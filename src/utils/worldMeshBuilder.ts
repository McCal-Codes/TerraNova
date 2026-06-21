import type { ChunkDataResponse } from "./ipc";
import type { VoxelMeshData } from "./voxelMeshBuilder";
import { resolveBlockColor, type BlockRenderInfo } from "./blockColorMap";
import { HASH_PRIME_A, HASH_PRIME_B, HASH_PRIME_C, HASH_PRIME_D } from "@/constants";

/**
 * Converts server chunk data into VoxelMeshData[] for VoxelPreview3D.
 *
 * Each chunk is meshed independently. Blocks are positioned in world-space
 * relative to the center chunk, then scaled to fit the Three.js scene box.
 */

/* ── Face definitions ────────────────────────────────────────────── */

type FaceDef = {
  dir: [number, number, number];
  vertices: [number, number, number][];
};

const FACES: FaceDef[] = [
  { dir: [0, 1, 0], vertices: [[0, 1, 0], [0, 1, 1], [1, 1, 1], [1, 1, 0]] },   // +Y
  { dir: [0, -1, 0], vertices: [[0, 0, 1], [0, 0, 0], [1, 0, 0], [1, 0, 1]] },   // -Y
  { dir: [1, 0, 0], vertices: [[1, 0, 0], [1, 1, 0], [1, 1, 1], [1, 0, 1]] },    // +X
  { dir: [-1, 0, 0], vertices: [[0, 0, 1], [0, 1, 1], [0, 1, 0], [0, 0, 0]] },   // -X
  { dir: [0, 0, 1], vertices: [[1, 0, 1], [1, 1, 1], [0, 1, 1], [0, 0, 1]] },    // +Z
  { dir: [0, 0, -1], vertices: [[0, 0, 0], [0, 1, 0], [1, 1, 0], [1, 0, 0]] },   // -Z
];

const FACE_BRIGHTNESS = [1.0, 0.6, 0.80, 0.72, 0.85, 0.68];

/* ── Color helpers ───────────────────────────────────────────────── */

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

/* ── Main builder ────────────────────────────────────────────────── */

export interface WorldMeshResult {
  meshes: VoxelMeshData[];
  /** Transform params for converting world Y → scene Y */
  sceneYMin: number;
  sceneScale: number;
  /** Scene-space footprint size (X and Z) of the loaded terrain */
  terrainSize: number;
  /** World-space midpoints used when meshing (for player marker overlay). */
  worldMidX: number;
  worldMidZ: number;
}

export interface BuildWorldMeshesOptions {
  /** RGB sampled from synced Hytale block textures, keyed by block type name. */
  blockColors?: Record<string, [number, number, number]>;
  /** When true, mesh the full chunk Y span instead of a surface column only. */
  meshFullColumns?: boolean;
  /** Convert sampled RGB to display hex (defaults to sRGB hex). */
  rgbToHex?: (rgb: [number, number, number]) => string;
}

