import {
  buildColorString,
  normalizeHourInput,
  readAlpha,
  readHexColor,
  type HourColor,
} from "@/utils/atmosphere";
import { buildTrackGradient, sectionClass } from "./weatherEditorUtils";

export interface ColorTrackCardProps {
  label: string;
  keyframes: HourColor[];
  onChange: (index: number, next: HourColor) => void;
  onRemove: (index: number) => void;
  onAdd: () => void;
  isFocused?: boolean;
}

export function ColorTrackCard({ label, keyframes, onChange, onRemove, onAdd, isFocused = false }: ColorTrackCardProps) {
  const entries = keyframes
    .map((entry, index) => ({ entry, index }))
    .sort((left, right) => left.entry.Hour - right.entry.Hour);
  const gradient = buildTrackGradient(keyframes);

  return (
    <div className={sectionClass(isFocused)}>
      <div className="border-b border-tn-border/40 px-3 py-2">
        <div className="flex items-center gap-2">
          <div
            className="h-5 flex-1 rounded border border-tn-border/40"
            style={{ background: keyframes.length ? `linear-gradient(to right, ${gradient})` : "transparent" }}
          />
          <span className="w-24 shrink-0 text-[11px] font-medium text-tn-text">{label}</span>
          <span className="w-12 shrink-0 text-right text-[10px] text-tn-text-muted">{keyframes.length} keys</span>
        </div>
      </div>
      <div className="space-y-2 px-3 py-3">
        {entries.map(({ entry, index }) => (
          <div key={`${entry.Hour}-${index}`} className="flex items-center gap-2">
            <label className="relative shrink-0 cursor-pointer" title="Pick color">
              <div
                className="h-7 w-7 rounded border border-tn-border/70 shadow-sm"
                style={{ backgroundColor: readHexColor(entry.Color) }}
              />
              <input
                type="color"
                value={readHexColor(entry.Color)}
                onChange={(event) => {
                  onChange(index, {
                    ...entry,
                    Color: buildColorString(event.target.value, readAlpha(entry.Color)),
                  });
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>
            <input
              type="text"
              value={entry.Color}
              onChange={(event) => onChange(index, { ...entry, Color: event.target.value })}
              className="min-w-0 flex-1 rounded border border-tn-border bg-tn-bg px-2 py-1 text-[10px] font-mono text-tn-text"
            />
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={readAlpha(entry.Color)}
              onChange={(event) => {
                const alpha = Number.parseFloat(event.target.value);
                if (!Number.isFinite(alpha)) return;
                onChange(index, {
                  ...entry,
                  Color: buildColorString(readHexColor(entry.Color), alpha),
                });
              }}
              className="w-14 shrink-0 rounded border border-tn-border bg-tn-bg px-1.5 py-1 text-[10px] font-mono text-right text-tn-text"
              title="Alpha"
            />
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
