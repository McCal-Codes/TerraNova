import {
  interpolateColorAtHour,
  interpolateValueAtHour,
  type HourColor,
  type HourValue,
} from "@/utils/atmosphere";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { ColorTimelineRow } from "./ColorTimelineRow";
import { PreviewHourControls } from "./PreviewHourControls";
import { PreviewInsightCard, PreviewSwatchCard, PreviewValueCard } from "./WeatherPreviewCards";
import { ValueTimelineRow } from "./ValueTimelineRow";
import { AtmosphereSceneSyncFooter } from "./AtmosphereSceneSyncFooter";
import { WeatherScenePreview } from "./WeatherScenePreview";
import { buildTrackGradient, formatTrackValue, readTextureLabel } from "./weatherEditorUtils";
import { HOURS, type WeatherDoc } from "./weatherEditorConstants";

interface DaypartInfo {
  label: string;
  description: string;
  accent: string;
}

interface WeatherPreviewPanelProps {
  doc: WeatherDoc;
  previewHour: number;
  onPreviewHourChange: (hour: number) => void;
  quickPresets: readonly { label: string; hour: number }[];
  daypart: DaypartInfo;
  sunVisible: boolean;
  moonVisible: boolean;
  sunColor: string;
  moonColor: string;
  sunScale: number;
  moonScale: number;
  starTexture: string | null;
  fogSpread: number | null;
  fogNear: number | null;
  fogFar: number | null;
  fogDensity: number;
  fogHeightFalloff: number;
  fogColor: string;
  cloudLayers: NonNullable<WeatherDoc["Clouds"]>;
  primaryMoonTexture: string | undefined;
  particleSummary: string;
  tagSummary: string;
  colorTrackCount: number;
  valueTrackCount: number;
  skyTop: string;
  skyBottom: string;
  sunlightColor: string;
  screenFx: string;
  waterTint: string;
  sunlightDamping: number;
  moons: NonNullable<WeatherDoc["Moons"]>;
  extraEntriesCount: number;
  totalCloudColorKeys: number;
  totalCloudSpeedKeys: number;
  showAtmosphereStrip: boolean;
  onToggleAtmosphereStrip: () => void;
  showPreviewTracks: boolean;
  onTogglePreviewTracks: () => void;
  showPreviewSnapshot: boolean;
  onTogglePreviewSnapshot: () => void;
  showPreviewAssets: boolean;
  onTogglePreviewAssets: () => void;
  compact?: boolean;
}

