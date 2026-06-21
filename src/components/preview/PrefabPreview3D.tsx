import { memo, useEffect, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import {
  BufferAttribute,
  BufferGeometry,
  Color,
  MathUtils,
} from "three";
import type { PrefabPreviewMeshData } from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";
import {
  computePrefabPreviewCameraDistance,
  computePrefabPreviewFitRadius,
} from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";

interface PrefabMeshProps {
  data: PrefabPreviewMeshData;
}

const PrefabMesh = memo(function PrefabMesh({ data }: PrefabMeshProps) {
  const geometry = useMemo(() => {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(data.positions, 3));
    geo.setAttribute("color", new BufferAttribute(data.colors, 3));
    geo.setIndex(new BufferAttribute(data.indices, 1));
    geo.computeVertexNormals();
    geo.computeBoundingSphere();
    return geo;
  }, [data]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} castShadow receiveShadow>
      <meshStandardMaterial vertexColors roughness={0.85} metalness={0.05} />
    </mesh>
  );
});

function FitCamera({
  data,
  staticView = false,
  compact = false,
}: {
  data: PrefabPreviewMeshData;
  staticView?: boolean;
  compact?: boolean;
}) {
  const { camera, controls, invalidate } = useThree();

  useEffect(() => {
    const [cx, cy, cz] = data.center;
    const fitRadius = computePrefabPreviewFitRadius(data);
    const fovDeg = compact ? 38 : 45;
    const padding = compact ? 1.55 : 1.4;
    const distance = computePrefabPreviewCameraDistance(fitRadius, fovDeg, padding);

    camera.position.set(
      cx + distance * 0.72,
      cy + distance * 0.55,
      cz + distance * 0.72,
    );
    camera.lookAt(cx, cy, cz);
    camera.updateProjectionMatrix();

    const orbit = controls as {
      target: { set: (x: number, y: number, z: number) => void };
      minDistance?: number;
      maxDistance?: number;
      update: () => void;
    } | null;
    if (orbit) {
      orbit.target.set(cx, cy, cz);
      orbit.minDistance = Math.max(fitRadius * 0.3, 2);
      orbit.maxDistance = Math.max(fitRadius * 10, 64);
      orbit.update();
    }

    if (staticView) invalidate();
  }, [camera, controls, data, invalidate, staticView, compact]);

  return null;
}

interface PrefabPreview3DProps {
  mesh: PrefabPreviewMeshData;
  className?: string;
  /** Lightweight static thumbnail for inline node previews (no orbit controls). */
  compact?: boolean;
}

/** Compact orbitable 3D preview of a Hytale prefab (vertex colors from synced block textures). */
export function PrefabPreview3D({ mesh, className, compact = false }: PrefabPreview3DProps) {
  const [cx, cy, cz] = mesh.center;
  const fitRadius = computePrefabPreviewFitRadius(mesh);
  const bg = new Color("#1c1a17");

  return (
    <div
      className={
        className
        ?? (compact
          ? "relative w-full h-full overflow-hidden bg-[#1c1a17]"
          : "relative w-full h-full min-h-[220px] rounded border border-tn-border overflow-hidden bg-[#1c1a17]")
      }
    >
      <Canvas
        camera={{ fov: compact ? 38 : 45, near: 0.1, far: Math.max(800, fitRadius * 24) }}
        dpr={compact ? 1 : undefined}
        frameloop={compact ? "demand" : "always"}
        gl={{ preserveDrawingBuffer: !compact, antialias: !compact }}
        onCreated={({ gl }) => {
          gl.setClearColor(bg);
        }}
      >
        <ambientLight intensity={0.55} />
        <directionalLight position={[12, 18, 8]} intensity={0.85} castShadow={!compact} />
        <directionalLight position={[-8, 10, -6]} intensity={0.25} color="#b0c4de" />
        <PrefabMesh data={mesh} />
        <FitCamera data={mesh} staticView={compact} compact={compact} />
        {!compact && (
          <>
            <OrbitControls
              target={[cx, cy, cz]}
              enableDamping
              dampingFactor={0.08}
              minDistance={MathUtils.clamp(fitRadius * 0.3, 2, 40)}
              maxDistance={Math.max(fitRadius * 10, 64)}
            />
            <gridHelper
              args={[Math.max(fitRadius * 2.4, 8), 8, "#4a4438", "#312d28"]}
              position={[cx, mesh.bounds.min[1], cz]}
            />
          </>
        )}
      </Canvas>
    </div>
  );
}
