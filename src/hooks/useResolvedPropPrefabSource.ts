import { useEffect, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { useProjectStore } from "@/stores/projectStore";
import {
  resolveEffectivePrefabPreviewSource,
  resolvePropPrefabPreviewSource,
  type PropPrefabPreviewSource,
} from "@/utils/propEditingContext";
import { resolveAssignmentPrefabPath } from "@/utils/hytaleBlockAssets/resolveAssignmentPrefabPath";

function resolveImportedAssignmentName(nodes: Node[], selectedNodeId: string | null): string | null {
  const tryNode = (node: Node): string | null => {
    const isImported =
      node.type === "Prop:Imported"
      || (node.data as { type?: string } | undefined)?.type === "Imported";
    if (!isImported) return null;
    const name = (node.data as { fields?: Record<string, unknown> })?.fields?.Name;
    return typeof name === "string" && name.trim() ? name.trim() : null;
  };

  if (selectedNodeId) {
    const selected = nodes.find((n) => n.id === selectedNodeId);
    const name = selected ? tryNode(selected) : null;
    if (name) return name;
  }

  for (const node of nodes) {
    const name = tryNode(node);
    if (name) return name;
  }
  return null;
}

/**
 * Resolve prefab preview source from graph Path fields, manual browse, or imported assignment defs.
 */
export function useResolvedPropPrefabSource(
  nodes: Node[],
  selectedNodeId: string | null,
  manualPath: string | null,
): PropPrefabPreviewSource | null {
  const projectPath = useProjectStore((s) => s.projectPath);
  const graphSource = useMemo(
    () => resolvePropPrefabPreviewSource(nodes, selectedNodeId),
    [nodes, selectedNodeId],
  );
  const directSource = useMemo(
    () => resolveEffectivePrefabPreviewSource(graphSource, manualPath),
    [graphSource, manualPath],
  );

  const importedName = useMemo(
    () => (directSource ? null : resolveImportedAssignmentName(nodes, selectedNodeId)),
    [directSource, nodes, selectedNodeId],
  );

  const [importedSource, setImportedSource] = useState<PropPrefabPreviewSource | null>(null);

  useEffect(() => {
    if (directSource || !importedName) {
      setImportedSource(null);
      return;
    }

    let cancelled = false;
    void resolveAssignmentPrefabPath(importedName, projectPath).then((path) => {
      if (cancelled || !path) {
        if (!cancelled) setImportedSource(null);
        return;
      }
      setImportedSource({
        nodeId: "",
        path,
        fields: { Path: path },
      });
    });

    return () => {
      cancelled = true;
    };
  }, [directSource, importedName, projectPath]);

  return directSource ?? importedSource;
}
