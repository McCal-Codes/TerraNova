import { useCallback, useEffect, useRef } from "react";
import { open, save } from "@tauri-apps/plugin-dialog";
import { useProjectStore } from "@/stores/projectStore";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import {
  saveAssetPack,
  readAssetFile,
  readAssetFileText,
  writeAssetFile,
  listDirectory,
  createFromTemplate,
  createBlankProject,
  createPackWizard,
  createDirectory,
  validateAssetPack,
} from "@/utils/ipc";
import type { DirectoryEntryData, PackWizardConfig } from "@/utils/ipc";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { graphToJson } from "@/utils/graphToJson";
import {
  isBiomeFile,
  isEnvironmentFile,
  isInstanceFile,
  isSettingsFile,
  isWeatherFile,
  normalizeImportWithMeta,
  normalizeExport,
  internalToHytaleBiome,
} from "@/utils/fileTypeDetection";
import type { ImportMetadata } from "@/utils/hytaleToInternal";
import { extractPreservedNodeEditorMetadata } from "@/utils/nodeEditorMetadata";
import { mergeImportGraph } from "@/utils/importAnnotations";
import { buildImportLayoutOptions } from "@/utils/importLayout";
import type { ImportLayoutMode, LayoutOffset } from "@/utils/applyHytaleImportLayout";
import { buildPropEntryFromSection, buildPropSectionGraph } from "@/utils/propSectionAssets";
import { sortPropSectionKeys } from "@/utils/propSectionKeys";
import {
  collectBiomeSectionNodeIds,
  discoverBiomeSectionKeys,
  sectionImportMetadata,
  splitImportMetadataBySection,
} from "@/utils/sectionAnnotationRouting";
import mapDirEntry from "@/utils/mapDirEntry";
import { getDirname, findServerRoot, isPathInProject } from "@/utils/pathUtils";
import { confirmOpenPackWithAlphaBackup } from "@/utils/openPackWithAlphaGuard";
import { openProjectAtPath } from "@/utils/openProjectAtPath";
import { useRecentProjectsStore } from "@/stores/recentProjectsStore";
import { useToastStore } from "@/stores/toastStore";
import { emit } from "@/stores/storeEvents";
import { loadPersistedHistory } from "@/stores/editorStore";
import type { BiomeConfig, BiomeSectionData, SectionHistoryEntry } from "@/stores/editorStore";
import { extractMaterialConfig } from "@/utils/materialResolver";
import { normalizeDensitySectionNodeTypes } from "@/utils/densitySectionNodes";
import { normalizeMaterialSectionNodeTypes } from "@/utils/materialSectionNodes";
import { sanitizeGraphNodesAndEdges } from "@/utils/sanitizeGraphNodes";
import { usePreviewStore } from "@/stores/previewStore";
import { strictJsonParse } from "@/utils/safeLocalStorage";
import { resolveBiomeAtmosphere } from "@/utils/resolveBiomeAtmosphere";
import { blockInvalidJsonWrite } from "@/utils/invalidJsonReadOnly";
import {
  discoverContentFieldsForBiome,
  inferBiomeNameFromFile,
  computeTerrainAutoFitYBounds,
} from "@/utils/terrainPreviewLevel";
import { discoverBiomeContentFieldsIpc } from "@/utils/previewBoundsIpc";
import { shouldBypassFileCacheForHytaleLayout } from "@/utils/layoutCachePolicy";

function resolveFileImportLayoutMode(sectionModes: ImportLayoutMode[]): ImportLayoutMode | null {
  if (sectionModes.some((mode) => mode === "hytale")) return "hytale";
  if (sectionModes.some((mode) => mode === "autolayout")) return "autolayout";
  if (sectionModes.length > 0) return "placeholder";
  return null;
}

/** Drop invalid React Flow nodes/edges from every biome section before save/export. */
function sanitizeBiomeSections(
  sections: Record<string, BiomeSectionData>,
): Record<string, BiomeSectionData> {
  const sanitized: Record<string, BiomeSectionData> = {};
  for (const [key, section] of Object.entries(sections)) {
    const { nodes, edges } = sanitizeGraphNodesAndEdges(section.nodes, section.edges);
    sanitized[key] = nodes === section.nodes && edges === section.edges
      ? section
      : { ...section, nodes, edges };
  }
  return sanitized;
}

function enterInvalidJsonReadOnly(filePath: string, rawText: string, error: string) {
  useEditorStore.setState({
    nodes: [],
    edges: [],
    selectedNodeId: null,
    outputNodeId: null,
    biomeSections: null,
    activeBiomeSection: null,
    biomeConfig: null,
    biomeRanges: [],
    noiseRangeConfig: null,
    settingsConfig: null,
    instanceConfig: null,
    materialConfig: null,
    originalWrapper: null,
    preservedNodeEditorMetadata: null,
    importLayoutMode: null,
    hytaleLayoutOffsets: null,
    biomeCanvasMode: "tabs",
    rawJsonContent: null,
    jsonViewDraft: null,
    editingContext: "InvalidJson",
    invalidJsonFile: { path: filePath, rawText, error },
    history: [{
      nodes: [],
      edges: [],
      biomeRanges: [],
      noiseRangeConfig: null,
      biomeConfig: null,
      settingsConfig: null,
      label: "Initial",
    }],
    historyIndex: 0,
  });
}

/**
 * Extract biome sections from a biome wrapper file.
 * Returns sections map and flat config.
 */
