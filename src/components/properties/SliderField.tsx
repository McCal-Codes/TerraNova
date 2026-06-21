import { useRef, useCallback } from "react";
import { FieldTooltip } from "./FieldTooltip";

interface SliderFieldProps {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  description?: string;
  /** When true, the number input accepts any value beyond the slider range */
  allowInputOverflow?: boolean;
  onChange: (value: number) => void;
  onBlur?: () => void;
}

function round(v: number, step: number): number {
  if (step <= 0) return v;
  const inv = 1 / step;
  return Math.round(v * inv) / inv;
}

export function SliderField({
  label,
  value,
  min = -100,
  max = 100,
  step = 0.01,
  description,
  allowInputOverflow,
  onChange,
  onBlur,
}: SliderFieldProps) {
  // Drag-to-scrub on the label
  const scrubRef = useRef<{ startX: number; startValue: number } | null>(null);

  const handleLabelPointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      scrubRef.current = { startX: e.clientX, startValue: value };
    },
    [value],
  );

  const handleLabelPointerMove = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!scrubRef.current) return;
      const dx = e.clientX - scrubRef.current.startX;
      // Fixed rate: 200px spans the full [min, max] range. Shift = 10x finer.
      const range = max - min || 1;
      const rate = e.shiftKey ? range / 2000 : range / 200;
      const snapStep = e.shiftKey ? step * 0.1 : step;
      const next = scrubRef.current.startValue + dx * rate;
      const clamped = allowInputOverflow ? Math.max(min, next) : Math.max(min, Math.min(max, next));
      onChange(round(clamped, snapStep));
    },
    [allowInputOverflow, max, min, onChange, step],
  );

  const handleLabelPointerUp = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (!scrubRef.current) return;
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      scrubRef.current = null;
      onBlur?.();
    },
    [onBlur],
  );

  // Shift+drag on range for fine control
  const handleRangeChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = parseFloat(e.target.value);
      if (Number.isNaN(raw)) return;
      onChange(raw);
    },
    [onChange],
  );

  // Mouse wheel on number input for fine adjustment
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLInputElement>) => {
      e.preventDefault();
      const fineStep = e.shiftKey ? step * 0.1 : step;
      const delta = e.deltaY < 0 ? fineStep : -fineStep;
      const next = value + delta;
      const clamped = allowInputOverflow ? Math.max(min, next) : Math.max(min, Math.min(max, next));
      onChange(round(clamped, fineStep));
    },
    [allowInputOverflow, max, min, onChange, step, value],
  );

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-[11px] text-tn-text-muted flex items-center gap-1">
        {/* Draggable label — cursor changes to indicate scrub behavior */}
        <span
          className="cursor-ew-resize select-none"
          title="Drag left/right to scrub · Shift+drag for fine control"
          onPointerDown={handleLabelPointerDown}
          onPointerMove={handleLabelPointerMove}
          onPointerUp={handleLabelPointerUp}
        >
          {label}
        </span>
        {description && <FieldTooltip description={description} />}
      </label>
      <div className="flex min-w-0 items-center gap-2" data-height-slider-row>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={Math.min(value, max)}
          aria-label={label}
          onChange={handleRangeChange}
          onBlur={onBlur}
          className="min-w-0 flex-1 accent-tn-accent h-1.5 cursor-pointer"
        />
        <input
          type="number"
          value={value}
          min={min}
          max={allowInputOverflow ? undefined : max}
          step={step}
          aria-label={`${label} value`}
          title="Scroll to adjust · Shift+scroll for fine control"
          onChange={(e) => {
            const raw = parseFloat(e.target.value);
            if (Number.isNaN(raw)) return;
            onChange(allowInputOverflow ? Math.max(min, raw) : Math.max(min, Math.min(max, raw)));
          }}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={onBlur}
          onWheel={handleWheel}
          className="w-14 shrink-0 px-1.5 py-1 text-xs bg-tn-bg border border-tn-border rounded text-right focus:outline-none focus:border-tn-accent/60 transition-colors"
        />
      </div>
    </div>
  );
}
