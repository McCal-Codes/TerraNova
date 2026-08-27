import type { Node } from "@xyflow/react";

/* ── Types ────────────────────────────────────────────────────────── */

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const ZERO_VEC3: Vec3 = { x: 0, y: 0, z: 0 };

/* ── Vector math helpers ──────────────────────────────────────────── */

export function vec3Length(v: Vec3): number {
  return Math.sqrt(v.x * v.x + v.y * v.y + v.z * v.z);
}

export function vec3Normalize(v: Vec3): Vec3 {
  const len = vec3Length(v);
  if (len < 1e-10) return ZERO_VEC3;
  return { x: v.x / len, y: v.y / len, z: v.z / len };
}

/* ── Vector Provider Evaluation ───────────────────────────────────── */

/**
 * Evaluate a vector provider node, returning a 3D direction vector.
 *
 * Vector providers produce Vec3 outputs used by VectorWarp and other nodes.
 * Types: Constant, DensityGradient, Cache, Exported, Imported
 */
export function evaluateVectorProvider(
  nodeId: string,
  x: number,
  y: number,
  z: number,
  nodeById: Map<string, Node>,
  inputEdges: Map<string, Map<string, string>>,
  densityEvaluate: (nodeId: string, x: number, y: number, z: number) => number,
): Vec3 {
  const node = nodeById.get(nodeId);
  if (!node) return ZERO_VEC3;

  const data = node.data as Record<string, unknown>;
  const rawType = (data.type as string) ?? "";
  // Vector nodes may be prefixed "Vector:" in their type field
  const type = rawType.replace(/^Vector:/, "");
  const fields = (data.fields as Record<string, unknown>) ?? {};
  const inputs = inputEdges.get(nodeId) ?? new Map<string, string>();

  switch (type) {
    case "Constant": {
      // V2 spells this `Vector` with uppercase X/Y/Z components. Reading
      // `Value`/lowercase silently returned the fallback for every constant
      // that was not already (0, 1, 0) — 13 of the 16 in the shipped assets,
      // including (30, 0, 0) and (0, 0, -15). The lowercase form is kept as a
      // fallback for graphs authored against the older shape.
      const raw = (fields.Vector ?? fields.Value) as
        | { X?: number; Y?: number; Z?: number; x?: number; y?: number; z?: number }
        | undefined;
      if (!raw) return { x: 0, y: 1, z: 0 };
      // `??` rather than `||` throughout: a component of 0 is a real value, and
      // six shipped constants are exactly (0, 0, 0).
      return {
        x: Number(raw.X ?? raw.x ?? 0),
        y: Number(raw.Y ?? raw.y ?? 0),
        z: Number(raw.Z ?? raw.z ?? 0),
      };
    }

    case "ScalarMultiplier": {
      // Scales a vector provider by a density. Java: vectorProviderAsset +
      // scalarAsset; JSON: "Vector" and "Scalar", confirmed against
      // Biomes/Examples/Example_Vector_Offset.json.
      const vecId = inputs.get("Vector");
      const scalarId = inputs.get("Scalar");
      if (!vecId) return ZERO_VEC3;
      const v = evaluateVectorProvider(
        vecId,
        x,
        y,
        z,
        nodeById,
        inputEdges,
        densityEvaluate,
      );
      const s = scalarId ? densityEvaluate(scalarId, x, y, z) : 1;
      return { x: v.x * s, y: v.y * s, z: v.z * s };
    }

    case "DensityGradient": {
      // Compute the gradient of a connected density function via finite differences
      const densityNodeId = inputs.get("DensityFunction") ?? inputs.get("Input");
      if (!densityNodeId) return { x: 0, y: 1, z: 0 };

      const eps = 0.01;
      const inv2e = 1.0 / (2.0 * eps);

      const dfdx = (densityEvaluate(densityNodeId, x + eps, y, z)
                   - densityEvaluate(densityNodeId, x - eps, y, z)) * inv2e;
      const dfdy = (densityEvaluate(densityNodeId, x, y + eps, z)
                   - densityEvaluate(densityNodeId, x, y - eps, z)) * inv2e;
      const dfdz = (densityEvaluate(densityNodeId, x, y, z + eps)
                   - densityEvaluate(densityNodeId, x, y, z - eps)) * inv2e;

      return { x: dfdx, y: dfdy, z: dfdz };
    }

    case "Cache":
    case "Exported":
    case "Imported": {
      // Passthrough: follow the connected vector input
      const srcId = inputs.get("VectorProvider") ?? inputs.get("Input");
      if (!srcId) return ZERO_VEC3;
      return evaluateVectorProvider(srcId, x, y, z, nodeById, inputEdges, densityEvaluate);
    }

    default:
      return ZERO_VEC3;
  }
}
