import { useEffect, useRef, useState } from "react";

const PAINT_INTERVAL_MS = 200;

/** Live elapsed ms while `active` — throttled updates to avoid overlay layout jitter. */
export function usePreviewElapsedMs(active: boolean): number | null {
  const startRef = useRef<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const rafRef = useRef<number | null>(null);
  const lastPaintRef = useRef(0);

  useEffect(() => {
    if (!active) {
      startRef.current = null;
      setElapsed(0);
      if (rafRef.current != null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    startRef.current = performance.now();
    lastPaintRef.current = 0;
    setElapsed(0);

    const tick = (now: number) => {
      if (startRef.current == null) return;
      if (now - lastPaintRef.current >= PAINT_INTERVAL_MS) {
        lastPaintRef.current = now;
        setElapsed(now - startRef.current);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [active]);

  return active ? elapsed : null;
}
