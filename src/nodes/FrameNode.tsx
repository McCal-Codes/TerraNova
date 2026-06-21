import { memo, useState, useCallback, useRef, useEffect } from "react";
import type { NodeProps, ResizeDragEvent, ResizeParams } from "@xyflow/react";
import { NodeResizer } from "@xyflow/react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";

export interface FrameNodeData {
  type: "frame";
  name: string;
  width: number;
  height: number;
}

const FRAME_COLOR = "#4a7fa5";
const FRAME_BG = "rgba(74, 127, 165, 0.14)";
const FRAME_BORDER = "rgba(74, 127, 165, 0.55)";
const MIN_WIDTH = 120;
const MIN_HEIGHT = 80;
const CLICK_DRAG_THRESHOLD_SQ = 25;

function pointerMovedBeyondThreshold(
  start: { x: number; y: number },
  current: { x: number; y: number },
): boolean {
  const dx = current.x - start.x;
  const dy = current.y - start.y;
  return dx * dx + dy * dy >= CLICK_DRAG_THRESHOLD_SQ;
}

export const FrameNode = memo(function FrameNode({ id, selected, data }: NodeProps) {
  const nodeData = data as unknown as FrameNodeData & { _readOnlyOverview?: boolean };
  const readOnlyOverview = Boolean(nodeData._readOnlyOverview);
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(nodeData.name ?? "");
  const cancelEditRef = useRef(false);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const didPointerDragRef = useRef(false);
  const suppressClickRef = useRef(false);

  const selectFrame = useCallback(() => {
    useEditorStore.getState().setSelectedNodeId(id);
  }, [id]);

  const headerPointerListenersRef = useRef<{
    move: (e: PointerEvent) => void;
    up: () => void;
  } | null>(null);

  const teardownHeaderPointer = useCallback(() => {
    const listeners = headerPointerListenersRef.current;
    if (listeners) {
      window.removeEventListener("pointermove", listeners.move);
      window.removeEventListener("pointerup", listeners.up);
      window.removeEventListener("pointercancel", listeners.up);
      headerPointerListenersRef.current = null;
    }
    pointerStartRef.current = null;
    if (suppressClickRef.current) {
      setTimeout(() => {
        suppressClickRef.current = false;
        didPointerDragRef.current = false;
      }, 0);
    }
  }, []);

  useEffect(() => () => {
    teardownHeaderPointer();
  }, [teardownHeaderPointer]);

  const handleHeaderPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return;
    teardownHeaderPointer();
    pointerStartRef.current = { x: e.clientX, y: e.clientY };
    didPointerDragRef.current = false;

    const onMove = (ev: PointerEvent) => {
      const start = pointerStartRef.current;
      if (!start || didPointerDragRef.current) return;
      if (pointerMovedBeyondThreshold(start, { x: ev.clientX, y: ev.clientY })) {
        didPointerDragRef.current = true;
        suppressClickRef.current = true;
      }
    };
    const onUp = () => {
      teardownHeaderPointer();
    };
    headerPointerListenersRef.current = { move: onMove, up: onUp };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }, [teardownHeaderPointer]);

  const handleHeaderClick = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current || didPointerDragRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    if (!selected) {
      selectFrame();
    }
  }, [selected, selectFrame]);

  const handleLabelDoubleClick = useCallback((e: React.MouseEvent) => {
    if (suppressClickRef.current || didPointerDragRef.current) {
      e.stopPropagation();
      e.preventDefault();
      return;
    }
    e.stopPropagation();
    setEditName(nodeData.name ?? "");
    setIsEditing(true);
  }, [nodeData.name]);

  const handleCommit = useCallback(() => {
    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      setIsEditing(false);
      return;
    }
    setIsEditing(false);
    const { nodes, setNodes, commitState } = useEditorStore.getState();
    setNodes(nodes.map((node) => (
      node.id !== id ? node : { ...node, data: { ...node.data as object, name: editName } }
    )));
    commitState("Rename frame");
    useProjectStore.getState().setDirty(true);
  }, [id, editName]);

  const handleResizeEnd = useCallback((_event: ResizeDragEvent, params: ResizeParams) => {
    suppressClickRef.current = true;
    const { nodes, setNodes, commitState } = useEditorStore.getState();
    setNodes(nodes.map((node) => (
      node.id !== id
        ? node
        : {
            ...node,
            width: params.width,
            height: params.height,
            data: { ...node.data as object, width: params.width, height: params.height },
          }
    )));
    commitState("Resize frame");
    useProjectStore.getState().setDirty(true);
    setTimeout(() => {
      suppressClickRef.current = false;
    }, 0);
  }, [id]);

  const width = nodeData.width ?? 300;
  const height = nodeData.height ?? 200;
  const frameColor = readOnlyOverview ? `${FRAME_COLOR}cc` : FRAME_COLOR;
  const frameBg = readOnlyOverview ? "rgba(74, 127, 165, 0.08)" : FRAME_BG;
  const frameBorder = readOnlyOverview ? "rgba(74, 127, 165, 0.35)" : (selected ? FRAME_COLOR : FRAME_BORDER);

  if (readOnlyOverview) {
    return (
      <div
        style={{
          width,
          height,
          background: frameBg,
          border: `1px solid ${frameBorder}`,
          borderRadius: 10,
          pointerEvents: "none",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            minHeight: 26,
            padding: "4px 10px",
            background: "rgba(74, 127, 165, 0.1)",
            borderBottom: `1px solid ${frameBorder}`,
            borderRadius: "9px 9px 0 0",
            display: "flex",
            alignItems: "center",
          }}
        >
          <span
            style={{
              color: frameColor,
              fontSize: 10,
              fontWeight: 600,
              userSelect: "none",
              opacity: nodeData.name ? 0.9 : 0.55,
            }}
          >
            {nodeData.name || "Frame"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <>
      <NodeResizer
        isVisible={selected}
        minWidth={MIN_WIDTH}
        minHeight={MIN_HEIGHT}
        lineStyle={{ borderColor: FRAME_COLOR, borderWidth: 1 }}
        handleStyle={{
          width: 10,
          height: 10,
          background: FRAME_COLOR,
          border: "2px solid rgba(0,0,0,0.3)",
          borderRadius: 2,
        }}
        onResizeEnd={handleResizeEnd}
      />
      <div
        style={{
          width,
          height,
          background: FRAME_BG,
          border: `1px solid ${selected ? FRAME_COLOR : FRAME_BORDER}`,
          borderRadius: 8,
          boxShadow: selected ? `0 0 0 2px ${FRAME_COLOR}55` : "none",
          pointerEvents: "none",
          position: "relative",
        }}
      >
        <div
          className={selected ? "frame-drag-handle" : "nodrag"}
          onPointerDown={handleHeaderPointerDown}
          onClick={handleHeaderClick}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            minHeight: 28,
            padding: "4px 10px",
            background: `${FRAME_COLOR}18`,
            borderBottom: `1px solid ${FRAME_BORDER}`,
            borderRadius: "7px 7px 0 0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 8,
            cursor: selected ? "grab" : "default",
            pointerEvents: "all",
          }}
        >
          <div onDoubleClick={handleLabelDoubleClick} style={{ minWidth: 0, flex: 1 }}>
            {isEditing ? (
              <input
                type="text"
                value={editName}
                autoFocus
                onChange={(e) => setEditName(e.target.value)}
                onBlur={handleCommit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") handleCommit();
                  if (e.key === "Escape") {
                    cancelEditRef.current = true;
                    setIsEditing(false);
                    setEditName(nodeData.name ?? "");
                  }
                }}
                className="nodrag"
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: FRAME_COLOR,
                  fontSize: 11,
                  fontWeight: 600,
                  minWidth: 60,
                  width: Math.max(60, editName.length * 7),
                }}
              />
            ) : (
              <span
                style={{
                  color: FRAME_COLOR,
                  fontSize: 11,
                  fontWeight: 600,
                  userSelect: "none",
                  cursor: "text",
                  opacity: nodeData.name ? 1 : 0.6,
                }}
              >
                {nodeData.name || "Frame"}
              </span>
            )}
          </div>
          {selected && (
            <span style={{ color: FRAME_COLOR, fontSize: 10, opacity: 0.85, userSelect: "none" }}>
              {Math.round(width)} x {Math.round(height)}
            </span>
          )}
        </div>
      </div>
    </>
  );
});
