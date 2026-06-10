import { Loader2 } from "lucide-react";
import { PreviewSliceHintBanner } from "./PreviewSliceHintBanner";
import { previewHudPanelClass } from "./previewChromeStyles";

export function PreviewStatusOverlays({
  loading,
  fidelityScore,
  hasData,
  showFidelity,
  sliceHint,
}: {
  loading: boolean;
  fidelityScore: number;
  hasData: boolean;
  showFidelity: boolean;
  /** When null, caller renders the hint elsewhere (e.g. inside TopoMapHud). */
  sliceHint?: string | null;
}) {
  const showFidelityBadge = showFidelity && fidelityScore < 100 && hasData;
  const showSliceHint = Boolean(sliceHint) && hasData && !loading;

  if (!loading && !showFidelityBadge && !showSliceHint) return null;

  return (
    <>
      <div className="pointer-events-none absolute top-2 left-2 z-10 flex flex-col items-start gap-1.5">
        {loading && (
          <div
            className={`flex items-center gap-1.5 px-2 py-1 text-[11px] text-tn-text-muted ${previewHudPanelClass}`}
            role="status"
          >
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-tn-accent" aria-hidden />
            Evaluating…
          </div>
        )}
        {showFidelityBadge && (
          <div
            className="rounded-md border border-black/35 bg-black/45 px-2 py-0.5 text-[10px] font-medium shadow-md backdrop-blur-sm"
            style={{
              backgroundColor: fidelityScore >= 90 ? "#4ade8033" : fidelityScore >= 70 ? "#facc1533" : "#f8717133",
              borderColor: fidelityScore >= 90 ? "#4ade8044" : fidelityScore >= 70 ? "#facc1544" : "#f8717144",
              color: fidelityScore >= 90 ? "#4ade80" : fidelityScore >= 70 ? "#facc15" : "#f87171",
            }}
            title="Share of nodes with fully accurate evaluation"
          >
            Fidelity {fidelityScore}%
          </div>
        )}
      </div>
      {showSliceHint && (
        <div className="pointer-events-none absolute top-2 left-1/2 z-10 w-[min(28rem,calc(100%-1.5rem))] -translate-x-1/2">
          <PreviewSliceHintBanner className="text-center">{sliceHint!}</PreviewSliceHintBanner>
        </div>
      )}
    </>
  );
}
