import { interpolateValueAtHour, type HourValue } from "@/utils/atmosphere";
import { HOURS } from "./weatherEditorConstants";
import { formatTrackValue } from "./weatherEditorUtils";

export interface ValueTimelineRowProps {
  label: string;
  keyframes: HourValue[];
  currentHour: number;
  onSelectHour: (hour: number) => void;
}

export function ValueTimelineRow({ label, keyframes, currentHour, onSelectHour }: ValueTimelineRowProps) {
  const samples = HOURS.map((hour) => interpolateValueAtHour(keyframes, hour));
  const minValue = samples.length ? Math.min(...samples) : 0;
  const maxValue = samples.length ? Math.max(...samples) : 0;
  const span = Math.max(1, maxValue - minValue);

  return (
    <div className="rounded border border-tn-border/50 bg-tn-bg/70 p-2">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[11px] font-medium text-tn-text">{label}</span>
        <div className="flex items-center gap-2 text-[10px] text-tn-text-muted">
          <span>{keyframes.length} keys</span>
          <span className="font-mono">{formatTrackValue(interpolateValueAtHour(keyframes, currentHour))}</span>
        </div>
      </div>
      <div className="grid grid-cols-12 items-end gap-1 sm:grid-cols-24">
        {samples.map((sample, hour) => {
          const normalized = ((sample - minValue) / span) * 100;
          return (
            <button
              key={`${label}-${hour}`}
              type="button"
              onClick={() => onSelectHour(hour)}
              className={`rounded border px-0.5 pt-1 transition-transform hover:-translate-y-0.5 ${
                currentHour === hour ? "border-tn-accent ring-1 ring-tn-accent/50" : "border-tn-border/40"
              }`}
              title={`${label} at ${hour}:00 = ${formatTrackValue(sample)}`}
            >
              <div className="flex h-10 items-end">
                <div
                  className="w-full rounded-sm bg-tn-accent/70"
                  style={{ height: `${Math.max(12, normalized || 0)}%` }}
                />
              </div>
              <p className="py-0.5 text-center text-[9px] font-mono text-tn-text-muted">{hour}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
