import { useMemo } from "react";
import { interpolateColorAtHour, sampleColorAtHour } from "@/utils/atmosphere";
import { ScenePreviewHourSlider } from "./ScenePreviewHourSlider";
import { buildScenePreviewModel, type WeatherSceneDoc } from "./scenePreviewModel";

interface AtmosphereScenePreviewProps {
  doc: WeatherSceneDoc;
  previewHour: number;
  onPreviewHourChange?: (hour: number) => void;
  weatherLabel?: string | null;
  inherited?: boolean;
  showSwatches?: boolean;
  showHourSlider?: boolean;
  sliderIdPrefix?: string;
}

function SceneSwatch({ label, color }: { label: string; color: string }) {
  return (
    <div className="flex min-w-0 items-center gap-1.5 rounded border border-tn-border/35 bg-tn-bg/50 px-2 py-1">
      <span
        className="h-3.5 w-3.5 shrink-0 rounded-sm border border-white/10"
        style={{ backgroundColor: color }}
        aria-hidden
      />
      <span className="truncate text-[9px] uppercase tracking-wider text-tn-text-muted">{label}</span>
    </div>
  );
}

export function AtmosphereScenePreview({
  doc,
  previewHour,
  onPreviewHourChange,
  weatherLabel,
  inherited = false,
  showSwatches = true,
  showHourSlider = true,
  sliderIdPrefix = "scene",
}: AtmosphereScenePreviewProps) {
  const model = useMemo(() => buildScenePreviewModel(doc, previewHour), [doc, previewHour]);

  const fogOpacity = clamp(model.fogDensity * 0.55 + 0.08, 0.06, 0.72);
  const sunSize = Math.max(28, 36 * Math.max(0.4, model.sunScale || 0.5));
  const moonSize = Math.max(18, 24 * Math.max(0.35, model.moonScale || 0.45));

  return (
    <div className="overflow-hidden rounded-xl border border-tn-border/50 bg-tn-surface/20">
      <div className="flex items-center justify-between gap-2 border-b border-tn-border/40 px-3 py-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-tn-text">
            {previewHour}:00
            <span className="mx-1.5 text-tn-text-muted/60">·</span>
            {model.daypart.label}
          </p>
          {weatherLabel && (
            <p className="truncate text-[10px] text-tn-text-muted">
              {weatherLabel}
              {inherited ? " (inherited)" : ""}
            </p>
          )}
        </div>
        <span
          className="shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-medium"
          style={{
            borderColor: `${model.daypart.accent}66`,
            color: model.daypart.accent,
            backgroundColor: `${model.daypart.accent}14`,
          }}
        >
          {model.daypart.label}
        </span>
      </div>

      <div
        className="relative mx-3 mt-3 aspect-[16/9] min-h-[200px] overflow-hidden rounded-lg border border-tn-border/40"
        style={{
          background: `linear-gradient(180deg, ${model.skyTop} 0%, ${model.sunlightColor} 38%, ${model.skyBottom} 72%, ${model.waterTint} 100%)`,
        }}
      >
        {/* Sunset wash */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `radial-gradient(ellipse 90% 55% at 50% 78%, ${model.sunsetColor}55 0%, transparent 62%)`,
          }}
        />

        {/* Stars */}
        <div className="pointer-events-none absolute inset-0" aria-hidden>
          {STAR_POSITIONS.map(([left, top], index) => (
            <div
              key={`star-${index}`}
              className="absolute rounded-full bg-white"
              style={{
                left: `${left}%`,
                top: `${top}%`,
                width: index % 3 === 0 ? 2 : 1,
                height: index % 3 === 0 ? 2 : 1,
                opacity: model.nightFactor * (0.35 + (index % 5) * 0.12),
              }}
            />
          ))}
        </div>

        {/* Sun arc guide */}
        <svg className="pointer-events-none absolute inset-0 h-full w-full opacity-20" aria-hidden>
          <path
            d="M 10 54 Q 50 8 90 54"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            strokeDasharray="3 4"
            className="text-tn-text-muted"
          />
        </svg>

        {/* Clouds */}
        {model.cloudLayers.slice(0, 3).map((layer, index) => {
          const color = sampleColorAtHour(layer.Colors, previewHour)
            ?? interpolateColorAtHour(layer.Colors, previewHour, "#94a3b8");
          const width = 58 - index * 8;
          return (
            <div
              key={`cloud-${index}`}
              className="pointer-events-none absolute rounded-full blur-lg"
              style={{
                left: `${12 + index * 14}%`,
                top: `${14 + index * 9}%`,
                width: `${width}%`,
                height: "14%",
                backgroundColor: color,
                opacity: 0.42 - index * 0.08,
              }}
            />
          );
        })}

        {/* Sun */}
        {model.sunVisible && (
          <div
            className="pointer-events-none absolute"
            style={{ left: `${model.sunX}%`, top: `${model.sunY}%`, transform: "translate(-50%, -50%)" }}
          >
            <div
              className="absolute rounded-full blur-xl"
              style={{
                width: sunSize * 1.8,
                height: sunSize * 1.8,
                left: "50%",
                top: "50%",
                transform: "translate(-50%, -50%)",
                backgroundColor: model.sunGlowColor,
                opacity: 0.45,
              }}
            />
            <div
              className="relative rounded-full"
              style={{
                width: sunSize,
                height: sunSize,
                backgroundColor: model.sunColor,
                boxShadow: `0 0 24px ${model.sunGlowColor}88`,
              }}
            />
          </div>
        )}

        {/* Moon */}
        {model.moonVisible && (
          <div
            className="pointer-events-none absolute rounded-full"
            style={{
              left: `${model.moonX}%`,
              top: `${model.moonY}%`,
              width: moonSize,
              height: moonSize,
              transform: "translate(-50%, -50%)",
              backgroundColor: model.moonColor,
              boxShadow: `0 0 16px ${model.moonColor}66`,
            }}
          />
        )}

        {/* Horizon haze */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[22%] h-[28%]"
          style={{
            opacity: fogOpacity,
            background: `linear-gradient(to top, ${model.fogColor} 0%, transparent 100%)`,
          }}
        />

        {/* Hills silhouette */}
        <div className="pointer-events-none absolute inset-x-0 bottom-[18%] h-[14%] opacity-90" aria-hidden>
          <svg viewBox="0 0 100 20" preserveAspectRatio="none" className="h-full w-full">
            <path
              d="M0 20 L0 12 Q 12 6 22 10 T 38 8 T 55 11 T 72 7 T 88 10 T 100 8 L100 20 Z"
              fill={model.skyBottom}
              opacity={0.85}
            />
            <path
              d="M0 20 L0 15 Q 18 11 35 13 T 60 12 T 82 14 T 100 12 L100 20 Z"
              fill="#0a0f18"
              opacity={0.55}
            />
          </svg>
        </div>

        {/* Water / ground plane */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-[20%]"
          style={{
            background: `linear-gradient(180deg, ${model.waterTint}00 0%, ${model.waterTint}cc 55%, ${model.waterTint} 100%)`,
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-0 bottom-[18%] h-px bg-white/15"
          aria-hidden
        />
      </div>

      {showSwatches && (
        <div className="mx-3 mt-2 grid grid-cols-2 gap-1.5 sm:grid-cols-5">
          <SceneSwatch label="Sky" color={model.skyTop} />
          <SceneSwatch label="Horizon" color={model.skyBottom} />
          <SceneSwatch label="Fog" color={model.fogColor} />
          <SceneSwatch label="Sun" color={model.sunColor} />
          <SceneSwatch label="Water" color={model.waterTint} />
        </div>
      )}

      {showHourSlider && onPreviewHourChange && (
        <ScenePreviewHourSlider
          idPrefix={sliderIdPrefix}
          previewHour={previewHour}
          onPreviewHourChange={onPreviewHourChange}
          skyTopColors={doc.SkyTopColors}
          skyBottomColors={doc.SkyBottomColors}
        />
      )}
    </div>
  );
}

const STAR_POSITIONS: Array<[number, number]> = [
  [8, 12], [14, 8], [22, 18], [31, 6], [38, 14], [46, 9], [54, 16], [62, 7],
  [71, 13], [79, 5], [86, 11], [92, 17], [11, 22], [19, 26], [27, 19], [35, 24],
  [43, 20], [51, 27], [59, 21], [67, 25], [75, 18], [83, 23], [90, 28], [17, 32],
];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