async function extractBiomeSections(
  wrapper: Record<string, unknown>,
  fileImportMeta?: ImportMetadata | null,
): Promise<{
  sections: Record<string, BiomeSectionData>;
  config: BiomeConfig;
  sectionKeys: string[];
  importLayoutMode: ImportLayoutMode | null;
  hytaleLayoutOffsets: Record<string, LayoutOffset>;
}> {
  const sections: Record<string, BiomeSectionData> = {};
  const sectionKeys: string[] = [];
  const plannedSectionKeys = discoverBiomeSectionKeys(wrapper);
  const annotationSlices = fileImportMeta
    ? splitImportMetadataBySection(fileImportMeta, plannedSectionKeys, wrapper)
    : null;
  const sectionNodeIdsMap = collectBiomeSectionNodeIds(wrapper);
  const hytaleLayoutOffsets: Record<string, LayoutOffset> = {};
  const sectionLayoutModes: ImportLayoutMode[] = [];

  const layoutSection = async (
    nodes: import("@xyflow/react").Node[],
    edges: import("@xyflow/react").Edge[],
    sectionKey: string,
    propComment?: string,
  ) => {
    const meta = sectionImportMetadata(fileImportMeta, annotationSlices?.get(sectionKey));
    const sectionNodeIds = sectionNodeIdsMap[sectionKey];
    const layoutResult = await mergeImportGraph(
      nodes,
      edges,
      meta,
      {
        ...buildImportLayoutOptions(fileImportMeta, sectionNodeIds),
        autoFrame: {
          sectionKey,
          propComment,
          edges,
          sectionNodeIds,
        },
      },
    );
    hytaleLayoutOffsets[sectionKey] = layoutResult.layoutOffset;
    sectionLayoutModes.push(layoutResult.layoutMode);
    return layoutResult.nodes;
  };

  // Terrain → graph the Density subtree
  const terrain = wrapper.Terrain as Record<string, unknown> | undefined;
  if (terrain && typeof terrain === "object") {
    const density = terrain.Density;
    if (density && typeof density === "object" && "Type" in (density as Record<string, unknown>)) {
      const { nodes, edges } = jsonToGraph(density as Record<string, unknown>, 0, 0, "terrain");
      // Tag the last node (root) with _outputNode and _biomeField
      let terrainOutputId: string | null = null;
      if (nodes.length > 0) {
        const rootNode = nodes[nodes.length - 1];
        rootNode.data = { ...(rootNode.data as Record<string, unknown>), _outputNode: true, _biomeField: "Terrain" };
        terrainOutputId = rootNode.id;
      }
      const layoutedNodes = normalizeDensitySectionNodeTypes(await layoutSection(nodes, edges, "Terrain"));
      // layoutedNodes and edges are freshly created — no clone needed
      const terrainInitial: SectionHistoryEntry = { nodes: layoutedNodes, edges, outputNodeId: terrainOutputId, label: "Initial" };
      sections["Terrain"] = { nodes: layoutedNodes, edges, outputNodeId: terrainOutputId, history: [terrainInitial], historyIndex: 0 };
      sectionKeys.push("Terrain");
    }
  }

  // MaterialProvider → graph entire subtree
  const matProvider = wrapper.MaterialProvider;
  if (matProvider && typeof matProvider === "object" && "Type" in (matProvider as Record<string, unknown>)) {
    const { nodes, edges } = jsonToGraph(matProvider as Record<string, unknown>, 0, 0, "mat", "MaterialProvider");
    let matOutputId: string | null = null;
    if (nodes.length > 0) {
      const rootNode = nodes[nodes.length - 1];
      rootNode.data = { ...(rootNode.data as Record<string, unknown>), _outputNode: true };
      matOutputId = rootNode.id;
    }
    const layoutedNodes = await layoutSection(nodes, edges, "MaterialProvider");
    const normalizedNodes = normalizeMaterialSectionNodeTypes(layoutedNodes);
    // normalizedNodes and edges are freshly created — no clone needed
    const matInitial: SectionHistoryEntry = { nodes: normalizedNodes, edges, outputNodeId: matOutputId, label: "Initial" };
    sections["MaterialProvider"] = { nodes: normalizedNodes, edges, outputNodeId: matOutputId, history: [matInitial], historyIndex: 0 };
    sectionKeys.push("MaterialProvider");
  }

  // Props[] → graph PropDistribution or flat Positions + Assignments per entry
  const props = wrapper.Props;
  if (Array.isArray(props)) {
    for (let i = 0; i < props.length; i++) {
      const prop = props[i] as Record<string, unknown>;
      const { nodes, edges } = buildPropSectionGraph(prop, `prop_${i}`);
      const propComment = typeof prop.$Comment === "string" ? prop.$Comment : undefined;
      const layoutedNodes = await layoutSection(nodes, edges, `Props[${i}]`, propComment);
      const key = `Props[${i}]`;
      const propInitial: SectionHistoryEntry = { nodes: layoutedNodes, edges, outputNodeId: null, label: "Initial" };
      sections[key] = { nodes: layoutedNodes, edges, history: [propInitial], historyIndex: 0 };
      sectionKeys.push(key);
    }
  }

  // EnvironmentProvider -> graph entire subtree (atmosphere)
  const environmentProvider = wrapper.EnvironmentProvider;
  if (
    environmentProvider &&
    typeof environmentProvider === "object" &&
    "Type" in (environmentProvider as Record<string, unknown>)
  ) {
    const { nodes, edges } = jsonToGraph(
      environmentProvider as Record<string, unknown>,
      0,
      0,
      "env",
      "EnvironmentProvider",
    );
    let environmentOutputId: string | null = null;
    if (nodes.length > 0) {
      const rootNode = nodes[nodes.length - 1];
      rootNode.data = {
        ...(rootNode.data as Record<string, unknown>),
        _outputNode: true,
        _biomeField: "EnvironmentProvider",
      };
      environmentOutputId = rootNode.id;
    }
    const layoutedNodes = await layoutSection(nodes, edges, "EnvironmentProvider");
    const environmentInitial: SectionHistoryEntry = {
      nodes: layoutedNodes,
      edges,
      outputNodeId: environmentOutputId,
      label: "Initial",
    };
    sections["EnvironmentProvider"] = {
      nodes: layoutedNodes,
      edges,
      outputNodeId: environmentOutputId,
      history: [environmentInitial],
      historyIndex: 0,
    };
    sectionKeys.push("EnvironmentProvider");
  }

  // TintProvider -> graph entire subtree (biome tint bands)
  const tintProvider = wrapper.TintProvider;
  if (
    tintProvider &&
    typeof tintProvider === "object" &&
    "Type" in (tintProvider as Record<string, unknown>)
  ) {
    const { nodes, edges } = jsonToGraph(
      tintProvider as Record<string, unknown>,
      0,
      0,
      "tint",
      "TintProvider",
    );
    let tintOutputId: string | null = null;
    if (nodes.length > 0) {
      const rootNode = nodes[nodes.length - 1];
      rootNode.data = {
        ...(rootNode.data as Record<string, unknown>),
        _outputNode: true,
        _biomeField: "TintProvider",
      };
      tintOutputId = rootNode.id;
    }
    const layoutedNodes = await layoutSection(nodes, edges, "TintProvider");
    const tintInitial: SectionHistoryEntry = {
      nodes: layoutedNodes,
      edges,
      outputNodeId: tintOutputId,
      label: "Initial",
    };
    sections["TintProvider"] = {
      nodes: layoutedNodes,
      edges,
      outputNodeId: tintOutputId,
      history: [tintInitial],
      historyIndex: 0,
    };
    sectionKeys.push("TintProvider");
  }

  // Extract flat config
  const config: BiomeConfig = {
    Name: (wrapper.Name as string) ?? "",
    EnvironmentProvider: (wrapper.EnvironmentProvider as Record<string, unknown>) ?? {},
    TintProvider: (wrapper.TintProvider as Record<string, unknown>) ?? {},
    // Left undefined when absent rather than defaulted — the preview needs to
    // be able to tell "no MapColor" apart from a colour someone chose.
    MapColor: typeof wrapper.MapColor === "string" ? wrapper.MapColor : undefined,
    propMeta: Array.isArray(props)
      ? (props as Record<string, unknown>[]).map((p) => ({
          Runtime: (p.Runtime as number) ?? 0,
          Skip: (p.Skip as boolean) ?? false,
        }))
      : [],
  };

  return {
    sections,
    config,
    sectionKeys,
    importLayoutMode: resolveFileImportLayoutMode(sectionLayoutModes),
    hytaleLayoutOffsets,
  };
}

/**
 * Wrappers around Tauri IPC commands for file I/O operations.
 */
