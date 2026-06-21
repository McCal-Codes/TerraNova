import type { Node, Edge } from "@xyflow/react";
import type { FlowDirection } from "@/constants";
import { autoLayout, tidyUp } from "@/utils/autoLayout";
import { isAnnotationNode } from "@/utils/annotationUtils";
import type { ImportMetadata } from "@/utils/hytaleToInternal";
import {
  applySectionHytalePositions,
  shouldUseHytaleImportLayout,
  type ImportLayoutMode,
  type LayoutOffset,
} from "@/utils/applyHytaleImportLayout";
import type { MergeImportGraphOptions } from "@/utils/importAnnotations";
import { useSettingsStore } from "@/stores/settingsStore";

export interface ResolveImportLayoutOptions {
  nodePositions?: Record<string, { x: number; y: number }>;
  sectionNodeIds?: Set<string>;
  autoLayoutOnOpen: boolean;
  flowDirection: FlowDirection;
}

export interface ResolveImportLayoutResult {
  nodes: Node[];
  layoutMode: ImportLayoutMode;
  layoutOffset: LayoutOffset;
}

/**
 * Choose dagre auto-layout, Hytale metadata positions, or placeholder tidy-up on import.
 */
export async function resolveImportLayout(
  nodes: Node[],
  edges: Edge[],
  options: ResolveImportLayoutOptions,
): Promise<ResolveImportLayoutResult> {
  const graphNodes = nodes.filter((n) => !isAnnotationNode(n));
  const nodePositions = options.nodePositions ?? {};

  if (
    shouldUseHytaleImportLayout(
      options.autoLayoutOnOpen,
      nodePositions,
      graphNodes,
      options.sectionNodeIds,
    )
  ) {
    const result = applySectionHytalePositions(nodes, nodePositions, options.sectionNodeIds);
    return {
      nodes: result.nodes,
      layoutMode: "hytale",
      layoutOffset: result.offset,
    };
  }

  if (options.autoLayoutOnOpen) {
    const layouted = await autoLayout(graphNodes, edges, options.flowDirection);
    return { nodes: layouted, layoutMode: "autolayout", layoutOffset: { x: 0, y: 0 } };
  }

  const tidied = tidyUp(graphNodes);
  return { nodes: tidied, layoutMode: "placeholder", layoutOffset: { x: 0, y: 0 } };
}

/** Build layout options from persisted settings and optional import metadata. */
export function buildImportLayoutOptions(
  metadata: ImportMetadata | null | undefined,
  sectionNodeIds?: Set<string>,
): MergeImportGraphOptions {
  const { autoLayoutOnOpen, flowDirection } = useSettingsStore.getState();
  return {
    nodePositions: metadata?.nodePositions,
    sectionNodeIds,
    autoLayoutOnOpen,
    flowDirection,
  };
}
