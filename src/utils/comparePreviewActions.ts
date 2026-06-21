import type { Edge, Node } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import { usePreviewStore } from "@/stores/previewStore";
import {
  buildDensityPreviewLens,
  supportsDensityPreviewLens,
} from "@/utils/densityPreviewLens";

export function openCompareForDensityNode(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): { ok: boolean; message?: string } {
  const lens = buildDensityPreviewLens(nodeId, nodes, edges);
  if (!lens || lens.inputs.length === 0) {
    const nodeType = getNodeType(nodes.find((n) => n.id === nodeId) ?? { data: {} } as Node);
    if (!supportsDensityPreviewLens(nodeType)) {
      return { ok: false, message: `Compare is not available for ${nodeType}.` };
    }
    return { ok: false, message: "Wire an input before comparing." };
  }

  const inputA = lens.inputs[0]!.nodeId;

  const store = usePreviewStore.getState();
  store.setViewMode("compare");
  store.setCompareNodeA(inputA);
  store.setCompareNodeB(lens.result.nodeId);
  store.setCompareModeA("2d");
  store.setCompareModeB("2d");

  return { ok: true };
}

/** Side-by-side 2D slices for two wired inputs (e.g. both noises before Max). */
export function openCompareLensInputs(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  _mode: "inputs",
): { ok: boolean; message?: string } {
  const lens = buildDensityPreviewLens(nodeId, nodes, edges);
  if (!lens || lens.inputs.length < 2) {
    return { ok: false, message: "Wire two inputs to compare them side by side." };
  }

  const store = usePreviewStore.getState();
  store.setViewMode("compare");
  store.setCompareNodeA(lens.inputs[0]!.nodeId);
  store.setCompareNodeB(lens.inputs[1]!.nodeId);
  store.setCompareModeA("2d");
  store.setCompareModeB("2d");

  return { ok: true };
}
