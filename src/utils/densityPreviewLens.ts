import type { Edge, Node } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import { SHAPE_PREVIEW_COMBINER_TYPES } from "@/utils/shapePreview/combinerShapePreview";

const UNARY_LENS_TYPES = new Set(["Pow", "Abs", "Square", "Sqrt", "Inverter", "Negate"]);

const MIX_LENS_TYPES = new Set(["Mix", "Blend"]);

export type DensityPreviewLensInput = {
  nodeId: string;
  /** Short label, e.g. SimplexNoise2D */
  typeName: string;
  index: number;
  handle: string;
};

export type DensityPreviewLens = {
  combinatorId: string;
  combinatorType: string;
  result: { nodeId: string; typeName: string };
  inputs: DensityPreviewLensInput[];
};

function wiredSource(nodeId: string, edges: Edge[], targetHandle: string): string | null {
  return edges.find((e) => e.target === nodeId && e.targetHandle === targetHandle)?.source ?? null;
}

function inputLabel(nodes: Node[], sourceId: string): string {
  const node = nodes.find((n) => n.id === sourceId);
  if (!node) return "Input";
  const data = node.data as Record<string, unknown>;
  const type = getNodeType(node);
  const custom = typeof data.label === "string" ? data.label : null;
  return custom ? `${custom} (${type})` : type;
}

function collectCompoundInputs(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
  arrayBase: string,
): DensityPreviewLensInput[] {
  const inputs: DensityPreviewLensInput[] = [];
  for (let i = 0; i < 8; i++) {
    const handle = `${arrayBase}[${i}]`;
    const sourceId = wiredSource(nodeId, edges, handle);
    if (!sourceId) break;
    inputs.push({
      nodeId: sourceId,
      typeName: inputLabel(nodes, sourceId),
      index: i,
      handle,
    });
  }
  return inputs;
}

export function supportsDensityPreviewLens(nodeType: string): boolean {
  return (
    SHAPE_PREVIEW_COMBINER_TYPES.has(nodeType)
    || UNARY_LENS_TYPES.has(nodeType)
  );
}

export function isUnaryDensityPreviewLens(nodeType: string): boolean {
  return UNARY_LENS_TYPES.has(nodeType);
}

/** Wired density inputs + result for combinator / unary arithmetic nodes. */
export function buildDensityPreviewLens(
  nodeId: string,
  nodes: Node[],
  edges: Edge[],
): DensityPreviewLens | null {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return null;

  const combinatorType = getNodeType(node);
  if (!supportsDensityPreviewLens(combinatorType)) return null;

  const result = { nodeId, typeName: combinatorType };

  if (UNARY_LENS_TYPES.has(combinatorType)) {
    const sourceId = wiredSource(nodeId, edges, "Input");
    const inputs: DensityPreviewLensInput[] = sourceId
      ? [{
          nodeId: sourceId,
          typeName: inputLabel(nodes, sourceId),
          index: 0,
          handle: "Input",
        }]
      : [];
    return { combinatorId: nodeId, combinatorType, result, inputs };
  }

  if (MIX_LENS_TYPES.has(combinatorType)) {
    const inputs: DensityPreviewLensInput[] = [];
    for (const [handle, index] of [["InputA", 0], ["InputB", 1]] as const) {
      const sourceId = wiredSource(nodeId, edges, handle);
      if (sourceId) {
        inputs.push({
          nodeId: sourceId,
          typeName: inputLabel(nodes, sourceId),
          index,
          handle,
        });
      }
    }
    return { combinatorId: nodeId, combinatorType, result, inputs };
  }

  const inputs = collectCompoundInputs(nodeId, nodes, edges, "Inputs");
  return { combinatorId: nodeId, combinatorType, result, inputs };
}

export type DensityPreviewLensSelection = "result" | `input-${number}`;

export function lensSelectionFromPreviewTarget(
  lens: DensityPreviewLens,
  previewTargetId: string | null,
): DensityPreviewLensSelection {
  if (!previewTargetId || previewTargetId === lens.result.nodeId) return "result";
  const idx = lens.inputs.findIndex((i) => i.nodeId === previewTargetId);
  if (idx >= 0) return `input-${lens.inputs[idx].index}`;
  return "result";
}

export function previewNodeIdForLensSelection(
  lens: DensityPreviewLens,
  selection: DensityPreviewLensSelection,
): string {
  if (selection === "result") return lens.result.nodeId;
  const index = Number(selection.replace("input-", ""));
  const input = lens.inputs.find((i) => i.index === index);
  return input?.nodeId ?? lens.result.nodeId;
}
