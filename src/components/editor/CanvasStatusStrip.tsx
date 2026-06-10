import { memo, useMemo } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { useLanguage } from "@/languages/useLanguage";
import { HudPill } from "@/components/ui/editorChrome";
import { getGraphOutputStatus } from "@/utils/graphOutputStatus";
import type { BaseNodeData } from "@/nodes/shared/BaseNode";

const ROOT_HIDDEN_CONTEXTS = new Set(["NoiseRange", "Settings", "RawJson"]);

function getNodeTypeLabel(data: unknown): string {
  const typed = data as Partial<BaseNodeData> | undefined;
  return typeof typed?.type === "string" && typed.type.length > 0 ? typed.type : "Node";
}

function getCustomLabel(data: unknown): string | null {
  const record = data as Record<string, unknown> | undefined;
  return typeof record?.label === "string" && record.label.trim().length > 0
    ? record.label
    : null;
}

export const CanvasStatusStrip = memo(function CanvasStatusStrip() {
  const nodes = useEditorStore((s) => s.nodes);
  const edges = useEditorStore((s) => s.edges);
  const outputNodeId = useEditorStore((s) => s.outputNodeId);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const editingContext = useEditorStore((s) => s.editingContext);
  const { getTypeDisplayName } = useLanguage();

  const selectedNodes = useMemo(
    () => {
      const selected = nodes.filter((node) => node.selected);
      if (selected.length > 0 || !selectedNodeId) return selected;
      const fallback = nodes.find((node) => node.id === selectedNodeId);
      return fallback ? [fallback] : [];
    },
    [nodes, selectedNodeId],
  );

  const selectionLabel = useMemo(() => {
    if (selectedNodes.length === 0) return "No selection";
    if (selectedNodes.length > 1) return `${selectedNodes.length} selected`;

    const node = selectedNodes[0];
    const customLabel = getCustomLabel(node.data);
    const typeLabel = getNodeTypeLabel(node.data);
    const displayName = getTypeDisplayName(typeLabel);
    return customLabel ? `${customLabel} (${displayName})` : displayName;
  }, [selectedNodes, getTypeDisplayName]);

  const activeBiomeSection = useEditorStore((s) => s.activeBiomeSection);

  const outputStatus = useMemo(() => {
    if (editingContext && ROOT_HIDDEN_CONTEXTS.has(editingContext)) return null;
    if (editingContext === "Biome" && activeBiomeSection && activeBiomeSection !== "Terrain") {
      return null;
    }
    return getGraphOutputStatus(nodes, edges, outputNodeId, getTypeDisplayName);
  }, [activeBiomeSection, editingContext, edges, nodes, outputNodeId, getTypeDisplayName]);

  return (
    <div className="pointer-events-none absolute left-3 top-3 z-20 max-w-[min(420px,calc(100%-24px))]">
      <HudPill className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {editingContext && (
          <span className="font-medium text-tn-text">{editingContext}</span>
        )}
        <span className="truncate text-tn-text max-w-[220px]">{selectionLabel}</span>
        {outputStatus && (
          <span className={outputStatus.warning ? "text-amber-400/90" : "text-tn-text-muted"}>
            {outputStatus.label}
          </span>
        )}
      </HudPill>
    </div>
  );
});
