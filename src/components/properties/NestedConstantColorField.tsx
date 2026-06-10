import { ColorPickerField } from "./ColorPickerField";

interface NestedConstantColorFieldProps {
  label: string;
  value: Record<string, unknown>;
  description?: string;
  onChange: (next: Record<string, unknown>) => void;
  onBlur?: () => void;
}

/** Nested `{ Type: "Constant", Color: "#rrggbb" }` — preserves Type and any sibling keys. */
export function NestedConstantColorField({
  label,
  value,
  description,
  onChange,
  onBlur,
}: NestedConstantColorFieldProps) {
  const color = typeof value.Color === "string" ? value.Color : "#ffffff";

  return (
    <ColorPickerField
      label={label}
      value={color}
      description={description}
      onChange={(nextColor) => onChange({ ...value, Type: "Constant", Color: nextColor })}
      onBlur={onBlur}
    />
  );
}
