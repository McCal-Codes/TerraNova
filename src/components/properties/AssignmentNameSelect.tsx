import { useMemo, useState } from "react";
import { useAssignmentNameCatalog } from "@/hooks/useAssignmentNameCatalog";

interface AssignmentNameSelectProps {
  value: string;
  projectPath: string | null;
  onChange: (name: string) => void;
  onBlur?: () => void;
  onOpenFile?: (filePath: string) => void;
}

export function AssignmentNameSelect({
  value,
  projectPath,
  onChange,
  onBlur,
  onOpenFile,
}: AssignmentNameSelectProps) {
  const [filter, setFilter] = useState("");
  const { catalog, loading } = useAssignmentNameCatalog(projectPath, true);

  const options = useMemo(() => {
    const q = filter.trim().toLowerCase();
    let names = catalog.names;
    if (q) {
      names = names.filter((n) => n.toLowerCase().includes(q));
    }
    if (value && !names.includes(value)) {
      names = [value, ...names];
    }
    return names.slice(0, 200);
  }, [catalog.names, filter, value]);

  const hiddenCount = Math.max(0, catalog.names.length - options.length);
  const resolvedPath = value ? catalog.pathsByName[value] : undefined;

  return (
    <div className="flex flex-col gap-1 flex-1 min-w-0">
      {catalog.names.length > 12 && (
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter assignments…"
          className="w-full px-2 py-0.5 text-[10px] rounded border border-tn-border bg-tn-bg text-tn-text placeholder:text-tn-text-muted/60"
        />
      )}
      <div className="flex items-center gap-1.5">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onBlur={onBlur}
          title={value || "Select assignment"}
          className="flex-1 min-w-0 px-2 py-1 text-[11px] rounded border border-tn-border bg-tn-bg text-tn-text font-mono truncate"
        >
          <option value="">Select assignment…</option>
          {options.map((name) => (
            <option key={name} value={name} title={name}>
              {name.replace(/_/g, " ")}
            </option>
          ))}
        </select>
        {onOpenFile && resolvedPath && (
          <button
            type="button"
            onClick={() => onOpenFile(resolvedPath)}
            className="shrink-0 text-[10px] px-2 py-1 rounded border border-tn-border text-tn-accent hover:bg-tn-accent/10"
            title="Open assignment file"
          >
            Open
          </button>
        )}
      </div>
      {loading && (
        <span className="text-[9px] text-tn-text-muted">Loading assignment catalog…</span>
      )}
      {!loading && catalog.error && (
        <span className="text-[9px] text-amber-400/90">{catalog.error}</span>
      )}
      {!loading && value && catalog.names.length > 0 && !catalog.names.includes(value) && (
        <span className="text-[9px] text-amber-400/90 leading-snug">
          Unknown assignment — not found under Server/HytaleGenerator/Assignments.
        </span>
      )}
      {!loading && catalog.names.length === 0 && !value && (
        <span className="text-[9px] text-tn-text-muted leading-snug">
          Add Server/HytaleGenerator/Assignments to your pack or sync Hytale assets.
        </span>
      )}
      {hiddenCount > 0 && (
        <span className="text-[9px] text-tn-text-muted">
          {hiddenCount} more — narrow filter
        </span>
      )}
    </div>
  );
}
