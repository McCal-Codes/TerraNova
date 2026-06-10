import { CollapsibleEditorSection } from "../CollapsibleEditorSection";
import { isStringArray, sanitizeTagValues } from "./environmentEditorUtils";
import type { EnvironmentDoc } from "./environmentEditorConstants";

interface EnvironmentTagsSectionProps {
  tagEntries: [string, unknown][];
  open: boolean;
  onToggle: () => void;
  onUpdateDoc: (updater: (previous: EnvironmentDoc) => EnvironmentDoc) => void;
}

export function EnvironmentTagsSection({
  tagEntries,
  open,
  onToggle,
  onUpdateDoc,
}: EnvironmentTagsSectionProps) {
  return (
    <CollapsibleEditorSection
      title="Tags"
      description="Optional tag groups for classifying the environment asset."
      badge={`${tagEntries.length} groups`}
      open={open}
      onToggle={onToggle}
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onUpdateDoc((previous) => {
            const existing = Object.keys(previous.Tags ?? {});
            let key = "NewGroup";
            let i = 2;
            while (existing.includes(key)) { key = `NewGroup_${i++}`; }
            return {
              ...previous,
              Tags: { ...(previous.Tags ?? {}), [key]: [] },
            };
          })}
          className="rounded border border-tn-accent/40 px-2 py-1 text-[10px] text-tn-accent transition-colors hover:bg-tn-accent/10"
        >
          Add Tag Group
        </button>
      </div>
      <div className="space-y-2">
        {tagEntries.length === 0 && (
          <p className="text-[11px] text-tn-text-muted">No tag groups on this environment file.</p>
        )}
        {tagEntries.map(([group, values], index) => (
          <div key={`${group}-${index}`} className="rounded border border-tn-border/40 bg-tn-bg p-2">
            <div className="mb-2 flex items-center gap-2">
              <input
                type="text"
                value={group}
                onChange={(event) => onUpdateDoc((previous) => {
                  const nextTags: Record<string, string[]> = {};
                  for (const [entryKey, entryValues] of Object.entries(previous.Tags ?? {})) {
                    if (entryKey === group) {
                      nextTags[event.target.value || "NewGroup"] = isStringArray(entryValues) ? entryValues : [];
                    } else {
                      nextTags[entryKey] = isStringArray(entryValues) ? entryValues : [];
                    }
                  }
                  return { ...previous, Tags: nextTags };
                })}
                className="min-w-0 flex-1 rounded border border-tn-border bg-tn-surface px-2 py-1 text-[11px] text-tn-text"
              />
              <button
                type="button"
                onClick={() => onUpdateDoc((previous) => {
                  const nextTags: Record<string, string[]> = {};
                  for (const [entryKey, entryValues] of Object.entries(previous.Tags ?? {})) {
                    if (entryKey !== group) {
                      nextTags[entryKey] = isStringArray(entryValues) ? entryValues : [];
                    }
                  }
                  return { ...previous, Tags: nextTags };
                })}
                className="rounded border border-tn-border/60 px-2 py-1 text-[10px] text-tn-text-muted transition-colors hover:border-red-500/50 hover:text-red-400"
              >
                Remove
              </button>
            </div>
            <input
              type="text"
              value={Array.isArray(values) ? values.join(", ") : ""}
              onChange={(event) => onUpdateDoc((previous) => ({
                ...previous,
                Tags: {
                  ...(previous.Tags ?? {}),
                  [group]: sanitizeTagValues(event.target.value),
                },
              }))}
              className="w-full rounded border border-tn-border bg-tn-surface px-2 py-1 text-[11px] text-tn-text"
              placeholder="Plains, Surface, Warm"
            />
          </div>
        ))}
      </div>
    </CollapsibleEditorSection>
  );
}
