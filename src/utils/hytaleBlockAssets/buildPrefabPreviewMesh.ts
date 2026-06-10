import { applyBlockRotation } from "./applyBlockRotation";
import { categoryColor, inferCategory } from "./inferCategory";
import type { BlockModelBox, PrefabBlockInstance, PrefabJson, ResolvedBlockModel } from "./types";

export const PREFAB_PREVIEW_BLOCK_CAP = 50_000;
/** Geometry budget for the property-panel preview (keeps R3F responsive). */
export const PREFAB_PREVIEW_RENDER_CAP = 8_000;

export interface PrefabPreviewMeshData {
  positions: Float32Array;
  colors: Float32Array;
  indices: Uint32Array;
  blockCount: number;
  renderedBlocks: number;
  truncated: boolean;
  bounds: { min: [number, number, number]; max: [number, number, number] };
  center: [number, number, number];
  radius: number;
}

function colorToRgb(hex: number): [number, number, number] {
  return [
    ((hex >> 16) & 0xff) / 255,
    ((hex >> 8) & 0xff) / 255,
    (hex & 0xff) / 255,
  ];
}

function pushAxisAlignedBox(
  positions: number[],
  colors: number[],
  indices: number[],
  ox: number,
  oy: number,
  oz: number,
  sx: number,
  sy: number,
  sz: number,
  rgb: [number, number, number],
): void {
  const base = positions.length / 3;
  const verts: [number, number, number][] = [
    [ox, oy, oz],
    [ox + sx, oy, oz],
    [ox + sx, oy + sy, oz],
    [ox, oy + sy, oz],
    [ox, oy, oz + sz],
    [ox + sx, oy, oz + sz],
    [ox + sx, oy + sy, oz + sz],
    [ox, oy + sy, oz + sz],
  ];

  for (const [x, y, z] of verts) {
    positions.push(x, y, z);
    colors.push(rgb[0], rgb[1], rgb[2]);
  }

  const faces = [
    [0, 1, 2, 0, 2, 3],
    [4, 6, 5, 4, 7, 6],
    [0, 4, 5, 0, 5, 1],
    [1, 5, 6, 1, 6, 2],
    [2, 6, 7, 2, 7, 3],
    [3, 7, 4, 3, 4, 0],
  ];
  for (const face of faces) {
    for (const idx of face) {
      indices.push(base + idx);
    }
  }
}

function rotatedSize(
  sx: number,
  sy: number,
  sz: number,
  rotation: number,
): [number, number, number] {
  const rot = applyBlockRotation(rotation);
  if (Math.abs(rot.y) > 0.01) {
    return [sz, sy, sx];
  }
  if (Math.abs(rot.x) > 0.01) {
    return [sx, sz, sy];
  }
  return [sx, sy, sz];
}

function boxesForBlock(
  _block: PrefabBlockInstance,
  model: ResolvedBlockModel | null | undefined,
): BlockModelBox[] {
  if (model?.boxes?.length) {
    return model.boxes;
  }
  return [{
    pos: [0, 0, 0],
    size: [1, 1, 1],
    quat: [0, 0, 0, 1],
  }];
}

export function buildPrefabPreviewMesh(
  prefab: PrefabJson,
  resolvedModels: Record<string, ResolvedBlockModel | null>,
  options?: {
    renderCap?: number;
    /** Per-block RGB sampled from Hytale block textures (0–1). */
    blockColors?: Record<string, [number, number, number]>;
  },
): PrefabPreviewMeshData {
  const renderCap = options?.renderCap ?? PREFAB_PREVIEW_RENDER_CAP;
  const sourceBlocks = prefab.blocks.slice(0, PREFAB_PREVIEW_BLOCK_CAP);
  const truncated = prefab.blocks.length > PREFAB_PREVIEW_BLOCK_CAP;
  const blocks = sourceBlocks.slice(0, renderCap);

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;

  for (const block of blocks) {
    const sampled = options?.blockColors?.[block.name];
    const rgb = sampled ?? colorToRgb(categoryColor(inferCategory(block.name)));
    const model = resolvedModels[block.name];
    const boxes = boxesForBlock(block, model);

    for (const box of boxes) {
      let [sx, sy, sz] = box.size;
      [sx, sy, sz] = rotatedSize(sx, sy, sz, block.rotation ?? 0);
      const ox = block.x + box.pos[0];
      const oy = block.y + box.pos[1];
      const oz = block.z + box.pos[2];
      pushAxisAlignedBox(positions, colors, indices, ox, oy, oz, sx, sy, sz, rgb);

      minX = Math.min(minX, ox, ox + sx);
      minY = Math.min(minY, oy, oy + sy);
      minZ = Math.min(minZ, oz, oz + sz);
      maxX = Math.max(maxX, ox, ox + sx);
      maxY = Math.max(maxY, oy, oy + sy);
      maxZ = Math.max(maxZ, oz, oz + sz);
    }
  }

  if (!Number.isFinite(minX)) {
    minX = minY = minZ = 0;
    maxX = maxY = maxZ = 1;
  }

  const center: [number, number, number] = [
    (minX + maxX) / 2,
    (minY + maxY) / 2,
    (minZ + maxZ) / 2,
  ];
  const radius = Math.max(maxX - minX, maxY - minY, maxZ - minZ, 1) * 0.75;

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    indices: new Uint32Array(indices),
    blockCount: prefab.blocks.length,
    renderedBlocks: blocks.length,
    truncated: truncated || prefab.blocks.length > renderCap,
    bounds: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] },
    center,
    radius,
  };
}
