import { ArrayField } from "./ArrayField";
import { TextField } from "./TextField";
import { SliderField } from "./SliderField";
import type { SwitchCaseEntry } from "@/utils/propertyPanelFields";

interface SwitchCasesFieldProps {
  label: string;
  value: SwitchCaseEntry[];
  description?: string;
  onChange: (next: SwitchCaseEntry[]) => void;
  onBlur?: () => void;
}

/** `SwitchCases: [{ State, InputIndex }, ...]` — Hytale switch routing table. */
export function SwitchCasesField({
  label,
  value,
  description,
  onChange,
  onBlur,
}: SwitchCasesFieldProps) {
  return (
    <ArrayField
      label={label}
      values={value}
      description={description ?? "Maps switch state strings to density input indices."}
      renderItem={(item, index) => {
        const entry = item as SwitchCaseEntry;
        const update = (patch: Partial<SwitchCaseEntry>) => {
          onChange(value.map((row, i) => (i === index ? { ...row, ...patch } : row)));
        };
        return (
          <div className="flex flex-col gap-1.5 py-0.5 w-full">
            <TextField
              label={`State [${index}]`}
              value={entry.State}
              onChange={(state) => update({ State: state })}
              onBlur={onBlur}
            />
            <SliderField
              label="Input index"
              value={entry.InputIndex}
              min={0}
              max={16}
              step={1}
              allowInputOverflow
              onChange={(inputIndex) => update({ InputIndex: Math.max(0, Math.round(inputIndex)) })}
              onBlur={onBlur}
            />
          </div>
        );
      }}
      onAdd={() => {
        onChange([
          ...value,
          { State: `state${value.length}`, InputIndex: value.length },
        ]);
      }}
      onRemove={(index) => {
        onChange(value.filter((_, i) => i !== index));
      }}
    />
  );
}
