import { interpolateValueAtHour, normalizeHourInput, type HourValue } from "@/utils/atmosphere";
import { HOURS } from "./weatherEditorConstants";
import { sectionClass } from "./weatherEditorUtils";

export interface ValueTrackCardProps {
  label: string;
  keyframes: HourValue[];
  onChange: (index: number, next: HourValue) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  isFocused?: boolean;
}

export function ValueTrackCard({ label, keyframes, onChange, onRemove, onAdd, isFocused = false }: ValueTrackCardProps) {
  const entries = keyframes
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => left.entry.Hour - right.entry.Hour);
  const samples = HOURS.map((hour) => interpolateValueAtHour(keyframes, hour));
  const minValue = samples.length ? Math.min(...samples) : 0;
  const maxValue = samples.length ? Math.max(...samples) : 0;
  const span = Math.max(1, maxValue - minValue);

  return (
    <div className={sectionClass(isFocused)}>
      <div className="border-b border-tn-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <div className="flex h-8 flex-1 items-end gap-px rounded border border-tn-border/40 bg-tn-bg px-1 py-1">
            {samples.map((sample, index) => {
              const normalized = ((sample - minValue) / span) * 100;
              return (
                <div
                  key={`${label}-${index}`}
                  className="flex-1 rounded-sm bg-tn-accent/60"
                  style={{ height: `${Math.max(12, normalized || 0)}%` }}
                />
              );
            })}
          </div>
          <span className="w-24 shrink-0 text-[11px] font-medium text-tn-text">{label}</span>
          <span className="w-12 shrink-0 text-right text-[10px] text-tn-text-muted">{keyframes.length} keys</span>
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        {entries.map(({ entry, index }) => (
          <div key={`${entry.Hour}-${index}`} className="flex items-center gap-2">
            <span className="w-12 shrink-0 text-right text-[10px] font-mono text-tn-text-muted">{entry.Hour}:00</span>
            <input
              type="number"
              min={0}
              max={23}
              step={1}
              value={entry.Hour}
              onChange={(event) => {
                const hour = Number.parseInt(event.target.value, 10);
                if (!Number.isFinite(hour)) return;
                onChange(index, { ...entry, Hour: normalizeHourInput(hour) });
              }}
              className="w-14 shrink-0 rounded border border-tn-border bg-tn-bg px-1.5 py-1 text-[10px] font-mono text-right text-tn-text"
            />
            <input
              type="number"
              step={0.05}
              value={entry.Value}
              onChange={(event) => {
                const value = Number.parseFloat(event.target.value);
                if (!Number.isFinite(value)) return;
                onChange(index, { ...entry, Value: value });
              }}
              className="min-w-0 flex-1 rounded border border-tn-border bg-tn-bg px-2 py-1 text-[10px] font-mono text-right text-tn-text"
            />
            <button
              type="button"
              onClick={() => onRemove(index)}
              className="shrink-0 rounded border border-tn-border/60 px-2 py-1 text-[10px] text-tn-text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
              title="Remove keyframe"
            >
              x
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={onAdd}
          className="w-full rounded border border-tn-accent/40 px-2 py-1 text-[10px] text-tn-accent transition-colors hover:bg-tn-accent/10"
        >
          Add keyframe
        </button>
      </div>
    </div>
  );
}
