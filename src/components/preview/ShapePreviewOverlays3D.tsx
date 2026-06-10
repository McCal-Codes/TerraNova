import { useMemo } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { Line } from "@react-three/drei";
import type { CellShapeGridResult } from "@/utils/shapePreview/cellShapeGrid";
import type { ContourSegment } from "@/utils/shapePreview/marchingSquaresZeroContour";
import { useShapePreviewSliceY } from "@/hooks/useShapePreviewSliceY";
import { useVoxelSceneMapping } from "@/hooks/useVoxelSceneMapping";
import { forEachCellVoronoiEdge } from "@/utils/shapePreview/cellVoronoiEdges";
import {
  gridCornerToWorld,
  worldToScenePoint,
  type PreviewSceneSpace,
  type VoxelSceneMapping,
} from "@/utils/shapePreview/previewSceneCoords";

interface ShapePreviewOverlays3DProps {
  space: PreviewSceneSpace;
  /** World Y for cell slice in voxel/world space (defaults to preview yLevel). */
  sliceWorldY?: number;
}

type HeightfieldContext = {
  values: Float32Array | null;
  resolution: number;
  heightScale3D: number;
  minValue: number;
  maxValue: number;
  p02Value?: number;
  p98Value?: number;
};

function buildCellLinePoints(
  cellShapeGrid: CellShapeGridResult,
  space: PreviewSceneSpace,
  rangeMin: number,
  rangeMax: number,
  sliceWorldY: number,
  heightfield: HeightfieldContext | undefined,
  voxelScene: VoxelSceneMapping | undefined,
): [number, number, number][] {
  const n = cellShapeGrid.resolution;
  const points: [number, number, number][] = [];
  const hf = space === "heightfield" ? heightfield : undefined;

  const cornerScene = (col: number, row: number) => {
    const { x, z } = gridCornerToWorld(col, row, n, rangeMin, rangeMax);
    return worldToScenePoint(x, sliceWorldY, z, space, rangeMin, rangeMax, hf, voxelScene);
  };

  forEachCellVoronoiEdge(cellShapeGrid, (c0, r0, c1, r1) => {
    points.push(cornerScene(c0, r0), cornerScene(c1, r1));
  });
  return points;
}

function buildContourLinePoints(
  segments: ContourSegment[],
  n: number,
  space: PreviewSceneSpace,
  rangeMin: number,
  rangeMax: number,
  sliceWorldY: number,
  heightfield: HeightfieldContext | undefined,
  voxelScene: VoxelSceneMapping | undefined,
): [number, number, number][] {
  const points: [number, number, number][] = [];
  const hf = space === "heightfield" ? heightfield : undefined;
  const worldRange = rangeMax - rangeMin || 1;

  for (const seg of segments) {
    const wx1 = rangeMin + (seg.x1 / n) * worldRange;
    const wz1 = rangeMin + (seg.z1 / n) * worldRange;
    const wx2 = rangeMin + (seg.x2 / n) * worldRange;
    const wz2 = rangeMin + (seg.z2 / n) * worldRange;
    points.push(
      worldToScenePoint(wx1, sliceWorldY, wz1, space, rangeMin, rangeMax, hf, voxelScene),
      worldToScenePoint(wx2, sliceWorldY, wz2, space, rangeMin, rangeMax, hf, voxelScene),
    );
  }
  return points;
}