export function buildWorldMeshes(
  chunks: ChunkDataResponse[],
  palette: Record<string, string>,
  centerX: number,
  centerZ: number,
  surfaceDepth = 32,
  options?: BuildWorldMeshesOptions,
): WorldMeshResult {
  if (chunks.length === 0) {
    return { meshes: [], sceneYMin: 0, sceneScale: 1, terrainSize: 0, worldMidX: 0, worldMidZ: 0 };
  }

  const toHex = options?.rgbToHex ?? ((rgb: [number, number, number]) => {
    const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
    const r = clamp(rgb[0]).toString(16).padStart(2, "0");
    const g = clamp(rgb[1]).toString(16).padStart(2, "0");
    const b = clamp(rgb[2]).toString(16).padStart(2, "0");
    return `#${r}${g}${b}`;
  });

  // Build block ID → render info lookup from palette
  const blockInfoCache = new Map<number, BlockRenderInfo>();
  const blockNameById = new Map<number, string>();
  for (const [idStr, name] of Object.entries(palette)) {
    const id = parseInt(idStr, 10);
    if (!isNaN(id) && id !== 0) {
      blockNameById.set(id, name);
      const sampled = options?.blockColors?.[name];
      const base = resolveBlockColor(name);
      blockInfoCache.set(id, sampled
        ? { ...base, color: toHex(sampled), name }
        : { ...base, name });
    }
  }

  // Determine scene scale: fit the entire region into ~50 unit box
  const sizeX = 32; // Hytale chunk is 32x32
  const sizeZ = 32;

  // Collect all chunk ranges to compute total extent
  let minCX = Infinity, maxCX = -Infinity, minCZ = Infinity, maxCZ = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  for (const c of chunks) {
    minCX = Math.min(minCX, c.chunkX);
    maxCX = Math.max(maxCX, c.chunkX);
    minCZ = Math.min(minCZ, c.chunkZ);
    maxCZ = Math.max(maxCZ, c.chunkZ);
    yMin = Math.min(yMin, c.yMin);
    yMax = Math.max(yMax, c.yMax);
  }

  // Compute world-space midpoint for centering terrain in the scene
  const worldMidX = ((minCX + maxCX + 1) / 2 - centerX) * sizeX;
  const worldMidZ = ((minCZ + maxCZ + 1) / 2 - centerZ) * sizeZ;

  const meshFullColumns = options?.meshFullColumns ?? false;
  const clampedDepth = Math.min(surfaceDepth, 128);

  const totalBlocksX = (maxCX - minCX + 1) * sizeX;
  const totalBlocksZ = (maxCZ - minCZ + 1) * sizeZ;
  const totalBlocksY = yMax - yMin;
  const maxExtent = Math.max(totalBlocksX, totalBlocksZ, totalBlocksY);
  const sceneSize = 50;
  const scale = sceneSize / maxExtent;

  const rgbCache = new Map<string, [number, number, number]>();

  // Build a lookup from numeric key → chunk for cross-chunk face culling.
  // Numeric key avoids string allocation in the hot path (millions of face-neighbor checks).
  // Safe for chunk coords in ±32767 (Hytale worlds never approach this limit).
  const chunkMap = new Map<number, ChunkDataResponse>();
  const chunkKey = (cx: number, cz: number) => (cx + 32768) * 65536 + (cz + 32768);
  for (const chunk of chunks) {
    chunkMap.set(chunkKey(chunk.chunkX, chunk.chunkZ), chunk);
  }

  // Cross-chunk block lookup by absolute Hytale world coordinates.
  // Returns block id (>0 solid, 0 air) or -1 (Y out of range / unloaded chunk → emit face).
  function getBlockAbsolute(absX: number, y: number, absZ: number): number {
    const cx = Math.floor(absX / sizeX);
    const cz = Math.floor(absZ / sizeZ);
    const c = chunkMap.get(chunkKey(cx, cz));
    if (!c) return -1; // unloaded neighbor — show world-edge face
    if (y < c.yMin || y >= c.yMax) return -1;
    const lx = absX - cx * sizeX;
    const lz = absZ - cz * sizeZ;
    const yr = c.yMax - c.yMin;
    const idx = (lz * sizeX + lx) * yr + (y - c.yMin);
    return c.blocks[idx] ?? 0;
  }

  // Collect quads per material color
  const materialQuads = new Map<string, {
    info: BlockRenderInfo;
    positions: number[];
    normals: number[];
    colors: number[];
    indices: number[];
  }>();

  for (const chunk of chunks) {
    const heightmap = chunk.heightmap;

    // World-space offset for this chunk (relative to center)
    const worldOffsetX = (chunk.chunkX - centerX) * sizeX;
    const worldOffsetZ = (chunk.chunkZ - centerZ) * sizeZ;

    // Absolute chunk origin in Hytale world coordinates
    const originX = chunk.chunkX * sizeX;
    const originZ = chunk.chunkZ * sizeZ;

    for (let lz = 0; lz < sizeZ; lz++) {
      for (let lx = 0; lx < sizeX; lx++) {
        const surfaceY = heightmap[lz * sizeX + lx] || 0;
        const colYMax = meshFullColumns
          ? chunk.yMax
          : Math.min(chunk.yMax, surfaceY + 4);
        const colYMin = meshFullColumns
          ? chunk.yMin
          : Math.max(chunk.yMin, surfaceY - clampedDepth);
        if (colYMin >= colYMax) continue;

        // Absolute Hytale X/Z for this column (used for cross-chunk neighbor checks)
        const absX = originX + lx;
        const absZ = originZ + lz;

        for (let y = colYMin; y < colYMax; y++) {
          const blockId = getBlockAbsolute(absX, y, absZ);
          if (blockId <= 0) continue; // air or invalid

          const info = blockInfoCache.get(blockId);
          if (!info) continue;

          // Scene-space position (relative to center, scaled)
          const wx = worldOffsetX + lx;
          const wy = y - yMin;
          const wz = worldOffsetZ + lz;

          // Check each face for exposure using cross-chunk neighbor lookup
          for (let fi = 0; fi < 6; fi++) {
            const face = FACES[fi];

            // Cross-chunk neighbor check: solid neighbors in adjacent chunks are now culled
            const neighborId = getBlockAbsolute(
              absX + face.dir[0],
              y + face.dir[1],
              absZ + face.dir[2],
            );
            if (neighborId > 0) continue; // neighbor is solid, face hidden

            const key = info.name ?? blockNameById.get(blockId) ?? info.color;
            let entry = materialQuads.get(key);
            if (!entry) {
              entry = { info, positions: [], normals: [], colors: [], indices: [] };
              materialQuads.set(key, entry);
            }

            const baseVert = entry.positions.length / 3;
            let baseRGB = rgbCache.get(info.color);
            if (!baseRGB) {
              baseRGB = hexToRGB(info.color);
              rgbCache.set(info.color, baseRGB);
            }
            const faceBrightness = FACE_BRIGHTNESS[fi];
            const jitter = blockJitter(wx, wy, wz);

            for (let vi = 0; vi < 4; vi++) {
              const vert = face.vertices[vi];
              entry.positions.push(
                (wx + vert[0] - worldMidX) * scale,
                (wy + vert[1]) * scale - sceneSize / 2,
                (wz + vert[2] - worldMidZ) * scale,
              );
              entry.normals.push(face.dir[0], face.dir[1], face.dir[2]);

              const brightness = faceBrightness * (1 + jitter);
              entry.colors.push(
                Math.min(1, Math.max(0, baseRGB[0] * brightness)),
                Math.min(1, Math.max(0, baseRGB[1] * brightness)),
                Math.min(1, Math.max(0, baseRGB[2] * brightness)),
              );
            }

            // Two triangles
            entry.indices.push(
              baseVert, baseVert + 1, baseVert + 2,
              baseVert, baseVert + 2, baseVert + 3,
            );
          }
        }
      }
    }
  }

  // Convert to VoxelMeshData[]
  const results: VoxelMeshData[] = [];
  let matIdx = 0;

  for (const [, entry] of materialQuads) {
    if (entry.positions.length === 0) continue;

    results.push({
      materialIndex: matIdx++,
      materialName: entry.info.name ?? "",
      color: entry.info.color,
      positions: new Float32Array(entry.positions),
      normals: new Float32Array(entry.normals),
      colors: new Float32Array(entry.colors),
      indices: new Uint32Array(entry.indices),
      materialProperties: {
        roughness: entry.info.roughness,
        metalness: entry.info.metalness,
        emissive: "#000000",
        emissiveIntensity: 0,
      },
    });
  }

  const terrainSize = Math.max(totalBlocksX, totalBlocksZ) * scale;
  return {
    meshes: results,
    sceneYMin: yMin,
    sceneScale: scale,
    terrainSize,
    worldMidX,
    worldMidZ,
  };
}

const SCENE_BOX = 50;

/** Map Hytale block coords into the same space as `buildWorldMeshes` output. */
export function blockToScenePosition(
  blockX: number,
  blockY: number,
  blockZ: number,
  centerChunkX: number,
  centerChunkZ: number,
  layout: Pick<WorldMeshResult, "sceneYMin" | "sceneScale" | "worldMidX" | "worldMidZ">,
): [number, number, number] {
  const wx = blockX - centerChunkX * 32;
  const wz = blockZ - centerChunkZ * 32;
  const wy = blockY - layout.sceneYMin;
  return [
    (wx - layout.worldMidX) * layout.sceneScale,
    wy * layout.sceneScale - SCENE_BOX / 2,
    (wz - layout.worldMidZ) * layout.sceneScale,
  ];
}
