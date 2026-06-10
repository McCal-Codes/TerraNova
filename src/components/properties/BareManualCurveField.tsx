import { CurveCanvas } from "./CurveCanvas";
import { CurvePointList } from "./CurvePointList";
import { inferCurvePointFormat } from "@/utils/propertyPanelFields";
import { normalizePoints, toPointsOutputFormat } from "@/utils/curveEvaluators";

interface BareManualCurveFieldProps {
  label: string;
  value: Record<string, unknown>;
  description?: string;
  onChange: (next: Record<string, unknown>) => void;
  onCommit: () => void;
}

/** Editor for `{ Points: [...] }` objects without a `Type` field. */
export function BareManualCurveField({
  label,
  value,
  description,
  onChange,
  onCommit,
}: BareManualCurveFieldProps) {
  const points = Array.isArray(value.Points) ? value.Points : [];
  const pointFormat = inferCurvePointFormat(points);
  const axisLabels =
    pointFormat === "yOut" ? { x: "Y", y: "Out" } : { x: "In", y: "Out" };

  const handlePointsChange = (raw: unknown[]) => {
    const normalized = normalizePoints(raw);
    onChange({ ...value, Points: toPointsOutputFormat(normalized, pointFormat) });
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-tn-text-muted">{label}</span>
        {description && (
          <span className="text-[10px] text-tn-text-muted/80 leading-snug">{description}</span>
        )}
        <p className="text-[10px] text-tn-text-muted/70 leading-snug">
          Point curve — drag the chart or edit {axisLabels.x}/{axisLabels.y} below.
        </p>
      </div>
      <CurveCanvas
        label={`Points (${points.length})`}
        points={points}
        onChange={(pts) => {
          handlePointsChange(pts);
          onCommit();
        }}
        onCommit={onCommit}
      />
      <CurvePointList
        points={points}
        pointFormat={pointFormat}
        axisLabels={axisLabels}
        onChange={handlePointsChange}
        onCommit={onCommit}
      />
    </div>
  );
}
