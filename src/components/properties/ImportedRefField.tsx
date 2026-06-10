import { TextField } from "./TextField";
import { AssignmentNameSelect } from "./AssignmentNameSelect";

interface ImportedRefFieldProps {
  label: string;
  fieldKey: string;
  value: Record<string, unknown>;
  description?: string;
  projectPath: string | null;
  onChange: (next: Record<string, unknown>) => void;
  onBlur?: () => void;
  onOpenAssignment?: (filePath: string) => void;
}

function usesAssignmentCatalog(fieldKey: string): boolean {
  return fieldKey === "Assignments" || fieldKey.endsWith("Assignments");
}

/** Nested `{ Type: "Imported", Name: string }` — preserves extra keys and Type on edit. */
export function ImportedRefField({
  label,
  fieldKey,
  value,
  description,
  projectPath,
  onChange,
  onBlur,
  onOpenAssignment,
}: ImportedRefFieldProps) {
  const name = typeof value.Name === "string" ? value.Name : "";

  const emitName = (nextName: string) => {
    onChange({ ...value, Type: "Imported", Name: nextName });
  };

  if (usesAssignmentCatalog(fieldKey) && projectPath) {
    return (
      <div className="flex flex-col gap-1">
        <span className="text-xs text-tn-text-muted">{label}</span>
        {description && (
          <span className="text-[10px] text-tn-text-muted/80 leading-snug">{description}</span>
        )}
        <AssignmentNameSelect
          value={name}
          projectPath={projectPath}
          onChange={emitName}
          onBlur={onBlur}
          onOpenFile={onOpenAssignment}
        />
      </div>
    );
  }

  return (
    <TextField
      label={label}
      value={name}
      description={description ?? "Imported asset name (Hytale reference)"}
      onChange={emitName}
      onBlur={onBlur}
    />
  );
}
