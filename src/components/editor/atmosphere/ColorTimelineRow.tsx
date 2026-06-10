import { interpolateColorAtHour, type HourColor } from "@/utils/atmosphere";
import { HOURS } from "./weatherEditorConstants";

export interface ColorTimelineRowProps {
  label: string;
  keyframes: HourColor[];
  currentHour: number;
  onSelectHour: (hour: number) => void;
}

export function ColorTimelineRow({ label, keyframes, currentHour, onSelectHour }: ColorTimelineRowProps) {
  return (
    <div className="rounded border border-tn-border/50 bg-tn-bg/70 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-tn-text">{label}</span>
        <div className="flex items-center gap-2 text-[10px] text-tn-text-muted">
          <span>{keyframes.length} keys</span>
          <span className="font-mono">{interpolateColorAtHour(keyframes, currentHour)}</span>
        </div>
      </div>
      <div className="grid grid-cols-12 gap-1 sm:grid-cols-24">
        {HOURS.map((hour) => (
          <button
            key={`${label}-${hour}`}
            type="button"
            onClick={() => onSelectHour(hour)}
            className={`rounded border transition-transform hover:-translate-y-0.5 ${
              currentHour === hour ? "border-tn-accent ring-1 ring-tn-accent/50" : "border-tn-border/40"
            }`}
            title={`${label} at ${hour}:00`}
          >
            <div
              className="h-6 rounded-sm"
              style={{ backgroundColor: interpolateColorAtHour(keyframes, hour) }}
            />
            <p className="py-0.5 text-center text-[9px] font-mono text-tn-text-muted">{hour}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
