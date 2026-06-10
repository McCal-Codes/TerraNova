import { useEffect, useRef, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import { getColormap } from "@/utils/colormaps";
import { evaluateCellShapeGrid } from "@/utils/shapePreview/cellShapeGrid";
import { marchingSquaresZeroContour } from "@/utils/shapePreview/marchingSquaresZeroContour";
import {
  drawCellBoundaries,
  drawSdfZeroContour,
  drawShapeMeshPoints,
  drawWallDistanceTint,
} from "@/utils/shapePreview/drawShapeOverlays";
import { isSdfType, getShapePreviewProfile } from "@/utils/shapePreview/shapePreviewProfile";
import { getCellNoisePreviewFields } from "@/utils/shapePreview/cellNoisePreviewFields";
import { resolveShapePreviewMeshNodeId } from "@/utils/shapePreview/resolveShapePreviewMesh";
import { evaluatePositions } from "@/utils/positionEvaluator";
import { usePreviewStore } from "@/stores/previewStore";

interface ShapePreviewCardProps {
  nodeId: string;
  nodeType: string;
  fields: Record<string, unknown>;
  nodes: Node[];
  edges: Edge[];
}

const CANVAS_SIZE = 280;
const GRID_RES = 64;
const BG = "#1c1a17";

export function ShapePreviewCard({
  nodeId,
  nodeType,
  fields,
  nodes,
  edges,
}: ShapePreviewCardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const colormap = usePreviewStore((s) => s.colormap);

  const render = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = CANVAS_SIZE * dpr;
    canvas.height = CANVAS_SIZE * dpr;
    ctx.scale(dpr, dpr);
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

    const n = GRID_RES;

    const gridToScreen = (gx: number, gz: number) => ({
      sx: (gx / n) * CANVAS_SIZE,
      sy: (gz / n) * CANVAS_SIZE,
    });

    try {
      const profile = getShapePreviewProfile(nodeType);

      if (!profile.mesh) {
        const { values, minValue, maxValue } = evaluateDensityGrid(
          nodes,
          edges,
          GRID_RES,
          rangeMin,
          rangeMax,
          yLevel,
          nodeId,
        );

        const cm = getColormap(colormap);
        const range = maxValue - minValue || 1;
        const imageData = ctx.createImageData(n, n);
        for (let row = 0; row < n; row++) {
          for (let col = 0; col < n; col++) {
            const t = (values[row * n + col] - minValue) / range;
            const [r, g, b] = cm.ramp(Math.max(0, Math.min(1, t)));
            const px = (row * n + col) * 4;
            imageData.data[px] = r;
            imageData.data[px + 1] = g;
            imageData.data[px + 2] = b;
            imageData.data[px + 3] = 255;
          }
        }

        const off = document.createElement("canvas");
        off.width = n;
        off.height = n;
        const offCtx = off.getContext("2d");
        if (offCtx) {
          offCtx.putImageData(imageData, 0, 0);
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(off, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
        }

        if (isSdfType(nodeType)) {
          const segments = marchingSquaresZeroContour(values, n);
          drawSdfZeroContour(ctx, segments, gridToScreen, true);
        }
      }

      const cellFields = getCellNoisePreviewFields(nodeType, fields, yLevel);
      if (cellFields) {
        const cellGrid = evaluateCellShapeGrid(rangeMin, rangeMax, n, cellFields);
        drawWallDistanceTint(ctx, cellGrid, gridToScreen, true);
        drawCellBoundaries(ctx, cellGrid, gridToScreen, true);
      }

      const meshNodeId = resolveShapePreviewMeshNodeId(nodes, edges, nodeId) ?? (profile.mesh ? nodeId : null);
      if (meshNodeId) {
        const pts = evaluatePositions(
          nodes,
          edges,
          { minX: rangeMin, maxX: rangeMax, minZ: rangeMin, maxZ: rangeMax },
          42,
          meshNodeId,
        );
        drawShapeMeshPoints(ctx, pts, rangeMin, rangeMax, n, gridToScreen, true);
      }
    } catch {
      ctx.fillStyle = "#6b7280";
      ctx.font = "11px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText("Preview unavailable", CANVAS_SIZE / 2, CANVAS_SIZE / 2);
      ctx.textAlign = "start";
    }
  }, [nodeId, nodeType, fields, nodes, edges, rangeMin, rangeMax, yLevel, colormap]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(render, 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [render]);

  return (
    <div className="flex flex-col gap-1 border-t border-tn-border pt-2 mt-1 min-w-0">
      <span className="text-xs text-tn-text-muted">Shape preview</span>
      <canvas
        ref={canvasRef}
        className="border border-tn-border w-full max-w-full aspect-square"
        style={{ imageRendering: "pixelated", borderRadius: 4, maxHeight: CANVAS_SIZE }}
      />
      <p className="text-[10px] text-tn-text-muted leading-relaxed">
        Quick slice at Y={yLevel} ({rangeMin}…{rangeMax} blocks). For the full biome range, open the preview panel,
        set Preview Target to this node, and enable Shape Preview.
      </p>
    </div>
  );
}
