import { useCallback, useRef, useState } from "react";
import type { Node } from "@xyflow/react";
import { useEditorStore } from "@/stores/editorStore";
import { findNearestEdge, NODE_CENTER_OFFSET_X, NODE_CENTER_OFFSET_Y } from "@/utils/graphGeometry";
import { findHandleDef, findCompatibleInterjectHandles } from "@/nodes/handleRegistry";
import type { AssetCategory } from "@/schema/types";

interface InterjectResult {
  edgeId: string;
  inputHandleId: string;
  outputHandleId: string;
}

/**
 * Hook for managing wire interjection during node drags (both on-canvas and palette).
 * Detects when a dragged node is near an existing edge, checks type compatibility,
 * and provides state for visual highlighting + drop-time edge splitting.
 */
export function useNodeInterjection() {
  const [interjectEdgeId, setInterjectEdgeId] = useState<string | null>(null);

  // Cache the resolved interjection result so we don't recompute on drop
  const interjectResultRef = useRef<InterjectResult | null>(null);
  const rafRef = useRef<number | null>(null);

  /**
   * Get the set of handle IDs already connected for a given node.
   */
  const getConnectedHandleIds = useCallback((nodeId: string): Set<string> => {
    const { edges } = useEditorStore.getState();
    const connected = new Set<string>();
    for (const e of edges) {
      if (e.source === nodeId && e.sourceHandle) connected.add(e.sourceHandle);
      if (e.target === nodeId && e.targetHandle) connected.add(e.targetHandle);
    }
    return connected;
  }, []);

  /**
   * Resolve the edge's source output category and target input category.
   */
  const getEdgeCategories = useCallback((edge: { source: string; target: string; sourceHandle?: string | null; targetHandle?: string | null }) => {
    const { nodes } = useEditorStore.getState();
    const sourceNode = nodes.find((n) => n.id === edge.source);
    const targetNode = nodes.find((n) => n.id === edge.target);
    if (!sourceNode || !targetNode) return null;

    const sourceType = sourceNode.type ?? "default";
    const targetType = targetNode.type ?? "default";

    const sourceHandleDef = findHandleDef(sourceType, edge.sourceHandle ?? "output");
    const targetHandleDef = findHandleDef(targetType, edge.targetHandle ?? "Input");

    if (!sourceHandleDef || !targetHandleDef) return null;

    return {
      sourceOutputCategory: sourceHandleDef.category as AssetCategory,
      targetInputCategory: targetHandleDef.category as AssetCategory,
    };
  }, []);

  /**
   * Core check: given a flow position and a node type, find a nearby edge
   * and check if the node can be interjected.
   */
  const checkInterjection = useCallback(
    (flowPosition: { x: number; y: number }, nodeType: string, nodeId?: string) => {
      const { nodes, edges } = useEditorStore.getState();
      const nearbyEdge = findNearestEdge(flowPosition, nodes, edges, 50);

      if (!nearbyEdge) {
        if (interjectResultRef.current) {
          interjectResultRef.current = null;
          setInterjectEdgeId(null);
        }
        return;
      }

      // Don't interject onto a wire connected to the node itself
      if (nodeId && (nearbyEdge.source === nodeId || nearbyEdge.target === nodeId)) {
        if (interjectResultRef.current) {
          interjectResultRef.current = null;
          setInterjectEdgeId(null);
        }
        return;
      }

      // Get the categories flowing through this edge
      const categories = getEdgeCategories(nearbyEdge);
      if (!categories) {
        if (interjectResultRef.current) {
          interjectResultRef.current = null;
          setInterjectEdgeId(null);
        }
        return;
      }

      // Check if the node type has compatible, unconnected handles
      const connectedHandles = nodeId ? getConnectedHandleIds(nodeId) : new Set<string>();
      const result = findCompatibleInterjectHandles(
        nodeType,
        categories.sourceOutputCategory,
        categories.targetInputCategory,
        connectedHandles,
      );

      if (!result) {
        if (interjectResultRef.current) {
          interjectResultRef.current = null;
          setInterjectEdgeId(null);
        }
        return;
      }

      // Compatible — highlight
      const newResult: InterjectResult = {
        edgeId: nearbyEdge.id,
        inputHandleId: result.inputHandleId,
        outputHandleId: result.outputHandleId,
      };

      // Only update state if the edge changed
      if (interjectResultRef.current?.edgeId !== newResult.edgeId) {
        interjectResultRef.current = newResult;
        setInterjectEdgeId(newResult.edgeId);
      } else {
        interjectResultRef.current = newResult;
      }
    },
    [getEdgeCategories, getConnectedHandleIds],
  );

  /**
   * Called during ReactFlow's onNodeDrag to detect interjection targets.
   */
  const onNodeDrag = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      if (rafRef.current !== null) return; // throttle to rAF
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        const nodeType = node.type ?? "default";
        const flowPos = {
          x: node.position.x + NODE_CENTER_OFFSET_X,
          y: node.position.y + NODE_CENTER_OFFSET_Y,
        };
        checkInterjection(flowPos, nodeType, node.id);
      });
    },
    [checkInterjection],
  );

  /**
   * Called on ReactFlow's onNodeDragStop — performs the interjection if applicable.
   */
  const onNodeDragStop = useCallback(
    (_event: React.MouseEvent, node: Node) => {
      // Cancel any pending rAF
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }

      const result = interjectResultRef.current;
      if (result) {
        useEditorStore.getState().interjectOnEdge(
          result.edgeId,
          node.id,
          result.inputHandleId,
          result.outputHandleId,
        );
        interjectResultRef.current = null;
        setInterjectEdgeId(null);
      }
    },
    [],
  );

  /**
   * Called during palette drag (mouse move) to detect nearby edges.
   */
  const checkPaletteDrag = useCallback(
    (flowPosition: { x: number; y: number }, nodeType: string) => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(() => {
        rafRef.current = null;
        checkInterjection(flowPosition, nodeType);
      });
    },
    [checkInterjection],
  );

  /**
   * Get the current interjection result (for use on palette drop).
   */
  const getInterjectResult = useCallback(() => {
    return interjectResultRef.current;
  }, []);

  /**
   * Reset interjection state.
   */
  const clearInterject = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    interjectResultRef.current = null;
    setInterjectEdgeId(null);
  }, []);

  return {
    interjectEdgeId,
    onNodeDrag,
    onNodeDragStop,
    checkPaletteDrag,
    getInterjectResult,
    clearInterject,
  };
}
