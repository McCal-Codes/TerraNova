import { useEffect, useCallback } from "react";
import { useReactFlow } from "@xyflow/react";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { BridgeDialog } from "@/components/dialogs/BridgeDialog";
import { useToastStore } from "@/stores/toastStore";
import { saveRef } from "@/utils/saveRef";

export function Toolbar() {
  const { saveFile } = useTauriIO();
  const reactFlow = useReactFlow();

  // Register saveRef so App.tsx can call saveFile from outside ReactFlowProvider
  useEffect(() => {
    saveRef.current = saveFile;
    return () => {
      saveRef.current = null;
    };
  }, [saveFile]);

  // Get selected count for enable/disable logic
  const selectedCount = useEditorStore(
    useCallback(
      (s: { nodes: { selected?: boolean }[] }) =>
        s.nodes.reduce((count, n) => count + (n.selected ? 1 : 0), 0),
      [],
    ),
  );

  async function handleAutoLayout() {
    const { nodes, edges, setNodes, commitState } = useEditorStore.getState();
    if (nodes.length === 0) return;
    try {
      const { autoLayout } = await import("@/utils/autoLayout");
      const layouted = await autoLayout(
        nodes,
        edges,
        useSettingsStore.getState().flowDirection,
      );
      setNodes(layouted);
      commitState("Auto layout");
      setTimeout(() => {
        reactFlow.fitView({ padding: 0.1, duration: 300 });
      }, 50);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Auto layout failed:", err);
      useToastStore.getState().addToast(`Auto layout failed: ${errorMessage}`, "error");
    }
  }

  async function handleAutoLayoutSelected() {
    const { nodes, edges, setNodes, commitState } = useEditorStore.getState();
    const selectedIds = new Set(nodes.filter((n) => n.selected).map((n) => n.id));
    if (selectedIds.size < 2) return;
    try {
      const { autoLayoutSelected } = await import("@/utils/autoLayout");
      const layouted = await autoLayoutSelected(
        nodes,
        edges,
        selectedIds,
        useSettingsStore.getState().flowDirection,
      );
      setNodes(layouted);
      commitState("Auto layout selected");
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      console.error("Auto layout selected failed:", err);
      useToastStore.getState().addToast(`Auto layout failed: ${errorMessage}`, "error");
    }
  }

  async function handleTidyUp() {
    const { nodes, setNodes, commitState } = useEditorStore.getState();
    if (nodes.length === 0) return;
    const { tidyUp } = await import("@/utils/autoLayout");
    const gridSize = useUIStore.getState().gridSize;
    const tidied = tidyUp(nodes, gridSize);
    setNodes(tidied);
    commitState("Tidy up");
  }

  return (
    <>
      <div className="flex items-center h-10 px-2 bg-tn-surface border-b border-tn-border shrink-0">
        <div className="flex items-center gap-1">
          <button
            className="px-2 py-1 text-[11px] hover:bg-tn-surface rounded text-tn-text-muted"
            onClick={handleAutoLayout}
            title="Auto Layout All (L)"
          >
            ⊞ Layout All
          </button>
          <button
            className={`px-2 py-1 text-[11px] rounded ${selectedCount < 2
              ? "text-tn-text-muted/40 cursor-default"
              : "hover:bg-tn-surface text-tn-text-muted"
              }`}
            onClick={handleAutoLayoutSelected}
            disabled={selectedCount < 2}
            title="Auto Layout Selected (Shift+L)"
          >
            ⊞ Layout Selected
          </button>
          <button
            className="px-2 py-1 text-[11px] hover:bg-tn-surface rounded text-tn-text-muted"
            onClick={handleTidyUp}
            title="Tidy Up (Ctrl+Shift+L)"
          >
            ⊞ Tidy Up
          </button>
        </div>

        <div className="flex-1" />
      </div>

      <BridgeDialog />
    </>
  );
}
