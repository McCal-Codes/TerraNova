/** Hytale block rotation enum → Euler angles for Three.js Object3D.rotation. */
export function applyBlockRotation(rotation: number): { x: number; y: number; z: number } {
  switch (rotation) {
    case 1: return { x: 0, y: -Math.PI / 2, z: 0 };
    case 2: return { x: 0, y: Math.PI, z: 0 };
    case 3: return { x: 0, y: Math.PI / 2, z: 0 };
    case 4: return { x: 0, y: 0, z: Math.PI / 2 };
    case 5: return { x: Math.PI / 2, y: 0, z: 0 };
    case 8: return { x: Math.PI, y: 0, z: 0 };
    default: return { x: 0, y: 0, z: 0 };
  }
}
