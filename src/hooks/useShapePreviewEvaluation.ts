import { useEffect, useRef } from "react";
import type { Node } from "@xyflow/react";
import { usePreviewStore } from "@/stores/previewStore";
import { useEditorStore } from "@/stores/editorStore";
import { useEvaluationFingerprint } from "@/hooks/useEvaluationFingerprint";
import { getNodeType } from "@/utils/density/evalTypes";
import { marchingSquaresZeroContour } from "@/utils/shapePreview/marchingSquaresZeroContour";
import { marchingSquaresZeroContourAtWorldY } from "@/utils/shapePreview/volumeSliceZeroContour";
import { isSdfType } from "@/utils/shapePreview/shapePreviewProfile";
import { buildCellShapeGridForTarget } from "@/utils/shapePreview/buildCellShapeGridForTarget";
import { resolveShapePreviewMeshNodeId } from "@/utils/shapePreview/resolveShapePreviewMesh";
import { evaluatePositions, type EvaluatedPosition, type WorldRange } from "@/utils/positionEvaluator";
import { useConfigStore } from "@/stores/configStore";
import { getShapePreviewSliceY } from "@/hooks/useShapePreviewSliceY";
import type { ContourSegment } from "@/utils/shapePreview/marchingSquaresZeroContour";
const EMPTY_CONTOUR_SEGMENTS: ContourSegment[] = [];
const EMPTY_MESH_POINTS: EvaluatedPosition[] = [];

function getPreviewTargetNode(
  nodes: Node[],
  selectedPreviewNodeId: string | null,
  outputNodeId: string | null,
): Node | null {
  if (selectedPreviewNodeId) {
    return nodes.find((n) => n.id === selectedPreviewNodeId) ?? null;
  }
  if (outputNodeId) {
    return nodes.find((n) => n.id === outputNodeId) ?? null;
  }
  return null;
}

/** Match Heatmap2D grid size from density values, or fall back to preview resolution. */
function densityGridResolution(
  values: Float32Array | null,
  mode: string,
  resolution: number,
  voxelResolution: number,
): number {
  if (mode === "voxel" || mode === "world") {
    return voxelResolution;
  }
  if (values && values.length > 0) {
    const n = Math.round(Math.sqrt(values.length));
    if (n > 0 && n * n === values.length) return n;
  }
  return resolution;
}

/**
 * Evaluates shape-preview overlays (Voronoi cells, wall distance, mesh dots, SDF zero contour).
 * Cell grid updates immediately when density values change so 2D overlays stay aligned
 * with progressive preview resolution (16→32→64→128).
 */
