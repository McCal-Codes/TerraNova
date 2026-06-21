import { memo, type RefObject } from "react";
import { GripVertical } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useDraggableLayoutPicker } from "@/hooks/useDraggableLayoutPicker";
import { LayoutPresetPicker, shouldShowLayoutPresetPicker } from "./LayoutPresetPicker";
import { NoiseRangeLayoutPicker } from "./NoiseRangeLayoutPicker";

interface CanvasLayoutPickerProps {
  containerRef: RefObject<HTMLElement | null>;
}

/**
 * Draggable layout picker on the editor workspace.
 * Default: bottom-center (best balance — away from status HUD, preview chrome, minimap, and RF controls).
 */
export const CanvasLayoutPicker = memo(function CanvasLayoutPicker({
  containerRef,
}: CanvasLayoutPickerProps) {
  const editingContext = useEditorStore((s) => s.editingContext);
  const {
    pickerRef,
    position,
    dragging,
    onGripPointerDown,
    onGripPointerMove,
    onGripPointerUp,
    resetPosition,
  } = useDraggableLayoutPicker(containerRef);

  if (!shouldShowLayoutPresetPicker(editingContext)) return null;

  return (
    <div
      ref={pickerRef}
      className={`pointer-events-auto absolute z-30 flex items-stretch rounded-lg shadow-lg ring-1 ring-tn-border/60 ${
        dragging ? "cursor-grabbing" : ""
      }`}
      style={
        position
          ? { left: position.x, top: position.y }
          : { visibility: "hidden" as const }
      }
      role="toolbar"
      aria-label="Editor layout"
    >
      <button
        type="button"
        className={`flex shrink-0 items-center rounded-l-lg border-r border-tn-border/60 px-1 text-tn-text-muted transition-colors hover:bg-tn-panel/80 hover:text-tn-text ${
          dragging ? "cursor-grabbing bg-tn-panel/60" : "cursor-grab"
        }`}
        aria-label="Drag layout picker. Double-click to reset position."
        title="Drag to move · double-click to reset"
        onPointerDown={onGripPointerDown}
        onPointerMove={onGripPointerMove}
        onPointerUp={onGripPointerUp}
        onPointerCancel={onGripPointerUp}
        onDoubleClick={(e) => {
          e.preventDefault();
          resetPosition();
        }}
      >
        <GripVertical className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
      </button>
      <div className="rounded-r-lg">
        {editingContext === "NoiseRange" ? <NoiseRangeLayoutPicker /> : <LayoutPresetPicker />}
      </div>
    </div>
  );
});
