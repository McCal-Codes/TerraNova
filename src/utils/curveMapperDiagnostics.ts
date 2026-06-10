import type { Node, Edge } from "@xyflow/react";
import { getNodeType } from "@/utils/density/evalTypes";
import { hasInlineCurveField } from "@/utils/propertyPanelFields";

export interface ManualCurveInRange {
  minIn: number;
  maxIn: number;
  minOut: number;
  maxOut: number;
  pointCount: number;
}

function readInOut(point: unknown): { inVal: number; outVal: number } | null {
  if (!point || typeof point !== "object" || Array.isArray(point)) return null;
  const rec = point as Record<string, unknown>;
  const inRaw = rec.In ?? rec.in ?? rec.x;
  const outRaw = rec.Out ?? rec.out ?? rec.y;
  const inVal = typeof inRaw === "number" ? inRaw : Number(inRaw);
  const outVal = typeof outRaw === "number" ? outRaw : Number(outRaw);
  if (!Number.isFinite(inVal) || !Number.isFinite(outVal)) return null;
  return { inVal, outVal };
}

/** Min/max In/Out from Manual curve Points (supports Hytale {In,Out} and editor [x,y]). */
export function getManualCurveInRange(
  fields: Record<string, unknown>,
): ManualCurveInRange | null {
  const curve = fields.Curve;
  const points =
    (curve && typeof curve === "object" && !Array.isArray(curve)
      ? (curve as Record<string, unknown>).Points
      : fields.Points) as unknown[] | undefined;
  if (!Array.isArray(points) || points.length === 0) return null;

  let minIn = Infinity;
  let maxIn = -Infinity;
  let minOut = Infinity;
  let maxOut = -Infinity;
  let count = 0;

  for (const point of points) {
    const parsed = readInOut(point);
    if (!parsed) continue;
    count += 1;
    minIn = Math.min(minIn, parsed.inVal);
    maxIn = Math.max(maxIn, parsed.inVal);
    minOut = Math.min(minOut, parsed.outVal);
    maxOut = Math.max(maxOut, parsed.outVal);
  }

  if (count === 0) return null;
  return { minIn, maxIn, minOut, maxOut, pointCount: count };
}

/** Where a Manual curve crosses Out=0 (linear segments), if any. */
export function findManualCurveZeroCrossingIn(
  fields: Record<string, unknown>,
): number | null {
  const curve = fields.Curve;
  const points =
    (curve && typeof curve === "object" && !Array.isArray(curve)
      ? (curve as Record<string, unknown>).Points
      : fields.Points) as unknown[] | undefined;
  if (!Array.isArray(points) || points.length < 2) return null;

  const parsed = points
    .map(readInOut)
    .filter((p): p is { inVal: number; outVal: number } => p != null)
    .sort((a, b) => a.inVal - b.inVal);
  if (parsed.length < 2) return null;

  let best: number | null = null;
  let bestAbsIn = Infinity;
  for (let i = 0; i < parsed.length - 1; i++) {
    const a = parsed[i];
    const b = parsed[i + 1];
    if (a.outVal === 0) {
      if (Math.abs(a.inVal) < bestAbsIn) {
        bestAbsIn = Math.abs(a.inVal);
        best = a.inVal;
      }
      continue;
    }
    if (b.outVal === 0) {
      if (Math.abs(b.inVal) < bestAbsIn) {
        bestAbsIn = Math.abs(b.inVal);
        best = b.inVal;
      }
      continue;
    }
    if ((a.outVal > 0 && b.outVal < 0) || (a.outVal < 0 && b.outVal > 0)) {
      const t = a.outVal / (a.outVal - b.outVal);
      const inAtZero = a.inVal + t * (b.inVal - a.inVal);
      if (Math.abs(inAtZero) < bestAbsIn) {
        bestAbsIn = Math.abs(inAtZero);
        best = inAtZero;
      }
    }
  }
  return best;
}

