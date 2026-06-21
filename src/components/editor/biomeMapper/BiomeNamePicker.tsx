import { useMemo } from "react";
import type { ProjectBiomeEntry } from "@/utils/propSources/listProjectBiomes";

export function BiomeNamePicker({
  rowIndex,
  value,
  projectBiomes,
  onChange,
  onBlur,
  onOpenBiome,
}: {
  rowIndex: number;
  value: string;
  projectBiomes: ProjectBiomeEntry[];
  onChange: (name: string) => void;
  onBlur?: () => void;
  onOpenBiome?: (path: string) => void;
}) {
  const linked = useMemo(
    () => projectBiomes.find((b) => b.name.toLowerCase() === value.trim().toLowerCase()),
    [projectBiomes, value],
  );

  return (
    <div className="flex items-center gap-1 min-w-0 w-full">
      <input
        list={`biome-picker-${rowIndex}`}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onClick={(e) => e.stopPropagation()}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (linked && onOpenBiome) onOpenBiome(linked.path);
        }}
        className="w-full min-w-0 h-5 px-1 text-[10px] bg-tn-surface border border-tn-border rounded text-tn-text focus:outline-none focus:border-tn-accent/50 truncate"
        title={linked ? `Double-click to open ${linked.path}` : "Enter biome name or pick from list"}
      />
      <datalist id={`biome-picker-${rowIndex}`}>
        {projectBiomes.map((b) => (
          <option key={b.path} value={b.name} />
        ))}
      </datalist>
      {projectBiomes.length > 0 && (
        <span
          className={`shrink-0 w-1.5 h-1.5 rounded-full ${
            linked ? "bg-emerald-400" : value.trim() ? "bg-amber-400" : "bg-tn-text-muted/30"
          }`}
          title={linked ? "Linked to project biome file" : value.trim() ? "No matching biome file" : "Unnamed"}
        />
      )}
    </div>
  );
}
