import { useState } from "react";
import {
  DEFAULT_ASSIGNMENT_DELIMITER,
  readDelimiterAssignment,
  summarizeAssignments,
  writeDelimiterAssignment,
} from "@/utils/weightedAssignmentSummary";
import { InlineAssignmentField } from "./InlineAssignmentField";

interface AssignmentDelimitersFieldProps {
  delimiters: Array<Record<string, unknown>>;
  onChange: (next: Array<Record<string, unknown>>) => void;
  onBlur: () => void;
  projectPath?: string | null;
  onOpenAssignment?: (filePath: string) => void;
}

function readRange(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function AssignmentDelimitersField({
  delimiters,
  onChange,
  onBlur,
  projectPath = null,
  onOpenAssignment,
}: AssignmentDelimitersFieldProps) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const updateDelimiter = (index: number, next: Record<string, unknown>) => {
    onChange(delimiters.map((d, i) => (i === index ? next : d)));
  };

  const updateRange = (index: number, key: "Min" | "Max", value: number) => {
    if (!Number.isFinite(value)) return;
    updateDelimiter(index, { ...delimiters[index], [key]: value });
  };

  const addDelimiter = () => {
    onChange([...delimiters, structuredClone(DEFAULT_ASSIGNMENT_DELIMITER)]);
    onBlur();
  };

  const removeDelimiter = (index: number) => {
    if (delimiters.length <= 1) return;
    onChange(delimiters.filter((_, i) => i !== index));
    onBlur();
  };

  const toggleExpanded = (index: number) => {
    setExpanded((prev) => ({ ...prev, [index]: !prev[index] }));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
          Noise bands
        </span>
        <button
          type="button"
          onClick={addDelimiter}
          className="text-[10px] text-tn-accent hover:text-tn-accent/80"
        >
          + Add band
        </button>
      </div>

      <p className="text-[10px] text-tn-text-muted leading-snug">
        Each band maps a noise range (Min inclusive, Max exclusive) to props placed when the field
        value falls in that range.
      </p>

      {delimiters.length === 0 && (
        <p className="text-[11px] text-tn-text-muted">No delimiters — add a noise band.</p>
      )}

      {delimiters.map((delimiter, index) => {
        const min = readRange(delimiter.Min, -1);
        const max = readRange(delimiter.Max, 1);
        const assignment = readDelimiterAssignment(delimiter);
        const summary = summarizeAssignments(assignment);
        const isOpen = expanded[index] ?? delimiters.length === 1;

        return (
          <div
            key={index}
            className="rounded border border-tn-border bg-tn-bg/40 overflow-hidden"
          >
            <div className="flex items-start gap-2 p-2">
              <button
                type="button"
                onClick={() => toggleExpanded(index)}
                className="text-[10px] text-tn-text-muted mt-1 shrink-0 w-3"
                aria-expanded={isOpen}
              >
                {isOpen ? "▾" : "▸"}
              </button>

              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-medium text-tn-text">Band {index + 1}</span>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-tn-text-muted">Min</label>
                    <input
                      type="number"
                      step="any"
                      value={min}
                      onChange={(e) => updateRange(index, "Min", parseFloat(e.target.value))}
                      onBlur={onBlur}
                      className="w-16 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <label className="text-[10px] text-tn-text-muted">Max</label>
                    <input
                      type="number"
                      step="any"
                      value={max}
                      onChange={(e) => updateRange(index, "Max", parseFloat(e.target.value))}
                      onBlur={onBlur}
                      className="w-16 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
                    />
                  </div>
                </div>
                <p className="text-[10px] text-tn-text-muted truncate" title={summary}>
                  {summary}
                </p>
              </div>

              {delimiters.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDelimiter(index)}
                  className="text-[10px] text-red-400 hover:text-red-300 shrink-0"
                >
                  Remove
                </button>
              )}
            </div>

            {isOpen && (
              <div className="border-t border-tn-border px-2 pb-2 pt-1.5 ml-5">
                <InlineAssignmentField
                  assignment={
                    assignment ?? { Type: "Imported", Name: "" }
                  }
                  onChange={(next) => updateDelimiter(index, writeDelimiterAssignment(delimiter, next))}
                  onBlur={onBlur}
                  projectPath={projectPath}
                  onOpenAssignment={onOpenAssignment}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
