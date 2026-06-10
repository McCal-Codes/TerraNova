import { memo, useMemo } from "react";
import { usePreviewStore } from "@/stores/previewStore";
import { blockToScenePosition } from "@/utils/worldMeshBuilder";

/** Glowing marker at the live player block position in World preview. */
export const WorldPlayerMarker = memo(function WorldPlayerMarker() {
  const mode = usePreviewStore((s) => s.mode);
  const show = usePreviewStore((s) => s.showWorldPlayerMarker);
  const live = usePreviewStore((s) => s.worldLivePlayer);
  const layout = usePreviewStore((s) => s.worldSceneLayout);
  const centerX = usePreviewStore((s) => s.worldCenterX);
  const centerZ = usePreviewStore((s) => s.worldCenterZ);
  const meshData = usePreviewStore((s) => s.voxelMeshData);

  const position = useMemo((): [number, number, number] | null => {
    if (mode !== "world" || !show || !live || !layout || !meshData?.length) return null;
    return blockToScenePosition(live.x, live.y, live.z, centerX, centerZ, layout);
  }, [mode, show, live, layout, centerX, centerZ, meshData]);

  if (!position) return null;

  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.55, 12, 12]} />
        <meshStandardMaterial
          color="#22d3ee"
          emissive="#0891b2"
          emissiveIntensity={0.85}
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh position={[0, 1.2, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 1.1, 6]} />
        <meshStandardMaterial color="#67e8f9" emissive="#06b6d4" emissiveIntensity={0.5} />
      </mesh>
    </group>
  );
});
