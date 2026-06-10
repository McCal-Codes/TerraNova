import { useEffect, useRef } from "react";
import { useThree } from "@react-three/fiber";

interface PreviewSceneCameraFitProps {
  /** Scene radius in world units (half-extent of content). */
  radius?: number;
  /** Orbit target — defaults to origin. */
  target?: [number, number, number];
  /** Re-run fit when this key changes (e.g. mode switch). */
  resetKey?: string | number;
}

/**
 * One-shot camera pull-back so the first 3D view is not overly tight.
 * Pattern matches PrefabPreview3D FitCamera with a wider margin.
 */
export function PreviewSceneCameraFit({
  radius = 28,
  target = [0, 0, 0],
  resetKey = "default",
}: PreviewSceneCameraFitProps) {
  const { camera, controls } = useThree();
  const lastKey = useRef<string | number | null>(null);

  useEffect(() => {
    if (lastKey.current === resetKey) return;
    lastKey.current = resetKey;

    const distance = Math.max(radius * 2.6, 42);
    const [tx, ty, tz] = target;
    camera.position.set(tx + distance * 0.72, ty + distance * 0.58, tz + distance * 0.72);
    camera.lookAt(tx, ty, tz);
    camera.updateProjectionMatrix();

    const orbit = controls as { target: { set: (x: number, y: number, z: number) => void }; minDistance?: number; maxDistance?: number; update: () => void } | null;
    if (orbit) {
      orbit.target.set(tx, ty, tz);
      orbit.minDistance = Math.max(radius * 0.35, 8);
      orbit.maxDistance = Math.max(radius * 6, 120);
      orbit.update();
    }
  }, [camera, controls, radius, resetKey, target]);

  return null;
}
