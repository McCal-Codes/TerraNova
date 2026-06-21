import type { Edge, Node } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";

export type TestFeaturesPatchCategory = "pcn" | "noise" | "sdf";

export interface TestFeaturesPatchDef {
  /** 1-based patch index (matches Hytale Max Inputs[] order). */
  index: number;
  x: number;
  z: number;
  label: string;
  category: TestFeaturesPatchCategory;
}

/** Shipped Test_Features gallery — 56 Max inputs (release Assets.zip). */
export const TEST_FEATURES_PATCHES: readonly TestFeaturesPatchDef[] = [
  { index: 1, x: 450, z: 1500, label: "PCN CellValue — TriangularGrid2d", category: "pcn" },
  { index: 2, x: 450, z: 1350, label: "PCN Density (SimplexNoise2D) — TriangularGrid2d", category: "pcn" },
  { index: 3, x: 450, z: 900, label: "PCN Distance2 — TriangularGrid2d", category: "pcn" },
  { index: 4, x: 450, z: 1050, label: "PCN Distance — TriangularGrid2d", category: "pcn" },
  { index: 5, x: 450, z: 1200, label: "PCN Curve — TriangularGrid2d", category: "pcn" },
  { index: 6, x: 450, z: 750, label: "PCN Distance2Add — TriangularGrid2d", category: "pcn" },
  { index: 7, x: 450, z: 600, label: "PCN Distance2Sub — TriangularGrid2d", category: "pcn" },
  { index: 8, x: 450, z: 450, label: "PCN Distance2Mul — TriangularGrid2d", category: "pcn" },
  { index: 9, x: 450, z: 300, label: "PCN Distance2Div — TriangularGrid2d", category: "pcn" },
  { index: 10, x: 300, z: 1500, label: "PCN CellValue — SquareGrid3d", category: "pcn" },
  { index: 11, x: 300, z: 900, label: "PCN Distance2 — SquareGrid3d", category: "pcn" },
  { index: 12, x: 300, z: 750, label: "PCN Distance2Add — SquareGrid3d", category: "pcn" },
  { index: 13, x: 300, z: 1200, label: "PCN Curve — SquareGrid3d", category: "pcn" },
  { index: 14, x: 300, z: 1350, label: "PCN Density (SimplexNoise3D) — SquareGrid3d", category: "pcn" },
  { index: 15, x: 300, z: 1050, label: "PCN Distance — SquareGrid3d", category: "pcn" },
  { index: 16, x: 300, z: 600, label: "PCN Distance2Sub — SquareGrid3d", category: "pcn" },
  { index: 17, x: 300, z: 450, label: "PCN Distance2Mul — SquareGrid3d", category: "pcn" },
  { index: 18, x: 300, z: 0, label: "SimplexNoise3D field", category: "noise" },
  { index: 19, x: 300, z: 150, label: "CellNoise3D + PCN", category: "noise" },
  { index: 20, x: 300, z: 300, label: "PCN Distance2Div — SquareGrid3d", category: "pcn" },
  { index: 21, x: 300, z: -300, label: "SDF Cube (Rotator)", category: "sdf" },
  { index: 22, x: 300, z: -450, label: "SDF Cuboid (Rotator)", category: "sdf" },
  { index: 23, x: 300, z: -750, label: "SDF Ellipsoid (Rotator)", category: "sdf" },
  { index: 24, x: 300, z: -900, label: "SDF Cylinder (Rotator)", category: "sdf" },
  { index: 25, x: 150, z: 1500, label: "PCN CellValue — SquareGrid2d", category: "pcn" },
  { index: 26, x: 150, z: 1350, label: "PCN Density (SimplexNoise2D) — SquareGrid2d", category: "pcn" },
  { index: 27, x: 150, z: 1200, label: "PCN Curve — SquareGrid2d", category: "pcn" },
  { index: 28, x: 150, z: 1050, label: "PCN Distance — SquareGrid2d", category: "pcn" },
  { index: 29, x: 150, z: 600, label: "PCN Distance2Sub — SquareGrid2d", category: "pcn" },
  { index: 30, x: 150, z: 900, label: "PCN Distance2 — SquareGrid2d", category: "pcn" },
  { index: 31, x: 150, z: 450, label: "PCN Distance2Mul — SquareGrid2d", category: "pcn" },
  { index: 32, x: 150, z: 150, label: "CellNoise2D + PCN", category: "noise" },
  { index: 33, x: 150, z: 750, label: "PCN Distance2Add — SquareGrid2d", category: "pcn" },
  { index: 34, x: 150, z: 300, label: "PCN Distance2Div — SquareGrid2d", category: "pcn" },
  { index: 35, x: 150, z: 0, label: "SimplexNoise2D + BaseHeight", category: "noise" },
  { index: 36, x: 150, z: -900, label: "SDF Cylinder (Scale)", category: "sdf" },
  { index: 37, x: 150, z: -750, label: "SDF Ellipsoid (Scale)", category: "sdf" },
  { index: 38, x: 150, z: -600, label: "Distance field (Scale)", category: "sdf" },
  { index: 39, x: 150, z: -450, label: "SDF Cuboid (Scale)", category: "sdf" },
  { index: 40, x: 150, z: -300, label: "SDF Cube (Scale)", category: "sdf" },
  { index: 41, x: 0, z: 0, label: "SimplexNoise2D + PCN", category: "noise" },
  { index: 42, x: 0, z: 150, label: "CellNoise2D + PCN", category: "noise" },
  { index: 43, x: 0, z: 600, label: "PCN Distance2Sub — SquareGrid2d", category: "pcn" },
  { index: 44, x: 0, z: 450, label: "PCN Distance2Mul — SquareGrid2d", category: "pcn" },
  { index: 45, x: 0, z: 1200, label: "PCN Curve — SquareGrid2d", category: "pcn" },
  { index: 46, x: 0, z: 1050, label: "PCN Distance — SquareGrid2d", category: "pcn" },
  { index: 47, x: 0, z: 300, label: "PCN Distance2Div — SquareGrid2d", category: "pcn" },
  { index: 48, x: 0, z: -900, label: "SDF Cylinder", category: "sdf" },
  { index: 49, x: 0, z: 900, label: "PCN Distance2 — SquareGrid2d", category: "pcn" },
  { index: 50, x: 0, z: 750, label: "PCN Distance2Add — SquareGrid2d", category: "pcn" },
  { index: 51, x: 0, z: 1350, label: "PCN Density (SimplexNoise2D) — SquareGrid2d", category: "pcn" },
  { index: 52, x: 0, z: 1500, label: "PCN CellValue — SquareGrid2d", category: "pcn" },
  { index: 53, x: 0, z: -750, label: "SDF Ellipsoid", category: "sdf" },
  { index: 54, x: 0, z: -600, label: "Distance field", category: "sdf" },
  { index: 55, x: 0, z: -450, label: "SDF Cuboid", category: "sdf" },
  { index: 56, x: 0, z: -300, label: "SDF Cube", category: "sdf" },
] as const;