export function useTauriIO() {
  const setProjectPath = useProjectStore((s) => s.setProjectPath);
  const setDirectoryTree = useProjectStore((s) => s.setDirectoryTree);
  const setCurrentFile = useProjectStore((s) => s.setCurrentFile);
  const setDirty = useProjectStore((s) => s.setDirty);

  const markFileSaved = useCallback(
    (path: string) => {
      setDirty(false);
      emit("project:file-saved", { path });
    },
    [setDirty],
  );
  const setLastError = useProjectStore((s) => s.setLastError);
  const setNodes = useEditorStore((s) => s.setNodes);
  const setEdges = useEditorStore((s) => s.setEdges);
  const commitState = useEditorStore((s) => s.commitState);
  const cacheCurrentFile = useEditorStore((s) => s.cacheCurrentFile);
  const restoreFromCache = useEditorStore((s) => s.restoreFromCache);

  const handleOpenAssetPack = useCallback(async () => {
    setLastError(null);
    try {
      const selected = (await open({ directory: true })) as string | null;
      if (!selected) return;

      const path = selected;
      const ok = await confirmOpenPackWithAlphaBackup(path);
      if (!ok) return;

      await openProjectAtPath(path);
    } catch (err) {
      setLastError(`Failed to open asset pack: ${err}`);
    }
  }, [setLastError]);

  const handleSaveAssetPack = useCallback(async () => {
    setLastError(null);
    try {
      const projectPath = useProjectStore.getState().projectPath;
      if (!projectPath) return;

      const pack = { path: projectPath, assets: {} };
      await saveAssetPack(pack);
      setDirty(false);
    } catch (err) {
      setLastError(`Failed to save asset pack: ${err}`);
    }
  }, [setDirty, setLastError]);

  const handleOpenFile = useCallback(
    async (filePath: string) => {
      setLastError(null);

      // If there is no open project (or the file is outside the current project),
      // treat the file's parent folder (or inferred Hytale Server root) as the project root.
      const currentProjectPath = useProjectStore.getState().projectPath;
      const insideCurrentProject = isPathInProject(filePath, currentProjectPath);
      if (!insideCurrentProject) {
        const inferredRoot = findServerRoot(filePath) ?? getDirname(filePath);
        if (inferredRoot && inferredRoot !== currentProjectPath) {
          setProjectPath(inferredRoot);
          try {
            const entries = await listDirectory(inferredRoot);
            setDirectoryTree(entries.map(mapDirEntry));
          } catch {
            // Ignore failures (e.g. invalid directory) and proceed with opening the file.
          }
        }
      }

      try {
        const rawText = await readAssetFileText(filePath);
        const parsedFile = strictJsonParse<unknown>(rawText);

        // Cache the current file's graph before switching. Invalid JSON files
        // are read-only views and should always be re-read from disk.
        const previousFile = useProjectStore.getState().currentFile;
        const wasDirty = useProjectStore.getState().isDirty;
        const previousEditingContext = useEditorStore.getState().editingContext;
        if (previousFile && previousEditingContext !== "InvalidJson") {
          cacheCurrentFile(previousFile, wasDirty);
        }

        setCurrentFile(filePath);

        // Load per-file bookmarks (scoped to current project); biome section
        // will be overridden later for biome files once the first section is known.
        const projectPath = useProjectStore.getState().projectPath ?? "";
        useUIStore.getState().reloadBookmarks(filePath, projectPath, "");

        if (!parsedFile.ok) {
          const { fileCache } = useEditorStore.getState();
          const newCache = new Map(fileCache);
          newCache.delete(filePath);
          useEditorStore.setState({ fileCache: newCache });
          enterInvalidJsonReadOnly(filePath, rawText, `Invalid JSON: ${parsedFile.error}`);
          setDirty(false);
          return;
        }

        useEditorStore.getState().setInvalidJsonFile(null);

        const rawContent = parsedFile.value as Record<string, unknown>;
        let importMetaPreview: ImportMetadata | null = null;
        if (rawContent && typeof rawContent === "object") {
          const { metadata } = normalizeImportWithMeta(rawContent);
          importMetaPreview = metadata;
        }

        // Try restoring from cache first (cache includes editingContext + originalWrapper)
        const peekedCache = useEditorStore.getState().fileCache.get(filePath);
        const bypassLayoutCache = shouldBypassFileCacheForHytaleLayout(
          rawContent,
          filePath,
          importMetaPreview,
          peekedCache,
        );
        const cached = bypassLayoutCache ? false : restoreFromCache(filePath);
        if (bypassLayoutCache && peekedCache) {
          const { fileCache } = useEditorStore.getState();
          const newCache = new Map(fileCache);
          newCache.delete(filePath);
          useEditorStore.setState({ fileCache: newCache });
        }
        if (cached) {
          // Override bookmarks with cached biome section (if any)
          useUIStore.getState().reloadBookmarks(filePath, projectPath, cached.activeBiomeSection ?? "");
          if (cached.editingContext === "Biome" && cached.biomeConfig) {
            void resolveBiomeAtmosphere({
              biomeConfig: cached.biomeConfig,
              biomeFilePath: filePath,
              projectPath,
            }).then((resolved) => {
              usePreviewStore.getState().setAtmosphereSettings(resolved.settings);
            }).catch((err: unknown) => {
              // Keep last preview atmosphere on resolver failure.
              console.warn("[TerraNova] Atmosphere resolver failed:", err);
            });
          }
          setDirty(cached.isDirty);
          return;
        }

        // No cache — infer editing context from file path for fresh loads
        const pathLower = filePath.toLowerCase();
        if (pathLower.includes("/density/") || pathLower.includes("\\density\\")) {
          useEditorStore.getState().setEditingContext("Density");
        } else if (pathLower.includes("/curves/") || pathLower.includes("\\curves\\")) {
          useEditorStore.getState().setEditingContext("Curve");
        } else if (pathLower.includes("/materials/") || pathLower.includes("\\materials\\")) {
          useEditorStore.getState().setEditingContext("MaterialProvider");
        } else if (pathLower.includes("/server/environments/") || pathLower.includes("\\server\\environments\\")) {
          useEditorStore.getState().setEditingContext("Environment");
        } else if (pathLower.includes("/server/weathers/") || pathLower.includes("\\server\\weathers\\")) {
          useEditorStore.getState().setEditingContext("Weather");
        } else if (pathLower.includes("/patterns/") || pathLower.includes("\\patterns\\")) {
          useEditorStore.getState().setEditingContext("Pattern");
        } else if (pathLower.includes("/positions/") || pathLower.includes("\\positions\\")) {
          useEditorStore.getState().setEditingContext("PositionProvider");
        } else if (pathLower.includes("/props/") || pathLower.includes("\\props\\")) {
          useEditorStore.getState().setEditingContext("Prop");
        } else if (pathLower.includes("/scanners/") || pathLower.includes("\\scanners\\")) {
          useEditorStore.getState().setEditingContext("Scanner");
        } else if (pathLower.includes("/settings/") || pathLower.includes("\\settings\\")) {
          useEditorStore.getState().setEditingContext("Settings");
        } else {
          useEditorStore.getState().setEditingContext(null);
        }

        // Read from disk (fresh file is not dirty)
        setDirty(false);
        let content: unknown = rawContent;
        let importMeta: ImportMetadata | null = null;
        if (rawContent && typeof rawContent === "object") {
          const normalized = normalizeImportWithMeta(rawContent);
          content = normalized.content;
          importMeta = normalized.metadata;
          useEditorStore.getState().setPreservedNodeEditorMetadata(
            extractPreservedNodeEditorMetadata(importMeta?.nodeEditorMetadata),
          );
        }

        if (content && typeof content === "object" && isEnvironmentFile(content as Record<string, unknown>, filePath)) {
          useEditorStore.getState().setPreservedNodeEditorMetadata(null);
          useEditorStore.setState({
            nodes: [],
            edges: [],
            selectedNodeId: null,
            outputNodeId: null,
            biomeSections: null,
            activeBiomeSection: null,
            biomeConfig: null,
            biomeRanges: [],
            noiseRangeConfig: null,
            settingsConfig: null,
            materialConfig: null,
            editingContext: "Environment",
            rawJsonContent: content as Record<string, unknown>,
            originalWrapper: content as Record<string, unknown>,
            history: [{ nodes: [], edges: [], biomeRanges: [], noiseRangeConfig: null, biomeConfig: null, settingsConfig: null, label: "Initial" }],
            historyIndex: 0,
          });
          return;
        }

        if (content && typeof content === "object" && isWeatherFile(content as Record<string, unknown>, filePath)) {
          useEditorStore.getState().setPreservedNodeEditorMetadata(null);
          useEditorStore.setState({
            nodes: [],
            edges: [],
            selectedNodeId: null,
            outputNodeId: null,
            biomeSections: null,
            activeBiomeSection: null,
            biomeConfig: null,
            biomeRanges: [],
            noiseRangeConfig: null,
            settingsConfig: null,
            materialConfig: null,
            editingContext: "Weather",
            rawJsonContent: content as Record<string, unknown>,
            originalWrapper: content as Record<string, unknown>,
            history: [{ nodes: [], edges: [], biomeRanges: [], noiseRangeConfig: null, biomeConfig: null, settingsConfig: null, label: "Initial" }],
            historyIndex: 0,
          });
          return;
        }

        // Convert JSON to graph nodes
        if (content && typeof content === "object" && "Type" in (content as Record<string, unknown>)) {
          const typed = content as Record<string, unknown>;

          // NoiseRange files get special handling: extract Biomes + config, graph the Density subtree
          if (typed.Type === "NoiseRange") {
            const store = useEditorStore.getState();

            // Extract biome ranges
            const biomes = Array.isArray(typed.Biomes) ? typed.Biomes as { Biome: string; Min: number; Max: number }[] : [];
            store.setBiomeRanges(biomes.map((b) => ({ Biome: b.Biome, Min: b.Min, Max: b.Max })));

            // Extract config
            store.setNoiseRangeConfig({
              DefaultBiome: (typed.DefaultBiome as string) ?? "",
              DefaultTransitionDistance: (typed.DefaultTransitionDistance as number) ?? 16,
              MaxBiomeEdgeDistance: (typed.MaxBiomeEdgeDistance as number) ?? 32,
            });

            // Graph the Density subtree (if present and typed)
            const density = typed.Density;
            if (density && typeof density === "object" && "Type" in (density as Record<string, unknown>)) {
              const { nodes: newNodes, edges: newEdges } = jsonToGraph(density as Record<string, unknown>);
              const layoutResult = await mergeImportGraph(newNodes, newEdges, importMeta, {
                ...buildImportLayoutOptions(importMeta),
                autoFrame: { sectionKey: "Density", edges: newEdges },
              });
              setNodes(layoutResult.nodes);
              useEditorStore.getState().setImportLayoutMode(layoutResult.layoutMode);
              useEditorStore.getState().setHytaleLayoutOffsets(null);
              setEdges(newEdges);
            } else {
              setNodes([]);
              setEdges([]);
            }

            store.setEditingContext("NoiseRange");
            store.setOriginalWrapper(typed);
            useUIStore.getState().setNoiseRangeSurface("placement");
            usePreviewStore.getState().setViewMode("graph");
            commitState("Initial");
            // Restore persisted history if available
            const persisted = loadPersistedHistory(projectPath, filePath);
            if (persisted?.g) {
              useEditorStore.setState({ history: persisted.g.h, historyIndex: persisted.g.i });
            }
          } else {
            const { nodes: newNodes, edges: newEdges } = jsonToGraph(typed);

            // Auto-layout for clean positioning instead of naive x-300 offsets
            const layoutResult = await mergeImportGraph(newNodes, newEdges, importMeta, {
              ...buildImportLayoutOptions(importMeta),
              autoFrame: { sectionKey: String(typed.Type ?? "Graph"), edges: newEdges },
            });
            setNodes(layoutResult.nodes);
            setEdges(newEdges);

            // Clear biome-specific state that may be left over from a previous biome file
            useEditorStore.setState({
              biomeSections: null,
              activeBiomeSection: null,
              biomeConfig: null,
              biomeRanges: [],
              noiseRangeConfig: null,
              importLayoutMode: layoutResult.layoutMode,
              hytaleLayoutOffsets: null,
              biomeCanvasMode: "tabs",
            });

            commitState("Initial");

            // Store original wrapper for round-trip preservation
            useEditorStore.getState().setOriginalWrapper(typed);

            // Restore persisted history if available
            const persistedStandalone = loadPersistedHistory(projectPath, filePath);
            if (persistedStandalone?.g) {
              useEditorStore.setState({ history: persistedStandalone.g.h, historyIndex: persistedStandalone.g.i });
            }
          }
        } else if (content && typeof content === "object" && isSettingsFile(content as Record<string, unknown>, filePath)) {
          // Settings file — flat config with no graph
          const raw = content as Record<string, unknown>;
          const store = useEditorStore.getState();
          store.setSettingsConfig({
            CustomConcurrency: (raw.CustomConcurrency as number) ?? -1,
            BufferCapacityFactor: (raw.BufferCapacityFactor as number) ?? 0.4,
            TargetViewDistance: (raw.TargetViewDistance as number) ?? 1024,
            TargetPlayerCount: (raw.TargetPlayerCount as number) ?? 8,
            StatsCheckpoints: Array.isArray(raw.StatsCheckpoints) ? raw.StatsCheckpoints as number[] : [],
          });
          store.setEditingContext("Settings");
          store.setOriginalWrapper(raw);
          setNodes([]);
          setEdges([]);
          // Ensure the right panel is visible so the user can edit settings
          useUIStore.getState().setRightPanelVisible(true);
          commitState("Initial");
          // Restore persisted history if available
          const persistedSettings = loadPersistedHistory(projectPath, filePath);
          if (persistedSettings?.g) {
            useEditorStore.setState({ history: persistedSettings.g.h, historyIndex: persistedSettings.g.i });
          }
        } else if (content && typeof content === "object" && isInstanceFile(content as Record<string, unknown>, filePath)) {
          // Instance file — parse into InstanceConfig
          const raw = content as Record<string, unknown>;
          const store = useEditorStore.getState();
          const worldGen = (raw.WorldGen ?? {}) as Record<string, unknown>;
          const spawnProvider = raw.SpawnProvider as Record<string, unknown> | undefined;
          const spawnPoint = (spawnProvider?.SpawnPoint ?? {}) as Record<string, unknown>;

          // Discover available WorldStructures from sibling directory
          let availableWorldStructures: string[] = [];
          try {
            const normalized = filePath.replace(/\\/g, "/");
            const parts = normalized.split("/");
            const serverIdx = parts.findIndex((p) => p.toLowerCase() === "server");
            if (serverIdx >= 0) {
              const wsDir = parts.slice(0, serverIdx + 1).join("/") + "/HytaleGenerator/WorldStructures";
              try {
                const wsEntries: DirectoryEntryData[] = await listDirectory(wsDir);
                availableWorldStructures = wsEntries
                  .filter((e) => !e.is_dir && !e.name.startsWith("._") && e.name.endsWith(".json"))
                  .map((e) => e.name.replace(/\.json$/, ""));
              } catch {
                // WorldStructures dir doesn't exist
              }
            }
          } catch {
            // Path parsing failed
          }

          store.setInstanceConfig({
            comment: (raw.$Comment as string) ?? "",
            gameMode: (raw.GameMode as string) ?? "Creative",
            gameplayConfig: (raw.GameplayConfig as string) ?? "Default",
            worldStructure: (worldGen.WorldStructure as string) ?? "",
            spawnEnabled: !!spawnProvider,
            spawnPoint: {
              X: (spawnPoint.X as number) ?? 0.5,
              Y: (spawnPoint.Y as number) ?? 80,
              Z: (spawnPoint.Z as number) ?? 0.5,
              Pitch: (spawnPoint.Pitch as number) ?? 0,
              Yaw: (spawnPoint.Yaw as number) ?? 180,
              Roll: (spawnPoint.Roll as number) ?? 0,
            },
            toggles: {
              IsPvpEnabled: (raw.IsPvpEnabled as boolean) ?? false,
              IsSpawningNPC: (raw.IsSpawningNPC as boolean) ?? true,
              IsCompassUpdating: (raw.IsCompassUpdating as boolean) ?? true,
              IsTicking: (raw.IsTicking as boolean) ?? true,
              IsGameTimePaused: (raw.IsGameTimePaused as boolean) ?? false,
              IsObjectiveMarkersEnabled: (raw.IsObjectiveMarkersEnabled as boolean) ?? true,
              IsAllNPCFrozen: (raw.IsAllNPCFrozen as boolean) ?? false,
              IsSavingPlayers: (raw.IsSavingPlayers as boolean) ?? true,
              IsSpawnMarkersEnabled: (raw.IsSpawnMarkersEnabled as boolean) ?? true,
              DeleteOnRemove: (raw.DeleteOnRemove as boolean) ?? false,
            },
            availableWorldStructures,
          });
          store.setEditingContext("Instance");
          store.setOriginalWrapper(raw);
          setNodes([]);
          setEdges([]);
          commitState("Initial");
        } else if (content && typeof content === "object" && isBiomeFile(content as Record<string, unknown>, filePath)) {
          // Biome wrapper file — extract all sections
          const wrapper = content as Record<string, unknown>;
          const { sections, config, sectionKeys, importLayoutMode, hytaleLayoutOffsets } = await extractBiomeSections(wrapper, importMeta);

          // Load ContentFields from sibling WorldStructures (Y-based Hytale schema)
          const biomeName = inferBiomeNameFromFile(wrapper, filePath);
          let contentFields: Record<string, number> | undefined;
          try {
            const ipcFields = await discoverBiomeContentFieldsIpc(filePath, biomeName);
            if (ipcFields && Object.keys(ipcFields.fields).length > 0) {
              contentFields = ipcFields.fields;
            } else {
              contentFields = await discoverContentFieldsForBiome(
                filePath,
                biomeName,
                readAssetFile,
                listDirectory,
              );
            }
          } catch {
            // WorldStructure not found — keep store defaults
          }

          // Extract material config from MaterialProvider for voxel preview
          const matConfig = extractMaterialConfig(wrapper);

          // Load first section into canvas
          const firstKey = sectionKeys[0] ?? null;
          let firstSection = firstKey ? sections[firstKey] : null;
          if (firstSection && firstKey === "Terrain") {
            const normalizedNodes = normalizeDensitySectionNodeTypes(firstSection.nodes);
            if (normalizedNodes !== firstSection.nodes) {
              firstSection = { ...firstSection, nodes: normalizedNodes };
              sections.Terrain = firstSection;
            }
          }

          // Atomic state update — sets ALL biome state at once to avoid race conditions.
          // Sections already have their initial history entry from extractBiomeSections(),
          // so no additional commitState() call is needed.
          useEditorStore.setState({
            biomeConfig: config,
            biomeSections: sections,
            activeBiomeSection: firstKey,
            nodes: firstSection ? firstSection.nodes : [],
            edges: firstSection ? firstSection.edges : [],
            outputNodeId: firstSection?.outputNodeId ?? null,
            editingContext: "Biome",
            originalWrapper: wrapper,
            materialConfig: matConfig,
            importLayoutMode,
            hytaleLayoutOffsets,
            biomeCanvasMode: "tabs",
            ...(contentFields ? { contentFields } : {}),
          });
          if (importLayoutMode === "hytale") {
            useToastStore.getState().addToast(
              "Applied Hytale editor layout from file metadata",
              "info",
            );
          }
          // Reload bookmarks scoped to the initial biome section
          useUIStore.getState().reloadBookmarks(filePath, projectPath, firstKey ?? "");

          // Restore persisted section histories if available (skip stale undo stacks)
          const persistedBiome = loadPersistedHistory(projectPath, filePath);
          if (persistedBiome?.s && importLayoutMode !== "hytale") {
            const updatedSections = { ...sections };
            for (const [key, data] of Object.entries(persistedBiome.s)) {
              if (updatedSections[key]) {
                updatedSections[key] = { ...updatedSections[key], history: data.h, historyIndex: data.i };
              }
            }
            useEditorStore.setState({ biomeSections: updatedSections });
          }

          void resolveBiomeAtmosphere({
            biomeConfig: config,
            biomeFilePath: filePath,
            projectPath,
          }).then((resolved) => {
            usePreviewStore.getState().setAtmosphereSettings(resolved.settings);
          }).catch(() => {
            // Keep last preview atmosphere on resolver failure.
          });

          // Seed voxel preview Y range from WorldStructure base height + terrain graph
          const terrainSection = sections.Terrain ?? firstSection;
          if (terrainSection) {
            const fields = contentFields ?? useEditorStore.getState().contentFields;
            const terrainAutoFit = computeTerrainAutoFitYBounds(
              terrainSection.nodes,
              terrainSection.edges,
              fields,
              {
                useBaseY: usePreviewStore.getState().terrainRefUseBaseY,
                rootNodeId: terrainSection.outputNodeId ?? undefined,
              },
            );
            if (terrainAutoFit) {
              const preview = usePreviewStore.getState();
              if (!preview._userManualYAdjust) {
                preview.setVoxelYMin(terrainAutoFit.worldYMin);
                preview.setVoxelYMax(terrainAutoFit.worldYMax);
                preview.setYLevel(terrainAutoFit.yLevel);
                preview._setAutoFitGraphHash("");
              }
            }
          }
        } else if (content && typeof content === "object") {
          // Non-typed wrapper file (e.g., Biome with nested typed assets)
          // Try to find a typed subtree to edit
          const wrapper = content as Record<string, unknown>;
          let foundTypedAsset = false;

          for (const [, val] of Object.entries(wrapper)) {
            if (val && typeof val === "object" && "Type" in (val as Record<string, unknown>)) {
              const { nodes: newNodes, edges: newEdges } = jsonToGraph(val as Record<string, unknown>);
              const assetType = String((val as Record<string, unknown>).Type ?? "Graph");
              const layoutResult = await mergeImportGraph(newNodes, newEdges, importMeta, {
                ...buildImportLayoutOptions(importMeta),
                autoFrame: { sectionKey: assetType, edges: newEdges },
              });
              setNodes(layoutResult.nodes);
              setEdges(newEdges);
              useEditorStore.getState().setImportLayoutMode(layoutResult.layoutMode);
              useEditorStore.getState().setHytaleLayoutOffsets(null);
              commitState("Initial");
              useEditorStore.getState().setOriginalWrapper(wrapper);
              // Restore persisted history if available
              const persistedWrapper = loadPersistedHistory(projectPath, filePath);
              if (persistedWrapper?.g) {
                useEditorStore.setState({ history: persistedWrapper.g.h, historyIndex: persistedWrapper.g.i });
              }
              foundTypedAsset = true;
              break;
            }
          }

          if (!foundTypedAsset) {
            const store = useEditorStore.getState();
            // Safety net: if path detection already flagged Settings, load as settings with defaults
            if (store.editingContext === "Settings") {
              const raw = wrapper;
              store.setSettingsConfig({
                CustomConcurrency: (raw.CustomConcurrency as number) ?? -1,
                BufferCapacityFactor: (raw.BufferCapacityFactor as number) ?? 0.4,
                TargetViewDistance: (raw.TargetViewDistance as number) ?? 1024,
                TargetPlayerCount: (raw.TargetPlayerCount as number) ?? 8,
                StatsCheckpoints: Array.isArray(raw.StatsCheckpoints) ? raw.StatsCheckpoints as number[] : [],
              });
              store.setOriginalWrapper(raw);
              setNodes([]);
              setEdges([]);
              commitState("Initial");
            } else {
              // RawJson fallback — show the file as read-only JSON
              store.setEditingContext("RawJson");
              store.setRawJsonContent(wrapper);
              store.setOriginalWrapper(null);
              store.setPreservedNodeEditorMetadata(null);
              setNodes([]);
              setEdges([]);
            }
          }
        } else {
          setNodes([]);
          setEdges([]);
          useEditorStore.getState().setOriginalWrapper(null);
          useEditorStore.getState().setPreservedNodeEditorMetadata(null);
        }
      } catch (err) {
        setLastError(`Failed to open file: ${err}`);
      }
    },
    [setCurrentFile, setNodes, setEdges, commitState, setLastError, setDirty, cacheCurrentFile, restoreFromCache, setProjectPath, setDirectoryTree],
  );

  const handleSaveFile = useCallback(async () => {
    if (blockInvalidJsonWrite()) return;
    setLastError(null);
    try {
      const currentFile = useProjectStore.getState().currentFile;
      if (!currentFile) return;

      // JSON view mode: save the raw JSON draft directly to disk
      const viewMode = usePreviewStore.getState().viewMode;
      if (viewMode === "json") {
        const jsonDraft = useEditorStore.getState().jsonViewDraft;
        if (jsonDraft && currentFile) {
          try {
            const parsed = strictJsonParse<unknown>(jsonDraft);
            if (!parsed.ok) throw new Error(parsed.error);
            await writeAssetFile(currentFile, parsed.value);
            markFileSaved(currentFile);
          } catch {
            setLastError("Cannot save: invalid JSON");
          }
        }
        return;
      }

      const { nodes, edges, originalWrapper, biomeRanges, noiseRangeConfig, preservedNodeEditorMetadata } =
        useEditorStore.getState();

      // NoiseRange files: reassemble the full structure
      if (originalWrapper?.Type === "NoiseRange") {
        const output = { ...originalWrapper } as Record<string, unknown>;
        output.Biomes = biomeRanges.map((r) => ({ Biome: r.Biome, Min: r.Min, Max: r.Max }));
        if (noiseRangeConfig) {
          output.DefaultBiome = noiseRangeConfig.DefaultBiome;
          output.DefaultTransitionDistance = noiseRangeConfig.DefaultTransitionDistance;
          output.MaxBiomeEdgeDistance = noiseRangeConfig.MaxBiomeEdgeDistance;
        }
        const densityJson = graphToJson(nodes, edges);
        if (densityJson) output.Density = densityJson;
        const hytaleOutput = normalizeExport(output, nodes, preservedNodeEditorMetadata);
        await writeAssetFile(currentFile, hytaleOutput);
        markFileSaved(currentFile);
        return;
      }

      // Settings files: flat JSON output (no graph, no Hytale translation)
      const { settingsConfig, editingContext, rawJsonContent } = useEditorStore.getState();
      if ((editingContext === "Weather" || editingContext === "Environment") && rawJsonContent) {
        await writeAssetFile(currentFile, rawJsonContent);
        markFileSaved(currentFile);
        return;
      }

      if (editingContext === "Settings" && settingsConfig && originalWrapper) {
        const output: Record<string, unknown> = { ...originalWrapper };
        output.CustomConcurrency = settingsConfig.CustomConcurrency;
        output.BufferCapacityFactor = settingsConfig.BufferCapacityFactor;
        output.TargetViewDistance = settingsConfig.TargetViewDistance;
        output.TargetPlayerCount = settingsConfig.TargetPlayerCount;
        output.StatsCheckpoints = settingsConfig.StatsCheckpoints;
        await writeAssetFile(currentFile, output);
        markFileSaved(currentFile);
        return;
      }

      // Instance files: reassemble from InstanceConfig
      const { instanceConfig } = useEditorStore.getState();
      if (editingContext === "Instance" && instanceConfig && originalWrapper) {
        const output: Record<string, unknown> = { ...originalWrapper };
        output.$Comment = instanceConfig.comment;
        output.RequiredPlugins = originalWrapper.RequiredPlugins ?? {};
        output.ChunkStorage = originalWrapper.ChunkStorage ?? { Type: "Hytale" };
        output.GameMode = instanceConfig.gameMode;
        output.IsPvpEnabled = instanceConfig.toggles.IsPvpEnabled;
        output.IsSpawningNPC = instanceConfig.toggles.IsSpawningNPC;
        output.GameTime = originalWrapper.GameTime ?? "0001-01-01T07:00:00Z";
        output.UUID = originalWrapper.UUID ?? {
          $binary: "AZKxiVAMQfWIS0qBsBfjzQ==",
          $type: "04",
        };
        output.GameplayConfig = instanceConfig.gameplayConfig;
        output.IsCompassUpdating = instanceConfig.toggles.IsCompassUpdating;
        output.IsTicking = instanceConfig.toggles.IsTicking;
        output.IsGameTimePaused = instanceConfig.toggles.IsGameTimePaused;
        output.IsObjectiveMarkersEnabled = instanceConfig.toggles.IsObjectiveMarkersEnabled;
        output.IsAllNPCFrozen = instanceConfig.toggles.IsAllNPCFrozen;
        output.IsSavingPlayers = instanceConfig.toggles.IsSavingPlayers;
        output.WorldGen = {
          Type: "HytaleGenerator",
          WorldStructure: instanceConfig.worldStructure,
        };
        if (instanceConfig.spawnEnabled) {
          output.SpawnProvider = {
            Id: "Global",
            SpawnPoint: { ...instanceConfig.spawnPoint },
          };
        } else {
          delete output.SpawnProvider;
        }
        output.IsSpawnMarkersEnabled = instanceConfig.toggles.IsSpawnMarkersEnabled;
        output.DeleteOnRemove = instanceConfig.toggles.DeleteOnRemove;
        output.Version = originalWrapper.Version ?? 2;
        await writeAssetFile(currentFile, output);
        markFileSaved(currentFile);
        useToastStore.getState().addToast("Instance saved", "success");
        return;
      }

      // RawJson files — save rawJsonContent directly to disk
      if (editingContext === "RawJson") {
        const rawContent = useEditorStore.getState().rawJsonContent;
        if (rawContent && currentFile) {
          await writeAssetFile(currentFile, rawContent);
          markFileSaved(currentFile);
        }
        return;
      }

      // Biome files: reassemble the full structure from sections
      const { biomeConfig, biomeSections, activeBiomeSection } = useEditorStore.getState();
      if (editingContext === "Biome" && originalWrapper && biomeConfig && biomeSections) {
        // Save current section's graph state first (preserve history)
        let updatedSections = { ...biomeSections };
        if (activeBiomeSection && updatedSections[activeBiomeSection]) {
          const sectionNodes =
            activeBiomeSection === "MaterialProvider"
              ? normalizeMaterialSectionNodeTypes(structuredClone(nodes))
              : structuredClone(nodes);
          updatedSections[activeBiomeSection] = {
            ...updatedSections[activeBiomeSection],
            nodes: sectionNodes,
            edges: structuredClone(edges),
            outputNodeId: useEditorStore.getState().outputNodeId ?? null,
          };
        }

        updatedSections = sanitizeBiomeSections(updatedSections);

        const output = { ...originalWrapper } as Record<string, unknown>;
        output.Name = biomeConfig.Name;

        // Rebuild Terrain.Density from Terrain section
        if (updatedSections["Terrain"]) {
          const terrainJson = graphToJson(updatedSections["Terrain"].nodes, updatedSections["Terrain"].edges);
          const origTerrain = (originalWrapper.Terrain ?? {}) as Record<string, unknown>;
          output.Terrain = { ...origTerrain, Density: terrainJson };
        }

        // Rebuild MaterialProvider from MaterialProvider section
        if (updatedSections["MaterialProvider"]) {
          const matNodes = normalizeMaterialSectionNodeTypes(updatedSections["MaterialProvider"].nodes);
          const matEdges = updatedSections["MaterialProvider"].edges;
          const matJson = graphToJson(matNodes, matEdges);
          if (matJson) output.MaterialProvider = matJson;
        }

        // Rebuild Props from Props[i] sections
        const propKeys = sortPropSectionKeys(
          Object.keys(updatedSections).filter((k) => k.startsWith("Props[")),
        );
        const props: Record<string, unknown>[] = [];
        for (let i = 0; i < propKeys.length; i++) {
          const section = updatedSections[propKeys[i]];
          const meta = biomeConfig.propMeta[i] ?? { Runtime: 0, Skip: false };
          props.push(buildPropEntryFromSection(section.nodes, section.edges, meta));
        }
        output.Props = props;

        // Rebuild EnvironmentProvider from section when present
        if (updatedSections["EnvironmentProvider"]) {
          const envJson = graphToJson(
            updatedSections["EnvironmentProvider"].nodes,
            updatedSections["EnvironmentProvider"].edges,
          );
          output.EnvironmentProvider = envJson ?? biomeConfig.EnvironmentProvider;
        } else {
          output.EnvironmentProvider = biomeConfig.EnvironmentProvider;
        }

        // Rebuild TintProvider from section when present
        if (updatedSections["TintProvider"]) {
          const tintJson = graphToJson(
            updatedSections["TintProvider"].nodes,
            updatedSections["TintProvider"].edges,
          );
          output.TintProvider = tintJson ?? biomeConfig.TintProvider;
        } else {
          output.TintProvider = biomeConfig.TintProvider;
        }

        const { importLayoutMode, hytaleLayoutOffsets } = useEditorStore.getState();
        const hytaleOutput = internalToHytaleBiome(
          output,
          Object.fromEntries(
            Object.entries(updatedSections).map(([key, section]) => [key, section.nodes]),
          ),
          preservedNodeEditorMetadata,
          { importLayoutMode, hytaleLayoutOffsets },
        );
        await writeAssetFile(currentFile, hytaleOutput);
        markFileSaved(currentFile);
        return;
      }

      const json = graphToJson(nodes, edges);
      if (json) {
        if (originalWrapper) {
          if ("Type" in originalWrapper) {
            // Direct typed asset — convert to Hytale native format
            const hytaleJson = normalizeExport(json, nodes, preservedNodeEditorMetadata);
            await writeAssetFile(currentFile, hytaleJson);
          } else {
            // Non-typed wrapper (e.g. Biome) — inject rebuilt asset into the correct sub-property
            const output = { ...originalWrapper };
            let replaced = false;
            for (const [key, val] of Object.entries(output)) {
              if (val && typeof val === "object" && "Type" in (val as Record<string, unknown>)) {
                output[key] = normalizeExport(json, nodes, preservedNodeEditorMetadata);
                replaced = true;
                break;
              }
            }
            const finalOutput = replaced
              ? output
              : normalizeExport(json, nodes, preservedNodeEditorMetadata);
            await writeAssetFile(currentFile, finalOutput);
          }
        } else {
          const hytaleJson = normalizeExport(json, nodes, preservedNodeEditorMetadata);
          await writeAssetFile(currentFile, hytaleJson);
        }
        markFileSaved(currentFile);
      }
    } catch (err) {
      setLastError(`Failed to save file: ${err}`);
    }
  }, [markFileSaved, setLastError]);

  const handleSaveFileAs = useCallback(async () => {
    if (blockInvalidJsonWrite()) return;
    setLastError(null);
    try {
      const filePath = await save({
        filters: [{ name: "JSON / BSON", extensions: ["json", "bson"] }],
      });
      if (!filePath) return;

      // Use serializeCurrentFile() which handles all file types correctly
      // (biome sections, NoiseRange config, settings, etc.)
      const { serializeCurrentFile } = await import("@/utils/exportAssetPack");
      const json = serializeCurrentFile();
      if (json) {
        await writeAssetFile(filePath, json);
        setCurrentFile(filePath);
        markFileSaved(filePath);
      }
    } catch (err) {
      setLastError(`Failed to save file: ${err}`);
    }
  }, [setCurrentFile, markFileSaved, setLastError]);

  const handleCreatePackWizard = useCallback(
    async (config: PackWizardConfig & { targetPath: string }) => {
      setLastError(null);
      try {
        const prevProjectPath = useProjectStore.getState().projectPath;
        const result = await createPackWizard(config);

        const { targetPath } = config;
        if (prevProjectPath !== targetPath) {
          useEditorStore.getState().reset();
          emit("project:close");
        }

        setProjectPath(targetPath);
        const entries = await listDirectory(targetPath);
        setDirectoryTree(entries.map(mapDirEntry));
        useRecentProjectsStore.getState().addProject(targetPath, "create-pack");

        try {
          const validation = await validateAssetPack(targetPath);
          if (validation.errors.length > 0) {
            useToastStore.getState().addToast(
              `Pack created with ${validation.errors.length} validation issue(s). Check the file tree.`,
              "warning",
            );
          }
        } catch {
          // validation is best-effort after wizard launch
        }

        await handleOpenFile(result.biomeFilePath);

        if (result.atmosphereImportFallback) {
          useToastStore.getState().addToast(
            "Could not import the selected Hytale environment — created custom Env + Weather files instead. Sync Hytale assets and try again if needed.",
            "warning",
          );
        }

        const envPath = result.environmentFilePath ?? null;
        if (envPath) {
          useToastStore.getState().addToast(
            "Atmosphere files are in your pack. Open the environment editor to tune sky and weather.",
            "info",
            {
              label: "Open environment",
              onClick: () => {
                void handleOpenFile(envPath);
              },
            },
          );
        }

        useToastStore.getState().addToast(
          "Pack created. Edit terrain, save, then Export Asset Pack when ready.",
          "success",
        );
      } catch (err) {
        setLastError(`Failed to create pack: ${err}`);
        throw err;
      }
    },
    [setProjectPath, setDirectoryTree, setLastError, handleOpenFile],
  );

  const handleCreateFromTemplate = useCallback(
    async (templateName: string, targetPath?: string) => {
      setLastError(null);
      try {
        let path = targetPath;
        if (!path) {
          const selected = (await open({ directory: true })) as string | null;
          if (!selected) return;
          path = selected;
        }

        if (templateName) {
          await createFromTemplate(templateName, path!);
        } else {
          await createBlankProject(path!);
        }
        setProjectPath(path!);

        const entries = await listDirectory(path!);
        setDirectoryTree(entries.map(mapDirEntry));
        useRecentProjectsStore.getState().addProject(path!, templateName);
      } catch (err) {
        setLastError(`Failed to create project: ${err}`);
        throw err;
      }
    },
    [setProjectPath, setDirectoryTree, setLastError],
  );

  const handleNewBiome = useCallback(async () => {
    setLastError(null);
    try {
      const projectPath = useProjectStore.getState().projectPath;
      if (!projectPath) return;
      const biomesDir = `${projectPath}/Server/HytaleGenerator/Biomes`;
      const filePath = await save({
        defaultPath: `${biomesDir}/NewBiome.json`,
        filters: [{ name: "JSON", extensions: ["json"] }],
      });
      if (!filePath) return;
      const name = filePath.replace(/\\/g, "/").split("/").pop()?.replace(/\.json$/, "") ?? "NewBiome";
      const biome = {
        Name: name,
        Terrain: {
          Type: "DAOTerrain",
          Density: { Type: "Constant", Value: 0.0 },
        },
        MaterialProvider: {
          Type: "Constant",
          Material: "stone",
        },
        Props: [],
        EnvironmentProvider: { Type: "Constant", Environment: "default" },
        TintProvider: { Type: "Constant", Color: "#7CFC00" },
      };
      await writeAssetFile(filePath, biome);
      // Refresh sidebar tree
      const entries = await listDirectory(projectPath);
      setDirectoryTree(entries.map(mapDirEntry));
      // Open the new file
      await handleOpenFile(filePath);
    } catch (err) {
      setLastError(`Failed to create biome: ${err}`);
    }
  }, [setLastError, setDirectoryTree, handleOpenFile]);

  const handleNewInstance = useCallback(async () => {
    setLastError(null);
    try {
      const projectPath = useProjectStore.getState().projectPath;
      if (!projectPath) return;
      const instancesDir = `${projectPath}/Server/Instances`;
      // User picks the folder name; the dialog "filename" is the folder name
      const folderPath = await save({
        defaultPath: `${instancesDir}/NewInstance`,
      });
      if (!folderPath) return;
      // Create the instance folder and write instance.bson inside it
      await createDirectory(folderPath);
      const filePath = `${folderPath}/instance.bson`;
      const instance = {
        $Comment: "New instance created by TerraNova",
        RequiredPlugins: {},
        ChunkStorage: { Type: "Hytale" },
        GameMode: "Creative",
        IsPvpEnabled: false,
        IsSpawningNPC: true,
        GameTime: "0001-01-01T07:00:00Z",
        UUID: {
          $binary: "AZKxiVAMQfWIS0qBsBfjzQ==",
          $type: "04",
        },
        GameplayConfig: "Default",
        IsCompassUpdating: true,
        IsTicking: true,
        IsGameTimePaused: false,
        IsObjectiveMarkersEnabled: true,
        IsAllNPCFrozen: false,
        IsSavingPlayers: true,
        WorldGen: {
          Type: "HytaleGenerator",
          WorldStructure: "MainWorld",
        },
        IsSpawnMarkersEnabled: true,
        DeleteOnRemove: false,
        Version: 2,
      };
      await writeAssetFile(filePath, instance);
      // Refresh sidebar tree
      const entries = await listDirectory(projectPath);
      setDirectoryTree(entries.map(mapDirEntry));
      // Open the new file
      await handleOpenFile(filePath);
    } catch (err) {
      setLastError(`Failed to create instance folder: ${err}`);
    }
  }, [setLastError, setDirectoryTree, handleOpenFile]);

  // Re-sync graph when leaving JSON view
  const viewMode = usePreviewStore((s) => s.viewMode);
  const prevViewModeRef = useRef(viewMode);
  useEffect(() => {
    if (prevViewModeRef.current === "json" && viewMode !== "json") {
      const currentFile = useProjectStore.getState().currentFile;
      if (currentFile) {
        // Clear cache so it re-parses from disk
        const { fileCache } = useEditorStore.getState();
        const newCache = new Map(fileCache);
        newCache.delete(currentFile);
        useEditorStore.setState({ fileCache: newCache });
        // Re-open the file to rebuild graph state
        handleOpenFile(currentFile);
      }
      // Clear the draft
      useEditorStore.getState().setJsonViewDraft(null);
    }
    prevViewModeRef.current = viewMode;
  }, [viewMode, handleOpenFile]);

  return {
    openAssetPack: handleOpenAssetPack,
    saveAssetPack: handleSaveAssetPack,
    openFile: handleOpenFile,
    saveFile: handleSaveFile,
    saveFileAs: handleSaveFileAs,
    createFromTemplate: handleCreateFromTemplate,
    createPackWizard: handleCreatePackWizard,
    newBiome: handleNewBiome,
    newInstance: handleNewInstance,
  };
}
