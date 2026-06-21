import { useCallback, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { Edge, Node } from "@xyflow/react";
import { CheckCircle2, AlertCircle, X } from "lucide-react";

import { PrefabPickerPanel } from "@/components/preview/PrefabPickerPanel";
import { PropPlacementGrid } from "@/components/properties/PropPlacementGrid";
import { usePrefabPathCatalog } from "@/hooks/usePrefabPathCatalog";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { hytaleToInternalBiome } from "@/utils/hytaleToInternal";
import { runHytaleAssetSync, formatHytaleSyncToast } from "@/utils/hytaleAssetSyncAction";
import { isTauriRuntime } from "@/utils/platform";
import { readAssetFile } from "@/utils/ipc";
import { buildPropSectionFromPrefabPath } from "@/utils/propSectionAssets";
import {
  buildPropSectionFromEntry,
  listHytaleBiomePropLayers,
  type HytaleBiomePropLayer,
} from "@/utils/propSources/hytaleBiomePropLayers";
import { listReferenceBiomeCatalog, type ReferenceBiomeCatalogEntry } from "@/utils/propSources/listReferenceBiomes";
import { listProjectBiomes, type ProjectBiomeEntry } from "@/utils/propSources/listProjectBiomes";
import { PropPrefabThumbnail } from "@/components/preview/PropPrefabThumbnail";
import {
  resolveBridgeWorldBiomeForProps,
  resolveBridgeWorldStructureName,
} from "@/utils/propSources/resolveBridgeWorldBiome";

export type PropSourceMode = "prefab" | "import" | "bridge" | "custom" | "blank";

export interface PropSourceConfirmPayload {
  nodes: Node[];
  edges: Edge[];
  meta: { Runtime: number; Skip: boolean };
}

interface NewPropSourceDialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  confirmLabel?: string;
  onConfirm: (payload: PropSourceConfirmPayload) => void;
}