export const TEST_FEATURES_CONTENT_FIELDS = {
  Base: 100,
  Water: 100,
  Bedrock: 0,
} as const;

export const TEST_FEATURES_Y_LEVEL = 100;

export interface ResolvedTestFeaturesPatch extends TestFeaturesPatchDef {
  nodeId: string;
}

export function parseTestFeaturesPatchIndex(search: string): number | null {
  const raw = new URLSearchParams(search).get("patch");
  if (!raw) return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1 || n > TEST_FEATURES_PATCHES.length) return null;
  return n;
}

export function testFeaturesPreviewOrigin(
  patchIndex: number | null,
  viewAll: boolean,
): { previewOriginX: number; previewOriginZ: number } {
  if (viewAll || patchIndex == null) {
    return { previewOriginX: 225, previewOriginZ: 300 };
  }
  const patch = TEST_FEATURES_PATCHES[patchIndex - 1];
  return { previewOriginX: patch?.x ?? 0, previewOriginZ: patch?.z ?? 0 };
}

export function findMaxTerrainNode(nodes: Node[]): Node | null {
  return nodes.find((n) => getNodeType(n) === "Max") ?? null;
}

/** Max combiner input sources sorted by Inputs[i] handle order. */
export function listMaxInputSourceIds(maxNodeId: string, edges: Edge[]): string[] {
  return edges
    .filter((e) => e.target === maxNodeId && /^Inputs\[\d+\]$/.test(e.targetHandle ?? ""))
    .sort((a, b) => {
      const ai = Number.parseInt(/\[(\d+)\]/.exec(a.targetHandle!)![1], 10);
      const bi = Number.parseInt(/\[(\d+)\]/.exec(b.targetHandle!)![1], 10);
      return ai - bi;
    })
    .map((e) => e.source);
}

export function resolveTestFeaturesPatches(
  nodes: Node[],
  edges: Edge[],
): ResolvedTestFeaturesPatch[] {
  const maxNode = findMaxTerrainNode(nodes);
  if (!maxNode) return [];

  const sourceIds = listMaxInputSourceIds(maxNode.id, edges);
  const count = Math.min(sourceIds.length, TEST_FEATURES_PATCHES.length);
  const out: ResolvedTestFeaturesPatch[] = [];

  for (let i = 0; i < count; i++) {
    const def = TEST_FEATURES_PATCHES[i]!;
    const nodeId = sourceIds[i];
    if (!nodeId) continue;
    out.push({ ...def, nodeId });
  }

  return out;
}

export function getTestFeaturesPatchPreset(category: TestFeaturesPatchCategory): "pcn" | "sdf" {
  return category === "sdf" ? "sdf" : "pcn";
}