export function WeatherPreviewPanel({
  doc,
  previewHour,
  onPreviewHourChange,
  quickPresets,
  daypart,
  sunVisible,
  moonVisible,
  sunColor,
  moonColor,
  sunScale,
  moonScale,
  starTexture,
  fogSpread,
  fogNear,
  fogFar,
  fogDensity,
  fogHeightFalloff,
  fogColor,
  cloudLayers,
  primaryMoonTexture,
  particleSummary,
  tagSummary,
  colorTrackCount,
  valueTrackCount,
  skyTop,
  skyBottom,
  sunlightColor,
  screenFx,
  waterTint,
  sunlightDamping,
  moons,
  extraEntriesCount,
  totalCloudColorKeys,
  totalCloudSpeedKeys,
  showAtmosphereStrip,
  onToggleAtmosphereStrip,
  showPreviewTracks,
  onTogglePreviewTracks,
  showPreviewSnapshot,
  onTogglePreviewSnapshot,
  showPreviewAssets,
  onTogglePreviewAssets,
  compact = false,
}: WeatherPreviewPanelProps) {
  return (
    <div>
      {!compact && (
        <PreviewHourControls
          idPrefix="weather"
          previewHour={previewHour}
          onPreviewHourChange={onPreviewHourChange}
          quickPresets={quickPresets}
        />
      )}

      <WeatherScenePreview
        doc={doc}
        previewHour={previewHour}
        onPreviewHourChange={onPreviewHourChange}
        compact={compact}
        sliderIdPrefix="weather-scene"
      />

      {compact && <AtmosphereSceneSyncFooter />}

      {compact && (
        <p className="mt-2 text-[10px] leading-relaxed text-tn-text-muted">{daypart.description}</p>
      )}

      {!compact && (
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-4">
        <PreviewInsightCard
          label="Daypart"
          title={daypart.label}
          detail={daypart.description}
          accent={daypart.accent}
        />
        <PreviewInsightCard
          label="Celestial"
          title={sunVisible ? "Sun in frame" : moonVisible ? "Moon in frame" : "No body visible"}
          detail={`Sun scale ${formatTrackValue(sunScale)} | Moon scale ${formatTrackValue(moonScale)} | Stars ${starTexture ? "configured" : "missing"}`}
          accent={sunVisible ? sunColor : moonColor}
        />
        <PreviewInsightCard
          label="Fog Volume"
          title={fogSpread !== null ? `${formatTrackValue(fogSpread)} span` : "Not configured"}
          detail={`Near ${fogNear ?? "?"} | Far ${fogFar ?? "?"} | Density ${formatTrackValue(fogDensity)} | Falloff ${formatTrackValue(fogHeightFalloff)}`}
          accent={fogColor}
        />
        <PreviewInsightCard
          label="Asset Stack"
          title={`${cloudLayers.length} cloud layer${cloudLayers.length === 1 ? "" : "s"}`}
          detail={`Stars ${readTextureLabel(starTexture ?? undefined)} | Moon ${readTextureLabel(primaryMoonTexture)} | Particle ${particleSummary}`}
          accent={cloudLayers[0]?.Colors?.length ? interpolateColorAtHour(cloudLayers[0].Colors ?? [], previewHour) : "#64748b"}
        />
      </div>
      )}

      {!compact && (
      <div className="mt-3 space-y-3">
        <CollapsibleEditorSection
          title="24h Atmosphere Strip"
          description="A compact day-long sky strip. Click any hour to retime the scene preview."
          badge={`${previewHour}:00`}
          open={showAtmosphereStrip}
          onToggle={onToggleAtmosphereStrip}
        >
          <div className="grid grid-cols-12 gap-1 sm:grid-cols-24">
            {HOURS.map((hour) => (
              <button
                key={`hour-strip-${hour}`}
                type="button"
                onClick={() => onPreviewHourChange(hour)}
                className={`group rounded border transition-transform hover:-translate-y-0.5 ${
                  previewHour === hour ? "border-tn-accent ring-1 ring-tn-accent/50" : "border-tn-border/50"
                }`}
                title={`${hour}:00`}
              >
                <div
                  className="h-10 rounded-sm"
                  style={{
                    background: `linear-gradient(to bottom, ${interpolateColorAtHour(doc.SkyTopColors, hour)}, ${interpolateColorAtHour(doc.SkyBottomColors, hour)})`,
                  }}
                />
                <p className="py-1 text-center text-[9px] font-mono text-tn-text-muted">{hour}</p>
              </button>
            ))}
          </div>
        </CollapsibleEditorSection>

        <CollapsibleEditorSection
          title="Track Preview"
          description="Sampled color and numeric tracks synced to the current preview hour."
          badge={`${colorTrackCount + valueTrackCount} keys`}
          open={showPreviewTracks}
          onToggle={onTogglePreviewTracks}
        >
          <div className="grid gap-3 xl:grid-cols-2">
            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">Color Track Preview</p>
                <p className="mt-1 text-[11px] text-tn-text-muted">
                  These rows are sampled directly from the color tracks. Click any hour to retime the preview.
                </p>
              </div>
              <ColorTimelineRow
                label="Sky Top"
                keyframes={(doc.SkyTopColors as HourColor[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ColorTimelineRow
                label="Sky Bottom"
                keyframes={(doc.SkyBottomColors as HourColor[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ColorTimelineRow
                label="Sunset"
                keyframes={(doc.SkySunsetColors as HourColor[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ColorTimelineRow
                label="Fog"
                keyframes={(doc.FogColors as HourColor[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ColorTimelineRow
                label="Water"
                keyframes={(doc.WaterTints as HourColor[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">Numeric Track Preview</p>
                <p className="mt-1 text-[11px] text-tn-text-muted">
                  Curve sampling is shown here without leaving the editor. The selected hour stays synchronized with the scene card.
                </p>
              </div>
              <ValueTimelineRow
                label="Sun Scale"
                keyframes={(doc.SunScales as HourValue[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ValueTimelineRow
                label="Moon Scale"
                keyframes={(doc.MoonScales as HourValue[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ValueTimelineRow
                label="Fog Density"
                keyframes={(doc.FogDensities as HourValue[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ValueTimelineRow
                label="Fog Falloff"
                keyframes={(doc.FogHeightFalloffs as HourValue[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
              <ValueTimelineRow
                label="Light Damping"
                keyframes={(doc.SunlightDampingMultipliers as HourValue[] | undefined) ?? []}
                currentHour={previewHour}
                onSelectHour={onPreviewHourChange}
              />
            </div>
          </div>
        </CollapsibleEditorSection>

        <CollapsibleEditorSection
          title="Sampled Values"
          description="Current-hour swatches and numeric readouts pulled from the preview model."
          badge={`${previewHour}:00 snapshot`}
          open={showPreviewSnapshot}
          onToggle={onTogglePreviewSnapshot}
        >
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            <PreviewSwatchCard label="Sky Top" color={skyTop} detail={skyTop} />
            <PreviewSwatchCard label="Sky Bottom" color={skyBottom} detail={skyBottom} />
            <PreviewSwatchCard label="Fog" color={fogColor} detail={fogColor} />
            <PreviewSwatchCard label="Sunlight" color={sunlightColor} detail={sunlightColor} />
            <PreviewSwatchCard label="Screen FX" color={screenFx} detail={screenFx} />
            <PreviewSwatchCard label="Water Tint" color={waterTint} detail={waterTint} />
            <PreviewValueCard label="Fog Density" value={formatTrackValue(fogDensity)} detail="Interpolated at the selected hour." />
            <PreviewValueCard label="Fog Falloff" value={formatTrackValue(fogHeightFalloff)} detail="Height fade sampled from the curve." />
            <PreviewValueCard label="Light Damping" value={formatTrackValue(sunlightDamping)} detail="Scene damping multiplier at this hour." />
          </div>
        </CollapsibleEditorSection>

        <CollapsibleEditorSection
          title="Asset Breakdown"
          description="Cloud, celestial, and metadata summaries inferred from the loaded weather file."
          badge={`${cloudLayers.length} cloud layers`}
          open={showPreviewAssets}
          onToggle={onTogglePreviewAssets}
        >
          <div className="grid gap-3 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="rounded border border-tn-border/50 bg-tn-bg/70 p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">Cloud and Celestial Breakdown</p>
                  <p className="mt-1 text-[11px] text-tn-text-muted">
                    Asset-level preview details inferred from the weather file itself.
                  </p>
                </div>
                <span className="text-[10px] font-mono text-tn-text-muted">{tagSummary}</span>
              </div>
              <div className="mt-3 grid gap-2 lg:grid-cols-2">
                {cloudLayers.slice(0, 4).map((layer, index) => {
                  const gradient = Array.isArray(layer.Colors) && layer.Colors.length
                    ? buildTrackGradient(layer.Colors ?? [])
                    : "";
                  const speed = interpolateValueAtHour(layer.Speeds ?? [], previewHour);
                  return (
                    <div key={`${layer.Texture ?? "cloud"}-${index}`} className="rounded border border-tn-border/40 bg-tn-surface/40 p-2">
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <p className="text-[11px] font-medium text-tn-text">{`Cloud Layer ${index + 1}`}</p>
                          <p className="text-[10px] text-tn-text-muted">{readTextureLabel(layer.Texture)}</p>
                        </div>
                        <span className="text-[10px] font-mono text-tn-text-muted">{formatTrackValue(speed)} speed</span>
                      </div>
                      {gradient && (
                        <div
                          className="mt-2 h-3 rounded border border-tn-border/40"
                          style={{ background: `linear-gradient(to right, ${gradient})` }}
                        />
                      )}
                      <p className="mt-2 text-[10px] text-tn-text-muted">
                        {Array.isArray(layer.Colors) ? layer.Colors.length : 0} color keys | {Array.isArray(layer.Speeds) ? layer.Speeds.length : 0} speed keys
                      </p>
                    </div>
                  );
                })}
                {cloudLayers.length === 0 && (
                  <div className="rounded border border-dashed border-tn-border/50 bg-tn-surface/20 p-3 text-[11px] text-tn-text-muted">
                    No cloud layers are configured in this weather file.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded border border-tn-border/50 bg-tn-bg/70 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted">Assets and Metadata</p>
              <div className="mt-3 space-y-2 text-[11px] text-tn-text">
                <div className="rounded border border-tn-border/40 bg-tn-surface/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Stars</p>
                  <p className="mt-1">{readTextureLabel(starTexture ?? undefined)}</p>
                </div>
                <div className="rounded border border-tn-border/40 bg-tn-surface/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Moon Cycle</p>
                  <p className="mt-1">{moons.length} entries</p>
                  <p className="mt-1 text-[10px] text-tn-text-muted">{readTextureLabel(primaryMoonTexture)}</p>
                </div>
                <div className="rounded border border-tn-border/40 bg-tn-surface/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Tags</p>
                  <p className="mt-1 text-[10px] leading-relaxed text-tn-text-muted">{tagSummary}</p>
                </div>
                <div className="rounded border border-tn-border/40 bg-tn-surface/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Unmodeled Fields</p>
                  <p className="mt-1">{extraEntriesCount} extra field{extraEntriesCount === 1 ? "" : "s"}</p>
                </div>
                <div className="rounded border border-tn-border/40 bg-tn-surface/40 px-3 py-2">
                  <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">Cloud Keys</p>
                  <p className="mt-1">{totalCloudColorKeys} color keys | {totalCloudSpeedKeys} speed keys</p>
                </div>
              </div>
            </div>
          </div>
        </CollapsibleEditorSection>
      </div>
      )}
    </div>
  );
}
