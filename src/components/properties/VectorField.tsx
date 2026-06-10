import { FieldTooltip } from "./FieldTooltip";
import { SliderField } from "./SliderField";

interface VectorFieldProps {
  label: string;
  value: { x: number; y: number; z?: number };
  description?: string;
  includeZ?: boolean;
  min?: number;
  max?: number;
  onChange: (value: { x: number; y: number; z: number }) => void;
  onBlur?: () => void;
}

export function VectorField({
  label,
  value,
  description,
  includeZ = true,
  min = -64,
  max = 64,
  onChange,
  onBlur,
}: VectorFieldProps) {
  const axes = includeZ ? (["x", "y", "z"] as const) : (["x", "y"] as const);
  const z = value.z ?? 0;

  return (
    <div className="flex flex-col gap-2">
      <label className="text-[11px] text-tn-text-muted flex items-center gap-1">
        {label}
        {description && <FieldTooltip description={description} />}
      </label>
      {axes.map((axis) => (
        <SliderField
          key={axis}
          label={axis.toUpperCase()}
          value={axis === "z" ? z : value[axis]}
          min={min}
          max={max}
          allowInputOverflow
          onChange={(v) => onChange({ x: value.x, y: value.y, z, [axis]: v })}
          onBlur={onBlur}
        />
      ))}
    </div>
  );
}
