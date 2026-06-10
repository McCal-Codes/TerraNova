import { SliderField } from "./SliderField";

interface NestedConstantFieldProps {
  label: string;
  value: Record<string, unknown>;
  description?: string;
  min?: number;
  max?: number;
  onChange: (next: Record<string, unknown>) => void;
  onBlur?: () => void;
}

/** Nested `{ Type: "Constant", Value: number }` leaf nodes. */
export function NestedConstantField({
  label,
  value,
  description,
  min = -100,
  max = 100,
  onChange,
  onBlur,
}: NestedConstantFieldProps) {
  const numeric = Number(value.Value ?? 0);
  return (
    <SliderField
      label={label}
      value={numeric}
      min={min}
      max={max}
      allowInputOverflow
      description={description ?? "Constant value"}
      onChange={(v) => onChange({ ...value, Type: "Constant", Value: v })}
      onBlur={onBlur}
    />
  );
}
