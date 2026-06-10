import { useCallback, useEffect, useRef } from "react";
import type { CanvasTransform } from "@/stores/previewStore";

export function canvasTransformToCss(transform: CanvasTransform): string {
  return `translate3d(${transform.offsetX}px, ${transform.offsetY}px, 0) scale(${transform.scale})`;
}

/**
 * GPU-friendly pan/zoom: apply transform to a DOM layer immediately, batch Zustand
 * commits to one update per animation frame so overlays are not redrawn every wheel tick.
 */
export function useSmoothCanvasTransform(
  canvasTransform: CanvasTransform,
  setCanvasTransform: (transform: CanvasTransform) => void,
) {
  const layerRef = useRef<HTMLDivElement>(null);
  const liveRef = useRef(canvasTransform);
  const storeRafRef = useRef<number | null>(null);

  const paintDom = useCallback((transform: CanvasTransform) => {
    liveRef.current = transform;
    const el = layerRef.current;
    if (el) el.style.transform = canvasTransformToCss(transform);
  }, []);

  useEffect(() => {
    paintDom(canvasTransform);
  }, [canvasTransform, paintDom]);

  useEffect(() => () => {
    if (storeRafRef.current != null) {
      cancelAnimationFrame(storeRafRef.current);
    }
  }, []);

  const applyTransform = useCallback((transform: CanvasTransform) => {
    paintDom(transform);
    if (storeRafRef.current != null) cancelAnimationFrame(storeRafRef.current);
    storeRafRef.current = requestAnimationFrame(() => {
      storeRafRef.current = null;
      setCanvasTransform(liveRef.current);
    });
  }, [paintDom, setCanvasTransform]);

  const flushTransform = useCallback(() => {
    if (storeRafRef.current != null) {
      cancelAnimationFrame(storeRafRef.current);
      storeRafRef.current = null;
    }
    setCanvasTransform(liveRef.current);
  }, [setCanvasTransform]);

  const getTransform = useCallback(() => liveRef.current, []);

  return { layerRef, applyTransform, flushTransform, getTransform };
}
