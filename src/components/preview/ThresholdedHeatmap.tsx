import { forwardRef, memo, useCallback, useEffect, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useNonPassiveWheel } from "@/hooks/useNonPassiveWheel";
import { usePreviewStore } from "@/stores/previewStore";
import { screenToWorld } from "@/utils/canvasTransform";
import { useSmoothCanvasTransform } from "@/hooks/useSmoothCanvasTransform";
import { previewHudBadgeClass } from "@/components/preview/previewChromeStyles";
import { generateContours } from "@/utils/contourLines";
import {
  drawCellBoundaries,
  drawSdfZeroContour,
  drawShapeMeshPoints,
  drawWallDistanceTint,
} from "@/utils/shapePreview/drawShapeOverlays";

const SOLID_COLOR = { r: 120, g: 180, b: 100 };
const AIR_COLOR = { r: 20, g: 20, b: 30 };

const ThresholdedHeatmapInner = forwardRef<
  HTMLCanvasElement,
  { exportRootRef?: (el: HTMLDivElement | null) => void }
>(function ThresholdedHeatmap({ exportRootRef }, ref) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<HTMLDivElement>(null);
  const {
    values, rangeMin, rangeMax, canvasTransform,
    showPositionOverlay, positionOverlayPoints, positionOverlayColor, positionOverlaySize,
    showShapePreview, showCellBoundaries, showWallDistance, showMeshSamples, showSdfSurface,
    cellShapeGrid, sdfZeroSegments, shapePreviewMeshPoints,
  } = usePreviewStore(
    useShallow((s) => ({
      values: s.values,
      rangeMin: s.rangeMin,
      rangeMax: s.rangeMax,
      canvasTransform: s.canvasTransform,
      showPositionOverlay: s.showPositionOverlay,
      positionOverlayPoints: s.positionOverlayPoints,
      positionOverlayColor: s.positionOverlayColor,
      positionOverlaySize: s.positionOverlaySize,
      showShapePreview: s.showShapePreview,
      showCellBoundaries: s.showCellBoundaries,
      showWallDistance: s.showWallDistance,
      showMeshSamples: s.showMeshSamples,
      showSdfSurface: s.showSdfSurface,
      cellShapeGrid: s.cellShapeGrid,
      sdfZeroSegments: s.sdfZeroSegments,
      shapePreviewMeshPoints: s.shapePreviewMeshPoints,
    })),
  );
  const setCanvasTransform = usePreviewStore((s) => s.setCanvasTransform);
  const {
    layerRef: transformLayerRef,
    applyTransform,
    flushTransform,
    getTransform,
  } = useSmoothCanvasTransform(canvasTransform, setCanvasTransform);

  const [hoverInfo, setHoverInfo] = useState<{ x: number; z: number; value: number; solid: boolean } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; startOX: number; startOY: number } | null>(null);

  useEffect(() => {
    exportRootRef?.(containerRef.current);
    return () => exportRootRef?.(null);
  }, [exportRootRef, values]);

  // Merge refs
  const setRefs = useCallback(
    (el: HTMLCanvasElement | null) => {
      (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
      if (typeof ref === "function") ref(el);
      else if (ref) (ref as React.MutableRefObject<HTMLCanvasElement | null>).current = el;
    },
    [ref],
  );

  // ── Draw thresholded heatmap ──
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !values) return;

    const n = Math.round(Math.sqrt(values.length));
    canvas.width = n;
    canvas.height = n;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imageData = ctx.createImageData(n, n);

    for (let i = 0; i < values.length; i++) {
      const isSolid = values[i] >= 0;
      const c = isSolid ? SOLID_COLOR : AIR_COLOR;
      const pixel = i * 4;
      imageData.data[pixel] = c.r;
      imageData.data[pixel + 1] = c.g;
      imageData.data[pixel + 2] = c.b;
      imageData.data[pixel + 3] = 255;
    }

    ctx.putImageData(imageData, 0, 0);
  }, [values]);

  // ── Draw overlay: surface contour at density=0 ──
  useEffect(() => {
    const overlay = overlayRef.current;
    if (!overlay || !values) return;

    const wrapperEl = overlay.parentElement;
    if (!wrapperEl) return;
    const displaySize = wrapperEl.clientWidth;
    if (displaySize === 0) return;

    const dpr = window.devicePixelRatio || 1;
    overlay.width = displaySize * dpr;
    overlay.height = displaySize * dpr;

    const ctx = overlay.getContext("2d");
    if (!ctx) return;

    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, displaySize, displaySize);

    const n = Math.round(Math.sqrt(values.length));

    const gridToScreen = (gx: number, gz: number) => {
      const cx = displaySize / 2;
      const cy = displaySize / 2;
      const normX = gx / n;
      const normZ = gz / n;
      const sx = normX * displaySize - cx + cx;
      const sy = normZ * displaySize - cy + cy;
      return { sx, sy };
    };

    // Draw surface contour at density=0
    const contours = generateContours(values, n, [0]);
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    for (const contour of contours) {
      for (const seg of contour.segments) {
        const p1 = gridToScreen(seg.x1, seg.z1);
        const p2 = gridToScreen(seg.x2, seg.z2);
        ctx.beginPath();
        ctx.moveTo(p1.sx, p1.sy);
        ctx.lineTo(p2.sx, p2.sy);
        ctx.stroke();
      }
    }

    if (showShapePreview) {
      if (cellShapeGrid && cellShapeGrid.resolution === n) {
        drawWallDistanceTint(ctx, cellShapeGrid, gridToScreen, showWallDistance);
        drawCellBoundaries(ctx, cellShapeGrid, gridToScreen, showCellBoundaries);
      }
      drawSdfZeroContour(ctx, sdfZeroSegments, gridToScreen, showSdfSurface);
      drawShapeMeshPoints(
        ctx,
        shapePreviewMeshPoints,
        rangeMin,
        rangeMax,
        n,
        gridToScreen,
        showMeshSamples,
      );
    }

    // ── Position overlay dots ──
    if (showPositionOverlay && positionOverlayPoints.length > 0) {
      const worldRange = rangeMax - rangeMin;
      ctx.fillStyle = positionOverlayColor;

      for (const pt of positionOverlayPoints) {
        const gx = ((pt.x - rangeMin) / worldRange) * n;
        const gz = ((pt.z - rangeMin) / worldRange) * n;
        const { sx, sy } = gridToScreen(gx, gz);

        ctx.globalAlpha = 0.3 + 0.7 * pt.weight;
        ctx.beginPath();
        ctx.arc(sx, sy, positionOverlaySize, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      // Position count badge
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(displaySize - 72, displaySize - 22, 68, 18);
      ctx.fillStyle = positionOverlayColor;
      ctx.font = "10px monospace";
      ctx.textAlign = "right";
      ctx.fillText(`${positionOverlayPoints.length} pts`, displaySize - 8, displaySize - 8);
      ctx.textAlign = "start";
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }, [values, rangeMin, rangeMax, showShapePreview, showCellBoundaries, showWallDistance, showMeshSamples, showSdfSurface, cellShapeGrid, sdfZeroSegments, shapePreviewMeshPoints, showPositionOverlay, positionOverlayPoints, positionOverlayColor, positionOverlaySize]);

  // ── Interaction rect ──
  const getInteractionRect = useCallback((): DOMRect | null => {
    const overlay = overlayRef.current;
    return overlay?.parentElement?.getBoundingClientRect() ?? null;
  }, []);

  // ── Mouse interactions ──
  const onMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!values) return;
      const rect = getInteractionRect();
      if (!rect) return;

      if (dragRef.current) {
        const dx = e.clientX - dragRef.current.startX;
        const dy = e.clientY - dragRef.current.startY;
        applyTransform({
          ...getTransform(),
          offsetX: dragRef.current.startOX + dx,
          offsetY: dragRef.current.startOY + dy,
        });
        return;
      }

      const world = screenToWorld(
        e.clientX - rect.left, e.clientY - rect.top,
        getTransform(), rect.width, rangeMin, rangeMax,
      );
      const n = Math.round(Math.sqrt(values.length));
      const worldRange = rangeMax - rangeMin;
      const col = Math.floor(((world.x - rangeMin) / worldRange) * n);
      const row = Math.floor(((world.z - rangeMin) / worldRange) * n);
      if (col < 0 || col >= n || row < 0 || row >= n) {
        setHoverInfo(null);
        return;
      }
      const idx = row * n + col;
      const val = values[idx];
      if (val === undefined) { setHoverInfo(null); return; }
      setHoverInfo({
        x: Math.round(world.x),
        z: Math.round(world.z),
        value: val,
        solid: val >= 0,
      });
    },
    [values, rangeMin, rangeMax, getTransform, applyTransform, getInteractionRect],
  );

  const onMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const liveTransform = getTransform();
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        startOX: liveTransform.offsetX,
        startOY: liveTransform.offsetY,
      };
    },
    [getTransform],
  );

  const onMouseUp = useCallback(() => {
    dragRef.current = null;
    flushTransform();
  }, [flushTransform]);

  const onWheel = useCallback(
    (e: WheelEvent) => {
      e.preventDefault();
      const rect = getInteractionRect();
      if (!rect) return;
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      const cx = rect.width / 2;
      const cy = rect.height / 2;

      const current = getTransform();
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1;
      const newScale = Math.max(0.25, Math.min(20, current.scale * factor));

      const ox = mouseX - cx - current.offsetX;
      const oy = mouseY - cy - current.offsetY;
      const ratio = newScale / current.scale;

      applyTransform({
        scale: newScale,
        offsetX: current.offsetX - (ox * (ratio - 1)),
        offsetY: current.offsetY - (oy * (ratio - 1)),
      });
    },
    [applyTransform, getInteractionRect, getTransform],
  );

  useNonPassiveWheel(interactionRef, onWheel, Boolean(values));

  const onMouseLeave = useCallback(() => {
    setHoverInfo(null);
    dragRef.current = null;
  }, []);

  if (!values) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-tn-text-muted">
        No preview data
      </div>
    );
  }

  return (
    <div ref={containerRef} data-tn-heatmap-root className="relative flex items-center justify-center h-full p-4">
      <div className="relative" style={{ aspectRatio: "1 / 1", maxWidth: "100%", maxHeight: "100%", height: "100%" }}>
        <div
          ref={transformLayerRef}
          className="absolute inset-0 w-full h-full"
          style={{ transformOrigin: "center center", willChange: "transform" }}
        >
          <canvas
            ref={setRefs}
            data-tn-heatmap-base
            className="absolute inset-0 w-full h-full border border-tn-border"
            style={{ imageRendering: canvasTransform.scale > 2 ? "auto" : "pixelated" }}
          />
          <canvas
            ref={overlayRef}
            data-tn-heatmap-overlay
            className="absolute inset-0 w-full h-full"
            style={{ pointerEvents: "none" }}
          />
        </div>
        <div
          ref={interactionRef}
          className="absolute inset-0"
          style={{ cursor: dragRef.current ? "grabbing" : "crosshair" }}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={onMouseUp}
          onMouseLeave={onMouseLeave}
        />
      </div>

      {/* Hover readout */}
      {hoverInfo && (
        <div className={`absolute bottom-3 left-3 px-2 py-1 text-[10px] text-tn-text font-mono ${previewHudBadgeClass}`}>
          x: {hoverInfo.x}, z: {hoverInfo.z} &rarr; {hoverInfo.value.toFixed(4)} ({hoverInfo.solid ? "solid" : "air"})
        </div>
      )}

      {/* Legend */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 text-[10px] text-tn-text-muted font-mono">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: `rgb(${SOLID_COLOR.r},${SOLID_COLOR.g},${SOLID_COLOR.b})` }} />
          <span>Solid (d &ge; 0)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-sm" style={{ background: `rgb(${AIR_COLOR.r},${AIR_COLOR.g},${AIR_COLOR.b})` }} />
          <span>Air (d &lt; 0)</span>
        </div>
      </div>

      {/* Zoom indicator */}
      {canvasTransform.scale !== 1 && (
        <div className={`absolute top-3 left-3 text-[9px] ${previewHudBadgeClass}`}>
          {canvasTransform.scale.toFixed(1)}x
        </div>
      )}
    </div>
  );
});

export const ThresholdedHeatmap = memo(ThresholdedHeatmapInner);
