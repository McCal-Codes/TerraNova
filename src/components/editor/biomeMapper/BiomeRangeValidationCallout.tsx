import type { ReactNode } from "react";
import { AlertTriangle, Info } from "lucide-react";
import { previewCalloutClasses } from "@/components/ui/surfaceStyles";
import type { BiomeRangeValidation } from "@/utils/biomeRangeDomain";

function CalloutIcon({ severity }: { severity: "warning" | "info" }) {
  const cls = "mt-0.5 h-3.5 w-3.5 shrink-0";
  if (severity === "warning") return <AlertTriangle className={`${cls} text-amber-400`} />;
  return <Info className={`${cls} text-sky-400`} />;
}

function getSimpleValidationContent(
  validation: BiomeRangeValidation,
  rangeCount: number,
  onCloseGap: () => void,
): ReactNode {
  if (validation.overlaps.length > 0) {
    return (
      <p>
        {validation.overlaps.length} overlapping range
        {validation.overlaps.length === 1 ? "" : "s"} — adjust bars so ranges do not overlap.
      </p>
    );
  }
  if (validation.gaps.length > 0) {
    return (
      <div>
        <p>Ranges do not fully cover −1 to +1 — uncovered columns use DefaultBiome.</p>
        {rangeCount >= 2 && (
          <button
            type="button"
            onClick={onCloseGap}
            className="mt-1 text-tn-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
          >
            Close largest gap
          </button>
        )}
      </div>
    );
  }
  if (validation.missingBiomeFiles.length > 0) {
    return <p>Missing biome files: {validation.missingBiomeFiles.join(", ")}</p>;
  }
  if (validation.defaultNotListed) {
    return <p>Add DefaultBiome to the range list, or pick a biome that is listed below.</p>;
  }
  if (validation.duplicateNames.length > 0) {
    return <p>Duplicate biome names: {validation.duplicateNames.join(", ")}</p>;
  }
  return null;
}

export function BiomeRangeValidationCallout({
  validation,
  rangeCount,
  onCloseGap,
  onSplitEqual,
  hideInfo = false,
  simpleMode = false,
}: {
  validation: BiomeRangeValidation;
  rangeCount: number;
  onCloseGap: () => void;
  onSplitEqual: () => void;
  hideInfo?: boolean;
  simpleMode?: boolean;
}) {
  if (rangeCount === 0) {
    return null;
  }

  const hasWarning =
    validation.gaps.length > 0 ||
    validation.overlaps.length > 0 ||
    validation.defaultNotListed ||
    validation.duplicateNames.length > 0 ||
    validation.missingBiomeFiles.length > 0;
  const hasInfo = !hideInfo && validation.unassignedProjectBiomes.length > 0;

  if (!hasWarning && !hasInfo) return null;

  if (simpleMode) {
    if (hasInfo) return null;
    const content = getSimpleValidationContent(validation, rangeCount, onCloseGap);
    if (!content) return null;
    return (
      <div className={`flex items-start gap-2 rounded border px-2 py-1.5 text-[10px] ${previewCalloutClasses.warning}`}>
        <CalloutIcon severity="warning" />
        {content}
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-1.5 rounded border px-2 py-1.5 text-[10px] ${previewCalloutClasses.warning}`}>
      {validation.gaps.length > 0 && (
        <div className="flex items-start gap-2">
          <CalloutIcon severity="warning" />
          <div className="min-w-0 flex-1">
            <p>{validation.gaps.length} gap(s) in coverage — columns may fall back to DefaultBiome.</p>
            {rangeCount >= 2 && (
              <button
                type="button"
                onClick={onCloseGap}
                className="mt-1 text-tn-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
              >
                Close largest gap
              </button>
            )}
          </div>
        </div>
      )}
      {validation.overlaps.length > 0 && (
        <div className="flex items-start gap-2">
          <CalloutIcon severity="warning" />
          <p>{validation.overlaps.length} overlapping range pair(s).</p>
        </div>
      )}
      {validation.defaultNotListed && (
        <div className="flex items-start gap-2">
          <CalloutIcon severity="warning" />
          <p>DefaultBiome is not listed in Biomes[].</p>
        </div>
      )}
      {validation.missingBiomeFiles.length > 0 && (
        <div className="flex items-start gap-2">
          <CalloutIcon severity="warning" />
          <p>Missing biome files: {validation.missingBiomeFiles.join(", ")}</p>
        </div>
      )}
      {validation.duplicateNames.length > 0 && (
        <div className="flex items-start gap-2">
          <CalloutIcon severity="warning" />
          <p>Duplicate biome names: {validation.duplicateNames.join(", ")}</p>
        </div>
      )}
      {hasInfo && (
        <div className="flex items-start gap-2">
          <CalloutIcon severity="info" />
          <p>
            Project biomes not in ranges: {validation.unassignedProjectBiomes.slice(0, 4).join(", ")}
            {validation.unassignedProjectBiomes.length > 4 ? "…" : ""}
          </p>
        </div>
      )}
      {rangeCount >= 2 && validation.gaps.length > 0 && (
        <button
          type="button"
          onClick={onSplitEqual}
          className="self-start text-tn-accent hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-tn-accent"
        >
          Split equally
        </button>
      )}
    </div>
  );
}
