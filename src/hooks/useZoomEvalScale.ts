import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** Visual zoom scale debounced before triggering 2D density re-eval. */
export const ZOOM_EVAL_DEBOUNCE_MS = 280;

export function useZoomEvalScale(visualScale: number): number {
  return useDebouncedValue(visualScale, ZOOM_EVAL_DEBOUNCE_MS);
}
