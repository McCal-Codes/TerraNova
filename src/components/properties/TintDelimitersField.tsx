import { ColorPickerField } from "./ColorPickerField";

export interface TintDelimitersFieldProps {
  delimiters: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
  onBlur?: () => void;
}

export function TintDelimitersField({ delimiters, onChange, onBlur }: TintDelimitersFieldProps) {
  const bandColors = delimiters.map((d) => {
    const t = (d.Tint as Record<string, unknown>) ?? {};
    return typeof t.Color === "string" ? t.Color : "#5b9e28";
  });
  const gradientStops = bandColors.length === 0
    ? "transparent"
    : bandColors.length === 1
      ? bandColors[0]
      : bandColors.map((c, i) => `${c} ${Math.round((i / (bandColors.length - 1)) * 100)}%`).join(", ");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-tn-text-muted uppercase tracking-wider font-semibold">Tint Bands</span>
        <span className="text-[10px] text-tn-text-muted/50">
          {delimiters.length} band{delimiters.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="relative h-6 w-full rounded overflow-hidden border border-tn-border/60">
        <div
          className="absolute inset-0"
          style={{ background: `linear-gradient(to right, ${gradientStops})` }}
        />
        {bandColors.length > 1 && bandColors.slice(0, -1).map((_, i) => (
          <div
            key={i}
            className="absolute top-0 bottom-0 w-px bg-black/30"
            style={{ left: `${((i + 1) / bandColors.length) * 100}%` }}
          />
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        {delimiters.map((delimiter, idx) => {
          const tint = (delimiter.Tint as Record<string, unknown>) ?? {};
          const range = (delimiter.Range as Record<string, unknown>) ?? {};
          const color = typeof tint.Color === "string" ? tint.Color : "#5b9e28";
          const minVal = typeof range.MinInclusive === "number" ? range.MinInclusive : -1;
          const maxVal = typeof range.MaxExclusive === "number" ? range.MaxExclusive : 1;
          return (
            <div key={idx} className="rounded border border-tn-border bg-tn-bg overflow-hidden">
              <div className="h-1.5 w-full" style={{ backgroundColor: color }} />
              <div className="px-2 py-1.5 flex flex-col gap-1.5">
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[10px] text-tn-text-muted font-semibold">Band {idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => onChange(delimiters.filter((_, i) => i !== idx))}
                    className="text-[10px] text-tn-text-muted hover:text-red-400 transition-colors leading-none px-1"
                    title="Remove band"
                  >
                    x
                  </button>
                </div>

                <ColorPickerField
                  label={`Band ${idx + 1} color`}
                  hideLabel
                  value={color}
                  onChange={(v) => {
                    const next = delimiters.map((d, i) => (i === idx ? {
                      ...d,
                      Tint: { Type: "Constant", ...(d.Tint as Record<string, unknown>), Color: v },
                    } : d));
                    onChange(next);
                  }}
                  onBlur={onBlur ?? (() => {})}
                />

                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-tn-text-muted w-5 shrink-0">Min</span>
                  <input
                    type="number"
                    step="0.01"
                    value={minVal}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isNaN(v)) return;
                      const next = delimiters.map((d, i) => (i === idx ? {
                        ...d,
                        Range: { ...(d.Range as Record<string, unknown>), MinInclusive: v },
                      } : d));
                      onChange(next);
                    }}
                    onBlur={onBlur}
                    className="flex-1 text-[10px] bg-tn-bg border border-tn-border rounded px-1.5 py-0.5 text-tn-text text-right font-mono"
                  />
                  <span className="text-[10px] text-tn-text-muted w-6 shrink-0 text-center">Max</span>
                  <input
                    type="number"
                    step="0.01"
                    value={maxVal}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (Number.isNaN(v)) return;
                      const next = delimiters.map((d, i) => (i === idx ? {
                        ...d,
                        Range: { ...(d.Range as Record<string, unknown>), MaxExclusive: v },
                      } : d));
                      onChange(next);
                    }}
                    onBlur={onBlur}
                    className="flex-1 text-[10px] bg-tn-bg border border-tn-border rounded px-1.5 py-0.5 text-tn-text text-right font-mono"
                  />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => {
          const last = delimiters[delimiters.length - 1];
          const lastMax = typeof (last?.Range as Record<string, unknown>)?.MaxExclusive === "number"
            ? Math.min((last.Range as Record<string, unknown>).MaxExclusive as number, 1)
            : 1;
          onChange([
            ...delimiters,
            {
              Range: { MinInclusive: lastMax, MaxExclusive: Math.min(lastMax + 0.33, 1) },
              Tint: { Type: "Constant", Color: "#7ea629" },
            },
          ]);
        }}
        className="text-[10px] text-tn-accent border border-tn-accent/50 rounded px-2 py-1 hover:bg-tn-accent/10 transition-colors w-full"
      >
        + Add band
      </button>
    </div>
  );
}