export function ShapePreviewCellLines3D({ space, sliceWorldY }: ShapePreviewOverlays3DProps) {
  const showShapePreview = usePreviewStore((s) => s.showShapePreview);
  const showCellBoundaries = usePreviewStore((s) => s.showCellBoundaries);
  const cellShapeGrid = usePreviewStore((s) => s.cellShapeGrid);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const defaultSliceY = useShapePreviewSliceY();
  const voxelSceneMap = useVoxelSceneMapping();
  const voxelScene = space === "voxelScene" ? voxelSceneMap : undefined;
  const values = usePreviewStore((s) => s.values);
  const resolution = usePreviewStore((s) => s.resolution);
  const heightScale3D = usePreviewStore((s) => s.heightScale3D);
  const minValue = usePreviewStore((s) => s.minValue);
  const maxValue = usePreviewStore((s) => s.maxValue);
  const p02Value = usePreviewStore((s) => s.p02Value);
  const p98Value = usePreviewStore((s) => s.p98Value);

  const sliceY = sliceWorldY ?? defaultSliceY;
  const heightfield = useMemo<HeightfieldContext | undefined>(
    () =>
      space === "heightfield"
        ? { values, resolution, heightScale3D, minValue, maxValue, p02Value, p98Value }
        : undefined,
    [space, values, resolution, heightScale3D, minValue, maxValue, p02Value, p98Value],
  );

  const points = useMemo(() => {
    if (!showShapePreview || !showCellBoundaries || !cellShapeGrid) return [];
    return buildCellLinePoints(
      cellShapeGrid,
      space,
      rangeMin,
      rangeMax,
      sliceY,
      heightfield,
      voxelScene,
    );
  }, [
    showShapePreview,
    showCellBoundaries,
    cellShapeGrid,
    space,
    rangeMin,
    rangeMax,
    sliceY,
    voxelScene,
    heightfield,
  ]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      segments
      color="#ffffff"
      lineWidth={1.5}
      transparent
      opacity={0.85}
    />
  );
}

export function ShapePreviewSdfLines3D({ space, sliceWorldY }: ShapePreviewOverlays3DProps) {
  const showShapePreview = usePreviewStore((s) => s.showShapePreview);
  const showSdfSurface = usePreviewStore((s) => s.showSdfSurface);
  const sdfZeroSegments = usePreviewStore((s) => s.sdfZeroSegments);
  const values = usePreviewStore((s) => s.values);
  const mode = usePreviewStore((s) => s.mode);
  const voxelResolution = usePreviewStore((s) => s.voxelResolution);
  const rangeMin = usePreviewStore((s) => s.rangeMin);
  const rangeMax = usePreviewStore((s) => s.rangeMax);
  const defaultSliceY = useShapePreviewSliceY();
  const voxelSceneMap = useVoxelSceneMapping();
  const voxelScene = space === "voxelScene" ? voxelSceneMap : undefined;
  const resolution = usePreviewStore((s) => s.resolution);
  const heightScale3D = usePreviewStore((s) => s.heightScale3D);
  const minValue = usePreviewStore((s) => s.minValue);
  const maxValue = usePreviewStore((s) => s.maxValue);
  const p02Value = usePreviewStore((s) => s.p02Value);
  const p98Value = usePreviewStore((s) => s.p98Value);

  const sliceY = sliceWorldY ?? defaultSliceY;
  const heightfield = useMemo<HeightfieldContext | undefined>(
    () =>
      space === "heightfield"
        ? { values, resolution, heightScale3D, minValue, maxValue, p02Value, p98Value }
        : undefined,
    [space, values, resolution, heightScale3D, minValue, maxValue, p02Value, p98Value],
  );

  const points = useMemo(() => {
    if (!showShapePreview || !showSdfSurface || sdfZeroSegments.length === 0) return [];
    const n =
      space === "voxelScene" || mode === "voxel" || mode === "world"
        ? voxelResolution
        : values
          ? Math.round(Math.sqrt(values.length))
          : 0;
    if (n <= 0) return [];
    return buildContourLinePoints(
      sdfZeroSegments,
      n,
      space,
      rangeMin,
      rangeMax,
      sliceY,
      heightfield,
      voxelScene,
    );
  }, [
    showShapePreview,
    showSdfSurface,
    sdfZeroSegments,
    mode,
    voxelResolution,
    values,
    space,
    rangeMin,
    rangeMax,
    sliceY,
    voxelScene,
    heightfield,
  ]);

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      segments
      color="#f472b6"
      lineWidth={2.5}
      transparent
      opacity={0.95}
    />
  );
}
