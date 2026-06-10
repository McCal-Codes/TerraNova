import { usePreviewEvaluation } from "@/hooks/usePreviewEvaluation";
import { usePreviewGraphAutoFit } from "@/hooks/usePreviewGraphAutoFit";

/** Runs density preview eval once for the whole editor (survives PreviewPanel remounts). */
export function PreviewEvaluationHost() {
  usePreviewEvaluation();
  usePreviewGraphAutoFit();
  return null;
}
