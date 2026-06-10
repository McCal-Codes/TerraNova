import type { Edge } from "@xyflow/react";
import type { HandleDef } from "@/nodes/shared/handles";
import { categoryInput } from "@/nodes/shared/handles";
import { COMPOUND_PORTS } from "@/nodes/shared/compoundPorts";
import { getHandles } from "@/nodes/handleRegistry";

/**
 * Resolve compound-port handles for a node from static registry + current edges.
 * Shared by the live canvas hook and SVG export (no React hooks).
 */
export function resolveCompoundHandles(
  nodeId: string,
  nodeType: string,
  edges: Edge[],
): HandleDef[] {
  const staticHandles = getHandles(nodeType);
  const config = COMPOUND_PORTS[nodeType];
  if (!config) return staticHandles;

  const { arrayBase, label, category, minSlots } = config;
  const pattern = new RegExp(
    `^${arrayBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\[(\\d+)\\]$`,
  );

  const connectedIndices = new Set<number>();
  for (const e of edges) {
    if (e.target !== nodeId) continue;
    const match = pattern.exec(e.targetHandle ?? "");
    if (match) connectedIndices.add(parseInt(match[1], 10));
  }

  const maxConnected = connectedIndices.size > 0 ? Math.max(...connectedIndices) : -1;
  const slotCount = Math.max(minSlots, maxConnected + 2);

  const compoundHandles: HandleDef[] = [];
  for (let i = 0; i < slotCount; i++) {
    compoundHandles.push(categoryInput(`${arrayBase}[${i}]`, `${label} ${i}`, category));
  }

  const nonCompound = staticHandles.filter((h) => {
    if (h.type === "source") return true;
    return !pattern.test(h.id);
  });
  const otherInputs = nonCompound.filter((h) => h.type === "target");
  const outputs = nonCompound.filter((h) => h.type === "source");

  return [...compoundHandles, ...otherInputs, ...outputs];
}
