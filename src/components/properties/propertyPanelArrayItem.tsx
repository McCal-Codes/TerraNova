import type { ReactNode } from "react";
import { TextField } from "./TextField";
import { SliderField } from "./SliderField";
import { NestedConstantColorField } from "./NestedConstantColorField";
import {
  isConstantColorSpec,
  isConstantValueSpec,
  isImportedRefSpec,
  isSwitchCaseEntry,
  type SwitchCaseEntry,
} from "@/utils/propertyPanelFields";

interface ArrayItemRenderContext {
  index: number;
  onUpdate: (next: unknown) => void;
  onBlur?: () => void;
}

/** Visual editor for simple array items; returns null to fall back to JSON text. */
export function renderPropertyPanelArrayItem(
  item: unknown,
  ctx: ArrayItemRenderContext,
): ReactNode | null {
  const { index, onUpdate, onBlur } = ctx;

  if (isSwitchCaseEntry(item)) {
    const entry = item as SwitchCaseEntry;
    return (
      <div className="flex flex-col gap-1 w-full">
        <TextField
          label={`State [${index}]`}
          value={entry.State}
          onChange={(state) => onUpdate({ ...entry, State: state })}
          onBlur={onBlur}
        />
        <SliderField
          label="Input index"
          value={entry.InputIndex}
          min={0}
          max={16}
          step={1}
          allowInputOverflow
          onChange={(inputIndex) =>
            onUpdate({ ...entry, InputIndex: Math.max(0, Math.round(inputIndex)) })
          }
          onBlur={onBlur}
        />
      </div>
    );
  }

  if (isImportedRefSpec(item)) {
    const ref = item as Record<string, unknown>;
    const name = typeof ref.Name === "string" ? ref.Name : "";
    return (
      <TextField
        label="Imported name"
        value={name}
        onChange={(nextName) => onUpdate({ ...ref, Type: "Imported", Name: nextName })}
        onBlur={onBlur}
      />
    );
  }

  if (isConstantValueSpec(item)) {
    const leaf = item as Record<string, unknown>;
    const numeric = Number(leaf.Value ?? 0);
    return (
      <SliderField
        label="Value"
        value={numeric}
        min={-100}
        max={100}
        allowInputOverflow
        onChange={(v) => onUpdate({ ...leaf, Type: "Constant", Value: v })}
        onBlur={onBlur}
      />
    );
  }

  if (isConstantColorSpec(item)) {
    return (
      <NestedConstantColorField
        label="Color"
        value={item as Record<string, unknown>}
        onChange={(next) => onUpdate(next)}
        onBlur={onBlur}
      />
    );
  }

  return null;
}