/** Block offset from Base where the height CurveMapper profile crosses zero density. */
export function findHeightCurveZeroDistance(
  nodes: Node[],
  edges: Edge[],
): number | null {
  for (const node of nodes) {
    if (getNodeType(node) !== "CurveMapper") continue;
    const inputNode = resolveCurveMapperInputNode(node.id, nodes, edges);
    if (!isBaseHeightDistanceInput(inputNode)) continue;
    const inRange = getCurveMapperManualInRange(node, nodes, edges);
    if (!inRange || isLikelyNormalizedCurveOnBlockOffsetInput(inRange)) continue;

    const fields = (node.data as Record<string, unknown>).fields as Record<string, unknown> ?? {};
    const zeroIn = findManualCurveZeroCrossingIn(fields);
    if (zeroIn != null) return zeroIn;

    const curveNode = resolveConnectedManualCurveNode(node.id, nodes, edges);
    if (!curveNode) continue;
    const curveFields = (curveNode.data as Record<string, unknown>).fields as Record<string, unknown>;
    const fromConnected = findManualCurveZeroCrossingIn({ Points: curveFields?.Points, Curve: curveFields?.Curve });
    if (fromConnected != null) return fromConnected;
  }
  return null;
}

/** Resolve the density node wired to CurveMapper's Input port. */
export function resolveCurveMapperInputNode(
  curveMapperId: string,
  nodes: Node[],
  edges: Edge[],
): Node | null {
  const inputEdge = edges.find(
    (e) => e.target === curveMapperId && (e.targetHandle === "Input" || e.targetHandle === "input"),
  );
  if (!inputEdge) return null;
  return nodes.find((n) => n.id === inputEdge.source) ?? null;
}

/** Manual curve node connected to CurveMapper.Curve, if any. */
export function resolveConnectedManualCurveNode(
  curveMapperId: string,
  nodes: Node[],
  edges: Edge[],
): Node | null {
  const curveEdge = edges.find(
    (e) =>
      e.target === curveMapperId
      && (e.targetHandle === "Curve" || e.targetHandle === "curve"),
  );
  if (!curveEdge) return null;
  const node = nodes.find((n) => n.id === curveEdge.source);
  if (!node) return null;
  const type = getNodeType(node);
  if (type === "Manual" || type.startsWith("Curve:")) return node;
  return null;
}

export function getCurveMapperManualInRange(
  curveMapperNode: Node,
  nodes: Node[],
  edges: Edge[],
): ManualCurveInRange | null {
  const fields = (curveMapperNode.data as Record<string, unknown>).fields as Record<string, unknown> ?? {};
  const inline = getManualCurveInRange(fields);
  if (inline) return inline;

  const curveNode = resolveConnectedManualCurveNode(curveMapperNode.id, nodes, edges);
  if (!curveNode) return null;
  const curveFields = (curveNode.data as Record<string, unknown>).fields as Record<string, unknown>;
  return getManualCurveInRange({ Points: curveFields?.Points, Curve: curveFields?.Curve });
}

/** BaseHeight Distance outputs block offsets — curve In in ~0..1 is a normalized-noise profile, not height. */
export function isLikelyNormalizedCurveOnBlockOffsetInput(
  inRange: ManualCurveInRange,
): boolean {
  const span = inRange.maxIn - inRange.minIn;
  if (span <= 0) return false;
  // Release height profiles span tens–hundreds of blocks; normalized noise curves sit in ~[-1,1] or [0,1].
  if (span > 4) return false;
  if (inRange.minIn >= -2 && inRange.maxIn <= 2) return true;
  return inRange.minIn >= 0 && inRange.maxIn <= 1.5;
}

export function isBaseHeightDistanceInput(
  inputNode: Node | null,
): boolean {
  if (!inputNode) return false;
  if (getNodeType(inputNode) !== "BaseHeight") return false;
  const fields = (inputNode.data as Record<string, unknown>).fields as Record<string, unknown>;
  return fields?.Distance === true;
}

export function curveMapperHasSatisfiedCurveField(
  curveMapperNode: Node,
  _nodes: Node[],
  _edges: Edge[],
  incomingByTarget: Map<string, Set<string>>,
): boolean {
  const fields = (curveMapperNode.data as Record<string, unknown>).fields as Record<string, unknown>;
  if (hasInlineCurveField(fields, "Curve")) return true;
  const handles = incomingByTarget.get(curveMapperNode.id);
  return handles?.has("Curve") === true || handles?.has("curve") === true;
}