export function NewPropSourceDialog({
  open,
  onClose,
  title = "New prop layer",
  confirmLabel = "Add prop layer",
  onConfirm,
}: NewPropSourceDialogProps) {
  const catalog = usePrefabPathCatalog(null);
  const addToast = useToastStore((s) => s.addToast);
  const hytaleAssetSyncEnabled = useSettingsStore((s) => s.hytaleAssetSyncEnabled);
  const hytaleReleaseAssetsPath = useSettingsStore((s) => s.hytaleReleaseAssetsPath);
  const hytaleCommonAssetsEnabled = useSettingsStore((s) => s.hytaleCommonAssetsEnabled);
  const hytaleCommonAssetsPath = useSettingsStore((s) => s.hytaleCommonAssetsPath);
  const discovery = useBridgeStore((s) => s.discovery);
  const serverModPath = useBridgeStore((s) => s.serverModPath);
  const instanceConfig = useEditorStore((s) => s.instanceConfig);
  const projectPath = useProjectStore((s) => s.projectPath);
  const currentFile = useProjectStore((s) => s.currentFile);

  const [mode, setMode] = useState<PropSourceMode>("prefab");
  const [prefabPath, setPrefabPath] = useState("");
  const [customPath, setCustomPath] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [importSourceTab, setImportSourceTab] = useState<"project" | "catalog">("project");
  const [biomeSearch, setBiomeSearch] = useState("");
  const [catalogEntries, setCatalogEntries] = useState<ReferenceBiomeCatalogEntry[]>([]);
  const [projectBiomes, setProjectBiomes] = useState<ProjectBiomeEntry[]>([]);
  const [projectBiomesLoading, setProjectBiomesLoading] = useState(false);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [selectedBiomePath, setSelectedBiomePath] = useState("");
  const [biomeLayers, setBiomeLayers] = useState<HytaleBiomePropLayer[]>([]);
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | null>(null);
  const [bridgeBiomePath, setBridgeBiomePath] = useState<string | null>(null);
  const [bridgeBiomeName, setBridgeBiomeName] = useState<string | null>(null);
  const [bridgeLayers, setBridgeLayers] = useState<HytaleBiomePropLayer[]>([]);
  const [bridgeLayerIndex, setBridgeLayerIndex] = useState<number | null>(null);
  const [bridgeLoading, setBridgeLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setMode("prefab");
    setPrefabPath("");
    setCustomPath("");
    setSelectedBiomePath("");
    setBiomeLayers([]);
    setSelectedLayerIndex(null);
    setBridgeLayerIndex(null);
    setBiomeSearch("");
    setImportSourceTab("project");
  }, [open]);

  useEffect(() => {
    if (!open || mode !== "import" || importSourceTab !== "catalog") return;
    let cancelled = false;
    setCatalogLoading(true);
    void listReferenceBiomeCatalog()
      .then((entries) => {
        if (!cancelled) setCatalogEntries(entries);
      })
      .catch(() => {
        if (!cancelled) addToast("Could not load reference biome catalog.", "error");
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, importSourceTab, addToast]);

  useEffect(() => {
    if (!open || mode !== "import" || importSourceTab !== "project") return;
    let cancelled = false;
    setProjectBiomesLoading(true);
    void listProjectBiomes(projectPath, currentFile)
      .then((entries) => {
        if (!cancelled) setProjectBiomes(entries);
      })
      .catch(() => {
        if (!cancelled) addToast("Could not list project biomes.", "error");
      })
      .finally(() => {
        if (!cancelled) setProjectBiomesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, importSourceTab, projectPath, currentFile, addToast]);

  useEffect(() => {
    if (!selectedBiomePath) {
      setBiomeLayers([]);
      setSelectedLayerIndex(null);
      return;
    }
    let cancelled = false;
    void readAssetFile(selectedBiomePath)
      .then((raw) => {
        if (cancelled) return;
        const wrapper = hytaleToInternalBiome(raw as Record<string, unknown>).wrapper;
        const layers = listHytaleBiomePropLayers(wrapper);
        setBiomeLayers(layers);
        setSelectedLayerIndex(layers.length > 0 ? 0 : null);
      })
      .catch(() => {
        if (!cancelled) addToast("Failed to read selected biome file.", "error");
      });
    return () => {
      cancelled = true;
    };
  }, [selectedBiomePath, addToast]);

  useEffect(() => {
    if (!open || mode !== "bridge") return;
    const modPath = discovery?.modPackPath ?? serverModPath;
    const wsName = resolveBridgeWorldStructureName({
      instanceWorldStructure: instanceConfig?.worldStructure,
      discovery,
    });
    if (!modPath || !wsName) {
      setBridgeBiomePath(null);
      setBridgeLayers([]);
      return;
    }
    let cancelled = false;
    setBridgeLoading(true);
    void resolveBridgeWorldBiomeForProps({ modPackPath: modPath, worldStructureName: wsName })
      .then(async (ref) => {
        if (cancelled || !ref) {
          if (!cancelled) {
            setBridgeBiomePath(null);
            setBridgeLayers([]);
          }
          return;
        }
        setBridgeBiomePath(ref.biomePath);
        setBridgeBiomeName(ref.biomeName);
        const raw = (await readAssetFile(ref.biomePath)) as Record<string, unknown>;
        if (cancelled) return;
        const wrapper = hytaleToInternalBiome(raw).wrapper;
        const layers = listHytaleBiomePropLayers(wrapper);
        setBridgeLayers(layers);
        setBridgeLayerIndex(layers.length > 0 ? 0 : null);
      })
      .catch(() => {
        if (!cancelled) {
          setBridgeBiomePath(null);
          setBridgeLayers([]);
        }
      })
      .finally(() => {
        if (!cancelled) setBridgeLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, mode, discovery, serverModPath, instanceConfig]);

  const groupedCatalog = useMemo(() => {
    const query = biomeSearch.trim().toLowerCase();
    const filtered = query
      ? catalogEntries.filter(
          (entry) =>
            entry.biomeName.toLowerCase().includes(query)
            || entry.group.toLowerCase().includes(query),
        )
      : catalogEntries;
    const groups = new Map<string, ReferenceBiomeCatalogEntry[]>();
    for (const entry of filtered) {
      const list = groups.get(entry.group) ?? [];
      list.push(entry);
      groups.set(entry.group, list);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [catalogEntries, biomeSearch]);

  const filteredProjectBiomes = useMemo(() => {
    const query = biomeSearch.trim().toLowerCase();
    if (!query) return projectBiomes;
    return projectBiomes.filter((entry) => entry.name.toLowerCase().includes(query));
  }, [projectBiomes, biomeSearch]);

  const previewLayer = useMemo(() => {
    if (mode === "import" && selectedLayerIndex !== null) {
      return biomeLayers[selectedLayerIndex] ?? null;
    }
    if (mode === "bridge" && bridgeLayerIndex !== null) {
      return bridgeLayers[bridgeLayerIndex] ?? null;
    }
    return null;
  }, [mode, selectedLayerIndex, biomeLayers, bridgeLayerIndex, bridgeLayers]);

  const previewGraph = useMemo(() => {
    if (!previewLayer) return null;
    return buildPropSectionFromEntry(previewLayer.rawPropEntry, "preview");
  }, [previewLayer]);

  const canConfirm = useMemo(() => {
    if (mode === "blank") return true;
    if (mode === "prefab") return prefabPath.trim().length > 0;
    if (mode === "custom") return customPath.trim().length > 0;
    if (mode === "import") return selectedLayerIndex !== null && biomeLayers.length > 0;
    if (mode === "bridge") return bridgeLayerIndex !== null && bridgeLayers.length > 0;
    return false;
  }, [mode, prefabPath, customPath, selectedLayerIndex, biomeLayers, bridgeLayerIndex, bridgeLayers]);

  const handleSync = useCallback(async () => {
    if (!hytaleAssetSyncEnabled) {
      addToast("Enable managed Hytale assets in Settings before syncing.", "warning");
      return;
    }
    if (!isTauriRuntime()) {
      addToast("Hytale asset sync is available in the TerraNova desktop app.", "warning");
      return;
    }
    try {
      setSyncing(true);
      const { result } = await runHytaleAssetSync({
        sourcePath: hytaleReleaseAssetsPath,
        commonOverlayEnabled: hytaleCommonAssetsEnabled,
        commonOverlayPath: hytaleCommonAssetsPath,
      });
      addToast(formatHytaleSyncToast(result), "success");
    } catch (err) {
      addToast(`Failed to sync Hytale assets: ${err}`, "error");
    } finally {
      setSyncing(false);
    }
  }, [
    addToast,
    hytaleAssetSyncEnabled,
    hytaleReleaseAssetsPath,
    hytaleCommonAssetsEnabled,
    hytaleCommonAssetsPath,
  ]);

  function buildPayload(): PropSourceConfirmPayload | null {
    if (mode === "blank") {
      return { nodes: [], edges: [], meta: { Runtime: 0, Skip: false } };
    }
    if (mode === "prefab" && prefabPath.trim()) {
      const graph = buildPropSectionFromPrefabPath(prefabPath.trim(), "newprop");
      return { nodes: graph.nodes, edges: graph.edges, meta: { Runtime: 0, Skip: false } };
    }
    if (mode === "custom" && customPath.trim()) {
      const graph = buildPropSectionFromPrefabPath(customPath.trim(), "newprop");
      return { nodes: graph.nodes, edges: graph.edges, meta: { Runtime: 0, Skip: false } };
    }
    if (mode === "import" && previewLayer) {
      const graph = buildPropSectionFromEntry(previewLayer.rawPropEntry, "newprop");
      return {
        nodes: graph.nodes,
        edges: graph.edges,
        meta: { Runtime: previewLayer.runtime, Skip: previewLayer.skip },
      };
    }
    if (mode === "bridge" && previewLayer) {
      const graph = buildPropSectionFromEntry(previewLayer.rawPropEntry, "newprop");
      return {
        nodes: graph.nodes,
        edges: graph.edges,
        meta: { Runtime: previewLayer.runtime, Skip: previewLayer.skip },
      };
    }
    return null;
  }

  function handleConfirm() {
    const payload = buildPayload();
    if (!payload) return;
    onConfirm(payload);
    onClose();
  }

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/65 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-tn-panel border border-tn-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-tn-border shrink-0">
          <h2 className="text-sm font-semibold text-tn-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded text-tn-text-muted hover:text-tn-text hover:bg-white/5"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-4 pt-3 shrink-0">
          <p className="text-xs text-tn-text-muted mb-2">
            Pick a Hytale prefab quick-start, import a prop layer from a reference biome, or start blank.
          </p>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                ["prefab", "Hytale prefab"],
                ["import", "Import from biome"],
                ["bridge", "Bridge world biome"],
                ["custom", "Custom path"],
                ["blank", "Blank graph"],
              ] as const
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setMode(key)}
                className={`px-2.5 py-1 text-[11px] rounded-full border transition-colors ${
                  mode === key
                    ? "border-tn-accent bg-tn-accent/15 text-tn-accent"
                    : "border-tn-border text-tn-text-muted hover:text-tn-text"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3">
          {mode === "prefab" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[280px]">
              <PrefabPickerPanel
                value={prefabPath}
                onChange={setPrefabPath}
                catalog={catalog}
                catalogLoading={catalog.loading}
                onRequestSync={() => void handleSync()}
                syncInProgress={syncing}
              />
              <div className="min-h-[200px]">
                {prefabPath.trim() ? (
                  <PropPrefabThumbnail fields={{ Path: prefabPath.trim() }} className="h-full min-h-[200px]" />
                ) : (
                  <p className="text-[11px] text-tn-text-muted p-2">Select a prefab to preview its mesh.</p>
                )}
              </div>
            </div>
          )}

          {mode === "custom" && (
            <div className="space-y-2">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] uppercase tracking-wide text-tn-text-muted">
                  Prefab path
                </span>
                <input
                  type="text"
                  value={customPath}
                  onChange={(e) => setCustomPath(e.target.value)}
                  placeholder="Trees/Palm_Green/Stage_2"
                  className="px-2 py-1.5 text-xs rounded border border-tn-border bg-tn-bg text-tn-text"
                />
              </label>
              <p className="text-[11px] text-tn-text-muted flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400/90" />
                Custom paths must match in-game prefab paths. Imported prop definitions use Import from biome.
              </p>
            </div>
          )}

          {mode === "import" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[280px]">
              <div className="space-y-2">
                <div className="flex gap-1">
                  {(
                    [
                      ["project", "This project"],
                      ["catalog", "Templates & release"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setImportSourceTab(key);
                        setSelectedBiomePath("");
                      }}
                      className={`px-2 py-1 text-[10px] rounded border ${
                        importSourceTab === key
                          ? "border-tn-accent bg-tn-accent/10 text-tn-accent"
                          : "border-tn-border text-tn-text-muted"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <input
                  type="search"
                  value={biomeSearch}
                  onChange={(e) => setBiomeSearch(e.target.value)}
                  placeholder="Search biomes…"
                  className="w-full px-2 py-1.5 text-xs rounded border border-tn-border bg-tn-bg text-tn-text"
                />

                <label className="flex flex-col gap-1">
                  <span className="text-[10px] uppercase tracking-wide text-tn-text-muted">
                    {importSourceTab === "project" ? "Project biome" : "Reference biome"}
                  </span>
                  <select
                    value={selectedBiomePath}
                    onChange={(e) => setSelectedBiomePath(e.target.value)}
                    disabled={importSourceTab === "catalog" ? catalogLoading : projectBiomesLoading}
                    className="px-2 py-1.5 text-xs rounded border border-tn-border bg-tn-bg text-tn-text"
                  >
                    <option value="">
                      {importSourceTab === "catalog"
                        ? (catalogLoading ? "Loading biomes…" : "Choose biome…")
                        : (projectBiomesLoading ? "Loading project biomes…" : "Choose biome…")}
                    </option>
                    {importSourceTab === "catalog"
                      ? groupedCatalog.map(([group, entries]) => (
                          <optgroup key={group} label={group}>
                            {entries.map((entry) => (
                              <option key={entry.path} value={entry.path}>
                                {entry.biomeName}
                              </option>
                            ))}
                          </optgroup>
                        ))
                      : filteredProjectBiomes.map((entry) => (
                          <option key={entry.path} value={entry.path}>
                            {entry.name}
                          </option>
                        ))}
                  </select>
                </label>

                {biomeLayers.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase tracking-wide text-tn-text-muted">
                      Prop layer
                    </span>
                    {biomeLayers.map((layer) => (
                      <button
                        key={layer.index}
                        type="button"
                        onClick={() => setSelectedLayerIndex(layer.index)}
                        className={`w-full text-left px-2 py-1.5 rounded border text-[11px] transition-colors ${
                          selectedLayerIndex === layer.index
                            ? "border-tn-accent bg-tn-accent/10 text-tn-accent"
                            : "border-tn-border text-tn-text-muted hover:bg-white/5"
                        }`}
                      >
                        <div className="font-medium">Props[{layer.index}]</div>
                        <div className="truncate opacity-80">{layer.summary}</div>
                      </button>
                    ))}
                  </div>
                )}

                {selectedBiomePath && biomeLayers.length === 0 && !catalogLoading && (
                  <p className="text-[11px] text-tn-text-muted">This biome has no Props layers.</p>
                )}
              </div>

              <div className="border border-tn-border/60 rounded p-2 min-h-[200px]">
                {previewGraph && previewGraph.nodes.length > 0 ? (
                  <PropPlacementGrid nodes={previewGraph.nodes} edges={previewGraph.edges} />
                ) : (
                  <p className="text-[11px] text-tn-text-muted p-2">Select a prop layer to preview placement.</p>
                )}
              </div>
            </div>
          )}

          {mode === "bridge" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[280px]">
              <div className="space-y-2">
                {bridgeLoading && (
                  <p className="text-xs text-tn-text-muted">Resolving live world biome…</p>
                )}
                {!bridgeLoading && !bridgeBiomePath && (
                  <p className="text-xs text-tn-text-muted flex items-start gap-1.5">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-amber-400/90" />
                    Connect Bridge with a mod pack and world structure, or open the instance file in this project.
                  </p>
                )}
                {bridgeBiomePath && (
                  <>
                    <p className="text-xs text-tn-text-muted flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                      {bridgeBiomeName} — {bridgeLayers.length} prop layer(s)
                    </p>
                    <div className="space-y-1">
                      {bridgeLayers.map((layer) => (
                        <button
                          key={layer.index}
                          type="button"
                          onClick={() => setBridgeLayerIndex(layer.index)}
                          className={`w-full text-left px-2 py-1.5 rounded border text-[11px] transition-colors ${
                            bridgeLayerIndex === layer.index
                              ? "border-tn-accent bg-tn-accent/10 text-tn-accent"
                              : "border-tn-border text-tn-text-muted hover:bg-white/5"
                          }`}
                        >
                          <div className="font-medium">Props[{layer.index}]</div>
                          <div className="truncate opacity-80">{layer.summary}</div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </div>

              <div className="border border-tn-border/60 rounded p-2 min-h-[200px]">
                {previewGraph && previewGraph.nodes.length > 0 ? (
                  <PropPlacementGrid nodes={previewGraph.nodes} edges={previewGraph.edges} />
                ) : (
                  <p className="text-[11px] text-tn-text-muted p-2">Select a bridge prop layer to preview placement.</p>
                )}
              </div>
            </div>
          )}

          {mode === "blank" && (
            <p className="text-xs text-tn-text-muted">
              Creates an empty Props tab. Build placement and assignment graphs manually from the node palette.
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 px-4 py-3 border-t border-tn-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 text-xs text-tn-text-muted hover:text-tn-text rounded-lg border border-tn-border"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canConfirm}
            onClick={handleConfirm}
            className="px-3 py-1.5 text-xs font-medium text-white bg-tn-accent hover:bg-tn-accent/90 rounded-lg disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
