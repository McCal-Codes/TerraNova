import { FieldTooltip } from "./FieldTooltip";

interface ColorPickerFieldProps {
  label: string;
  value: string;
  description?: string;
  /** Hide the label row (e.g. delimiter band cards with their own heading). */
  hideLabel?: boolean;
  onChange: (value: string) => void;
  onBlur?: () => void;
}

/** Normalize to #RRGGBB for the native color input (strips alpha channel). */
export function hexForNativeColorInput(value: string, fallback = "#ffffff"): string {
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{8}$/.test(value)) return value.slice(0, 7);
  return fallback;
}

export function ColorPickerField({
  label,
  value,
  description,
  hideLabel = false,
  onChange,
  onBlur,
}: ColorPickerFieldProps) {
  const pickerValue = hexForNativeColorInput(value);

  return (
    <div className="flex flex-col gap-1">
      {!hideLabel && (
        <label className="text-[11px] text-tn-text-muted flex items-center gap-1">
          {label}
          {description && <FieldTooltip description={description} />}
        </label>
      )}
      <div className="flex items-center gap-2">
        <input
          type="color"
          value={pickerValue}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          className="h-7 w-7 rounded border border-tn-border bg-transparent cursor-pointer shrink-0 p-0.5"
          aria-label={hideLabel ? label : undefined}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          spellCheck={false}
          placeholder="#rrggbb"
          className="flex-1 px-2 py-1 text-xs bg-tn-bg border border-tn-border rounded font-mono tracking-wide focus:outline-none focus:border-tn-accent/60 transition-colors"
        />
      </div>
    </div>
  );
}
