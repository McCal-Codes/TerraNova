import { useReactFlow } from "@xyflow/react";
import { ContextMenuOverlay, ContextMenuItem, ContextMenuSeparator } from "./ContextMenuPrimitives";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { makeAuthorNoteText } from "@/utils/annotationUtils";

interface CanvasContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onQuickAdd: () => void;
}

export function CanvasContextMenu({ x, y, onClose, onQuickAdd }: CanvasContextMenuProps) {
  const reactFlow = useReactFlow();
  const hasClipboard = useEditorStore((s) => s._clipboardData !== null);

  return (
    <ContextMenuOverlay x={x} y={y} onClose={onClose}>
      <ContextMenuItem
        label="Add Node..."
        shortcut="Tab"
        onClick={() => {
          onClose();
          onQuickAdd();
        }}
      />
      <ContextMenuItem
        label="Add Comment"
        onClick={() => {
          const flowPos = reactFlow.screenToFlowPosition({ x, y });
          const id = `comment-${crypto.randomUUID()}`;
          const { nodes, setNodes, commitState } = useEditorStore.getState();
          setNodes([
            ...nodes,
            {
              id,
              type: "comment",
              position: flowPos,
              data: { type: "comment", text: "", width: 240, height: 110 },
              draggable: true,
              selectable: true,
              zIndex: 1,
            },
          ]);
          commitState("Add comment");
          onClose();
        }}
      />
      <ContextMenuItem
        label="Add Author Note"
        onClick={() => {
          const flowPos = reactFlow.screenToFlowPosition({ x, y });
          const id = `comment-${crypto.randomUUID()}`;
          const { nodes, setNodes, commitState } = useEditorStore.getState();
          setNodes([
            ...nodes,
            {
              id,
              type: "comment",
              position: flowPos,
              data: {
                type: "comment",
                text: makeAuthorNoteText("Explain what to tune here."),
                width: 300,
                height: 140,
              },
              draggable: true,
              selectable: true,
              zIndex: 1,
            },
          ]);
          commitState("Add author note");
          onClose();
        }}
      />
      <ContextMenuItem
        label="Add Frame"
        onClick={() => {
          const flowPos = reactFlow.screenToFlowPosition({ x, y });
          const id = `frame-${crypto.randomUUID()}`;
          const { nodes, setNodes, commitState } = useEditorStore.getState();
          setNodes([
            {
              id,
              type: "frame",
              position: flowPos,
              data: { type: "frame", name: "", width: 300, height: 200 },
              draggable: true,
              selectable: true,
              zIndex: -1,
            },
            ...nodes,
          ]);
          commitState("Add frame");
          onClose();
        }}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label="Paste"
        shortcut="Ctrl+V"
        disabled={!hasClipboard}
        onClick={() => {
          useEditorStore.getState().pasteNodes();
          onClose();
        }}
      />
      <ContextMenuItem
        label="Select All"
        shortcut="Ctrl+A"
        onClick={() => {
          const nodes = useEditorStore.getState().nodes;
          useEditorStore.getState().setNodes(nodes.map((n) => ({ ...n, selected: true })));
          onClose();
        }}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label="Fit View"
        shortcut="Ctrl+1"
        onClick={() => {
          const graphNodes = useEditorStore.getState().nodes.filter(
            (n) => n.type !== "comment" && n.type !== "frame",
          );
          reactFlow.fitView({ nodes: graphNodes, padding: 0.1, duration: 300 });
          onClose();
        }}
      />
      <ContextMenuItem
        label="Auto Layout"
        onClick={async () => {
          onClose();
          const { handleAutoLayout } = await import("@/utils/layoutActions");
          await handleAutoLayout(reactFlow);
        }}
      />
      <ContextMenuSeparator />
      <ContextMenuItem
        label="Toggle Grid"
        shortcut="G"
        onClick={() => {
          useUIStore.getState().toggleGrid();
          onClose();
        }}
      />
      <ContextMenuItem
        label="Toggle Snap"
        shortcut="Shift+G"
        onClick={() => {
          useUIStore.getState().toggleSnap();
          onClose();
        }}
      />
    </ContextMenuOverlay>
  );
}
