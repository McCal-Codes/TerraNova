import { CurveCanvas } from "./CurveCanvas";
import { CurvePointList } from "./CurvePointList";
import { SliderField } from "./SliderField";
import { RangeField } from "./RangeField";
import { getCurveEvaluator } from "@/utils/curveEvaluators";
import {
  COMMON_CURVE_TYPES,
  curveSpecDefaults,
} from "@/utils/propertyPanelFields";

interface InlineCurveFieldProps {
  label: string;
  value: Record<string, unknown>;
  description?: string;
  onChange: (next: Record<string, unknown>) => void;
  onBlur: () => void;
  onCommit: () => void;
}

export function InlineCurveField({
  label,
  value,
  description,
  onChange,
  onBlur,
  onCommit,
}: InlineCurveFieldProps) {
  const curveType = typeof value.Type === "string" ? value.Type : "Manual";

  const handleTypeChange = (nextType: string) => {
    onChange(curveSpecDefaults(nextType));
    onCommit();
  };

  const evaluator = getCurveEvaluator(curveType, value);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-tn-text-muted">{label}</span>
        {description && (
          <span className="text-[10px] text-tn-text-muted/80 leading-snug">{description}</span>
        )}
        <p className="text-[10px] text-tn-text-muted/70 leading-snug">
          Inline curve on this node. Connect a separate <strong className="font-medium text-tn-text-muted">Curve:Manual</strong> node to the curve port instead if you prefer a dedicated curve node.
        </p>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-[10px] uppercase tracking-wide text-tn-text-muted">Type</label>
        <select
          value={curveType}
          onChange={(e) => handleTypeChange(e.target.value)}
          className="px-2 py-1 text-xs text-tn-text bg-tn-bg border border-tn-border rounded focus:outline-none focus:border-tn-accent/60"
        >
          {COMMON_CURVE_TYPES.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
          {!COMMON_CURVE_TYPES.includes(curveType as typeof COMMON_CURVE_TYPES[number]) && (
            <option value={curveType}>{curveType}</option>
          )}
        </select>
      </div>

      {curveType === "Manual" && (
        <>
          <CurveCanvas
            label={`Points (${Array.isArray(value.Points) ? value.Points.length : 0})`}
            points={Array.isArray(value.Points) ? value.Points : []}
            compact
            compactHeight={160}
            onChange={(pts) => onChange({ ...value, Type: "Manual", Points: pts })}
            onCommit={onCommit}
          />
          <CurvePointList
            points={Array.isArray(value.Points) ? value.Points : []}
            onChange={(pts) => onChange({ ...value, Type: "Manual", Points: pts })}
            onCommit={onCommit}
          />
        </>
      )}

      {curveType === "Constant" && (
        <SliderField
          label="Value"
          value={Number(value.Value ?? 0)}
          min={-1}
          max={1}
          step={0.01}
          onChange={(v) => onChange({ ...value, Type: "Constant", Value: v })}
          onBlur={onBlur}
        />
      )}

      {curveType === "DistanceExponential" && (
        <>
          <SliderField
            label="Exponent"
            value={Number(value.Exponent ?? 2)}
            min={0.1}
            max={8}
            step={0.1}
            onChange={(v) => onChange({ ...value, Type: "DistanceExponential", Exponent: v })}
            onBlur={onBlur}
          />
          <RangeField
            label="Range"
            value={{
              Min: Number((value.Range as { Min?: number })?.Min ?? 0),
              Max: Number((value.Range as { Max?: number })?.Max ?? 1),
            }}
            onChange={(r) => onChange({ ...value, Type: "DistanceExponential", Range: r })}
            onBlur={onBlur}
          />
        </>
      )}

      {curveType !== "Manual" && curveType !== "Constant" && curveType !== "DistanceExponential" && evaluator && (
        <CurveCanvas label="Preview (read-only)" evaluator={evaluator} compact compactHeight={140} />
      )}

      {curveType !== "Manual" && curveType !== "Constant" && curveType !== "DistanceExponential" && !evaluator && (
        <pre className="text-[10px] text-tn-text bg-tn-bg p-2 rounded border border-tn-border overflow-x-auto max-h-32">
          {JSON.stringify(value, null, 2)}
        </pre>
      )}
    </div>
  );
}
