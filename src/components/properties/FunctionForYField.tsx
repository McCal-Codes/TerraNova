import { CurveCanvas } from "./CurveCanvas";
import { CurvePointList } from "./CurvePointList";
import { FUNCTION_FOR_Y_FIELD_DESCRIPTION } from "@/utils/propertyPanelFields";
import { normalizePoints, toPointsOutputFormat } from "@/utils/curveEvaluators";

interface FunctionForYFieldProps {
  label: string;
  value: Record<string, unknown>;
  description?: string;
  onChange: (next: Record<string, unknown>) => void;
  onCommit: () => void;
}

export function FunctionForYField({
  label,
  value,
  description,
  onChange,
  onCommit,
}: FunctionForYFieldProps) {
  const points = Array.isArray(value.Points) ? value.Points : [];

  const updatePoints = (nextPoints: unknown[]) => {
    onChange({ ...value, Points: nextPoints });
  };

  const handlePointsChange = (raw: unknown[]) => {
    const normalized = normalizePoints(raw);
    updatePoints(toPointsOutputFormat(normalized, "yOut"));
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-tn-text-muted">{label}</span>
        <span className="text-[10px] text-tn-text-muted/80 leading-snug">
          {description ?? FUNCTION_FOR_Y_FIELD_DESCRIPTION}
        </span>
      </div>

      <CurveCanvas
        label={`Elevation profile (${points.length} points) — Y horizontal, Out vertical`}
        points={points}
        onChange={(pts) => {
          handlePointsChange(pts);
          onCommit();
        }}
        onCommit={onCommit}
      />

      <CurvePointList
        points={points}
        pointFormat="yOut"
        axisLabels={{ x: "Y", y: "Out" }}
        onChange={handlePointsChange}
        onCommit={onCommit}
      />
    </div>
  );
}
