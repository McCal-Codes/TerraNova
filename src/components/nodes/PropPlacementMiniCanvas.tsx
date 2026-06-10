import { useCallback, useEffect, useRef } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { evaluatePositions } from "@/utils/positionEvaluator";
import { drawPropPlacementCanvas } from "@/components/properties/propPlacementCanvasDraw";

const DISPLAY = 64;
const RANGE = { minX: -32, maxX: 32, minZ: -32, maxZ: 32 };
const SEED = 42;

interface PropPlacementMiniCanvasProps {
  nodeId: string;
}

export function PropPlacementMiniCanvas({ nodeId }: PropPlacementMiniCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const visibleRef = useRef(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !visibleRef.current) return;

    const schedule = typeof requestIdleCallback !== "undefined"
      ? requestIdleCallback
      : (cb: () => void) => requestAnimationFrame(cb);

    schedule(() => {
      const { nodes, edges } = useEditorStore.getState();
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      try {
        const positions = evaluatePositions(nodes, edges, RANGE, SEED, nodeId);
        drawPropPlacementCanvas(ctx, {
          width: DISPLAY,
          height: DISPLAY,
          worldRange: RANGE,
          positions,
          showGrid: false,
          showDensityOverlay: false,
          dotRadius: 1.5,
          showAxisLabels: false,
        });
      } catch {
        ctx.clearRect(0, 0, DISPLAY, DISPLAY);
      }
    });
  }, [nodeId]);

  useEffect(() => {
    function scheduleRender() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(render, 300);
    }

    const unsub = useEditorStore.subscribe((state, prevState) => {
      if (state.nodes !== prevState.nodes || state.edges !== prevState.edges) {
        scheduleRender();
      }
    });

    return () => {
      unsub();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [render]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = visibleRef.current;
        visibleRef.current = entry.isIntersecting;
        if (!wasVisible && entry.isIntersecting) render();
      },
      { threshold: 0 },
    );

    observer.observe(canvas);
    return () => observer.disconnect();
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      width={DISPLAY}
      height={DISPLAY}
      style={{
        width: DISPLAY,
        height: DISPLAY,
        imageRendering: "pixelated",
        borderRadius: 4,
      }}
    />
  );
}
