import { useEffect, useRef, useState } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { usePreviewTarget } from "@/hooks/usePreviewTarget";
import { drawShapeCellMap } from "@/utils/shapePreview/drawShapeCellMap";
import { SHAPE_PREVIEW_COLORS } from "@/utils/shapePreview/shapePreviewColors";
import {
  PreviewLegendSwatch,
  previewButtonClass,
} from "./controls/PreviewControlPrimitives";

export function ShapeCellMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState(200);

  const showShapePreview = usePreviewStore((s) => s.showShapePreview);
  const showShapeCellMap = usePreviewStore((s) => s.showShapeCellMap);
  const setShowShapeCellMap = usePreviewStore((s) => s.setShowShapeCellMap);
  const showCellBoundaries = usePreviewStore((s) => s.showCellBoundaries);
  const showWallDistance = usePreviewStore((s) => s.showWallDistance);
  const showMeshSamples = usePreviewStore((s) => s.showMeshSamples);
  const cellShapeGrid = usePreviewStore((s) => s.cellShapeGrid);
  const meshPoints = usePreviewStore((s) => s.shapePreviewMeshPoints);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const yLevel = usePreviewStore((s) => s.yLevel);

  const { previewTargetType } = usePreviewTarget();

  const hasCellData = !!cellShapeGrid;
  const meshCount = meshPoints.length;
  const hasVisual =
    showShapePreview &&
    ((hasCellData && (showCellBoundaries || showWallDistance)) ||
      (showMeshSamples && meshCount > 0));

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (w && w > 0) setSize(Math.min(Math.round(w), 280));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size < 8) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);

    drawShapeCellMap(ctx, {
      size,
      rangeMin,
      rangeMax,
      showShapePreview,
      showCellBoundaries,
      showWallDistance,
      showMeshSamples,
      cellShapeGrid,
      meshPoints,
    });
  }, [
    size,
    showShapePreview,
    showCellBoundaries,
    showWallDistance,
    showMeshSamples,
    cellShapeGrid,
    meshPoints,
    rangeMin,
    rangeMax,
  ]);

  if (!showShapeCellMap) return null;

  const emptyMessage = !showShapePreview
    ? "Enable shape layers to draw the map."
    : !hasCellData && meshCount === 0
      ? "No cell or mesh data in range — check preview target and Y level."
      : !hasVisual
        ? "Turn on cell boundaries, wall tint, or mesh samples."
        : null;

  return (
    <div
      className="flex flex-col gap-2 rounded-md border border-tn-border/80 bg-tn-bg/40 p-2"
      aria-labelledby="shape-cell-map-heading"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 id="shape-cell-map-heading" className="text-[11px] font-semibold text-tn-text">
            Cell map
          </h4>
          <p className="text-[10px] text-tn-text-muted leading-snug">
            Top-down XZ at Y={yLevel}
            {previewTargetType ? (
              <>
                {" "}
                · <span className="font-mono text-tn-text/90">{previewTargetType}</span>
              </>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          className={previewButtonClass}
          onClick={() => setShowShapeCellMap(false)}
          aria-label="Hide cell map"
        >
          Hide
        </button>
      </div>

      <div ref={containerRef} className="relative aspect-square w-full">
        <canvas
          ref={canvasRef}
          role="img"
          aria-label={
            hasVisual
              ? `Cell layout map at Y ${yLevel}, world X and Z from ${rangeMin} to ${rangeMax}`
              : "Cell layout map, no data to display"
          }
          className="absolute inset-0 h-full w-full rounded border border-tn-border"
        />
        {emptyMessage ? (
          <div
            className="absolute inset-0 flex items-center justify-center rounded border border-dashed border-tn-border/60 bg-tn-panel/80 px-3 text-center text-[10px] leading-relaxed text-tn-text-muted"
            role="status"
          >
            {emptyMessage}
          </div>
        ) : null}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <PreviewLegendSwatch color="#ffffff" label="Walls" />
        <PreviewLegendSwatch color="#38bdf8" label="Near wall" />
        <PreviewLegendSwatch color={SHAPE_PREVIEW_COLORS.mesh} label="Mesh" />
        {hasCellData ? (
          <span className="text-[10px] text-tn-text-muted tabular-nums ml-auto">
            {cellShapeGrid!.resolution}×{cellShapeGrid!.resolution} cells
          </span>
        ) : null}
        {meshCount > 0 ? (
          <span className="text-[10px] text-tn-text-muted tabular-nums">
            {meshCount.toLocaleString()} mesh pts
          </span>
        ) : null}
      </div>
    </div>
  );
}
