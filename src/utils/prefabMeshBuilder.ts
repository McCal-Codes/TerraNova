import type { VoxelMeshData } from "./voxelMeshBuilder";
import { resolveBlockColor } from "./blockColorMap";
import { HASH_PRIME_A, HASH_PRIME_B, HASH_PRIME_C, HASH_PRIME_D } from "@/constants";

export interface PrefabBlock {
  x: number;
  y: number;
  z: number;
  name: string;
}

export interface PrefabJson {
  version?: number;
  blockIdVersion?: number;
  anchorX?: number;
  anchorY?: number;
  anchorZ?: number;
  blocks: PrefabBlock[];
}

const FACES = [
  { dir: [0, 1, 0] as const, verts: [[0,1,0],[0,1,1],[1,1,1],[1,1,0]] as const },
  { dir: [0,-1,0] as const, verts: [[0,0,1],[0,0,0],[1,0,0],[1,0,1]] as const },
  { dir: [1, 0, 0] as const, verts: [[1,0,0],[1,1,0],[1,1,1],[1,0,1]] as const },
  { dir: [-1,0, 0] as const, verts: [[0,0,1],[0,1,1],[0,1,0],[0,0,0]] as const },
  { dir: [0, 0, 1] as const, verts: [[1,0,1],[1,1,1],[0,1,1],[0,0,1]] as const },
  { dir: [0, 0,-1] as const, verts: [[0,0,0],[0,1,0],[1,1,0],[1,0,0]] as const },
];
const FACE_BRIGHTNESS = [1.0, 0.6, 0.80, 0.72, 0.85, 0.68];

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [
    parseInt(h.substring(0, 2), 16) / 255,
    parseInt(h.substring(2, 4), 16) / 255,
    parseInt(h.substring(4, 6), 16) / 255,
  ];
}

function blockHash(x: number, y: number, z: number): number {
  let h = (x * HASH_PRIME_A + y * HASH_PRIME_B + z * HASH_PRIME_D) | 0;
  h = ((h ^ (h >> 13)) * HASH_PRIME_C) | 0;
  return (h ^ (h >> 16)) & 0x7fffffff;
}

function blockJitter(x: number, y: number, z: number): number {
  return ((blockHash(x, y, z) % 1000) / 1000 - 0.5) * 0.12;
}

export function buildPrefabMeshes(blocks: PrefabBlock[]): VoxelMeshData[] {
  if (blocks.length === 0) return [];

  // Occupancy set for O(1) neighbor checks
  const occupied = new Set<string>(blocks.map((b) => `${b.x},${b.y},${b.z}`));

  // Bounding box
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let zMin = Infinity, zMax = -Infinity;
  for (const b of blocks) {
    if (b.x < xMin) xMin = b.x; if (b.x > xMax) xMax = b.x;
    if (b.y < yMin) yMin = b.y; if (b.y > yMax) yMax = b.y;
    if (b.z < zMin) zMin = b.z; if (b.z > zMax) zMax = b.z;
  }

  const extentX = xMax - xMin + 1;
  const extentY = yMax - yMin + 1;
  const extentZ = zMax - zMin + 1;
  const maxExtent = Math.max(extentX, extentY, extentZ, 1);

  const SCENE_SIZE = 50;
  const scale = SCENE_SIZE / maxExtent;
  const midX = (xMin + xMax + 1) / 2;
  const midZ = (zMin + zMax + 1) / 2;

  const rgbCache = new Map<string, [number, number, number]>();

  const materialQuads = new Map<string, {
    color: string;
    roughness: number;
    metalness: number;
    name: string;
    positions: number[];
    normals: number[];
    colors: number[];
    indices: number[];
  }>();

  for (const b of blocks) {
    const info = resolveBlockColor(b.name);
    const key = info.color;

    let entry = materialQuads.get(key);
    if (!entry) {
      entry = {
        color: info.color,
        roughness: info.roughness,
        metalness: info.metalness,
        name: info.name,
        positions: [],
        normals: [],
        colors: [],
        indices: [],
      };
      materialQuads.set(key, entry);
    }

    let baseRGB = rgbCache.get(info.color);
    if (!baseRGB) {
      baseRGB = hexToRGB(info.color);
      rgbCache.set(info.color, baseRGB);
    }

    for (let fi = 0; fi < 6; fi++) {
      const face = FACES[fi];
      const nx = b.x + face.dir[0];
      const ny = b.y + face.dir[1];
      const nz = b.z + face.dir[2];
      if (occupied.has(`${nx},${ny},${nz}`)) continue;

      const baseVert = entry.positions.length / 3;
      const faceBrightness = FACE_BRIGHTNESS[fi];
      const jitter = blockJitter(b.x, b.y, b.z);

      for (let vi = 0; vi < 4; vi++) {
        const v = face.verts[vi];
        entry.positions.push(
          ((b.x + v[0]) - midX) * scale,
          ((b.y + v[1]) - yMin) * scale - SCENE_SIZE / 2,
          ((b.z + v[2]) - midZ) * scale,
        );
        entry.normals.push(face.dir[0], face.dir[1], face.dir[2]);

        const br = faceBrightness * (1 + jitter);
        entry.colors.push(
          Math.min(1, Math.max(0, baseRGB[0] * br)),
          Math.min(1, Math.max(0, baseRGB[1] * br)),
          Math.min(1, Math.max(0, baseRGB[2] * br)),
        );
      }
      entry.indices.push(
        baseVert, baseVert + 1, baseVert + 2,
        baseVert, baseVert + 2, baseVert + 3,
      );
    }
  }

  const results: VoxelMeshData[] = [];
  let matIdx = 0;
  for (const [, entry] of materialQuads) {
    if (entry.positions.length === 0) continue;
    results.push({
      materialIndex: matIdx++,
      materialName: entry.name,
      color: entry.color,
      positions: new Float32Array(entry.positions),
      normals: new Float32Array(entry.normals),
      colors: new Float32Array(entry.colors),
      indices: new Uint32Array(entry.indices),
      materialProperties: {
        roughness: entry.roughness,
        metalness: entry.metalness,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
    });
  }
  return results;
}
