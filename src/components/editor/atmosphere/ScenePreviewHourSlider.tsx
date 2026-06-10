import { useMemo, type KeyboardEvent } from "react";
import { interpolateColorAtHour, sampleColorAtHour, type HourColor } from "@/utils/atmosphere";
import { ATMOSPHERE_HOURS, stepAtmosphereHour } from "@/utils/atmosphere/atmosphereHours";
import { QUICK_PREVIEW_HOURS } from "./PreviewHourControls";

const HOURS = ATMOSPHERE_HOURS;

interface ScenePreviewHourSliderProps {
  previewHour: number;
  onPreviewHourChange: (hour: number) => void;
  idPrefix: string;
  skyTopColors?: HourColor[];
  skyBottomColors?: HourColor[];
}

export function ScenePreviewHourSlider({
  previewHour,
  onPreviewHourChange,
  idPrefix,
  skyTopColors,
  skyBottomColors,
}: ScenePreviewHourSliderProps) {
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPreviewHourChange(stepAtmosphereHour(previewHour, -1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onPreviewHourChange(stepAtmosphereHour(previewHour, 1));
    }
  };
  const trackGradient = useMemo(
    () => HOURS.map((hour) => {
      const top = sampleColorAtHour(skyTopColors, hour)
        ?? interpolateColorAtHour(skyTopColors, hour, "#28405a");
      const bottom = sampleColorAtHour(skyBottomColors, hour)
        ?? interpolateColorAtHour(skyBottomColors, hour, "#0f172a");
      return `${top} ${(hour / 23) * 50}%, ${bottom} ${((hour + 0.5) / 23) * 100}%`;
    }).join(", "),
    [skyTopColors, skyBottomColors],
  );

  return (
    <div
      className="mx-3 mb-3 mt-2 space-y-2 outline-none focus-within:ring-1 focus-within:ring-tn-accent/40 focus-within:ring-offset-1 focus-within:ring-offset-tn-bg rounded-md"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="group"
      aria-label="Scene preview time controls. Use left and right arrow keys to step by one hour."
    >
      <div className="flex items-center gap-3">
        <label
          className="shrink-0 text-[9px] font-semibold uppercase tracking-wider text-tn-text-muted"
          htmlFor={`${idPrefix}-scene-hour`}
        >
          Time
        </label>
        <div className="relative min-w-0 flex-1">
          <div
            className="pointer-events-none absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full opacity-70"
            style={{ background: trackGradient ? `linear-gradient(to right, ${trackGradient})` : undefined }}
            aria-hidden
          />
          <input
            id={`${idPrefix}-scene-hour`}
            type="range"
            min={0}
            max={23}
            step={1}
            value={previewHour}
            onChange={(event) => {
              const hour = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(hour)) onPreviewHourChange(hour);
            }}
            className="relative z-10 w-full accent-tn-accent"
            aria-label={`Preview hour: ${previewHour}:00`}
            aria-valuemin={0}
            aria-valuemax={23}
            aria-valuenow={previewHour}
          />
        </div>
        <span className="w-10 shrink-0 text-right text-[11px] font-mono font-medium text-tn-text">
          {previewHour}:00
        </span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {QUICK_PREVIEW_HOURS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => onPreviewHourChange(preset.hour)}
            className={`rounded border px-2 py-0.5 text-[10px] font-medium transition-colors ${
              previewHour === preset.hour
                ? "border-tn-accent/60 bg-tn-accent/15 text-tn-accent"
                : "border-tn-border/50 bg-tn-bg/50 text-tn-text-muted hover:border-tn-accent/40 hover:text-tn-text"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  );
}
