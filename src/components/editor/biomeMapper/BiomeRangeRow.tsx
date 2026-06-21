import type { BiomeRangeEntry } from "@/stores/slices/types";
import type { ProjectBiomeEntry } from "@/utils/propSources/listProjectBiomes";
import { biomeColor } from "@/utils/biomeRangeColors";
import {
  clampMaxInput,
  clampMinInput,
  estimateCoveragePercent,
} from "@/utils/biomeRangeDomain";
import { BiomeNamePicker } from "./BiomeNamePicker";
import { BiomeRangeMiniBar } from "./BiomeRangeMiniBar";

export const BIOME_RANGE_ROW_H = 28;

export function BiomeRangeRow({
  range,
  index,
  isSelected,
  projectBiomes,
  compact = false,
  onSelect,
  onRename,
  onUpdateMin,
  onUpdateMax,
  onRemove,
  onOpenBiome,
  onDragMin,
  onDragMax,
  onDragMove,
  onCommitEdit,
}: {
  range: BiomeRangeEntry;
  index: number;
  isSelected: boolean;
  projectBiomes: ProjectBiomeEntry[];
  compact?: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onUpdateMin: (v: number) => void;
  onUpdateMax: (v: number) => void;
  onRemove: () => void;
  onOpenBiome: (path: string) => void;
  onDragMin: (e: React.PointerEvent) => void;
  onDragMax: (e: React.PointerEvent) => void;
  onDragMove: (e: React.PointerEvent) => void;
  onCommitEdit: () => void;
}) {
  const color = biomeColor(range.Biome);
  const coverage = estimateCoveragePercent(range);

  return (
    <div
      className={`flex items-center gap-1 px-3 border-b border-white/[0.03] cursor-pointer transition-colors ${
        isSelected ? "bg-tn-accent/[0.08]" : "hover:bg-tn-surface"
      }`}
      style={{ height: BIOME_RANGE_ROW_H }}
      onClick={onSelect}
    >
      <div className="w-2.5 h-2.5 rounded-[3px] shrink-0" style={{ backgroundColor: color }} />

      <div className={compact ? "w-[140px] shrink-0 min-w-0" : "w-[120px] shrink-0 min-w-0"}>
        <BiomeNamePicker
          rowIndex={index}
          value={range.Biome}
          projectBiomes={projectBiomes}
          onChange={onRename}
          onBlur={onCommitEdit}
          onOpenBiome={onOpenBiome}
        />
      </div>

      <div className="flex-1 h-3.5 min-w-0">
        <BiomeRangeMiniBar
          min={range.Min}
          max={range.Max}
          color={color}
          isSelected={isSelected}
          onDragMin={onDragMin}
          onDragMax={onDragMax}
          onDragMove={onDragMove}
        />
      </div>

      {!compact && (
        <>
          <input
            type="number"
            step={0.01}
            value={range.Min.toFixed(2)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onUpdateMin(clampMinInput(v, range.Max));
            }}
            onBlur={onCommitEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-12 shrink-0 h-5 px-0.5 text-[10px] text-right bg-transparent border border-transparent hover:border-tn-border focus:border-tn-accent/50 rounded text-tn-text-muted focus:text-tn-text tabular-nums focus:outline-none"
          />

          <input
            type="number"
            step={0.01}
            value={range.Max.toFixed(2)}
            onChange={(e) => {
              const v = parseFloat(e.target.value);
              if (!isNaN(v)) onUpdateMax(clampMaxInput(v, range.Min));
            }}
            onBlur={onCommitEdit}
            onClick={(e) => e.stopPropagation()}
            className="w-12 shrink-0 h-5 px-0.5 text-[10px] text-right bg-transparent border border-transparent hover:border-tn-border focus:border-tn-accent/50 rounded text-tn-text-muted focus:text-tn-text tabular-nums focus:outline-none"
          />

          <span className="w-10 shrink-0 text-[9px] text-tn-text-muted/60 text-right tabular-nums">
            {coverage.toFixed(0)}%
          </span>
        </>
      )}

      <button
        type="button"
        className="w-5 shrink-0 h-5 flex items-center justify-center text-[10px] text-tn-text-muted/40 hover:text-red-400 transition-colors rounded focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        title="Remove"
      >
        ×
      </button>
    </div>
  );
}
