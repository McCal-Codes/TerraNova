import { useEffect, useRef } from "react";
import type { Node, Edge } from "@xyflow/react";
import { usePropPlacementStore } from "@/stores/propPlacementStore";

/** Debounced prop placement evaluation shared by property panel and preview panel. */
export function usePropPlacementEvaluation(
  nodes: Node[],
  edges: Edge[],
  rootNodeId?: string,
  enabled = true,
) {
  const worldRange = usePropPlacementStore((s) => s.worldRange);
  const seed = usePropPlacementStore((s) => s.seed);
  const evaluate = usePropPlacementStore((s) => s.evaluate);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    usePropPlacementStore.setState({ positions: [], positionCount: 0 });
    debounceRef.current = setTimeout(() => {
      evaluate(nodes, edges, rootNodeId);
    }, 200);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [nodes, edges, worldRange, seed, rootNodeId, evaluate, enabled]);
}