export function useShapePreviewEvaluation() {
  const evalFingerprint = useEvaluationFingerprint();
  const outputNodeId = useEditorStore((s) => s.outputNodeId);
  const mode = usePreviewStore((s) => s.mode);
  const resolution = usePreviewStore((s) => s.resolution);
  const voxelResolution = usePreviewStore((s) => s.voxelResolution);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const yLevel = usePreviewStore((s) => s.yLevel);
  const voxelYMin = usePreviewStore((s) => s.voxelYMin);
  const voxelYMax = usePreviewStore((s) => s.voxelYMax);
  const selectedPreviewNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);
  const values = usePreviewStore((s) => s.values);
  const voxelDensities = usePreviewStore((s) => s.voxelDensities);
  const voxelYSlices = usePreviewStore((s) => s.voxelYSlices);
  const viewMode = usePreviewStore((s) => s.viewMode);
  const autoRefresh = usePreviewStore((s) => s.autoRefresh);

  const showShapePreview = usePreviewStore((s) => s.showShapePreview);
  const showCellBoundaries = usePreviewStore((s) => s.showCellBoundaries);
  const showWallDistance = usePreviewStore((s) => s.showWallDistance);
  const showMeshSamples = usePreviewStore((s) => s.showMeshSamples);
  const showSdfSurface = usePreviewStore((s) => s.showSdfSurface);
  const shapePreviewSeed = usePreviewStore((s) => s.shapePreviewSeed);

  const setCellShapeGrid = usePreviewStore((s) => s.setCellShapeGrid);
  const setSdfZeroSegments = usePreviewStore((s) => s.setSdfZeroSegments);
  const setShapePreviewMeshPoints = usePreviewStore((s) => s.setShapePreviewMeshPoints);

  const debounceMs = useConfigStore((s) => s.debounceMs);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── SDF zero contour from 3D voxel volume (voxel mode; matches mesh slice) ──
  useEffect(() => {
    if (mode !== "voxel" && mode !== "world") return;

    if (viewMode === "graph" || !autoRefresh || !showShapePreview || !showSdfSurface) {
      if (usePreviewStore.getState().sdfZeroSegments.length > 0) {
        setSdfZeroSegments(EMPTY_CONTOUR_SEGMENTS);
      }
      return;
    }

    const { nodes } = useEditorStore.getState();
    const target = getPreviewTargetNode(nodes, selectedPreviewNodeId, outputNodeId);
    if (!target || !isSdfType(getNodeType(target))) {
      if (usePreviewStore.getState().sdfZeroSegments.length > 0) {
        setSdfZeroSegments(EMPTY_CONTOUR_SEGMENTS);
      }
      return;
    }
    if (!voxelDensities || voxelDensities.length === 0) return;

    const n = voxelResolution;
    const ys = Math.max(1, voxelYSlices);
    if (voxelDensities.length < n * n * ys) return;

    const sliceY = getShapePreviewSliceY(mode, yLevel, voxelYMin, voxelYMax, {
      preferYLevel: true,
    });
    setSdfZeroSegments(
      marchingSquaresZeroContourAtWorldY(
        voxelDensities,
        n,
        ys,
        voxelYMin,
        voxelYMax,
        sliceY,
      ),
    );
  }, [
    evalFingerprint,
    outputNodeId,
    mode,
    voxelResolution,
    voxelYSlices,
    voxelYMin,
    voxelYMax,
    yLevel,
    selectedPreviewNodeId,
    voxelDensities,
    viewMode,
    autoRefresh,
    showShapePreview,
    showSdfSurface,
    setSdfZeroSegments,
  ]);

  // ── Cell walls: sync immediately with current density grid (no debounce) ──
  useEffect(() => {
    const clearCellGrid = () => {
      if (usePreviewStore.getState().cellShapeGrid !== null) {
        setCellShapeGrid(null);
      }
    };

    if (viewMode === "graph" || !autoRefresh || !showShapePreview) {
      clearCellGrid();
      return;
    }
    if (!showCellBoundaries && !showWallDistance) {
      clearCellGrid();
      return;
    }
    if (!values || values.length === 0) {
      clearCellGrid();
      return;
    }

    const { nodes, edges } = useEditorStore.getState();
    const target = getPreviewTargetNode(nodes, selectedPreviewNodeId, outputNodeId);
    if (!target) {
      clearCellGrid();
      return;
    }

    const sliceY = getShapePreviewSliceY(mode, yLevel, voxelYMin, voxelYMax);
    const gridRes = densityGridResolution(values, mode, resolution, voxelResolution);
    const grid = buildCellShapeGridForTarget(
      nodes,
      edges,
      target,
      rangeMin,
      rangeMax,
      gridRes,
      sliceY,
    );
    setCellShapeGrid(grid);
  }, [
    evalFingerprint,
    outputNodeId,
    mode,
    resolution,
    voxelResolution,
    rangeMin,
    rangeMax,
    yLevel,
    voxelYMin,
    voxelYMax,
    selectedPreviewNodeId,
    values,
    viewMode,
    autoRefresh,
    showShapePreview,
    showCellBoundaries,
    showWallDistance,
    setCellShapeGrid,
  ]);

  // ── Mesh + 2D SDF: debounced (voxel SDF uses dedicated effect above) ──
  useEffect(() => {
    if (viewMode === "graph" || !autoRefresh || !showShapePreview) {
      if (usePreviewStore.getState().shapePreviewMeshPoints.length > 0) {
        setShapePreviewMeshPoints(EMPTY_MESH_POINTS);
      }
      if (mode !== "voxel" && mode !== "world" && usePreviewStore.getState().sdfZeroSegments.length > 0) {
        setSdfZeroSegments(EMPTY_CONTOUR_SEGMENTS);
      }
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const { nodes, edges } = useEditorStore.getState();
      const target = getPreviewTargetNode(nodes, selectedPreviewNodeId, outputNodeId);
      if (!target) {
        if (usePreviewStore.getState().sdfZeroSegments.length > 0) {
          setSdfZeroSegments(EMPTY_CONTOUR_SEGMENTS);
        }
        if (usePreviewStore.getState().shapePreviewMeshPoints.length > 0) {
          setShapePreviewMeshPoints(EMPTY_MESH_POINTS);
        }
        return;
      }

      const type = getNodeType(target);
      const previewId = target.id;

      const useVolumeSdf =
        (mode === "voxel" || mode === "world") &&
        isSdfType(type) &&
        voxelDensities &&
        voxelDensities.length >= voxelResolution * voxelResolution * Math.max(1, voxelYSlices);

      if (showSdfSurface && isSdfType(type) && !useVolumeSdf && values && values.length > 0) {
        const n = Math.round(Math.sqrt(values.length));
        if (n * n === values.length) {
          setSdfZeroSegments(marchingSquaresZeroContour(values, n));
        } else if (usePreviewStore.getState().sdfZeroSegments.length > 0) {
          setSdfZeroSegments(EMPTY_CONTOUR_SEGMENTS);
        }
      } else if (showSdfSurface && isSdfType(type) && useVolumeSdf) {
        // Voxel/world SDF contour: dedicated effect above (no debounce).
      } else if ((!showSdfSurface || !isSdfType(type)) && usePreviewStore.getState().sdfZeroSegments.length > 0) {
        setSdfZeroSegments(EMPTY_CONTOUR_SEGMENTS);
      }

      if (showMeshSamples) {
        const meshNodeId = resolveShapePreviewMeshNodeId(nodes, edges, previewId);
        if (meshNodeId) {
          const range: WorldRange = {
            minX: rangeMin,
            maxX: rangeMax,
            minZ: rangeMin,
            maxZ: rangeMax,
          };
          const pts = evaluatePositions(nodes, edges, range, shapePreviewSeed, meshNodeId);
          setShapePreviewMeshPoints(pts);
        } else if (usePreviewStore.getState().shapePreviewMeshPoints.length > 0) {
          setShapePreviewMeshPoints(EMPTY_MESH_POINTS);
        }
      } else if (usePreviewStore.getState().shapePreviewMeshPoints.length > 0) {
        setShapePreviewMeshPoints(EMPTY_MESH_POINTS);
      }
    }, debounceMs);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [
    evalFingerprint,
    outputNodeId,
    rangeMin,
    rangeMax,
    selectedPreviewNodeId,
    values,
    voxelDensities,
    mode,
    voxelResolution,
    voxelYSlices,
    voxelYMin,
    voxelYMax,
    yLevel,
    viewMode,
    autoRefresh,
    showShapePreview,
    showMeshSamples,
    showSdfSurface,
    shapePreviewSeed,
    debounceMs,
    setSdfZeroSegments,
    setShapePreviewMeshPoints,
  ]);
}
