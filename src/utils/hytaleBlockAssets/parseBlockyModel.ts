import type { BlockModelBox } from "./types";

interface BlockyNode {
  position?: { x?: number; y?: number; z?: number };
  orientation?: { x?: number; y?: number; z?: number; w?: number };
  shape?: {
    settings?: { size?: { x?: number; y?: number; z?: number } };
    stretch?: { x?: number; y?: number; z?: number };
  };
  children?: BlockyNode[];
}

export interface BlockyModelJson {
  nodes?: BlockyNode[];
}

/** Parse Hytale `.blockymodel` JSON into axis-aligned boxes (world units). */
export function parseBlockyModel(data: BlockyModelJson): BlockModelBox[] | null {
  if (!Array.isArray(data.nodes)) return null;

  const boxes: BlockModelBox[] = [];

  function traverse(node: BlockyNode, px = 0, py = 0, pz = 0): void {
    const x = px + (node.position?.x ?? 0);
    const y = py + (node.position?.y ?? 0);
    const z = pz + (node.position?.z ?? 0);

    const size = node.shape?.settings?.size;
    if (size) {
      const stretch = node.shape?.stretch ?? { x: 1, y: 1, z: 1 };
      const o = node.orientation ?? { x: 0, y: 0, z: 0, w: 1 };
      boxes.push({
        pos: [x / 32, y / 32, z / 32],
        size: [
          Math.abs((size.x ?? 0) * (stretch.x ?? 1)) / 32,
          Math.abs((size.y ?? 0) * (stretch.y ?? 1)) / 32,
          Math.abs((size.z ?? 0) * (stretch.z ?? 1)) / 32,
        ],
        quat: [o.x ?? 0, o.y ?? 0, o.z ?? 0, o.w ?? 1],
      });
    }

    for (const child of node.children ?? []) {
      traverse(child, x, y, z);
    }
  }

  for (const node of data.nodes) {
    traverse(node);
  }

  return boxes.length > 0 ? boxes : null;
}
