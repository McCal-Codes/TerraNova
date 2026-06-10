import { useEffect, useRef } from "react";
import { useUIStore } from "@/stores/uiStore";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore, type ViewMode } from "@/stores/previewStore";
import { previewWorkerLog } from "@/utils/previewWorkerLog";

/**
 * When the properties panel is open with a node selected, hide split/preview
 * view modes so the canvas + inspector share horizontal space comfortably.
 * Restores the prior view mode when inspection ends.
 */
export function usePreviewPropertiesLayout() {
  const rightPanelVisible = useUIStore((s) => s.rightPanelVisible);
  const rightPanelMode = useUIStore((s) => s.rightPanelMode);
  const selectedNodeId = useEditorStore((s) => s.selectedNodeId);
  const setViewMode = usePreviewStore((s) => s.setViewMode);
  const savedViewModeRef = useRef<ViewMode | null>(null);

  useEffect(() => {
    const inspecting = rightPanelVisible
      && rightPanelMode === "properties"
      && Boolean(selectedNodeId);

    if (inspecting) {
      if (savedViewModeRef.current === null) {
        const current = usePreviewStore.getState().viewMode;
        if (current === "preview" || current === "split") {
          savedViewModeRef.current = current;
          setViewMode("graph");
          previewWorkerLog("layout", "properties open — switched to graph", { from: current });
        }
      }
      return;
    }

    if (savedViewModeRef.current !== null) {
      const restore = savedViewModeRef.current;
      savedViewModeRef.current = null;
      setViewMode(restore);
      previewWorkerLog("layout", "properties closed — restored view", { to: restore });
    }
  }, [rightPanelVisible, rightPanelMode, selectedNodeId, setViewMode]);
}
