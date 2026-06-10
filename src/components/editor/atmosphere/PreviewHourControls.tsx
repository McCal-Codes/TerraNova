import { type KeyboardEvent } from "react";
import { stepAtmosphereHour } from "@/utils/atmosphere/atmosphereHours";

export const QUICK_PREVIEW_HOURS = [
  { label: "Night", hour: 0 },
  { label: "Morning", hour: 8 },
  { label: "Afternoon", hour: 12 },
  { label: "Evening", hour: 18 },
] as const;

interface PreviewHourControlsProps {
  previewHour: number;
  onPreviewHourChange: (hour: number) => void;
  idPrefix: string;
  quickPresets?: ReadonlyArray<{ label: string; hour: number }>;
}

export function PreviewHourControls({
  previewHour,
  onPreviewHourChange,
  idPrefix,
  quickPresets = QUICK_PREVIEW_HOURS,
}: PreviewHourControlsProps) {
  const quickPreviewPresetValue = quickPresets.find((preset) => preset.hour === previewHour)?.hour.toString() ?? "custom";

  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      onPreviewHourChange(stepAtmosphereHour(previewHour, -1));
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      onPreviewHourChange(stepAtmosphereHour(previewHour, 1));
    }
  };

  return (
    <div
      className="mb-3 flex flex-wrap items-center gap-3 rounded border border-tn-border/40 bg-tn-bg/40 px-3 py-2 outline-none focus-within:ring-1 focus-within:ring-tn-accent/40"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      role="group"
      aria-label="Preview hour controls. Use left and right arrow keys to step by one hour."
    >
      <label className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted" htmlFor={`${idPrefix}-preview-hour`}>
        Preview Hour
      </label>
      <input
        id={`${idPrefix}-preview-hour`}
        type="range"
        min={0}
        max={23}
        step={1}
        value={previewHour}
        onChange={(event) => {
          const hour = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(hour)) onPreviewHourChange(hour);
        }}
        className="min-w-[180px] flex-1 accent-tn-accent"
        aria-label={`Preview hour: ${previewHour}:00`}
        aria-valuemin={0}
        aria-valuemax={23}
        aria-valuenow={previewHour}
      />
      <span className="w-12 text-right text-[10px] font-mono text-tn-text-muted">{previewHour}:00</span>
      <label className="text-[10px] font-semibold uppercase tracking-wider text-tn-text-muted" htmlFor={`${idPrefix}-preview-jump`}>
        Jump To
      </label>
      <select
        id={`${idPrefix}-preview-jump`}
        value={quickPreviewPresetValue}
        onChange={(event) => {
          if (event.target.value === "custom") return;
          const hour = Number.parseInt(event.target.value, 10);
          if (Number.isFinite(hour)) onPreviewHourChange(hour);
        }}
        className="rounded border border-tn-border bg-tn-bg px-2 py-1 text-[11px] text-tn-text"
        aria-label="Jump to preset time"
      >
        <option value="custom">Manual slider</option>
        {quickPresets.map((preset) => (
          <option key={preset.label} value={preset.hour}>
            {preset.label} ({preset.hour}:00)
          </option>
        ))}
      </select>
    </div>
  );
}
