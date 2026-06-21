import type { Edge, Node } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import { usePreviewStore } from "@/stores/previewStore";

const VOXEL_NOISE_TYPES = new Set([
  "SimplexNoise3D",
  "CellNoise3D",
  "FractalNoise3D",
  "SimplexRidgeNoise3D",
]);

const CARVE_MASK_TYPES = new Set(["Inverter", "Negate", "SmoothClamp"]);

function buildUpstreamIndex(edges: Edge[]): Map<string, string[]> {
  const upstream = new Map<string, string[]>();
  for (const edge of edges) {
    if (!upstream.has(edge.target)) upstream.set(edge.target, []);
    upstream.get(edge.target)!.push(edge.source);
  }
  return upstream;
}

function visitUpstreamTypes(
  startId: string,
  types: Map<string, string>,
  upstream: Map<string, string[]>,
  match: Set<string>,
): boolean {
  const seen = new Set<string>();
  const stack = [startId];
  while (stack.length > 0) {
    const id = stack.pop()!;
    if (seen.has(id)) continue;
    seen.add(id);
    const t = types.get(id);
    if (t && match.has(t)) return true;
    for (const src of upstream.get(id) ?? []) stack.push(src);
  }
  return false;
}

export function previewTargetNeedsVoxel(
  nodes: Node[],
  edges: Edge[],
  previewRootId: string | null,
): { needsVoxel: boolean; reason: string | null } {
  if (!previewRootId) {
    return { needsVoxel: false, reason: null };
  }

  const types = new Map(nodes.map((n) => [n.id, getNodeType(n)]));
  const upstream = buildUpstreamIndex(edges);

  if (visitUpstreamTypes(previewRootId, types, upstream, VOXEL_NOISE_TYPES)) {
    return {
      needsVoxel: true,
      reason: "Preview includes 3D noise — Voxel shows variation through Y.",
    };
  }

  if (
    visitUpstreamTypes(previewRootId, types, upstream, CARVE_MASK_TYPES) &&
    visitUpstreamTypes(previewRootId, types, upstream, VOXEL_NOISE_TYPES)
  ) {
    return {
      needsVoxel: true,
      reason: "Carve mask with 3D noise — use Voxel + Cutaway for voids.",
    };
  }

  return { needsVoxel: false, reason: null };
}

/** Force or suggest voxel mode (snippet insert uses force). */
export function applyAutoVoxelPreviewIfNeeded(options: {
  reason: string;
  force?: boolean;
}): boolean {
  const store = usePreviewStore.getState();
  if (store._userManualPreviewMode && !options.force) return false;
  if (store.mode === "voxel") return false;

  store.setMode("voxel", { automated: true });
  if (options.force) {
    store._setUserManualPreviewMode(false);
  }
  return true;
}
