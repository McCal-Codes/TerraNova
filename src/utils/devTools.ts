import type { Edge, Node } from "@xyflow/react";
import { internalToHytale } from "@/utils/internalToHytale";
import { isTauriRuntime } from "@/utils/platform";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";

export function filterExportableNodeFields(
  fields: Record<string, unknown>,
): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).filter(
      ([key]) => !key.startsWith("$") && !key.startsWith("__") && key !== "_comment",
    ),
  );
}

export function buildNodeInternalRecord(node: Node): Record<string, unknown> {
  const data = node.data as Record<string, unknown>;
  const fields = (data.fields as Record<string, unknown> | undefined) ?? {};
  return {
    id: node.id,
    type: node.type ?? data.type,
    dataType: data.type,
    position: node.position,
    label: data.label,
    fields: filterExportableNodeFields(fields),
    outputNode: data._outputNode === true,
  };
}

export function buildNodeHytaleRecord(node: Node): Record<string, unknown> | null {
  const data = node.data as Record<string, unknown>;
  const typeName = typeof data.type === "string" ? data.type : null;
  if (!typeName) return null;
  const fields = (data.fields as Record<string, unknown> | undefined) ?? {};
  const asset = { Type: typeName, ...filterExportableNodeFields(fields) };
  return internalToHytale(asset as { Type: string; [key: string]: unknown }, [node]);
}

export function collectConnectedNodeIds(
  rootId: string,
  edges: Edge[],
  direction: "upstream" | "downstream" | "both",
): Set<string> {
  const ids = new Set<string>([rootId]);
  const queue = [rootId];
  while (queue.length > 0) {
    const current = queue.shift()!;
    for (const edge of edges) {
      if (direction !== "upstream" && edge.source === current && !ids.has(edge.target)) {
        ids.add(edge.target);
        queue.push(edge.target);
      }
      if (direction !== "downstream" && edge.target === current && !ids.has(edge.source)) {
        ids.add(edge.source);
        queue.push(edge.source);
      }
    }
  }
  return ids;
}

export function buildSubgraphClipboard(
  rootId: string,
  nodes: Node[],
  edges: Edge[],
  direction: "upstream" | "downstream" | "both",
): { version: "1"; nodes: Node[]; edges: Edge[] } {
  const ids = collectConnectedNodeIds(rootId, edges, direction);
  const subNodes = nodes.filter((n) => ids.has(n.id));
  const subEdges = edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  return {
    version: "1",
    nodes: structuredClone(subNodes),
    edges: structuredClone(subEdges),
  };
}

export interface DevSessionSnapshot {
  capturedAt: string;
  runtime: "tauri" | "browser";
  projectPath: string | null;
  currentFile: string | null;
  isDirty: boolean;
  graph: {
    nodeCount: number;
    edgeCount: number;
    selectedNodeId: string | null;
    selectedCount: number;
  };
  validation: {
    total: number;
    errors: number;
    warnings: number;
    info: number;
  };
  preview: {
    mode: string;
    viewMode: string;
    isLoading: boolean;
    previewError: string | null;
    selectedPreviewNodeId: string | null;
  };
  bridge: {
    connected: boolean;
    host: string;
    port: number;
  };
}

export function buildDevSessionSnapshot(input: {
  projectPath: string | null;
  currentFile: string | null;
  isDirty: boolean;
  nodes: Node[];
  edges: Edge[];
  selectedNodeId: string | null;
  diagnostics: GraphDiagnostic[];
  preview: DevSessionSnapshot["preview"];
  bridge: DevSessionSnapshot["bridge"];
}): DevSessionSnapshot {
  const selectedCount = input.nodes.reduce((n, node) => n + (node.selected ? 1 : 0), 0);
  return {
    capturedAt: new Date().toISOString(),
    runtime: isTauriRuntime() ? "tauri" : "browser",
    projectPath: input.projectPath,
    currentFile: input.currentFile,
    isDirty: input.isDirty,
    graph: {
      nodeCount: input.nodes.length,
      edgeCount: input.edges.length,
      selectedNodeId: input.selectedNodeId,
      selectedCount,
    },
    validation: {
      total: input.diagnostics.length,
      errors: input.diagnostics.filter((d) => d.severity === "error").length,
      warnings: input.diagnostics.filter((d) => d.severity === "warning").length,
      info: input.diagnostics.filter((d) => d.severity === "info").length,
    },
    preview: input.preview,
    bridge: input.bridge,
  };
}

export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
