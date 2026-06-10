import { useMemo, useRef, useEffect } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { SphereGeometry, MeshStandardMaterial, Color, Object3D } from "three";
import type { InstancedMesh } from "three";
import { useShapePreviewSliceY } from "@/hooks/useShapePreviewSliceY";
import { useVoxelSceneMapping } from "@/hooks/useVoxelSceneMapping";
import { worldToScenePoint, type PreviewSceneSpace } from "@/utils/shapePreview/previewSceneCoords";

interface ShapePreviewMeshMarkers3DProps {
  space: PreviewSceneSpace;
  sliceWorldY?: number;
}

/**
 * Shape-preview mesh sample markers (amber), separate from generic position overlay.
 */
export function ShapePreviewMeshMarkers3D({ space, sliceWorldY }: ShapePreviewMeshMarkers3DProps) {
  const showShapePreview = usePreviewStore((s) => s.showShapePreview);
  const showMeshSamples = usePreviewStore((s) => s.showMeshSamples);
  const points = usePreviewStore((s) => s.shapePreviewMeshPoints);
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

  const meshRef = useRef<InstancedMesh>(null);
  const sliceY = sliceWorldY ?? defaultSliceY;

  const geometry = useMemo(() => new SphereGeometry(0.2, 8, 6), []);
  const material = useMemo(
    () =>
      new MeshStandardMaterial({
        color: new Color("#f59e0b"),
        emissive: new Color("#f59e0b"),
        emissiveIntensity: 0.6,
      }),
    [],
  );

  useEffect(() => () => geometry.dispose(), [geometry]);
  useEffect(() => () => material.dispose(), [material]);

  const visiblePoints = useMemo(() => {
    if (!showShapePreview || !showMeshSamples) return [];
    return points;
  }, [showShapePreview, showMeshSamples, points]);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh || visiblePoints.length === 0) return;

    const hf =
      space === "heightfield"
        ? {
            values,
            resolution,
            heightScale3D,
            minValue,
            maxValue,
            p02Value,
            p98Value,
          }
        : undefined;

    const dummy = new Object3D();

    for (let i = 0; i < visiblePoints.length; i++) {
      const pt = visiblePoints[i];
      const [sx, sy, sz] = worldToScenePoint(
        pt.x,
        sliceY,
        pt.z,
        space,
        rangeMin,
        rangeMax,
        hf,
        voxelScene,
      );
      const scl = 0.35 + 0.25 * pt.weight;
      dummy.position.set(sx, sy + 0.1, sz);
      dummy.scale.set(scl, scl, scl);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }

    mesh.instanceMatrix.needsUpdate = true;
    mesh.count = visiblePoints.length;
  }, [
    visiblePoints,
    space,
    rangeMin,
    rangeMax,
    sliceY,
    voxelScene,
    values,
    resolution,
    heightScale3D,
    minValue,
    maxValue,
    p02Value,
    p98Value,
  ]);

  if (visiblePoints.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, visiblePoints.length]}
      frustumCulled={false}
    />
  );
}
