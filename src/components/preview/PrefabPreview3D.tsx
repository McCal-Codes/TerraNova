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

function FitCamera({ data, staticView = false }: { data: PrefabPreviewMeshData; staticView?: boolean }) {
  const { camera, invalidate } = useThree();

  useEffect(() => {
    const [cx, cy, cz] = data.center;
    const distance = Math.max(data.radius * 2.2, 4);
    camera.position.set(cx + distance, cy + distance * 0.65, cz + distance);
    camera.lookAt(cx, cy, cz);
    camera.updateProjectionMatrix();
    if (staticView) invalidate();
  }, [camera, data, invalidate, staticView]);

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
        camera={{ fov: compact ? 38 : 45, near: 0.1, far: 500 }}
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
        <FitCamera data={mesh} staticView={compact} />
        {!compact && (
          <>
            <OrbitControls
              target={[cx, cy, cz]}
              enableDamping
              dampingFactor={0.08}
              minDistance={MathUtils.clamp(mesh.radius * 0.4, 2, 40)}
              maxDistance={Math.max(mesh.radius * 6, 24)}
            />
            <gridHelper
              args={[Math.max(mesh.radius * 2, 8), 8, "#4a4438", "#312d28"]}
              position={[cx, mesh.bounds.min[1], cz]}
            />
          </>
        )}
      </Canvas>
    </div>
  );
}
