import { useCallback, useRef } from "react";
import type { BiomeDragMode } from "@/utils/biomeRangeDomain";

export function useBiomeRangeDrag(
  onDelta: (mode: BiomeDragMode, delta: number) => void,
  onCommit: () => void,
) {
  const dragOrigRef = useRef<{ index: number; committed: boolean } | null>(null);

  const startDrag = useCallback(
    (e: React.PointerEvent, mode: BiomeDragMode) => {
      e.stopPropagation();
      e.preventDefault();
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
      const startX = e.clientX;
      const bar = (e.currentTarget as HTMLElement).closest("[data-range-bar]");
      if (!bar) return;

      const onMove = (ev: PointerEvent) => {
        const barWidth = bar.getBoundingClientRect().width;
        const dxPx = ev.clientX - startX;
        const dValue = (dxPx / barWidth) * 2;
        onDelta(mode, dValue);
      };

      const onUp = (ev: PointerEvent) => {
        (ev.target as HTMLElement).releasePointerCapture(ev.pointerId);
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
        if (!dragOrigRef.current?.committed) {
          dragOrigRef.current = { index: 0, committed: true };
          onCommit();
        }
      };

      dragOrigRef.current = { index: 0, committed: false };
      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [onDelta, onCommit],
  );

  const resetDrag = useCallback(() => {
    dragOrigRef.current = null;
  }, []);

  return { startDrag, resetDrag };
}
