import type { Node } from "@xyflow/react";
import { graphToJson } from "@/utils/graphToJson";
import { normalizeExport } from "@/utils/fileTypeDetection";
import type { PreservedNodeEditorMetadata } from "@/utils/nodeEditorMetadata";

export interface ExportPreviewSnapshot {
  internal: Record<string, unknown> | null;
  hytale: Record<string, unknown> | null;
  note: string | null;
}

export function buildExportPreviewSnapshot(input: {
  nodes: Node[];
  edges: import("@xyflow/react").Edge[];
  editingContext: string | null;
  outputNodeId?: string | null;
  originalWrapper: Record<string, unknown> | null;
  rawJsonContent: Record<string, unknown> | null;
  preservedNodeEditorMetadata: PreservedNodeEditorMetadata | null;
}): ExportPreviewSnapshot {
  const { nodes, edges, editingContext, outputNodeId, originalWrapper, rawJsonContent, preservedNodeEditorMetadata } = input;

  if (editingContext === "Weather" || editingContext === "Environment" || editingContext === "RawJson") {
    const doc = rawJsonContent ?? originalWrapper;
    return {
      internal: doc,
      hytale: doc,
      note: "This file is edited as raw JSON — internal and Hytale views are identical.",
    };
  }

  if (editingContext === "Settings" || editingContext === "Instance") {
    return {
      internal: originalWrapper,
      hytale: originalWrapper,
      note: "Settings and instance files are saved without graph-to-Hytale conversion.",
    };
  }

  let graphAsset = graphToJson(nodes, edges);
  if (!graphAsset && outputNodeId) {
    const tagged = nodes.map((n) =>
      n.id === outputNodeId
        ? { ...n, data: { ...(n.data as object), _outputNode: true } }
        : n,
    );
    graphAsset = graphToJson(tagged, edges);
  }
  if (!graphAsset) {
    return {
      internal: originalWrapper,
      hytale: null,
      note: "No graph output — cannot build export preview.",
    };
  }

  if (editingContext === "Biome") {
    return {
      internal: graphAsset as unknown as Record<string, unknown>,
      hytale: normalizeExport(graphAsset, nodes, preservedNodeEditorMetadata) as Record<string, unknown>,
      note: "Biome files: compares the active section graph only (full biome wrapper export uses Save).",
    };
  }

  const hytale = normalizeExport(graphAsset, nodes, preservedNodeEditorMetadata) as Record<string, unknown>;
  return {
    internal: graphAsset as unknown as Record<string, unknown>,
    hytale,
    note: null,
  };
}
