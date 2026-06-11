import { useCallback, useEffect, useMemo, useState } from "react";
import { open as openFileDialog } from "@tauri-apps/plugin-dialog";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useUIStore } from "@/stores/uiStore";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useWeatherAssetIndex } from "@/hooks/useWeatherAssetIndex";
import { useWeatherDocCache } from "@/hooks/useWeatherDocCache";
import { useEffectiveEnvironment } from "@/hooks/useEffectiveEnvironment";
import { useAtmospherePreviewSync } from "@/hooks/useAtmospherePreviewSync";
import {
  copyFile,
  createDirectory,
  exportAssetFile,
  listDirectory,
  readAssetFile,
  showInFolder,
  writeAssetFile,
} from "@/utils/ipc";
import { useToastStore } from "@/stores/toastStore";
import mapDirEntry from "@/utils/mapDirEntry";
import { loadKnownEnvironmentNames } from "@/utils/environmentAssetLookup";
import {
  buildDefaultWeatherDoc,
  getAssetIndex,
  inferSuggestedParentEnvironment,
  materializeWeatherFiles,
  readForecastHour,
  collectForecastWeatherIds,
  type JsonRecord,
  type WeatherForecastEntry,
} from "@/utils/atmosphere";
import { AtmosphereEditorToolbar } from "@/components/editor/atmosphere/AtmosphereEditorToolbar";
import { AtmosphereSimpleImportBanner } from "@/components/editor/atmosphere/AtmosphereSimpleImportBanner";
import { AtmosphereHelpCard } from "@/components/editor/atmosphere/AtmosphereHelpCard";
import { AdditionalFieldsSection } from "@/components/editor/atmosphere/AdditionalFieldsSection";
import { EnvironmentForecastBulkSection } from "@/components/editor/atmosphere/EnvironmentForecastBulkSection";
import { EnvironmentIssueLogSection } from "@/components/editor/atmosphere/EnvironmentIssueLogSection";
import { EnvironmentOverviewSection } from "@/components/editor/atmosphere/EnvironmentOverviewSection";
import { EnvironmentPreviewPanel } from "@/components/editor/atmosphere/EnvironmentPreviewPanel";
import { EnvironmentTagsSection } from "@/components/editor/atmosphere/EnvironmentTagsSection";
import { DAYPARTS, HOURS, type EnvironmentDoc } from "@/components/editor/atmosphere/environmentEditorConstants";
import {
  collectWeatherUsage,
  computeEnvironmentIssues,
  getDisplayedForecastHours,
  summarizeDaypart,
} from "@/components/editor/atmosphere/environmentEditorUtils";
import { CollapsibleEditorSection } from "./CollapsibleEditorSection";
import { joinPath, inferServerRoot } from "@/utils/pathUtils";
import { blockInvalidJsonWrite } from "@/utils/invalidJsonReadOnly";

