import { WeightedAssignmentsField } from "./WeightedAssignmentsField";
import { AssignmentNameSelect } from "./AssignmentNameSelect";
import { ColumnPropFields } from "./ColumnPropFields";
import { WeightedPrefabPathsField } from "./WeightedPrefabPathsField";
import {
  normalizeInlineAssignment,
  type WeightedAssignmentEntry,
  type WeightedPrefabPathEntry,
} from "@/utils/weightedAssignmentSummary";

interface InlineAssignmentFieldProps {
  assignment: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  onBlur: () => void;
  projectPath?: string | null;
  onOpenAssignment?: (filePath: string) => void;
}

export function InlineAssignmentField({
  assignment,
  onChange,
  onBlur,
  projectPath = null,
  onOpenAssignment,
}: InlineAssignmentFieldProps) {
  const normalized = normalizeInlineAssignment(assignment);
  const type = (normalized.Type as string) ?? "Weighted";
  const inlineComment = typeof normalized._comment === "string" ? normalized._comment : "";

  if (type === "Weighted") {
    const entries = Array.isArray(normalized.WeightedAssignments)
      ? (normalized.WeightedAssignments as WeightedAssignmentEntry[])
      : [];
    const skipChance = typeof normalized.SkipChance === "number" ? normalized.SkipChance : 0;
    const seed = typeof normalized.Seed === "string" ? normalized.Seed : "";

    return (
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <label className="text-[10px] text-tn-text-muted shrink-0">Skip chance</label>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={skipChance}
              onChange={(e) => {
                onChange({ ...normalized, SkipChance: parseFloat(e.target.value) });
              }}
              onBlur={onBlur}
              className="w-24 accent-tn-accent"
            />
            <span className="text-[10px] font-mono text-tn-text-muted w-10 text-right">
              {skipChance.toFixed(2)}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[140px]">
            <label className="text-[10px] text-tn-text-muted shrink-0">Seed</label>
            <input
              type="text"
              value={seed}
              onChange={(e) => onChange({ ...normalized, Seed: e.target.value })}
              onBlur={onBlur}
              className="flex-1 min-w-0 px-2 py-0.5 text-xs bg-tn-bg border border-tn-border rounded font-mono"
            />
          </div>
        </div>

        <WeightedAssignmentsField
          entries={entries}
          onChange={(next) => onChange({ ...normalized, WeightedAssignments: next })}
          onBlur={onBlur}
        />
      </div>
    );
  }

  if (type === "Constant") {
    const prop = normalized.Prop as Record<string, unknown> | undefined;
    const propType = (prop?.Type as string) ?? "";

    if (propType === "Column" && prop) {
      return (
        <ColumnPropFields
          prop={prop}
          onChange={(nextProp) => onChange({ ...normalized, Prop: nextProp })}
          onBlur={onBlur}
        />
      );
    }

    if (propType === "Prefab" && prop && Array.isArray(prop.WeightedPrefabPaths)) {
      return (
        <WeightedPrefabPathsField
          paths={prop.WeightedPrefabPaths as WeightedPrefabPathEntry[]}
          onChange={(nextPaths) => {
            onChange({ ...normalized, Prop: { ...prop, WeightedPrefabPaths: nextPaths } });
          }}
          onBlur={onBlur}
          projectPath={projectPath}
        />
      );
    }
  }

  if (type === "Imported") {
    const name = typeof normalized.Name === "string" ? normalized.Name : "";
    return (
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-tn-text-muted shrink-0 w-12">Name</label>
          <AssignmentNameSelect
            value={name}
            projectPath={projectPath}
            onChange={(nextName) => onChange({ ...normalized, Name: nextName })}
            onBlur={onBlur}
            onOpenFile={onOpenAssignment}
          />
        </div>
        {inlineComment && (
          <p className="text-[10px] text-tn-text-muted leading-snug pl-12">{inlineComment}</p>
        )}
        <p className="text-[10px] text-tn-text-muted/80 leading-snug pl-12">
          References a named assignment under Server/HytaleGenerator/Assignments.
        </p>
      </div>
    );
  }

  return (
    <p className="text-[10px] text-tn-text-muted leading-snug">
      {type} assignments are kept inline — expand on the canvas or edit via export for full detail.
    </p>
  );
}
