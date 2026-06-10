import { useRef, useEffect, useCallback } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { evaluateDensityGrid } from "@/utils/densityEvaluator";
import { getColormap } from "@/utils/colormaps";
const GRID = 16;
const DISPLAY = 64;
/** Thumbnails use terrain tinting so they stay readable regardless of preview colormap. */
const THUMB_COLORMAP = getColormap("terrain");

interface NodeThumbnailProps {
  nodeId: string;
}

function normalizeThumbSample(
  raw: number,
  minValue: number,
  maxValue: number,
): number {
  if (!Number.isFinite(raw)) return 0.5;
  const span = maxValue - minValue;
  if (Math.abs(span) < 1e-8) return 0.5;
  return Math.max(0, Math.min(1, (raw - minValue) / span));
}

function previewRangeSample(raw: number, rangeMin: number, rangeMax: number): number {
  if (!Number.isFinite(raw)) return 0.5;
  const span = rangeMax - rangeMin;
  if (Math.abs(span) < 1e-8) return 0.5;
  return Math.max(0, Math.min(1, (raw - rangeMin) / span));
}

function paintFlatPlaceholder(ctx: CanvasRenderingContext2D): void {
  ctx.fillStyle = "#2a2830";
  ctx.fillRect(0, 0, DISPLAY, DISPLAY);
  ctx.strokeStyle = "#4a4438";
  ctx.lineWidth = 1;
  for (let i = -DISPLAY; i < DISPLAY * 2; i += 8) {
    ctx.beginPath();
    ctx.moveTo(i, 0);
    ctx.lineTo(i + DISPLAY, DISPLAY);
    ctx.stroke();
  }
}

function paintThumbnail(
  canvas: HTMLCanvasElement,
  nodeId: string,
  rangeMin: number,
  rangeMax: number,
  yLevel: number,
): void {
  const { nodes, edges, contentFields } = useEditorStore.getState();

  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  try {
    const { values, minValue, maxValue } = evaluateDensityGrid(
      nodes,
      edges,
      GRID,
      rangeMin,
      rangeMax,
      yLevel,
      nodeId,
      { contentFields },
    );

    const span = maxValue - minValue;
    const uniform = Math.abs(span) < 1e-8;
    if (!Number.isFinite(minValue) || !Number.isFinite(maxValue)) {
      paintFlatPlaceholder(ctx);
      return;
    }

    const imageData = ctx.createImageData(DISPLAY, DISPLAY);
    const scale = DISPLAY / GRID;

    for (let gy = 0; gy < GRID; gy++) {
      for (let gx = 0; gx < GRID; gx++) {
        const raw = values[gy * GRID + gx];
        const t = uniform
          ? previewRangeSample(raw, rangeMin, rangeMax)
          : normalizeThumbSample(raw, minValue, maxValue);
        const [r, g, b] = THUMB_COLORMAP.ramp(t);

        for (let dy = 0; dy < scale; dy++) {
          for (let dx = 0; dx < scale; dx++) {
            const px = gx * scale + dx;
            const py = gy * scale + dy;
            const idx = (py * DISPLAY + px) * 4;
            imageData.data[idx] = r;
            imageData.data[idx + 1] = g;
            imageData.data[idx + 2] = b;
            imageData.data[idx + 3] = 255;
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0);
  } catch {
    paintFlatPlaceholder(ctx);
  }
}

export function NodeThumbnail({ nodeId }: NodeThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const yLevel = usePreviewStore((s) => s.yLevel);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    paintThumbnail(canvas, nodeId, rangeMin, rangeMax, yLevel);
  }, [nodeId, rangeMin, rangeMax, yLevel]);

  useEffect(() => {
    render();
  }, [render]);

  useEffect(() => {
    function scheduleRender() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(render, 200);
    }

    const unsubEditor = useEditorStore.subscribe((state, prevState) => {
      if (
        state.nodes !== prevState.nodes
        || state.edges !== prevState.edges
        || state.contentFields !== prevState.contentFields
      ) {
        scheduleRender();
      }
    });

    const unsubPreview = usePreviewStore.subscribe((state, prevState) => {
      if (
        state.rangeMin !== prevState.rangeMin
        || state.rangeMax !== prevState.rangeMax
        || state.yLevel !== prevState.yLevel
      ) {
        scheduleRender();
      }
    });

    return () => {
      unsubEditor();
      unsubPreview();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [render]);

  return (
    <canvas
      ref={canvasRef}
      width={DISPLAY}
      height={DISPLAY}
      className="nodrag nopan border border-tn-border/40 bg-tn-bg/80"
      style={{
        width: DISPLAY,
        height: DISPLAY,
        imageRendering: "pixelated",
        borderRadius: 4,
      }}
      aria-hidden
    />
  );
}
