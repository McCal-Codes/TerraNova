import { useCallback, useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { SliderField } from "@/components/properties/SliderField";
import { parseContentFieldsFromWorldStructure } from "@/utils/terrainPreviewLevel";

const CONTENT_FIELD_NAMES = ["Base", "Water", "Bedrock"] as const;

function buildContentFields(values: Record<string, number>): unknown[] {
  return CONTENT_FIELD_NAMES.filter((name) => Number.isFinite(values[name])).map((name) => ({
    Type: "BaseHeight",
    Name: name,
    Y: values[name],
  }));
}

function spawnSummary(spawn: unknown): string {
  if (!spawn || typeof spawn !== "object") return "Not configured";
  const rec = spawn as Record<string, unknown>;
  const type = String(rec.Type ?? "Unknown");
  const offsetY = rec.OffsetY;
  if (typeof offsetY === "number") return `${type} (OffsetY ${offsetY})`;
  return type;
}

export function WorldStructureSettingsPanel() {
  const originalWrapper = useEditorStore((s) => s.originalWrapper);
  const setOriginalWrapper = useEditorStore((s) => s.setOriginalWrapper);
  const commitState = useEditorStore((s) => s.commitState);
  const setDirty = useProjectStore((s) => s.setDirty);

  const contentFields = useMemo(
    () => (originalWrapper ? parseContentFieldsFromWorldStructure(originalWrapper) : {}),
    [originalWrapper],
  );

  const spawnSummaryText = useMemo(
    () => spawnSummary(originalWrapper?.SpawnPositions),
    [originalWrapper],
  );

  const updateContentField = useCallback(
    (name: string, value: number) => {
      if (!originalWrapper) return;
      const nextValues = { ...contentFields, [name]: value };
      const next = {
        ...originalWrapper,
        ContentFields: buildContentFields(nextValues),
      };
      setOriginalWrapper(next);
      setDirty(true);
      commitState(`Edit ContentFields.${name}`);
    },
    [originalWrapper, contentFields, setOriginalWrapper, setDirty, commitState],
  );

  if (!originalWrapper) return null;

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <div className="flex min-w-0 flex-col gap-3">
        {CONTENT_FIELD_NAMES.map((name) => (
          <SliderField
            key={name}
            label={name}
            value={contentFields[name] ?? (name === "Bedrock" ? 0 : 64)}
            min={0}
            max={256}
            step={1}
            onChange={(v) => updateContentField(name, v)}
            onBlur={() => {}}
          />
        ))}
      </div>
      <div className="rounded border border-tn-border bg-tn-surface px-2 py-1.5">
        <p className="mb-1 text-[10px] font-medium uppercase tracking-wider text-tn-text-muted">
          SpawnPositions
        </p>
        <p className="text-[11px] text-tn-text-muted">{spawnSummaryText}</p>
        <p className="mt-1 text-[10px] text-tn-text-muted/70">
          Edit complex spawn graphs on the canvas or in JSON view.
        </p>
      </div>
    </div>
  );
}
