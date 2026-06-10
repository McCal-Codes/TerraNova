import { useCallback, useEffect, useRef, useState } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { sampleVerticalCrossSection } from "@/utils/verticalCrossSection";
import {
  USGS_PARCHMENT_RGB,
  USGS_WATER_RGB,
  USGS_CONTOUR_BROWN,
  USGS_INDEX_CONTOUR_BROWN,
} from "@/utils/topoMapStyle";

export function VerticalCrossSectionPlot() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const crossSectionLine = usePreviewStore((s) => s.crossSectionLine);
  const verticalSectionDensities = usePreviewStore((s) => s.verticalSectionDensities);
  const verticalSectionMeta = usePreviewStore((s) => s.verticalSectionMeta);
  const isVerticalSectionLoading = usePreviewStore((s) => s.isVerticalSectionLoading);
  const [hover, setHover] = useState<{ x: number; y: number; distance: number; worldY: number; value: number } | null>(null);

  const grid = (() => {
    if (!crossSectionLine || !verticalSectionDensities || !verticalSectionMeta) return null;
    return sampleVerticalCrossSection(
      verticalSectionDensities,
      verticalSectionMeta.resolution,
      verticalSectionMeta.ySlices,
      verticalSectionMeta.rangeMin,
      verticalSectionMeta.rangeMax,
      verticalSectionMeta.yMin,
      verticalSectionMeta.yMax,
      crossSectionLine.start,
      crossSectionLine.end,
      80,
      64,
    );
  })();

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !grid) return;

    const container = containerRef.current;
    if (container) {
      canvas.width = container.clientWidth * window.devicePixelRatio;
      canvas.height = 160 * window.devicePixelRatio;
    }

    const w = canvas.width;
    const h = canvas.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    const dw = w / window.devicePixelRatio;
    const dh = h / window.devicePixelRatio;

    const padding = { top: 10, right: 12, bottom: 22, left: 44 };
    const plotW = dw - padding.left - padding.right;
    const plotH = dh - padding.top - padding.bottom;

    ctx.fillStyle = `rgb(${USGS_PARCHMENT_RGB.join(",")})`;
    ctx.fillRect(0, 0, dw, dh);

    const yMin = grid.worldYs[0];
    const yMax = grid.worldYs[grid.worldYs.length - 1];
    const maxDist = grid.distances[grid.distances.length - 1] || 1;

    let vMin = Infinity;
    let vMax = -Infinity;
    for (let i = 0; i < grid.values.length; i++) {
      const v = grid.values[i];
      if (v < vMin) vMin = v;
      if (v > vMax) vMax = v;
    }
    if (!Number.isFinite(vMin)) vMin = -1;
    if (!Number.isFinite(vMax)) vMax = 1;

    const cellW = plotW / grid.width;
    const cellH = plotH / grid.height;

    for (let yi = 0; yi < grid.height; yi++) {
      for (let di = 0; di < grid.width; di++) {
        const v = grid.values[yi * grid.width + di];
        const x = padding.left + di * cellW;
        const y = padding.top + (grid.height - 1 - yi) * cellH;
        if (v < 0) {
          ctx.fillStyle = `rgba(${USGS_WATER_RGB.join(",")},0.55)`;
        } else {
          const t = Math.max(0, Math.min(1, (v - vMin) / (vMax - vMin || 1)));
          const g = Math.round(180 + t * 50);
          ctx.fillStyle = `rgb(${g},${Math.round(g * 0.9)},${Math.round(g * 0.75)})`;
        }
        ctx.fillRect(x, y, cellW + 0.5, cellH + 0.5);
      }
    }

    // d = 0 boundary (marching along columns)
    ctx.strokeStyle = USGS_INDEX_CONTOUR_BROWN;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    let started = false;
    for (let di = 0; di < grid.width; di++) {
      for (let yi = 0; yi < grid.height - 1; yi++) {
        const v0 = grid.values[yi * grid.width + di];
        const v1 = grid.values[(yi + 1) * grid.width + di];
        if ((v0 >= 0 && v1 < 0) || (v0 < 0 && v1 >= 0)) {
          const t = Math.abs(v0) / (Math.abs(v0) + Math.abs(v1) || 1);
          const wy = grid.worldYs[yi] + t * (grid.worldYs[yi + 1] - grid.worldYs[yi]);
          const px = padding.left + (di + 0.5) * cellW;
          const py = padding.top + plotH - ((wy - yMin) / (yMax - yMin || 1)) * plotH;
          if (!started) {
            ctx.moveTo(px, py);
            started = true;
          } else {
            ctx.lineTo(px, py);
          }
          break;
        }
      }
    }
    if (started) ctx.stroke();

    // Grid + axes
    ctx.strokeStyle = USGS_CONTOUR_BROWN + "55";
    ctx.lineWidth = 0.5;
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * plotH;
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(padding.left + plotW, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#4a3728";
    ctx.font = "9px monospace";
    ctx.textAlign = "right";
    for (let i = 0; i <= 4; i++) {
      const y = padding.top + (i / 4) * plotH;
      const wy = yMax - (i / 4) * (yMax - yMin);
      ctx.fillText(String(Math.round(wy)), padding.left - 4, y + 3);
    }
    ctx.textAlign = "center";
    ctx.fillText("0", padding.left, dh - 6);
    ctx.fillText(`${Math.round(maxDist)}`, padding.left + plotW, dh - 6);
    ctx.fillText("Distance along line →", padding.left + plotW / 2, dh - 6);
  }, [grid]);

  useEffect(() => {
    draw();
  }, [draw]);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!grid || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const padding = { top: 10, right: 12, bottom: 22, left: 44 };
    const plotW = rect.width - padding.left - padding.right;
    const plotH = rect.height - padding.top - padding.bottom;
    const di = Math.floor(((x - padding.left) / plotW) * grid.width);
    const yi = grid.height - 1 - Math.floor(((y - padding.top) / plotH) * grid.height);
    if (di < 0 || di >= grid.width || yi < 0 || yi >= grid.height) {
      setHover(null);
      return;
    }
    const value = grid.values[yi * grid.width + di];
    setHover({
      x,
      y,
      distance: grid.distances[di],
      worldY: grid.worldYs[yi],
      value,
    });
  }, [grid]);

  if (!crossSectionLine) return null;

  if (isVerticalSectionLoading && !grid) {
    return (
      <div className="border-t border-tn-border bg-tn-panel px-3 py-2 text-[10px] text-tn-text-muted">
        Building vertical section profile…
      </div>
    );
  }

  if (!grid) return null;

  return (
    <div ref={containerRef} className="border-t border-tn-border bg-tn-panel relative">
      <div className="px-3 py-1 text-[10px] text-tn-text-muted font-medium">
        Section profile (vertical wall)
      </div>
      <canvas
        ref={canvasRef}
        className="w-full block"
        style={{ height: 160 }}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHover(null)}
      />
      {hover && (
        <div
          className="pointer-events-none absolute z-10 px-1.5 py-0.5 rounded border border-tn-border bg-tn-panel/95 text-[9px] font-mono text-tn-text"
          style={{ left: hover.x + 8, top: hover.y - 24 }}
        >
          Y={hover.worldY.toFixed(0)} d={hover.distance.toFixed(0)} ρ={hover.value.toFixed(2)}
        </div>
      )}
    </div>
  );
}
