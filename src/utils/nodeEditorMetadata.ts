import type { Node } from "@xyflow/react";
import { isAnnotationNode } from "@/utils/annotationUtils";

/**
 * Preserve Hytale editor fields TerraNova does not edit on the canvas.
 */

export interface PreservedNodeEditorMetadata {
  $WorkspaceID?: unknown;
  $Links?: unknown;
  $FloatingNodes?: unknown;
}

/** True when the file root carries Hytale editor canvas metadata. */
export function fileHasNodeEditorMetadata(json: Record<string, unknown>): boolean {
  return "$NodeEditorMetadata" in json
    && typeof json.$NodeEditorMetadata === "object"
    && json.$NodeEditorMetadata !== null;
}

/** Extract workspace/link/floating-node state from imported $NodeEditorMetadata. */
export function extractPreservedNodeEditorMetadata(
  raw?: Record<string, unknown> | null,
): PreservedNodeEditorMetadata | null {
  if (!raw || typeof raw !== "object") return null;

  const preserved: PreservedNodeEditorMetadata = {};
  if ("$WorkspaceID" in raw) {
    preserved.$WorkspaceID = raw.$WorkspaceID;
  }
  if ("$Links" in raw) {
    preserved.$Links = raw.$Links;
  }
  if ("$FloatingNodes" in raw) {
    preserved.$FloatingNodes = raw.$FloatingNodes;
  }

  return Object.keys(preserved).length > 0 ? preserved : null;
}

function graphNodeMetadataKey(node: Node): string {
  const data = node.data as { __hytaleNodeId?: string } | undefined;
  return data?.__hytaleNodeId ?? node.id;
}

/** Empty Hytale-native $NodeEditorMetadata shell. */
export function emptyHytaleNodeEditorMetadata(): Record<string, unknown> {
  return {
    $Nodes: {},
    $FloatingNodes: [],
    $Links: {},
    $Groups: [],
    $Comments: [],
    $WorkspaceID: "",
  };
}

/**
 * Build Hytale $NodeEditorMetadata from TerraNova canvas nodes.
 * Canvas comments/frames map to $Comments/$Groups; graph nodes map to $Nodes positions.
 */
export function generateHytaleNodeEditorMetadata(nodes: Node[]): Record<string, unknown> {
  const $Nodes: Record<string, unknown> = {};
  const $Comments: unknown[] = [];
  const $Groups: unknown[] = [];

  for (const node of nodes) {
    if (!node) continue;

    if (node.type === "comment") {
      const d = (node.data ?? {}) as { text?: string; width?: number; height?: number };
      const text = d.text ?? "";
      $Comments.push({
        // Hytale release assets use lowercase keys; keep PascalCase for older TerraNova exports.
        $text: text,
        $Text: text,
        $name: "Comment",
        $Position: { $x: node.position.x, $y: node.position.y },
        $width: d.width ?? 200,
        $height: d.height ?? 80,
        $Width: d.width ?? 200,
        $Height: d.height ?? 80,
      });
    } else if (node.type === "frame") {
      const d = (node.data ?? {}) as { name?: string; width?: number; height?: number };
      $Groups.push({
        $Position: { $x: node.position.x, $y: node.position.y },
        $width: d.width ?? 400,
        $height: d.height ?? 300,
        $name: d.name ?? "",
      });
    } else if (!isAnnotationNode(node)) {
      if (!node.data) continue;
      $Nodes[graphNodeMetadataKey(node)] = {
        $Position: { $x: node.position.x, $y: node.position.y },
      };
    }
  }

  return {
    $Nodes,
    $FloatingNodes: [],
    $Links: {},
    $Groups,
    $Comments,
    $WorkspaceID: "",
  };
}

export function mergePreservedNodeEditorMetadata(
  generated: Record<string, unknown>,
  preserved?: PreservedNodeEditorMetadata | null,
): Record<string, unknown> {
  if (!preserved) return generated;

  if (preserved.$WorkspaceID !== undefined) {
    generated.$WorkspaceID = preserved.$WorkspaceID;
  }
  if (preserved.$Links !== undefined) {
    generated.$Links = preserved.$Links;
  }
  if (preserved.$FloatingNodes !== undefined) {
    generated.$FloatingNodes = preserved.$FloatingNodes;
  }

  return generated;
}

/** Attach generated metadata to a Hytale export root when canvas nodes are available. */
export function attachHytaleNodeEditorMetadata(
  output: Record<string, unknown>,
  nodes: Node[] | undefined,
  preserved?: PreservedNodeEditorMetadata | null,
): void {
  if (nodes === undefined) return;
  output.$NodeEditorMetadata = mergePreservedNodeEditorMetadata(
    generateHytaleNodeEditorMetadata(nodes),
    preserved,
  );
}