export function EnvironmentEditorView() {
  const rawJsonContent = useEditorStore((state) => state.rawJsonContent) as EnvironmentDoc | null;
  const setRawJsonContent = useEditorStore((state) => state.setRawJsonContent);
  const currentFile = useProjectStore((state) => state.currentFile);
  const projectPath = useProjectStore((state) => state.projectPath);
  const isDirty = useProjectStore((state) => state.isDirty);
  const setDirty = useProjectStore((state) => state.setDirty);
  const setDirectoryTree = useProjectStore((state) => state.setDirectoryTree);
  const { openFile } = useTauriIO();
  const addToast = useToastStore((state) => state.addToast);
  const setRequestedDocSlug = useUIStore((state) => state.setRequestedDocSlug);
  const setRightPanelMode = useUIStore((state) => state.setRightPanelMode);
  const setRightPanelVisible = useUIStore((state) => state.setRightPanelVisible);
  const syncAtmospherePreview = useUIStore((state) => state.syncAtmospherePreview);
  const toggleSyncAtmospherePreview = useUIStore((state) => state.toggleSyncAtmospherePreview);
  const editorUIMode = useUIStore((state) => state.atmosphereEditorUIMode);
  const setAtmosphereEditorUIMode = useUIStore((state) => state.setAtmosphereEditorUIMode);
  const previewHour = useUIStore((state) => state.atmospherePreviewHour);
  const setPreviewHour = useUIStore((state) => state.setAtmospherePreviewHour);
  const invalidJsonReadOnly = useEditorStore(
    (state) => state.editingContext === "InvalidJson" && state.invalidJsonFile !== null,
  );
  const isAdvanced = editorUIMode === "advanced";
  const hasEnvironmentDoc = rawJsonContent !== null;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [environmentParentOptions, setEnvironmentParentOptions] = useState<string[]>([]);
  const [environmentPathIndex, setEnvironmentPathIndex] = useState<Record<string, string>>({});
  const [selectedDaypartId, setSelectedDaypartId] = useState<(typeof DAYPARTS)[number]["id"] | null>(null);
  const [showIssueLog, setShowIssueLog] = useState(true);
  const [showPreview, setShowPreview] = useState(true);
  const [showOverviewSection, setShowOverviewSection] = useState(true);
  const [showTagsSection, setShowTagsSection] = useState(false);
  const [showForecastSection, setShowForecastSection] = useState(true);
  const [showExtraSection, setShowExtraSection] = useState(false);
  const [forecastScope, setForecastScope] = useState<"current" | "daypart" | "all">("current");
  const [lookupRevision, setLookupRevision] = useState(0);

  const {
    status: lookupStatus,
    options: weatherOptions,
    pathIndex: weatherPathIndex,
    error: lookupError,
  } = useWeatherAssetIndex(currentFile, projectPath, lookupRevision);

  const serverRoot = useMemo(
    () => inferServerRoot(currentFile, projectPath),
    [currentFile, projectPath],
  );

  const environmentName = useMemo(() => {
    if (!currentFile) return null;
    const base = currentFile.split(/[/\\]/).pop() ?? "";
    return base.replace(/\.json$/i, "") || null;
  }, [currentFile]);

  const doc = useMemo(() => rawJsonContent ?? ({} as EnvironmentDoc), [rawJsonContent]);

  const {
    mergedEnvironment,
    parentChain,
  } = useEffectiveEnvironment(
    rawJsonContent as JsonRecord | null,
    environmentName,
    serverRoot,
    lookupRevision,
  );

  const forecastWeatherIds = useMemo(() => {
    const ids = new Set<string>();
    for (const hour of HOURS) {
      for (const entry of readForecastHour(doc, hour)) {
        if (entry.WeatherId) ids.add(entry.WeatherId);
      }
      if (mergedEnvironment) {
        for (const entry of readForecastHour(mergedEnvironment, hour)) {
          if (entry.WeatherId) ids.add(entry.WeatherId);
        }
      }
    }
    return [...ids];
  }, [doc, mergedEnvironment]);

  const weatherDocs = useWeatherDocCache(weatherPathIndex, forecastWeatherIds, lookupRevision);

  useAtmospherePreviewSync({
    editingContext: "Environment",
    rawJsonContent: rawJsonContent as JsonRecord | null,
    serverRoot,
    environmentName,
    previewHour,
  });

  const isHytaleAssetPath = useCallback((resolvedPath: string): boolean => {
    if (!projectPath) return false;
    const norm = resolvedPath.replace(/\\/g, "/").toLowerCase();
    const projNorm = projectPath.replace(/\\/g, "/").toLowerCase();
    return !norm.startsWith(projNorm);
  }, [projectPath]);

  const refreshProjectTreeAndLookup = useCallback(async () => {
    if (projectPath) {
      try {
        const entries = await listDirectory(projectPath);
        setDirectoryTree(entries.map(mapDirEntry));
      } catch {
        // Tree refresh failure is non-fatal.
      }
    }
    setLookupRevision((value) => value + 1);
  }, [projectPath, setDirectoryTree]);

  const hytaleOnlyIds = useMemo(() => {
    if (!rawJsonContent || Object.keys(weatherPathIndex).length === 0) return [];
    const allIds = collectForecastWeatherIds(rawJsonContent as JsonRecord);
    return allIds.filter((id) => {
      const p = weatherPathIndex[id.toLowerCase()];
      return p && isHytaleAssetPath(p);
    });
  }, [rawJsonContent, weatherPathIndex, isHytaleAssetPath]);

  const missingIds = useMemo(() => {
    if (!rawJsonContent || lookupStatus === "loading") return [];
    const allIds = collectForecastWeatherIds(rawJsonContent as JsonRecord);
    return allIds.filter((id) => !weatherPathIndex[id.toLowerCase()]);
  }, [rawJsonContent, weatherPathIndex, lookupStatus]);

  useEffect(() => {
    if (!serverRoot) {
      setEnvironmentPathIndex({});
      return;
    }

    let active = true;
    void getAssetIndex(serverRoot, { listDirectoryFn: listDirectory, readAssetFileFn: readAssetFile })
      .then((index) => {
        if (!active) return;
        const paths: Record<string, string> = {};
        for (const [key, path] of index.environmentPaths) {
          paths[key] = path;
        }
        setEnvironmentPathIndex(paths);
      })
      .catch(() => {
        if (!active) return;
        setEnvironmentPathIndex({});
      });

    return () => {
      active = false;
    };
  }, [serverRoot, lookupRevision]);

  useEffect(() => {
    let active = true;

    void loadKnownEnvironmentNames(currentFile, projectPath)
      .then((names) => {
        if (active) {
          setEnvironmentParentOptions(names ?? []);
        }
      })
      .catch(() => {
        if (active) {
          setEnvironmentParentOptions([]);
        }
      });

    return () => {
      active = false;
    };
  }, [currentFile, projectPath]);

  const suggestedParentEnvironment = useMemo(() => (
    doc.Parent?.trim()
      ? null
      : inferSuggestedParentEnvironment(currentFile, environmentParentOptions)
  ), [currentFile, doc.Parent, environmentParentOptions]);

  const updateDoc = useCallback((updater: (previous: EnvironmentDoc) => EnvironmentDoc) => {
    if (!rawJsonContent) return;
    const next = updater(structuredClone(doc));
    setRawJsonContent(next);
    setDirty(true);
    if (saveStatus !== "idle") {
      setSaveStatus("idle");
    }
  }, [rawJsonContent, doc, setRawJsonContent, setDirty, saveStatus, setSaveStatus]);

  const isWeatherDirMissing = lookupStatus === "error" && (lookupError?.includes("not found") ?? false);

  const materializeReferencedWeatherFiles = useCallback(async ({
    importIds,
    createIds,
  }: {
    importIds?: string[];
    createIds?: string[];
  }) => {
    if (!serverRoot) {
      addToast("Cannot determine the Server root for weather fixes.", "warning");
      return;
    }

    const weathersDir = joinPath(serverRoot, "Weathers");
    const result = await materializeWeatherFiles({
      weathersDir,
      importIds,
      createIds,
      bundledPathIndex: weatherPathIndex,
    });

    await refreshProjectTreeAndLookup();

    if (result.imported > 0) {
      addToast(`Added ${result.imported} referenced weather file(s) to Server/Weathers.`, "success");
    }
    if (result.created > 0) {
      addToast(`Created ${result.created} placeholder weather file(s) in Server/Weathers.`, "success");
    }
    if (result.failed > 0) {
      addToast(
        `Failed to materialize ${result.failed} weather file(s).`,
        result.imported > 0 || result.created > 0 ? "warning" : "error",
      );
    }
  }, [serverRoot, weatherPathIndex, addToast, refreshProjectTreeAndLookup]);

  const handleCreateDefaultWeather = useCallback(async () => {
    if (!serverRoot) return;
    const filePath = joinPath(joinPath(serverRoot, "Weathers"), "Weather_Default.json");
    try {
      await exportAssetFile(filePath, buildDefaultWeatherDoc("Weather_Default"));
      await refreshProjectTreeAndLookup();
    } catch (error) {
      addToast(`Failed to create default weather: ${error}`, "error");
    }
  }, [serverRoot, refreshProjectTreeAndLookup, addToast]);

  const weathersDirPath = (() => {
    const serverRoot = inferServerRoot(currentFile, projectPath);
    return serverRoot ? joinPath(serverRoot, "Weathers") : null;
  })();

  const handleLocateWeathers = async () => {
    if (!weathersDirPath) {
      addToast("Cannot determine Server root from the current file path.", "warning");
      return;
    }
    try {
      await showInFolder(weathersDirPath);
    } catch {
      addToast("Weathers folder not found. Creating it now with a default weather file...", "info");
      await handleCreateDefaultWeather();
      try { await showInFolder(weathersDirPath); } catch { /* ignore */ }
    }
  };

  const setForecastEntries = useCallback((hour: number, entries: WeatherForecastEntry[]) => {
    updateDoc((previous) => ({
      ...previous,
      WeatherForecasts: {
        ...(previous.WeatherForecasts ?? {}),
        [String(hour)]: entries,
      },
    }));
  }, [updateDoc]);

  const updateForecastEntry = (
    hour: number,
    index: number,
    updater: (entry: WeatherForecastEntry) => WeatherForecastEntry,
  ) => {
    setForecastEntries(
      hour,
      readForecastHour(doc, hour).map((entry, entryIndex) => (
        entryIndex === index ? updater(entry) : entry
      )),
    );
  };

  const addForecastEntry = (hour: number) => {
    setForecastEntries(hour, [
      ...readForecastHour(doc, hour),
      {
        WeatherId: weatherOptions[0]?.id ?? "",
        Weight: 100,
      },
    ]);
  };

  const removeForecastEntry = (hour: number, index: number) => {
    setForecastEntries(
      hour,
      readForecastHour(doc, hour).filter((_, entryIndex) => entryIndex !== index),
    );
  };

  const clearForecastHour = (hour: number) => {
    setForecastEntries(hour, []);
  };

  const handleImportForecastWeather = async (weatherId: string, sourcePath: string) => {
    if (!weathersDirPath) {
      addToast("Cannot resolve Server/Weathers path", "error");
      return;
    }
    try {
      await createDirectory(weathersDirPath);
      const fileName = sourcePath.split(/[/\\]/).pop() ?? `${weatherId}.json`;
      await copyFile(sourcePath, joinPath(weathersDirPath, fileName));
      await refreshProjectTreeAndLookup();
      addToast(`Imported ${weatherId}`, "success");
    } catch (error) {
      addToast(`Import failed: ${error}`, "error");
    }
  };

  const handleLocateForecastWeather = async (weatherId: string) => {
    const selected = await openFileDialog({
      title: `Locate weather file for "${weatherId}"`,
      filters: [{ name: "JSON", extensions: ["json"] }],
    });
    if (!selected || typeof selected !== "string") return;
    if (!weathersDirPath) {
      addToast("Cannot resolve Server/Weathers path", "error");
      return;
    }
    try {
      await createDirectory(weathersDirPath);
      const fileName = selected.split(/[/\\]/).pop() ?? `${weatherId}.json`;
      await copyFile(selected, joinPath(weathersDirPath, fileName));
      await refreshProjectTreeAndLookup();
      addToast(`Copied ${fileName} into Server/Weathers`, "success");
    } catch (error) {
      addToast(`Failed to copy file: ${error}`, "error");
    }
  };

  const handleSave = async () => {
    if (blockInvalidJsonWrite()) return;
    if (!currentFile || !rawJsonContent) return;
    try {
      await writeAssetFile(currentFile, doc);
      setDirty(false);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  const tagEntries = Object.entries(doc.Tags ?? {});
  const extraEntries = Object.entries(doc).filter(([key]) => (
    !["Parent", "Tags", "WeatherForecasts", "WaterTint", "SpawnDensity", "BlockModificationAllowed", "$Comment"].includes(key)
  ));
  const activeForecasts = [...readForecastHour(doc, previewHour)].sort((left, right) => right.Weight - left.Weight);
  const selectedDaypart = DAYPARTS.find((daypart) => daypart.id === selectedDaypartId) ?? null;
  const uniqueWeatherUsage = collectWeatherUsage(doc);
  const uniqueWeatherIds = [...uniqueWeatherUsage.keys()].sort((left, right) => left.localeCompare(right));
  const daypartSummaries = DAYPARTS.map((daypart) => ({
    ...daypart,
    ...summarizeDaypart(doc, daypart.start, daypart.end),
  }));
  const primaryForecast = activeForecasts[0] ?? null;

  const copyHourToDaypart = useCallback(() => {
    if (!selectedDaypart) return;
    const sourceEntries = readForecastHour(doc, previewHour);
    if (sourceEntries.length === 0) return;
    updateDoc((previous) => {
      const forecasts = { ...(previous.WeatherForecasts ?? {}) };
      for (let hour = selectedDaypart.start; hour <= selectedDaypart.end; hour += 1) {
        forecasts[String(hour)] = sourceEntries.map((entry) => ({ ...entry }));
      }
      return { ...previous, WeatherForecasts: forecasts };
    });
  }, [doc, previewHour, selectedDaypart, updateDoc]);

  const applyDaypartTemplate = useCallback(() => {
    if (!selectedDaypart) return;
    const summary = summarizeDaypart(doc, selectedDaypart.start, selectedDaypart.end);
    const dominantId = summary.dominantWeatherId ?? weatherOptions[0]?.id ?? "";
    if (!dominantId) return;
    updateDoc((previous) => {
      const forecasts = { ...(previous.WeatherForecasts ?? {}) };
      for (let hour = selectedDaypart.start; hour <= selectedDaypart.end; hour += 1) {
        forecasts[String(hour)] = [{ WeatherId: dominantId, Weight: 100 }];
      }
      return { ...previous, WeatherForecasts: forecasts };
    });
  }, [doc, selectedDaypart, updateDoc, weatherOptions]);

  const normalizePreviewHourWeights = useCallback(() => {
    const entries = readForecastHour(doc, previewHour);
    if (entries.length === 0) return;
    const total = entries.reduce((sum, entry) => sum + entry.Weight, 0);
    if (total <= 0) return;
    const normalized = entries.map((entry) => ({
      ...entry,
      Weight: Math.round((entry.Weight / total) * 100),
    }));
    const sum = normalized.reduce((value, entry) => value + entry.Weight, 0);
    if (sum !== 100 && normalized.length > 0) {
      normalized[0] = { ...normalized[0], Weight: normalized[0].Weight + (100 - sum) };
    }
    setForecastEntries(previewHour, normalized);
  }, [doc, previewHour, setForecastEntries]);

  useEffect(() => {
    if (selectedDaypart) {
      setPreviewHour(selectedDaypart.start);
    }
  }, [selectedDaypart, setPreviewHour]);

  const environmentIssues = useMemo(() => computeEnvironmentIssues({
    doc,
    mergedEnvironment,
    suggestedParentEnvironment,
    hytaleOnlyIds,
    missingIds,
    lookupStatus,
    lookupError,
    tagCount: tagEntries.length,
    extraFieldCount: extraEntries.length,
    onUseSuggestedParent: (parent) => updateDoc((previous) => ({ ...previous, Parent: parent })),
    onImportHytaleWeather: (ids) => { void materializeReferencedWeatherFiles({ importIds: ids }); },
    onCreateMissingWeather: (ids) => { void materializeReferencedWeatherFiles({ createIds: ids }); },
    onCreateDefaultWeather: () => { void handleCreateDefaultWeather(); },
  }), [
    doc,
    extraEntries.length,
    handleCreateDefaultWeather,
    hytaleOnlyIds,
    lookupError,
    lookupStatus,
    materializeReferencedWeatherFiles,
    mergedEnvironment,
    missingIds,
    suggestedParentEnvironment,
    tagEntries.length,
    updateDoc,
  ]);

  const displayedForecastHours = useMemo(
    () => getDisplayedForecastHours(forecastScope, previewHour, selectedDaypart),
    [forecastScope, previewHour, selectedDaypart],
  );

  const forecastCallbacks = {
    onClearForecastHour: clearForecastHour,
    onAddForecastEntry: addForecastEntry,
    onUpdateForecastEntry: updateForecastEntry,
    onRemoveForecastEntry: removeForecastEntry,
    onOpenWeatherFile: (path: string) => { void openFile(path); },
    onImportForecastWeather: (weatherId: string, sourcePath: string) => { void handleImportForecastWeather(weatherId, sourcePath); },
    onLocateForecastWeather: (weatherId: string) => { void handleLocateForecastWeather(weatherId); },
  };

  return (
    <div className="flex h-full flex-col bg-tn-bg">
      <AtmosphereEditorToolbar
        variant="environment"
        fileName={currentFile?.split(/[/\\]/).pop() ?? "Untitled"}
        hasDoc={hasEnvironmentDoc}
        lookupStatus={lookupStatus}
        weathersDirPath={weathersDirPath}
        isDirty={isDirty}
        saveStatus={saveStatus}
        canSave={hasEnvironmentDoc && Boolean(currentFile) && !invalidJsonReadOnly}
        editorUIMode={editorUIMode}
        onEditorUIModeChange={setAtmosphereEditorUIMode}
        syncAtmospherePreview={syncAtmospherePreview}
        onToggleSyncAtmospherePreview={toggleSyncAtmospherePreview}
        onOpenDocs={() => {
          setRequestedDocSlug("guides/world/environments-and-weather");
          setRightPanelMode("docs");
          setRightPanelVisible(true);
        }}
        onLocateWeathers={() => { void handleLocateWeathers(); }}
        onSave={handleSave}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-4 px-4 py-4">
          {!hasEnvironmentDoc && (
            <div className="rounded border border-dashed border-tn-border/50 bg-tn-surface/20 px-4 py-6 text-center text-sm text-tn-text-muted">
              No environment file loaded.
            </div>
          )}
          {hasEnvironmentDoc && (
            <AtmosphereHelpCard
              context="environment-editor"
              editorUIMode={editorUIMode}
            />
          )}
          {hasEnvironmentDoc && !isAdvanced && (
            <AtmosphereSimpleImportBanner
              builtInWeatherCount={hytaleOnlyIds.length}
              missingWeatherCount={missingIds.length}
              onImportBuiltIn={() => { void materializeReferencedWeatherFiles({ importIds: hytaleOnlyIds }); }}
              onSwitchToAdvanced={() => setAtmosphereEditorUIMode("advanced")}
            />
          )}
          {hasEnvironmentDoc && (isAdvanced || environmentIssues.length > 0) && (
            <EnvironmentIssueLogSection
              issues={environmentIssues}
              open={showIssueLog}
              onToggle={() => setShowIssueLog((v) => !v)}
              isWeatherDirMissing={isWeatherDirMissing}
              onCreateDefaultWeather={() => { void handleCreateDefaultWeather(); }}
            />
          )}
          <CollapsibleEditorSection
            title="Preview"
            description={isAdvanced
              ? "Forecast strip, active weather weights, and daypart summaries."
              : "Scene at the selected hour and 24-hour schedule."}
            badge={`${previewHour}:00`}
            open={showPreview}
            onToggle={() => setShowPreview((v) => !v)}
          >
            <EnvironmentPreviewPanel
              doc={doc}
              mergedEnvironment={mergedEnvironment}
              previewHour={previewHour}
              onPreviewHourChange={setPreviewHour}
              weatherDocs={weatherDocs}
              selectedDaypart={selectedDaypart}
              selectedDaypartId={selectedDaypartId}
              onSelectDaypart={(id, startHour) => {
                setSelectedDaypartId(id as (typeof DAYPARTS)[number]["id"]);
                setPreviewHour(startHour);
              }}
              lookupStatus={lookupStatus}
              weatherFileCount={weatherOptions.length}
              lookupError={lookupError}
              tagEntries={tagEntries}
              uniqueWeatherIds={uniqueWeatherIds}
              primaryForecast={primaryForecast}
              activeForecasts={activeForecasts}
              daypartSummaries={daypartSummaries}
              projectPath={projectPath}
              weatherPathIndex={weatherPathIndex}
              isHytaleAssetPath={isHytaleAssetPath}
              {...forecastCallbacks}
              compact={!isAdvanced}
            />
          </CollapsibleEditorSection>

          <EnvironmentOverviewSection
            doc={doc}
            open={showOverviewSection}
            onToggle={() => setShowOverviewSection((value) => !value)}
            parentChain={parentChain}
            parentEnvironmentPaths={environmentPathIndex}
            onOpenEnvironment={(name) => {
              const path = environmentPathIndex[name.toLowerCase()];
              if (path) void openFile(path);
            }}
            environmentParentOptions={environmentParentOptions}
            suggestedParentEnvironment={suggestedParentEnvironment}
            weatherOptions={weatherOptions}
            previewHour={previewHour}
            primaryForecast={primaryForecast}
            onUpdateDoc={updateDoc}
            compact={!isAdvanced}
          />

          {isAdvanced && (
            <>
              <EnvironmentTagsSection
                tagEntries={tagEntries}
                open={showTagsSection}
                onToggle={() => setShowTagsSection((value) => !value)}
                onUpdateDoc={updateDoc}
              />

              <EnvironmentForecastBulkSection
                doc={doc}
                open={showForecastSection}
                onToggle={() => setShowForecastSection((value) => !value)}
                forecastScope={forecastScope}
                onForecastScopeChange={setForecastScope}
                displayedForecastHours={displayedForecastHours}
                selectedDaypart={selectedDaypart}
                previewHour={previewHour}
                projectPath={projectPath}
                weatherPathIndex={weatherPathIndex}
                weatherDocs={weatherDocs}
                isHytaleAssetPath={isHytaleAssetPath}
                onCopyHourToDaypart={copyHourToDaypart}
                onApplyDaypartTemplate={applyDaypartTemplate}
                onNormalizePreviewHourWeights={normalizePreviewHourWeights}
                {...forecastCallbacks}
              />

              <AdditionalFieldsSection
                entries={extraEntries}
                open={showExtraSection}
                onToggle={() => setShowExtraSection((value) => !value)}
                onUpdateField={(key, value) => updateDoc((previous) => ({ ...previous, [key]: value }))}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
