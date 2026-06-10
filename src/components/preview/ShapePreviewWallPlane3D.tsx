import { useEffect, useMemo, useRef } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { useShapePreviewSliceY } from "@/hooks/useShapePreviewSliceY";
import { useVoxelSceneMapping } from "@/hooks/useVoxelSceneMapping";
import { BufferAttribute, DoubleSide } from "three";
import type { Mesh } from "three";
import {
  gridCornerToWorld,
  worldToScenePoint,
  type PreviewSceneSpace,
} from "@/utils/shapePreview/previewSceneCoords";

interface ShapePreviewWallPlane3DProps {
  space: PreviewSceneSpace;
  sliceWorldY?: number;
}

/**
 * Semi-transparent horizontal slice tinted by Voronoi wall distance (cyan = near wall).
 */
export function ShapePreviewWallPlane3D({ space, sliceWorldY }: ShapePreviewWallPlane3DProps) {
  const showShapePreview = usePreviewStore((s) => s.showShapePreview);
  const showWallDistance = usePreviewStore((s) => s.showWallDistance);
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

  const meshRef = useRef<Mesh>(null);
  const sliceY = sliceWorldY ?? defaultSliceY;

  const heightfield = useMemo(
    () =>
      space === "heightfield"
        ? { values, resolution, heightScale3D, minValue, maxValue, p02Value, p98Value }
        : undefined,
    [space, values, resolution, heightScale3D, minValue, maxValue, p02Value, p98Value],
  );

  const geometry = useMemo(() => {
    if (!showShapePreview || !showWallDistance || !cellShapeGrid) return null;

    const n = cellShapeGrid.resolution;
    let maxWall = 0;
    for (let i = 0; i < cellShapeGrid.wallDist.length; i++) {
      if (cellShapeGrid.wallDist[i] > maxWall) maxWall = cellShapeGrid.wallDist[i];
    }
    if (maxWall < 1e-6) return null;

    const positions: number[] = [];
    const colors: number[] = [];
    const indices: number[] = [];

    for (let row = 0; row < n - 1; row++) {
      for (let col = 0; col < n - 1; col++) {
        const idx = row * n + col;
        const w = cellShapeGrid.wallDist[idx] / maxWall;
        const strength = (1 - w) * 0.85;
        if (strength < 0.03) continue;

        const { x: wx0, z: wz0 } = gridCornerToWorld(col, row, n, rangeMin, rangeMax);
        const { x: wx1, z: wz1 } = gridCornerToWorld(col + 1, row, n, rangeMin, rangeMax);
        const { x: wx2, z: wz2 } = gridCornerToWorld(col, row + 1, n, rangeMin, rangeMax);
        const { x: wx3, z: wz3 } = gridCornerToWorld(col + 1, row + 1, n, rangeMin, rangeMax);

        const corners = [
          worldToScenePoint(wx0, sliceY, wz0, space, rangeMin, rangeMax, heightfield, voxelScene),
          worldToScenePoint(wx1, sliceY, wz1, space, rangeMin, rangeMax, heightfield, voxelScene),
          worldToScenePoint(wx3, sliceY, wz3, space, rangeMin, rangeMax, heightfield, voxelScene),
          worldToScenePoint(wx2, sliceY, wz2, space, rangeMin, rangeMax, heightfield, voxelScene),
        ];

        const base = positions.length / 3;
        for (const c of corners) {
          positions.push(c[0], c[1] + 0.05, c[2]);
          colors.push(0.22 * strength, 0.74 * strength, 0.97 * strength);
        }
        indices.push(base, base + 1, base + 2, base, base + 2, base + 3);
      }
    }

    if (indices.length === 0) return null;

    return {
      positions: new Float32Array(positions),
      colors: new Float32Array(colors),
      indices: new Uint32Array(indices),
    };
  }, [
    showShapePreview,
    showWallDistance,
    cellShapeGrid,
    space,
    rangeMin,
    rangeMax,
    sliceY,
    voxelScene,
    heightfield,
  ]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || !geometry) return;
    const geo = mesh.geometry;
    geo.setAttribute("position", new BufferAttribute(geometry.positions, 3));
    geo.setAttribute("color", new BufferAttribute(geometry.colors, 3));
    geo.setIndex(new BufferAttribute(geometry.indices, 1));
    geo.computeVertexNormals();
  }, [geometry]);

  if (!geometry) return null;

  return (
    <mesh ref={meshRef} frustumCulled={false} renderOrder={8}>
      <bufferGeometry />
      <meshBasicMaterial
        vertexColors
        transparent
        opacity={0.55}
        side={DoubleSide}
        depthWrite={false}
      />
    </mesh>
  );
}
