import { useState, useCallback, useRef, useEffect } from "react";
import { CheckCircle2, Package, AlertTriangle } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore, type DirectoryEntry } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useTauriIO } from "@/hooks/useTauriIO";
import { CollapsibleEditorSection } from "@/components/editor/CollapsibleEditorSection";
import { useToastStore } from "@/stores/toastStore";
import { copyFile, createDirectory, listDirectory, resolveBundledHytaleAssetPath, showInFolder } from "@/utils/ipc";
import mapDirEntry from "@/utils/mapDirEntry";
import { joinPath, normalizePath, getDirname } from "@/utils/pathUtils";
import { collectForecastWeatherIds, inferSuggestedParentEnvironment, materializeWeatherFiles } from "@/utils/atmosphere";
import { AssetInspectorScenePreview } from "./AssetInspectorScenePreview";

const WEATHER_SUMMARY_COLOR_KEYS = [
  "SkyTopColors",
  "SkyBottomColors",
  "SkySunsetColors",
  "FogColors",
  "SunColors",
  "SunGlowColors",
  "MoonColors",
  "MoonGlowColors",
  "SunlightColors",
  "ScreenEffectColors",
  "WaterTints",
];

const WEATHER_SUMMARY_VALUE_KEYS = [
  "SunScales",
  "MoonScales",
  "FogDensities",
  "FogHeightFalloffs",
  "SunlightDampingMultipliers",
];

const ENVIRONMENT_NAME_HINTS = [
  "Env_Default_Flat", "Env_Default_Void", "Env_Void", "Env_Zone0",
  "Env_Zone1_Caves_Forests", "Env_Zone1_Caves_Plains", "Env_Zone1_Forests", "Env_Zone1_Plains", "Env_Zone1_Shores",
  "Env_Zone2_Caves_Deserts", "Env_Zone2_Deserts", "Env_Zone2_Shores",
  "Env_Zone3_Caves_Forests", "Env_Zone3_Forests", "Env_Zone3_Glacial_Henges", "Env_Zone3_Shores",
  "Env_Zone4_Jungles", "Env_Zone4_Shores", "Env_Zone4_Wastes",
  "Env_Portals_Hedera", "Env_Portals_Oasis",
  "Zone1_Overground", "Zone1_Plains", "Zone1_Underground", "Zone3_Overground",
];

function isAssetFileInFolder(path: string | null, folderName: string): boolean {
  if (!path) return false;
  return path.replace(/\\/g, "/").toLowerCase().includes(`/${folderName.toLowerCase()}/`);
}

export function resolveAssetInspectorMode(
  hasSelectedNode: boolean,
  rawJsonContent: unknown,
  currentFile: string | null,
): "weather" | "environment" | null {
  if (hasSelectedNode || !rawJsonContent) return null;
  if (isAssetFileInFolder(currentFile, "Server/Weathers")) return "weather";
  if (isAssetFileInFolder(currentFile, "Server/Environments")) return "environment";
  return null;
}

interface AssetInspectorEntry {
  key: string;
  label: string;
  detail: string;
  status: "in-pack" | "built-in" | "missing";
  projectPath: string | null;
  bundledPath: string | null;
  kind: "weather-texture" | "environment-weather";
}

function toRelativeDisplayPath(root: string | null, path: string): string {
  const normalizedPath = normalizePath(path);
  if (!root) return normalizedPath;
  const normalizedRoot = normalizePath(root);
  const prefix = `${normalizedRoot}/`.toLowerCase();
  return normalizedPath.toLowerCase().startsWith(prefix)
    ? normalizedPath.slice(normalizedRoot.length + 1)
    : normalizedPath;
}

function collectDirectoryFilePaths(entries: DirectoryEntry[]): string[] {
  const files: string[] = [];
  const visit = (items: DirectoryEntry[]) => {
    for (const entry of items) {
      if (entry.isDir && Array.isArray(entry.children)) {
        visit(entry.children);
        continue;
      }
      if (!entry.isDir) {
        files.push(entry.path);
      }
    }
  };
  visit(entries);
  return files;
}

function getFileStem(path: string): string {
  const normalized = path.replace(/\\/g, "/");
  const fileName = normalized.slice(normalized.lastIndexOf("/") + 1);
  return fileName.replace(/\.[^.]+$/i, "");
}

function referenceToBundledCommonPath(referencePath: string): string {
  const normalized = referencePath.replace(/\\/g, "/").replace(/^\/+/, "");
  return normalized.toLowerCase().startsWith("common/") ? normalized : `Common/${normalized}`;
}

function referenceToProjectCommonPath(projectRoot: string, referencePath: string): string {
  const normalized = referencePath.replace(/\\/g, "/").replace(/^\/+/, "");
  const relativePath = normalized.toLowerCase().startsWith("common/") ? normalized : `Common/${normalized}`;
  return joinPath(projectRoot, relativePath);
}

