import { MaterialField } from "@/components/properties/MaterialField";

interface MaterialBlockPickerProps {
  value: string;
  onChange: (blockId: string) => void;
}

/** Primary surface block for the basic biome template MaterialProvider. */
export function MaterialBlockPicker({ value, onChange }: MaterialBlockPickerProps) {
  return (
    <MaterialField
      label="Surface material"
      description="Block ID written to MaterialProvider for the basic biome template."
      value={value}
      onChange={onChange}
    />
  );
}
