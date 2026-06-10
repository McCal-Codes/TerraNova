import { useMemo, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { useUIStore } from "@/stores/uiStore";
import { useAtmospherePreviewSync } from "@/hooks/useAtmospherePreviewSync";
import { copyFile, listDirectory, resolveBundledHytaleAssetPath, writeAssetFile } from "@/utils/ipc";
import mapDirEntry from "@/utils/mapDirEntry";
import { joinPath, findServerRoot, inferServerRoot } from "@/utils/pathUtils";
import {
  interpolateColorAtHour,
  interpolateValueAtHour,
  upsertColorKeyframe,
  type HourColor,
  type HourValue,
  type JsonRecord,
} from "@/utils/atmosphere";
import { AdditionalFieldsSection } from "@/components/editor/atmosphere/AdditionalFieldsSection";
import { AtmosphereEditorToolbar } from "@/components/editor/atmosphere/AtmosphereEditorToolbar";
import { AtmosphereHelpCard } from "@/components/editor/atmosphere/AtmosphereHelpCard";
import { WeatherCloudSection } from "@/components/editor/atmosphere/WeatherCloudSection";
import { WeatherColorTracksSection } from "@/components/editor/atmosphere/WeatherColorTracksSection";
import { WeatherFogSection } from "@/components/editor/atmosphere/WeatherFogSection";
import { WeatherIssueLogSection } from "@/components/editor/atmosphere/WeatherIssueLogSection";
import { WeatherPreviewPanel } from "@/components/editor/atmosphere/WeatherPreviewPanel";
import { WeatherQuickEditSection } from "@/components/editor/atmosphere/WeatherQuickEditSection";
import { WeatherValueTracksSection } from "@/components/editor/atmosphere/WeatherValueTracksSection";
import {
  COLOR_TRACKS,
  DEFAULT_CELESTIAL_ASSETS,
  DEFAULT_CLOUD_ASSETS,
  VALUE_TRACKS,
  KNOWN_KEYS,
  type BundledAssetSource,
  type CloudLayer,
  type ColorTrackKey,
  type ValueTrackKey,
  type WeatherDoc,
} from "@/components/editor/atmosphere/weatherEditorConstants";
import {
  computeWeatherIssues,
  describeDaypart,
  describeValue,
  isRecord,
} from "@/components/editor/atmosphere/weatherEditorUtils";
import { CollapsibleEditorSection } from "./CollapsibleEditorSection";

export function WeatherEditorView() {
  const rawJsonContent = useEditorStore((state) => state.rawJsonContent) as WeatherDoc | null;
  const setRawJsonContent = useEditorStore((state) => state.setRawJsonContent);
  const projectPath = useProjectStore((state) => state.projectPath);
  const currentFile = useProjectStore((state) => state.currentFile);
  const isDirty = useProjectStore((state) => state.isDirty);
  const setDirty = useProjectStore((state) => state.setDirty);
  const setDirectoryTree = useProjectStore((state) => state.setDirectoryTree);
  const addToast = useToastStore((state) => state.addToast);
  const syncAtmospherePreview = useUIStore((state) => state.syncAtmospherePreview);
  const toggleSyncAtmospherePreview = useUIStore((state) => state.toggleSyncAtmospherePreview);
  const editorUIMode = useUIStore((state) => state.atmosphereEditorUIMode);
  const setAtmosphereEditorUIMode = useUIStore((state) => state.setAtmosphereEditorUIMode);
  const previewHour = useUIStore((state) => state.atmospherePreviewHour);
  const setPreviewHour = useUIStore((state) => state.setAtmospherePreviewHour);
  const setRequestedDocSlug = useUIStore((state) => state.setRequestedDocSlug);
  const setRightPanelMode = useUIStore((state) => state.setRightPanelMode);
  const setRightPanelVisible = useUIStore((state) => state.setRightPanelVisible);
  const isAdvanced = editorUIMode === "advanced";
  const hasWeatherDoc = rawJsonContent !== null;
  const [saveStatus, setSaveStatus] = useState<"idle" | "saved" | "error">("idle");
  const [showPreview, setShowPreview] = useState(true);
  const [showQuickEdit, setShowQuickEdit] = useState(true);
  const [showIssueLog, setShowIssueLog] = useState(true);
  const [showAtmosphereStrip, setShowAtmosphereStrip] = useState(false);
  const [showPreviewTracks, setShowPreviewTracks] = useState(false);
  const [showPreviewSnapshot, setShowPreviewSnapshot] = useState(false);
  const [showPreviewAssets, setShowPreviewAssets] = useState(false);
  const [showFogSection, setShowFogSection] = useState(true);
  const [showColorSections, setShowColorSections] = useState(true);
  const [showValueSections, setShowValueSections] = useState(false);
  const [showCloudSections, setShowCloudSections] = useState(false);
  const [showExtraSections, setShowExtraSections] = useState(false);

  const doc = rawJsonContent ?? ({} as WeatherDoc);
  const serverRoot = useMemo(() => inferServerRoot(currentFile, projectPath), [currentFile, projectPath]);

  useAtmospherePreviewSync({
    editingContext: "Weather",
    rawJsonContent: rawJsonContent as JsonRecord | null,
    serverRoot,
    environmentName: null,
    previewHour,
  });

  const updateDoc = (updater: (previous: WeatherDoc) => WeatherDoc) => {
    if (!rawJsonContent) return;
    const next = updater(structuredClone(doc));
    setRawJsonContent(next);
    setDirty(true);
    if (saveStatus !== "idle") {
      setSaveStatus("idle");
    }
  };

  const updateColorTrack = (trackKey: ColorTrackKey, next: HourColor[]) => {
    updateDoc((previous) => ({ ...previous, [trackKey]: next }));
  };

  const updateValueTrack = (trackKey: ValueTrackKey, next: HourValue[]) => {
    updateDoc((previous) => ({ ...previous, [trackKey]: next }));
  };

  const syncBundledAssetsToProject = async (assets: BundledAssetSource[]) => {
    const projectRoot = findServerRoot(currentFile) ?? findServerRoot(projectPath);
    if (!projectRoot) {
      addToast("Cannot determine the project root to add the referenced asset files.", "warning");
      return;
    }

    const uniqueAssets = [...new Map(assets.map((asset) => [asset.bundledPath.toLowerCase(), asset])).values()];
    let copied = 0;
    let failed = 0;

    for (const asset of uniqueAssets) {
      try {
        const sourcePath = await resolveBundledHytaleAssetPath(asset.bundledPath);
        const destinationPath = joinPath(projectRoot, asset.bundledPath);
        await copyFile(sourcePath, destinationPath);
        copied += 1;
      } catch {
        failed += 1;
      }
    }

    if (projectPath) {
      try {
        const entries = await listDirectory(projectPath);
        setDirectoryTree(entries.map(mapDirEntry));
      } catch {
        // Tree refresh failure is non-fatal.
      }
    }

    if (copied > 0) {
      addToast(`Added ${copied} cached Hytale asset file(s) to the pack.`, "success");
    }
    if (failed > 0) {
      addToast(`Failed to add ${failed} cached Hytale asset file(s).`, copied > 0 ? "warning" : "error");
    }
  };

  const handleSave = async () => {
    if (!currentFile || !rawJsonContent) return;
    try {
      await writeAssetFile(currentFile, doc);
      setDirty(false);
      setSaveStatus("saved");
    } catch {
      setSaveStatus("error");
    }
  };

  const skyTop = interpolateColorAtHour(doc.SkyTopColors, previewHour, "#28405a");
  const skyBottom = interpolateColorAtHour(doc.SkyBottomColors, previewHour, "#0f172a");
  const sunsetColor = interpolateColorAtHour(doc.SkySunsetColors, previewHour, "#fb923c");
  const fogColor = interpolateColorAtHour(doc.FogColors, previewHour, "#223142");
  const sunColor = interpolateColorAtHour(doc.SunColors, previewHour, "#fbbf24");
  const moonColor = interpolateColorAtHour(doc.MoonColors, previewHour, "#cbd5f5");
  const waterTint = interpolateColorAtHour(doc.WaterTints, previewHour, "#2563eb");
  const screenFx = interpolateColorAtHour(doc.ScreenEffectColors, previewHour, "#64748b");
  const sunlightColor = interpolateColorAtHour(doc.SunlightColors, previewHour, "#fde68a");
  const sunScale = interpolateValueAtHour(doc.SunScales, previewHour, 0);
  const moonScale = interpolateValueAtHour(doc.MoonScales, previewHour, 0);
  const fogDensity = interpolateValueAtHour(doc.FogDensities, previewHour, 0);
  const fogHeightFalloff = interpolateValueAtHour(doc.FogHeightFalloffs, previewHour, 0);
  const sunlightDamping = interpolateValueAtHour(doc.SunlightDampingMultipliers, previewHour, 0);
  const extraEntries = Object.entries(doc).filter(([key]) => !KNOWN_KEYS.has(key));
  const cloudLayers = Array.isArray(doc.Clouds) ? doc.Clouds : [];
  const moons = Array.isArray(doc.Moons) ? doc.Moons : [];
  const daypart = describeDaypart(previewHour);
  const fogNear = Array.isArray(doc.FogDistance) && typeof doc.FogDistance[0] === "number" ? doc.FogDistance[0] : null;
  const fogFar = Array.isArray(doc.FogDistance) && typeof doc.FogDistance[1] === "number" ? doc.FogDistance[1] : null;
  const fogSpread = fogNear !== null && fogFar !== null ? fogFar - fogNear : null;
  const totalCloudColorKeys = cloudLayers.reduce((sum, layer) => sum + ((layer.Colors ?? []).length), 0);
  const totalCloudSpeedKeys = cloudLayers.reduce((sum, layer) => sum + ((layer.Speeds ?? []).length), 0);
  const starTexture = typeof doc.Stars === "string" ? doc.Stars : null;
  const primaryMoonTexture = moons.find((moon) => typeof moon.Texture === "string")?.Texture;
  const particleSummary = doc.Particle === undefined ? "No particle system" : describeValue(doc.Particle);
  const tagSummary = isRecord(doc.Tags)
    ? Object.entries(doc.Tags)
      .slice(0, 2)
      .map(([key, values]) => `${key}: ${Array.isArray(values) ? values.join(", ") : describeValue(values)}`)
      .join(" | ")
    : "No tags";
  const sunVisible = previewHour >= 5 && previewHour <= 20;
  const moonVisible = previewHour <= 7 || previewHour >= 17;
  const colorTrackCount = COLOR_TRACKS.reduce((sum, track) => sum + (((doc[track.key] as HourColor[] | undefined) ?? []).length), 0);
  const valueTrackCount = VALUE_TRACKS.reduce((sum, track) => sum + (((doc[track.key] as HourValue[] | undefined) ?? []).length), 0);
  const weatherQuickPresets = [
    { label: "Midnight", hour: 0 },
    { label: "Dawn", hour: 6 },
    { label: "Noon", hour: 12 },
    { label: "Dusk", hour: 18 },
  ] as const;
  const setSimpleColor = (trackKey: ColorTrackKey, color: string) => {
    updateColorTrack(trackKey, upsertColorKeyframe(((doc[trackKey] as HourColor[] | undefined) ?? []), previewHour, color));
  };

  const weatherIssues = computeWeatherIssues({
    doc,
    cloudLayers,
    starTexture,
    moonCount: moons.length,
    extraFieldCount: extraEntries.length,
    onSetFogDefaults: () => updateDoc((previous) => ({ ...previous, FogDistance: [-96, 1024] })),
    onSwapFogDistance: () => updateDoc((previous) => ({
      ...previous,
      FogDistance: [previous.FogDistance![1], previous.FogDistance![0]] as [number, number],
    })),
    onDeduplicateTracks: () => updateDoc((previous) => {
      const next = { ...previous };
      for (const track of COLOR_TRACKS) {
        const kf = (next[track.key] as HourColor[] | undefined) ?? [];
        const seen = new Set<number>();
        next[track.key] = kf.filter((entry) => {
          if (seen.has(entry.Hour)) return false;
          seen.add(entry.Hour);
          return true;
        });
      }
      for (const track of VALUE_TRACKS) {
        const kf = (next[track.key] as HourValue[] | undefined) ?? [];
        const seen = new Set<number>();
        next[track.key] = kf.filter((entry) => {
          if (seen.has(entry.Hour)) return false;
          seen.add(entry.Hour);
          return true;
        });
      }
      if (Array.isArray(next.Clouds)) {
        next.Clouds = (next.Clouds as CloudLayer[]).map((layer) => {
          const colorSeen = new Set<number>();
          const speedSeen = new Set<number>();
          return {
            ...layer,
            Colors: (layer.Colors ?? []).filter((e) => {
              if (colorSeen.has(e.Hour)) return false;
              colorSeen.add(e.Hour);
              return true;
            }),
            Speeds: (layer.Speeds ?? []).filter((e) => {
              if (speedSeen.has(e.Hour)) return false;
              speedSeen.add(e.Hour);
              return true;
            }),
          };
        });
      }
      return next;
    }),
    onAddCelestialDefaults: () => {
      updateDoc((previous) => ({
        ...previous,
        Stars: DEFAULT_CELESTIAL_ASSETS[0].referencePath,
        Moons: [
          { Day: 0, Texture: DEFAULT_CELESTIAL_ASSETS[1].referencePath },
          { Day: 1, Texture: DEFAULT_CELESTIAL_ASSETS[2].referencePath },
          { Day: 2, Texture: DEFAULT_CELESTIAL_ASSETS[3].referencePath },
          { Day: 3, Texture: DEFAULT_CELESTIAL_ASSETS[4].referencePath },
          { Day: 4, Texture: DEFAULT_CELESTIAL_ASSETS[5].referencePath },
        ],
      }));
      void syncBundledAssetsToProject(DEFAULT_CELESTIAL_ASSETS);
    },
    onAddCloudDefaults: () => {
      updateDoc((previous) => ({
        ...previous,
        Clouds: [
          {
            Texture: DEFAULT_CLOUD_ASSETS[0].referencePath,
            Colors: [
              { Hour: 3, Color: "#1a1a1bc7" },
              { Hour: 5, Color: "rgba(#ff5e43, 0.504)" },
              { Hour: 7, Color: "#ffffffe6" },
              { Hour: 17, Color: "#ffffffe6" },
              { Hour: 19, Color: "#ff5e4347" },
              { Hour: 21, Color: "#1a1a1bc7" },
            ],
            Speeds: [{ Hour: 0, Value: 0.7 }],
          },
          {
            Texture: DEFAULT_CLOUD_ASSETS[1].referencePath,
            Colors: [
              { Hour: 3, Color: "#1a1a1bc7" },
              { Hour: 5, Color: "#ff5e4366" },
              { Hour: 7, Color: "#ffffffe6" },
              { Hour: 17, Color: "#ffffffe6" },
              { Hour: 19, Color: "#ff5e4347" },
              { Hour: 21, Color: "#1a1a1bc7" },
            ],
            Speeds: [{ Hour: 0, Value: 0.7 }],
          },
        ],
      }));
      void syncBundledAssetsToProject(DEFAULT_CLOUD_ASSETS);
    },
  });

  return (
    <div className="flex h-full flex-col bg-tn-bg">
      <AtmosphereEditorToolbar
        variant="weather"
        fileName={currentFile?.split(/[/\\]/).pop() ?? "Untitled"}
        hasDoc={hasWeatherDoc}
        isDirty={isDirty}
        saveStatus={saveStatus}
        canSave={hasWeatherDoc && Boolean(currentFile)}
        editorUIMode={editorUIMode}
        onEditorUIModeChange={setAtmosphereEditorUIMode}
        syncAtmospherePreview={syncAtmospherePreview}
        onToggleSyncAtmospherePreview={toggleSyncAtmospherePreview}
        onOpenDocs={() => {
          setRequestedDocSlug("guides/world/environments-and-weather");
          setRightPanelMode("docs");
          setRightPanelVisible(true);
        }}
        onSave={handleSave}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-3 px-4 py-4">
          {!hasWeatherDoc && (
            <div className="rounded border border-dashed border-tn-border/50 bg-tn-surface/20 px-4 py-6 text-center text-sm text-tn-text-muted">
              No weather file loaded.
            </div>
          )}

          {hasWeatherDoc && (
            <>
              <AtmosphereHelpCard
                context="weather-editor"
                editorUIMode={editorUIMode}
              />

              {(isAdvanced || weatherIssues.length > 0) && (
                <WeatherIssueLogSection
                  issues={weatherIssues}
                  open={showIssueLog}
                  onToggle={() => setShowIssueLog((v) => !v)}
                />
              )}

              <CollapsibleEditorSection
                title="Scene Preview"
                description={isAdvanced
                  ? "Live atmosphere preview sampled from the current weather tracks."
                  : "Preview sky and lighting at the selected hour."}
                badge={`${previewHour}:00`}
                open={showPreview}
                onToggle={() => setShowPreview((v) => !v)}
              >
                <WeatherPreviewPanel
                  doc={doc}
                  previewHour={previewHour}
                  onPreviewHourChange={setPreviewHour}
                  quickPresets={weatherQuickPresets}
                  daypart={daypart}
                  sunVisible={sunVisible}
                  moonVisible={moonVisible}
                  sunColor={sunColor}
                  moonColor={moonColor}
                  sunScale={sunScale}
                  moonScale={moonScale}
                  starTexture={starTexture}
                  fogSpread={fogSpread}
                  fogNear={fogNear}
                  fogFar={fogFar}
                  fogDensity={fogDensity}
                  fogHeightFalloff={fogHeightFalloff}
                  fogColor={fogColor}
                  cloudLayers={cloudLayers}
                  primaryMoonTexture={primaryMoonTexture}
                  particleSummary={particleSummary}
                  tagSummary={tagSummary}
                  colorTrackCount={colorTrackCount}
                  valueTrackCount={valueTrackCount}
                  skyTop={skyTop}
                  skyBottom={skyBottom}
                  sunlightColor={sunlightColor}
                  screenFx={screenFx}
                  waterTint={waterTint}
                  sunlightDamping={sunlightDamping}
                  moons={moons}
                  extraEntriesCount={extraEntries.length}
                  totalCloudColorKeys={totalCloudColorKeys}
                  totalCloudSpeedKeys={totalCloudSpeedKeys}
                  showAtmosphereStrip={showAtmosphereStrip}
                  onToggleAtmosphereStrip={() => setShowAtmosphereStrip((value) => !value)}
                  showPreviewTracks={showPreviewTracks}
                  onTogglePreviewTracks={() => setShowPreviewTracks((value) => !value)}
                  showPreviewSnapshot={showPreviewSnapshot}
                  onTogglePreviewSnapshot={() => setShowPreviewSnapshot((value) => !value)}
                  showPreviewAssets={showPreviewAssets}
                  onTogglePreviewAssets={() => setShowPreviewAssets((value) => !value)}
                  compact={!isAdvanced}
                />
              </CollapsibleEditorSection>

              <WeatherQuickEditSection
                doc={doc}
                previewHour={previewHour}
                open={showQuickEdit}
                onToggle={() => setShowQuickEdit((v) => !v)}
                skyTop={skyTop}
                skyBottom={skyBottom}
                sunsetColor={sunsetColor}
                fogColor={fogColor}
                sunColor={sunColor}
                waterTint={waterTint}
                sunScale={sunScale}
                fogDensity={fogDensity}
                onSetSimpleColor={setSimpleColor}
                onUpdateDoc={updateDoc}
                onUpdateSunScales={(next) => updateValueTrack("SunScales", next)}
                onUpdateFogDensities={(next) => updateValueTrack("FogDensities", next)}
              />

              {isAdvanced && (
                <>
                  <WeatherFogSection
                    doc={doc}
                    open={showFogSection}
                    onToggle={() => setShowFogSection((value) => !value)}
                    onUpdateDoc={updateDoc}
                  />

                  <WeatherColorTracksSection
                    doc={doc}
                    open={showColorSections}
                    onToggle={() => setShowColorSections((value) => !value)}
                    onUpdateColorTrack={updateColorTrack}
                  />

                  <WeatherValueTracksSection
                    doc={doc}
                    open={showValueSections}
                    onToggle={() => setShowValueSections((value) => !value)}
                    onUpdateValueTrack={updateValueTrack}
                  />

                  <WeatherCloudSection
                    clouds={cloudLayers}
                    previewHour={previewHour}
                    open={showCloudSections}
                    onToggle={() => setShowCloudSections((value) => !value)}
                  />

                  <AdditionalFieldsSection
                    entries={extraEntries}
                    open={showExtraSections}
                    onToggle={() => setShowExtraSections((value) => !value)}
                    onUpdateField={(key, value) => updateDoc((previous) => ({ ...previous, [key]: value }))}
                    describeValue={describeValue}
                  />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