function collectWeatherTextureReferences(doc: Record<string, unknown>): Array<{ label: string; referencePath: string }> {
  const references: Array<{ label: string; referencePath: string }> = [];
  const seen = new Set<string>();
  const pushReference = (label: string, referencePath: unknown) => {
    if (typeof referencePath !== "string" || !referencePath.trim()) return;
    const normalized = referencePath.trim();
    const key = normalized.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    references.push({ label, referencePath: normalized });
  };

  pushReference("Stars", doc.Stars);

  if (Array.isArray(doc.Moons)) {
    for (const [index, moon] of doc.Moons.entries()) {
      if (moon && typeof moon === "object") {
        pushReference(`Moon ${index + 1}`, (moon as { Texture?: unknown }).Texture);
      }
    }
  }

  if (Array.isArray(doc.Clouds)) {
    for (const [index, cloud] of doc.Clouds.entries()) {
      if (cloud && typeof cloud === "object") {
        pushReference(`Cloud ${index + 1}`, (cloud as { Texture?: unknown }).Texture);
      }
    }
  }

  return references;
}

function collectEnvironmentWeatherIds(doc: Record<string, unknown>): string[] {
  return collectForecastWeatherIds(doc).sort((left, right) => left.localeCompare(right));
}

function statusClass(status: AssetInspectorEntry["status"]): string {
  switch (status) {
    case "in-pack":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-300";
    case "built-in":
      return "border-sky-500/30 bg-sky-500/10 text-sky-300";
    default:
      return "border-amber-500/30 bg-amber-500/10 text-amber-300";
  }
}

function buildBundledPathIndex(entries: AssetInspectorEntry[]): Record<string, string> {
  const index: Record<string, string> = {};
  for (const entry of entries) {
    if (entry.bundledPath) {
      index[entry.label.toLowerCase()] = entry.bundledPath;
    }
  }
  return index;
}

