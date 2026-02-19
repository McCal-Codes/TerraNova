import { mulberry32, hashSeed } from "./prng";
import { HASH_PRIME_A, HASH_PRIME_B, HASH_PRIME_C } from "@/constants";

export function voronoiNoise2D(
  _rng: () => number,
  cellType: string = "Euclidean",
  jitter: number = 1.0,
): (x: number, y: number) => number {
  return (x: number, y: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    let d1 = Infinity;
    let d2 = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const cx = ix + dx;
        const cy = iy + dy;
        const s = hashSeed(cx * HASH_PRIME_A + cy * HASH_PRIME_B);
        const cellRng = mulberry32(s);
        const px = cx + cellRng() * jitter;
        const py = cy + cellRng() * jitter;
        const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2);
        if (dist < d1) { d2 = d1; d1 = dist; }
        else if (dist < d2) { d2 = dist; }
      }
    }
    if (cellType === "Distance2Div") return d2 > 0 ? (d1 / d2) * 2 - 1 : 0;
    if (cellType === "Distance2Sub") return (d2 - d1) * 2 - 1;
    return d1 * 2 - 1; // Euclidean default
  };
}

export function voronoiNoise3D(
  _rng: () => number,
  cellType: string = "Euclidean",
  jitter: number = 1.0,
): (x: number, y: number, z: number) => number {
  return (x: number, y: number, z: number) => {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const iz = Math.floor(z);
    let d1 = Infinity;
    let d2 = Infinity;
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        for (let dz = -1; dz <= 1; dz++) {
          const cx = ix + dx;
          const cy = iy + dy;
          const cz = iz + dz;
          const s = hashSeed(cx * HASH_PRIME_A + cy * HASH_PRIME_B + cz * HASH_PRIME_C);
          const cellRng = mulberry32(s);
          const px = cx + cellRng() * jitter;
          const py = cy + cellRng() * jitter;
          const pz = cz + cellRng() * jitter;
          const dist = Math.sqrt((x - px) ** 2 + (y - py) ** 2 + (z - pz) ** 2);
          if (dist < d1) { d2 = d1; d1 = dist; }
          else if (dist < d2) { d2 = dist; }
        }
      }
    }
    if (cellType === "Distance2Div") return d2 > 0 ? (d1 / d2) * 2 - 1 : 0;
    if (cellType === "Distance2Sub") return (d2 - d1) * 2 - 1;
    return d1 * 2 - 1; // Euclidean default
  };
}
