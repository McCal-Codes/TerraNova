import type { ColumnLinearScannerFields } from "@/utils/columnPropHelpers";
import { ToggleField } from "./ToggleField";

interface ColumnScannerFieldProps {
  scanner: ColumnLinearScannerFields;
  onChange: (next: ColumnLinearScannerFields) => void;
  onBlur: () => void;
}

function readNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

export function ColumnScannerField({ scanner, onChange, onBlur }: ColumnScannerFieldProps) {
  const minY = readNumber(scanner.MinY, 48);
  const maxY = readNumber(scanner.MaxY, 92);
  const resultCap = readNumber(scanner.ResultCap, 1);
  const topDown = scanner.TopDownOrder ?? true;

  const patch = (fields: Partial<ColumnLinearScannerFields>) => {
    onChange({ ...scanner, ...fields });
  };

  return (
    <div className="flex flex-col gap-2 rounded border border-tn-border/70 bg-tn-bg/30 p-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-tn-text-muted">
        Column scanner
      </span>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-tn-text-muted">Min Y</label>
          <input
            type="number"
            step={1}
            value={minY}
            onChange={(e) => patch({ MinY: parseInt(e.target.value, 10) })}
            onBlur={onBlur}
            className="w-16 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-tn-text-muted">Max Y</label>
          <input
            type="number"
            step={1}
            value={maxY}
            onChange={(e) => patch({ MaxY: parseInt(e.target.value, 10) })}
            onBlur={onBlur}
            className="w-16 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
          />
        </div>
        <div className="flex items-center gap-1">
          <label className="text-[10px] text-tn-text-muted">Cap</label>
          <input
            type="number"
            step={1}
            min={1}
            value={resultCap}
            onChange={(e) => patch({ ResultCap: parseInt(e.target.value, 10) })}
            onBlur={onBlur}
            className="w-12 px-1.5 py-0.5 text-xs bg-tn-bg border border-tn-border rounded text-right font-mono"
          />
        </div>
      </div>
      <ToggleField
        label="Top-down order"
        value={topDown}
        onChange={(value) => {
          patch({ TopDownOrder: value });
          onBlur();
        }}
      />
    </div>
  );
}