export function AssetInspectorPanel() {
  const rawJsonContent = useEditorStore((s) => s.rawJsonContent);
  const setRawJsonContent = useEditorStore((s) => s.setRawJsonContent);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const directoryTree = useProjectStore((s) => s.directoryTree);
  const setDirty = useProjectStore((s) => s.setDirty);
  const setDirectoryTree = useProjectStore((s) => s.setDirectoryTree);
  const currentFile = useProjectStore((s) => s.currentFile);
  const projectPath = useProjectStore((s) => s.projectPath);
  const { openFile } = useTauriIO();
  const addToast = useToastStore((s) => s.addToast);
  const compactAssetInspector = useUIStore((s) => s.compactAssetInspector);
  const toggleAssetInspectorCompact = useUIStore((s) => s.toggleAssetInspectorCompact);
  const atmospherePreviewHour = useUIStore((s) => s.atmospherePreviewHour);

  const [assetInspectorEntries, setAssetInspectorEntries] = useState<AssetInspectorEntry[]>([]);
  const [assetInspectorLoading, setAssetInspectorLoading] = useState(false);
  const [assetInspectorActionKey, setAssetInspectorActionKey] = useState<string | null>(null);
  const [assetInspectorRevision, setAssetInspectorRevision] = useState(0);
  const [assetInspectorCategory, setAssetInspectorCategory] = useState("all");
  const [assetInspectorOverviewOpen, setAssetInspectorOverviewOpen] = useState(true);
  const [assetInspectorToolsOpen, setAssetInspectorToolsOpen] = useState(true);
  const [assetInspectorReferencesOpen, setAssetInspectorReferencesOpen] = useState(true);
  const [assetInspectorGuidanceOpen, setAssetInspectorGuidanceOpen] = useState(false);
  const [assetInspectorSceneOpen, setAssetInspectorSceneOpen] = useState(true);
  const assetInspectorContainerRef = useRef<HTMLDivElement | null>(null);

  const assetInspectorMode = resolveAssetInspectorMode(
    Boolean(selectedNodeId),
    rawJsonContent,
    currentFile,
  );

  const refreshAssetInspectorTree = useCallback(async () => {
    if (projectPath) {
      try {
        const entries = await listDirectory(projectPath);
        setDirectoryTree(entries.map(mapDirEntry));
      } catch {
        // Tree refresh failure is non-fatal for the inspector.
      }
    }
    setAssetInspectorRevision((value) => value + 1);
  }, [projectPath, setDirectoryTree]);

  const importWeatherTextureEntries = useCallback(async (entries: AssetInspectorEntry[]) => {
    const importableEntries = entries.filter((entry): entry is AssetInspectorEntry & { bundledPath: string; projectPath: string } => (
      entry.kind === "weather-texture" && Boolean(entry.bundledPath && entry.projectPath)
    ));
    if (importableEntries.length === 0) return { imported: 0, failed: 0 };

    let imported = 0;
    let failed = 0;

    for (const entry of importableEntries) {
      try {
        await createDirectory(getDirname(entry.projectPath)).catch(() => {});
        await copyFile(entry.bundledPath, entry.projectPath);
        imported += 1;
      } catch {
        failed += 1;
      }
    }

    return { imported, failed };
  }, []);

  const importAssetInspectorEntries = useCallback(async (entries: AssetInspectorEntry[]) => {
    const textureEntries = entries.filter((entry) => entry.kind === "weather-texture");
    const weatherEntries = entries.filter((entry) => entry.kind === "environment-weather");

    let imported = 0;
    let failed = 0;

    if (textureEntries.length > 0) {
      const textureResult = await importWeatherTextureEntries(textureEntries);
      imported += textureResult.imported;
      failed += textureResult.failed;
    }

    if (weatherEntries.length > 0 && projectPath) {
      const weathersDir = joinPath(projectPath, "Server/Weathers");
      const result = await materializeWeatherFiles({
        weathersDir,
        importIds: weatherEntries.map((entry) => entry.label),
        bundledPathIndex: buildBundledPathIndex(weatherEntries),
      });
      imported += result.imported;
      failed += result.failed;
    }

    await refreshAssetInspectorTree();

    const isTextureImport = textureEntries.length > 0 && weatherEntries.length === 0;
    const noun = isTextureImport ? "referenced sky asset" : "referenced weather file";

    if (imported > 0) {
      addToast(`Added ${imported} ${noun}${imported === 1 ? "" : "s"} to this pack.`, "success");
    }
    if (failed > 0) {
      addToast(`Failed to add ${failed} ${noun}${failed === 1 ? "" : "s"}.`, imported > 0 ? "warning" : "error");
    }
  }, [addToast, importWeatherTextureEntries, projectPath, refreshAssetInspectorTree]);

  const createAssetInspectorWeatherFiles = useCallback(async (entries: AssetInspectorEntry[]) => {
    const creatableEntries = entries.filter((entry) => entry.kind === "environment-weather");
    if (creatableEntries.length === 0 || !projectPath) return;

    const weathersDir = joinPath(projectPath, "Server/Weathers");
    const result = await materializeWeatherFiles({
      weathersDir,
      createIds: creatableEntries.map((entry) => entry.label),
      bundledPathIndex: {},
    });

    await refreshAssetInspectorTree();

    if (result.created > 0) {
      addToast(`Created ${result.created} placeholder weather file${result.created === 1 ? "" : "s"} in Server/Weathers.`, "success");
    }
    if (result.failed > 0) {
      addToast(
        `Failed to create ${result.failed} placeholder weather file${result.failed === 1 ? "" : "s"}.`,
        result.created > 0 ? "warning" : "error",
      );
    }
  }, [addToast, projectPath, refreshAssetInspectorTree]);

  const runAssetInspectorAction = useCallback(async (actionKey: string, action: () => Promise<void>) => {
    if (assetInspectorActionKey) return;
    setAssetInspectorActionKey(actionKey);
    try {
      await action();
    } catch (error) {
      addToast(String(error), "error");
    } finally {
      setAssetInspectorActionKey(null);
    }
  }, [assetInspectorActionKey, addToast]);

  useEffect(() => {
    if (!assetInspectorMode || !rawJsonContent || !projectPath) {
      setAssetInspectorEntries([]);
      setAssetInspectorLoading(false);
      return;
    }

    let cancelled = false;

    const loadEntries = async () => {
      setAssetInspectorLoading(true);

      try {
        const doc = rawJsonContent as Record<string, unknown>;
        const projectFiles = collectDirectoryFilePaths(Array.isArray(directoryTree) ? directoryTree : []);
        const projectFileIndex = new Set(projectFiles.map((path) => normalizePath(path).toLowerCase()));

        if (assetInspectorMode === "weather") {
          const textureEntries = await Promise.all(
            collectWeatherTextureReferences(doc).map(async ({ label, referencePath }) => {
              const targetPath = referenceToProjectCommonPath(projectPath, referencePath);
              const inPack = projectFileIndex.has(normalizePath(targetPath).toLowerCase());
              let bundledPath: string | null = null;

              if (!inPack) {
                try {
                  bundledPath = await resolveBundledHytaleAssetPath(referenceToBundledCommonPath(referencePath));
                } catch {
                  bundledPath = null;
                }
              }

              return {
                key: `weather-texture:${referencePath}`.toLowerCase(),
                label,
                detail: referencePath.replace(/\\/g, "/"),
                status: inPack ? "in-pack" : bundledPath ? "built-in" : "missing",
                projectPath: targetPath,
                bundledPath,
                kind: "weather-texture",
              } satisfies AssetInspectorEntry;
            }),
          );

          if (!cancelled) {
            setAssetInspectorEntries(textureEntries);
          }
          return;
        }

        const projectWeatherIndex = new Map<string, string>();
        for (const filePath of projectFiles) {
          const normalizedFilePath = normalizePath(filePath);
          if (!normalizedFilePath.toLowerCase().endsWith(".json")) continue;
          if (!isAssetFileInFolder(normalizedFilePath, "Server/Weathers")) continue;
          projectWeatherIndex.set(getFileStem(normalizedFilePath).toLowerCase(), normalizedFilePath);
        }

        const bundledWeatherIndex = new Map<string, string>();
        try {
          const bundledWeathersPath = await resolveBundledHytaleAssetPath("Server/Weathers");
          const bundledEntries = await listDirectory(bundledWeathersPath);
          const bundledFiles = collectDirectoryFilePaths(bundledEntries.map(mapDirEntry));
          for (const filePath of bundledFiles) {
            const normalizedFilePath = normalizePath(filePath);
            if (!normalizedFilePath.toLowerCase().endsWith(".json")) continue;
            bundledWeatherIndex.set(getFileStem(normalizedFilePath).toLowerCase(), normalizedFilePath);
          }
        } catch {
          // Built-in weather lookup is optional.
        }

        const weatherEntries = collectEnvironmentWeatherIds(doc).map((weatherId) => {
          const weatherKey = weatherId.toLowerCase();
          const existingProjectPath = projectWeatherIndex.get(weatherKey) ?? null;
          const bundledPath = existingProjectPath ? null : bundledWeatherIndex.get(weatherKey) ?? null;
          const targetFileName = bundledPath
            ? (normalizePath(bundledPath).split("/").pop() ?? `${weatherId}.json`)
            : `${weatherId}.json`;
          const targetPath = existingProjectPath ?? joinPath(projectPath, `Server/Weathers/${targetFileName}`);

          return {
            key: `environment-weather:${weatherKey}`,
            label: weatherId,
            detail: existingProjectPath
              ? toRelativeDisplayPath(projectPath, existingProjectPath)
              : `Server/Weathers/${targetFileName}`,
            status: existingProjectPath ? "in-pack" : bundledPath ? "built-in" : "missing",
            projectPath: targetPath,
            bundledPath,
            kind: "environment-weather",
          } satisfies AssetInspectorEntry;
        });

        if (!cancelled) {
          setAssetInspectorEntries(weatherEntries);
        }
      } catch {
        if (!cancelled) {
          setAssetInspectorEntries([]);
        }
      } finally {
        if (!cancelled) {
          setAssetInspectorLoading(false);
        }
      }
    };

    void loadEntries();

    return () => {
      cancelled = true;
    };
  }, [assetInspectorMode, rawJsonContent, projectPath, directoryTree, assetInspectorRevision]);

  useEffect(() => {
    setAssetInspectorCategory("all");
    setAssetInspectorOverviewOpen(true);
    setAssetInspectorToolsOpen(true);
    setAssetInspectorReferencesOpen(true);
    setAssetInspectorGuidanceOpen(false);
    setAssetInspectorSceneOpen(true);
    assetInspectorContainerRef.current?.scrollTo({ top: 0 });
  }, [assetInspectorMode, currentFile]);

  if (!assetInspectorMode || !rawJsonContent) {
    return null;
  }

  const isWeatherAsset = assetInspectorMode === "weather";
  const assetLabel = isWeatherAsset ? "Weather Asset Inspector" : "Environment Asset Inspector";
  const doc = rawJsonContent as Record<string, unknown>;
  const inPackEntries = assetInspectorEntries.filter((entry) => entry.status === "in-pack");
  const builtInEntries = assetInspectorEntries.filter((entry) => entry.status === "built-in");
  const missingEntries = assetInspectorEntries.filter((entry) => entry.status === "missing");
  const prioritizedAssetInspectorEntries = [...assetInspectorEntries].sort((left, right) => {
    const rank = (status: AssetInspectorEntry["status"]) => (
      status === "missing" ? 0 : status === "built-in" ? 1 : 2
    );
    return rank(left.status) - rank(right.status) || left.label.localeCompare(right.label);
  });
  const assetInspectorCategoryOptions = isWeatherAsset
    ? [
        { value: "all", label: "All assets" },
        { value: "celestial", label: "Celestial" },
        { value: "clouds", label: "Clouds" },
        { value: "needs-attention", label: "Needs attention" },
        { value: "built-in", label: "Built-in" },
        { value: "missing", label: "Missing" },
        { value: "in-pack", label: "In pack" },
      ]
    : [
        { value: "all", label: "All weather refs" },
        { value: "needs-attention", label: "Needs attention" },
        { value: "built-in", label: "Built-in" },
        { value: "missing", label: "Missing" },
        { value: "in-pack", label: "In pack" },
      ];
  const filteredAssetInspectorEntries = prioritizedAssetInspectorEntries.filter((entry) => {
    switch (assetInspectorCategory) {
      case "needs-attention":
        return entry.status !== "in-pack";
      case "built-in":
      case "missing":
      case "in-pack":
        return entry.status === assetInspectorCategory;
      case "celestial":
        return isWeatherAsset && (entry.label === "Stars" || entry.label.startsWith("Moon "));
      case "clouds":
        return isWeatherAsset && entry.label.startsWith("Cloud ");
      default:
        return true;
    }
  });
  const suggestedParentEnvironment = !isWeatherAsset && !(typeof doc.Parent === "string" && doc.Parent.trim())
    ? inferSuggestedParentEnvironment(currentFile, ENVIRONMENT_NAME_HINTS)
    : null;
  const projectAssetFolder = projectPath
    ? joinPath(projectPath, isWeatherAsset ? "Common/Sky" : "Server/Weathers")
    : null;
  const summaryRows = isWeatherAsset
    ? [
        {
          label: "Color tracks",
          value: String(WEATHER_SUMMARY_COLOR_KEYS.filter((key) => Array.isArray(doc[key])).length),
        },
        {
          label: "Value tracks",
          value: String(WEATHER_SUMMARY_VALUE_KEYS.filter((key) => Array.isArray(doc[key])).length),
        },
        {
          label: "Cloud layers",
          value: String(Array.isArray(doc.Clouds) ? doc.Clouds.length : 0),
        },
        {
          label: "Moons",
          value: String(Array.isArray(doc.Moons) ? doc.Moons.length : 0),
        },
        {
          label: "Stars",
          value: typeof doc.Stars === "string" && doc.Stars.trim() ? "Configured" : "Missing",
        },
      ]
    : (() => {
        const forecasts = (doc.WeatherForecasts && typeof doc.WeatherForecasts === "object"
          ? doc.WeatherForecasts
          : {}) as Record<string, unknown>;
        const forecastEntries = Object.values(forecasts)
          .filter((value) => Array.isArray(value))
          .map((value) => value as unknown[]);
        const totalEntries = forecastEntries.reduce((sum, entries) => sum + entries.length, 0);
        const uniqueWeatherIds = new Set<string>();
        for (const entries of forecastEntries) {
          for (const entry of entries) {
            if (entry && typeof entry === "object" && typeof (entry as { WeatherId?: unknown }).WeatherId === "string") {
              uniqueWeatherIds.add((entry as { WeatherId: string }).WeatherId);
            }
          }
        }
        return [
          {
            label: "Forecast hours",
            value: String(forecastEntries.filter((entries) => entries.length > 0).length),
          },
          {
            label: "Forecast entries",
            value: String(totalEntries),
          },
          {
            label: "Weather refs",
            value: String(uniqueWeatherIds.size),
          },
          {
            label: "Tags",
            value: String(doc.Tags && typeof doc.Tags === "object" ? Object.keys(doc.Tags as Record<string, unknown>).length : 0),
          },
          {
            label: "Parent",
            value: typeof doc.Parent === "string" && doc.Parent.trim() ? doc.Parent : "None",
          },
        ];
      })();

  return (
    <div
      ref={assetInspectorContainerRef}
      className={`flex h-full flex-col overflow-y-auto ${compactAssetInspector ? "gap-2 p-2" : "gap-3 p-3"}`}
    >
      <div className="border-b border-tn-border pb-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{assetLabel}</h3>
            <p className="mt-1 text-xs text-tn-text-muted">
              {compactAssetInspector
                ? "Compact asset tools for the file open in the center editor."
                : "Context summary and file actions for the asset open in the center editor."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={toggleAssetInspectorCompact}
              className="rounded border border-tn-border px-2.5 py-1 text-[10px] uppercase tracking-wider text-tn-text-muted transition-colors hover:bg-tn-surface hover:text-tn-text"
            >
              {compactAssetInspector ? "Expand" : "Compact"}
            </button>
          </div>
        </div>
      </div>

      <CollapsibleEditorSection
        title="Guidance"
        description="Authoring notes for pack folder structure and how to build from Hytale-style assets."
        badge={isWeatherAsset ? "Common + Weathers" : "Environments"}
        open={assetInspectorGuidanceOpen}
        onToggle={() => setAssetInspectorGuidanceOpen((value) => !value)}
      >
        <div className="flex flex-col gap-3">
          <div className="rounded border border-tn-border/50 bg-tn-bg/60 p-3">
            <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Folder Notes</p>
            <p className="mt-1 text-[11px] text-tn-text-muted">
              {isWeatherAsset
                ? "Store weather JSON in Server/Weathers. Import a cached Hytale weather to start fast, then keep referenced sky textures under Common/Sky."
                : "Store environment JSON in Server/Environments. Start from a Hytale asset or create your own, then point Parent at a shared base such as Env_Zone1, Env_Zone1_Caves, or another family root."}
            </p>
          </div>
          {!isWeatherAsset && (
            <div className="rounded border border-tn-border/50 bg-tn-bg/60 p-3">
              <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Zone Folder Pattern</p>
              <p className="mt-1 text-[11px] text-tn-text-muted">
                Mirror Hytale by grouping environments into folders like Server/Environments/Zone1, Zone2, Zone3, Zone4, Zone0, and Unique. Keep a shared base such as Env_Zone1 or Env_Zone1_Caves alongside the child variants in that family.
              </p>
            </div>
          )}
        </div>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Scene Preview"
        description="Same preview hour as center editors and the biome Atmosphere tab."
        badge={`${atmospherePreviewHour}:00`}
        open={assetInspectorSceneOpen}
        onToggle={() => setAssetInspectorSceneOpen((value) => !value)}
      >
        <AssetInspectorScenePreview
          mode={assetInspectorMode}
          doc={doc}
          currentFile={currentFile}
          projectPath={projectPath}
          compact={compactAssetInspector}
          lookupRevision={assetInspectorRevision}
        />
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Overview"
        description="Current file and high-level summary for the asset open in the center editor."
        badge={currentFile?.split(/[/\\]/).pop() ?? "Untitled"}
        open={assetInspectorOverviewOpen}
        onToggle={() => setAssetInspectorOverviewOpen((value) => !value)}
      >
        <div className="flex flex-col gap-3">
          <div className="rounded border border-tn-border/60 bg-tn-bg/70 p-3">
            <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Current File</p>
            <p className="mt-1 truncate text-sm font-medium text-tn-text">
              {currentFile?.split(/[/\\]/).pop() ?? "Untitled"}
            </p>
            <p className="mt-1 break-all text-[11px] text-tn-text-muted">{currentFile ?? "No file open"}</p>
          </div>

          <div className={`grid gap-2 ${compactAssetInspector ? "grid-cols-1" : "grid-cols-2"}`}>
            {summaryRows.map((item) => (
              <div key={item.label} className="rounded border border-tn-border/50 bg-tn-bg/60 px-3 py-2">
                <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">{item.label}</p>
                <p className="mt-1 text-sm font-semibold text-tn-text">{item.value}</p>
              </div>
            ))}
          </div>
        </div>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Asset Tools"
        description={isWeatherAsset
          ? "Track missing sky textures and pull cached Hytale assets into the pack's Common folder."
          : "Resolve referenced weather IDs without leaving the editor by opening, importing, or creating files."}
        badge={`${filteredAssetInspectorEntries.length}/${assetInspectorEntries.length}`}
        open={assetInspectorToolsOpen}
        onToggle={() => setAssetInspectorToolsOpen((value) => !value)}
      >
        <div className="flex flex-col gap-3 rounded border border-tn-border/50 bg-tn-bg/50 p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex flex-wrap gap-1 text-[10px]">
              <span className={`rounded border px-2 py-1 ${statusClass("in-pack")}`}>{inPackEntries.length} in pack</span>
              <span className={`rounded border px-2 py-1 ${statusClass("built-in")}`}>{builtInEntries.length} cached</span>
              <span className={`rounded border px-2 py-1 ${statusClass("missing")}`}>{missingEntries.length} missing</span>
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3">
            <label className="flex min-w-[180px] flex-col gap-1 text-[10px] uppercase tracking-wider text-tn-text-muted">
              Category
              <select
                value={assetInspectorCategory}
                onChange={(event) => setAssetInspectorCategory(event.target.value)}
                className="rounded border border-tn-border bg-tn-bg px-2 py-1.5 text-[11px] normal-case tracking-normal text-tn-text"
              >
                {assetInspectorCategoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <p className="pb-1 text-[11px] text-tn-text-muted">
              Showing {filteredAssetInspectorEntries.length} of {assetInspectorEntries.length} referenced {isWeatherAsset ? "assets" : "weather files"}.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {builtInEntries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  void runAssetInspectorAction(
                    isWeatherAsset ? "batch-add-built-in-textures" : "batch-import-built-in-weathers",
                    async () => {
                      await importAssetInspectorEntries(builtInEntries);
                    },
                  );
                }}
                disabled={assetInspectorActionKey !== null}
                className="rounded border border-sky-500/40 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWeatherAsset ? "Add Built-ins" : "Import Built-ins"}
              </button>
            )}
            {!isWeatherAsset && suggestedParentEnvironment && (
              <button
                type="button"
                onClick={() => {
                  setRawJsonContent({
                    ...(doc as Record<string, unknown>),
                    Parent: suggestedParentEnvironment,
                  });
                  setDirty(true);
                }}
                disabled={assetInspectorActionKey !== null}
                className="rounded border border-violet-500/40 bg-violet-500/10 px-3 py-1.5 text-xs text-violet-200 transition-colors hover:bg-violet-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Use {suggestedParentEnvironment}
              </button>
            )}
            {!isWeatherAsset && missingEntries.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  void runAssetInspectorAction("batch-create-missing-weathers", async () => {
                    await createAssetInspectorWeatherFiles(missingEntries);
                  });
                }}
                disabled={assetInspectorActionKey !== null}
                className="rounded border border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Create Missing Files
              </button>
            )}
            {projectAssetFolder && (
              <button
                type="button"
                onClick={() => {
                  void showInFolder(projectAssetFolder);
                }}
                disabled={assetInspectorActionKey !== null}
                className="rounded border border-tn-border px-3 py-1.5 text-xs text-tn-text transition-colors hover:bg-tn-surface disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isWeatherAsset ? "Reveal Sky Folder" : "Reveal Weathers Folder"}
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                void runAssetInspectorAction("refresh-asset-inspector", refreshAssetInspectorTree);
              }}
              disabled={assetInspectorActionKey !== null}
              className="rounded border border-tn-border px-3 py-1.5 text-xs text-tn-text transition-colors hover:bg-tn-surface disabled:cursor-not-allowed disabled:opacity-60"
            >
              Refresh
            </button>
          </div>

          {!projectPath && (
            <div className="rounded border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
              Open the file from a pack root to enable import and create actions.
            </div>
          )}

          {!isWeatherAsset && (
            <div className={`grid gap-2 ${compactAssetInspector ? "grid-cols-1" : "md:grid-cols-2"}`}>
              <div className="rounded border border-tn-border/50 bg-tn-bg/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Parent Chain</p>
                <p className="mt-1 text-sm font-semibold text-tn-text">
                  {typeof doc.Parent === "string" && doc.Parent.trim() ? doc.Parent : "No parent set"}
                </p>
                <p className="mt-1 text-[11px] text-tn-text-muted">
                  {typeof doc.Parent === "string" && doc.Parent.trim()
                    ? "Inherited environment settings will flow from this parent."
                    : `Suggested parent: ${suggestedParentEnvironment ?? "Env_Zone1"}`}
                </p>
              </div>
              <div className="rounded border border-tn-border/50 bg-tn-bg/60 p-3">
                <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Resolution Focus</p>
                <p className="mt-1 text-sm font-semibold text-tn-text">
                  {builtInEntries.length + missingEntries.length} referenced weather file(s) still need attention
                </p>
                <p className="mt-1 text-[11px] text-tn-text-muted">
                  Import cached Hytale assets first, then create placeholders only for custom weather IDs that do not exist anywhere.
                </p>
              </div>
            </div>
          )}
        </div>
      </CollapsibleEditorSection>

      <CollapsibleEditorSection
        title="Referenced Assets"
        description={isWeatherAsset
          ? "Sky textures referenced by this weather asset."
          : "Weather files referenced by this environment asset."}
        badge={`${filteredAssetInspectorEntries.length}`}
        open={assetInspectorReferencesOpen}
        onToggle={() => setAssetInspectorReferencesOpen((value) => !value)}
      >
        <div className="flex max-h-[26rem] flex-col gap-2 overflow-y-auto pr-1">
          {assetInspectorLoading ? (
            <div className="rounded border border-dashed border-tn-border/60 px-3 py-4 text-xs text-tn-text-muted">
              Scanning referenced assets...
            </div>
          ) : assetInspectorEntries.length === 0 ? (
            <div className="rounded border border-dashed border-tn-border/60 px-3 py-4 text-xs text-tn-text-muted">
              {isWeatherAsset
                ? "No referenced sky textures were found on this weather file yet."
                : "No referenced weather IDs were found on this environment file yet."}
            </div>
          ) : filteredAssetInspectorEntries.length === 0 ? (
            <div className="rounded border border-dashed border-tn-border/60 px-3 py-4 text-xs text-tn-text-muted">
              No referenced {isWeatherAsset ? "assets" : "weather files"} match the current category.
            </div>
          ) : (
            filteredAssetInspectorEntries.map((entry) => {
              const isRunning = assetInspectorActionKey === `entry:${entry.key}`;
              const projectRelativePath = entry.projectPath ? toRelativeDisplayPath(projectPath, entry.projectPath) : null;
              const hasEntryAction = Boolean(
                (entry.kind === "weather-texture" && entry.status === "in-pack" && entry.projectPath)
                || (entry.kind === "weather-texture" && entry.status === "built-in")
                || (entry.kind === "environment-weather" && entry.status === "in-pack" && entry.projectPath)
                || (entry.kind === "environment-weather" && entry.status === "built-in")
                || (entry.kind === "environment-weather" && entry.status === "missing"),
              );

              return (
                <div key={entry.key} className="rounded border border-tn-border/60 bg-tn-bg/60 p-3">
                  <div className={compactAssetInspector ? "flex flex-col gap-2" : "flex items-start gap-3"}>
                    <div className="flex min-w-0 items-start gap-3">
                      {entry.status === "in-pack" && <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />}
                      {entry.status === "built-in" && <Package className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-400" />}
                      {entry.status === "missing" && <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-400" />}

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-sm font-medium text-tn-text">{entry.label}</p>
                          <span className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wider ${statusClass(entry.status)}`}>
                            {entry.status === "in-pack" ? "In Pack" : entry.status === "built-in" ? "Cached" : "Missing"}
                          </span>
                        </div>
                        <p className="mt-1 break-all text-[11px] text-tn-text-muted">{entry.detail}</p>
                        {isWeatherAsset && projectRelativePath && (
                          <p className="mt-1 text-[11px] text-tn-text-muted/80">Pack path: {projectRelativePath}</p>
                        )}
                      </div>
                    </div>

                    {hasEntryAction && (
                      <div className={compactAssetInspector ? "ml-[1.375rem] flex flex-wrap gap-2" : "shrink-0"}>
                        {entry.kind === "weather-texture" && entry.status === "in-pack" && entry.projectPath && (
                          <button
                            type="button"
                            onClick={() => {
                              void showInFolder(entry.projectPath!);
                            }}
                            disabled={assetInspectorActionKey !== null}
                            className="rounded border border-tn-border px-2.5 py-1.5 text-xs text-tn-text transition-colors hover:bg-tn-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Reveal
                          </button>
                        )}

                        {entry.kind === "weather-texture" && entry.status === "built-in" && (
                          <button
                            type="button"
                            onClick={() => {
                              void runAssetInspectorAction(`entry:${entry.key}`, async () => {
                                await importAssetInspectorEntries([entry]);
                              });
                            }}
                            disabled={assetInspectorActionKey !== null}
                            className="rounded border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRunning ? "Adding..." : "Add"}
                          </button>
                        )}

                        {entry.kind === "environment-weather" && entry.status === "in-pack" && entry.projectPath && (
                          <button
                            type="button"
                            onClick={() => {
                              void openFile(entry.projectPath!);
                            }}
                            disabled={assetInspectorActionKey !== null}
                            className="rounded border border-tn-border px-2.5 py-1.5 text-xs text-tn-text transition-colors hover:bg-tn-surface disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            Open
                          </button>
                        )}

                        {entry.kind === "environment-weather" && entry.status === "built-in" && (
                          <button
                            type="button"
                            onClick={() => {
                              void runAssetInspectorAction(`entry:${entry.key}`, async () => {
                                await importAssetInspectorEntries([entry]);
                              });
                            }}
                            disabled={assetInspectorActionKey !== null}
                            className="rounded border border-sky-500/40 bg-sky-500/10 px-2.5 py-1.5 text-xs text-sky-200 transition-colors hover:bg-sky-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRunning ? "Importing..." : "Import"}
                          </button>
                        )}

                        {entry.kind === "environment-weather" && entry.status === "missing" && (
                          <button
                            type="button"
                            onClick={() => {
                              void runAssetInspectorAction(`entry:${entry.key}`, async () => {
                                await createAssetInspectorWeatherFiles([entry]);
                              });
                            }}
                            disabled={assetInspectorActionKey !== null}
                            className="rounded border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-200 transition-colors hover:bg-amber-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isRunning ? "Creating..." : "Create"}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </CollapsibleEditorSection>

      <div className="rounded border border-tn-border/50 bg-tn-bg/50 p-3">
        <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Quick Actions</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => {
              if (currentFile) void showInFolder(currentFile);
            }}
            className="rounded border border-tn-border px-3 py-1.5 text-xs text-tn-text hover:bg-tn-surface"
          >
            Reveal File
          </button>
          <button
            type="button"
            onClick={() => {
              if (projectPath) void showInFolder(projectPath);
            }}
            className="rounded border border-tn-border px-3 py-1.5 text-xs text-tn-text hover:bg-tn-surface"
          >
            Reveal Pack Root
          </button>
        </div>
      </div>
    </div>
  );
}
