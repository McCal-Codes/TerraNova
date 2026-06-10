import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

/** Notify parent to remount Canvas after WebGL context loss. */
export function WebGLContextRecovery({ onRecover }: { onRecover: () => void }) {
  const gl = useThree((s) => s.gl);

  useEffect(() => {
    const canvas = gl.domElement;
    const onLost = (event: Event) => {
      event.preventDefault();
      onRecover();
    };
    canvas.addEventListener("webglcontextlost", onLost, false);
    return () => canvas.removeEventListener("webglcontextlost", onLost);
  }, [gl, onRecover]);

  return null;
}
