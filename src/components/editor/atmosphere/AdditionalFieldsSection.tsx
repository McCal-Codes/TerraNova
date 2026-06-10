import { useState } from "react";
import { CollapsibleEditorSection } from "../CollapsibleEditorSection";

type ScalarValue = string | number | boolean;

function isScalarValue(value: unknown): value is ScalarValue {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

interface AdditionalFieldsSectionProps {
  entries: [string, unknown][];
  open: boolean;
  onToggle: () => void;
  onUpdateField?: (key: string, value: unknown) => void;
  describeValue?: (value: unknown) => string;
}

export function AdditionalFieldsSection({
  entries,
  open,
  onToggle,
  onUpdateField,
  describeValue,
}: AdditionalFieldsSectionProps) {
  const [editingKeys, setEditingKeys] = useState<Set<string>>(new Set());

  if (entries.length === 0) return null;

  const toggleEdit = (key: string) => {
    setEditingKeys((previous) => {
      const next = new Set(previous);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <CollapsibleEditorSection
      title="Additional Fields"
      description="Raw fields not yet represented by dedicated controls."
      badge={`${entries.length} fields`}
      open={open}
      onToggle={onToggle}
    >
      <div className="grid gap-2 md:grid-cols-2">
        {entries.map(([key, value]) => {
          const canEdit = onUpdateField && isScalarValue(value);
          const isEditing = editingKeys.has(key);

          return (
            <div key={key} className="rounded border border-tn-border/40 bg-tn-bg px-3 py-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[10px] uppercase tracking-wider text-tn-text-muted">{key}</p>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => toggleEdit(key)}
                    className="text-[10px] text-tn-accent transition-colors hover:text-tn-accent/80"
                  >
                    {isEditing ? "Done" : "Edit"}
                  </button>
                )}
              </div>
              {describeValue && !isEditing && (
                <p className="mt-1 text-[11px] text-tn-text">{describeValue(value)}</p>
              )}
              {isEditing && canEdit ? (
                <div className="mt-2">
                  {typeof value === "boolean" ? (
                    <label className="flex items-center gap-2 text-[11px] text-tn-text">
                      <input
                        type="checkbox"
                        checked={value}
                        onChange={(event) => onUpdateField(key, event.target.checked)}
                      />
                      {value ? "true" : "false"}
                    </label>
                  ) : typeof value === "number" ? (
                    <input
                      type="number"
                      step={0.05}
                      value={value}
                      onChange={(event) => {
                        const parsed = Number.parseFloat(event.target.value);
                        if (Number.isFinite(parsed)) onUpdateField(key, parsed);
                      }}
                      className="w-full rounded border border-tn-border bg-tn-surface px-2 py-1 text-[11px] font-mono text-tn-text"
                    />
                  ) : (
                    <input
                      type="text"
                      value={value}
                      onChange={(event) => onUpdateField(key, event.target.value)}
                      className="w-full rounded border border-tn-border bg-tn-surface px-2 py-1 text-[11px] text-tn-text"
                    />
                  )}
                </div>
              ) : (
                <pre className="mt-2 overflow-auto rounded bg-black/10 p-2 text-[10px] text-tn-text-muted">
                  {JSON.stringify(value, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </CollapsibleEditorSection>
  );
}
