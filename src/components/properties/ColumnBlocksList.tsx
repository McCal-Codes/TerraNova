import {
  DEFAULT_COLUMN_BLOCK,
  nextColumnBlockY,
  readColumnBlockSolid,
  writeColumnBlockSolid,
  type ColumnBlockEntry,
} from "@/utils/weightedAssignmentSummary";
import { MaterialField } from "./MaterialField";

interface ColumnBlocksListProps {
  blocks: ColumnBlockEntry[];
  onChange: (next: ColumnBlockEntry[]) => void;
  onBlur: () => void;
}

export function ColumnBlocksList({ blocks, onChange, onBlur }: ColumnBlocksListProps) {
  const updateBlock = (index: number, patch: Partial<ColumnBlockEntry>) => {
    onChange(blocks.map((block, i) => (i === index ? { ...block, ...patch } : block)));
  };

  const updateSolid = (index: number, solid: string) => {
    onChange(blocks.map((block, i) => (i === index ? writeColumnBlockSolid(block, solid) : block)));
  };

  const addBlock = () => {
    onChange([
      ...blocks,
      { ...DEFAULT_COLUMN_BLOCK, Y: nextColumnBlockY(blocks) },
    ]);
    onBlur();
  };

  const removeBlock = (index: number) => {
    if (blocks.length <= 1) return;
    onChange(blocks.filter((_, i) => i !== index));
    onBlur();
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
          Column stack ({blocks.length})
        </span>
        <button
          type="button"
          onClick={addBlock}
          className="text-[10px] text-tn-accent hover:text-tn-accent/80"
        >
          + Add block
        </button>
      </div>

      <p className="text-[10px] text-tn-text-muted leading-snug">
        Each row is one block in the vertical stack. Y is the offset above the placement anchor.
      </p>

      {blocks.length === 0 && (
        <p className="text-[11px] text-tn-text-muted">No column blocks — add one.</p>
      )}

      <div className="flex flex-col gap-2 max-h-48 overflow-y-auto pr-0.5">
        {blocks.map((block, index) => {
          const y = typeof block.Y === "number" ? block.Y : 0;
          const solid = readColumnBlockSolid(block);

          return (
            <div
              key={`column-block-${index}`}
              className="rounded border border-tn-border/70 bg-tn-bg/30 p-2 flex flex-col gap-2"
            >
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-tn-text-muted w-8 shrink-0">Y</span>
                <input
                  type="number"
                  step={1}
                  value={y}
                  onChange={(e) => {
                    const nextY = parseInt(e.target.value, 10);
                    if (!Number.isFinite(nextY)) return;
                    updateBlock(index, { Y: nextY });
                  }}
                  onBlur={onBlur}
                  className="w-14 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
                />
                {blocks.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeBlock(index)}
                    className="ml-auto text-[10px] text-red-400 hover:text-red-300 shrink-0"
                  >
                    Remove
                  </button>
                )}
              </div>
              <MaterialField
                label="Block"
                value={solid}
                onChange={(nextSolid) => updateSolid(index, nextSolid)}
                onBlur={onBlur}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
