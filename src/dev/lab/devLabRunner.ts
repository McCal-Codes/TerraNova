import type { Node, Edge } from "@xyflow/react";
import { DENSITY_TYPES, getEvalStatus } from "@/utils/density/evalTypes";
import { EvalStatus } from "@/schema/types";
import {
  aggregateStatus,
  type DevLabCase,
  type DevLabDiagnostic,
  type DevLabMetrics,
  type DevLabResult,
  type DevLabStatus,
} from "./devLabTypes";

/**
 * Structural and statistical validation for a Dev Lab case.
 *
 * Layer 1 (structural) asks whether the case is even runnable: does the graph
 * parse, is there an output, does evaluation produce finite numbers. Layer 2
 * (statistical) records broad metrics and checks them against the wide bands a
 * case may declare.
 *
 * Screenshot comparison is deliberately NOT here. Golden images are not stable
 * across operating systems and GPU drivers, so enforcing them would produce
 * failures that say nothing about correctness.
 */

export interface EvaluatedSample {
  /** Sampled density values. */
  values: Float32Array | number[];
  vertexCount?: number;
  triangleCount?: number;
  materialFallbackCount?: number;
}

export interface RunInputs {
  nodes: Node[];
  edges: Edge[];
  /** Null when the case could not be resolved to a graph at all. */
  sample: EvaluatedSample | null;
  /** Populated when evaluation threw or a worker died. */
  evaluationError?: string | null;
  durationMs: number;
}

/**
 * Split a graph's node types into what the evaluator can and cannot preview.
 *
 * Two independent signals, because neither alone is sufficient:
 *
 *  - `getEvalStatus` marks types the evaluator knowingly approximates. Its
 *    UNSUPPORTED_TYPES set is currently empty, so it never reports unsupported.
 *  - A type absent from DENSITY_TYPES is one the evaluator has no handler for at
 *    all — newly shipped Hytale nodes land here. For preview purposes that is
 *    unsupported, and saying so is the whole point of the Dev Lab.
 */
function classifyNodeTypes(nodes: Node[]): { unsupported: string[]; approximate: string[] } {
  const unsupported = new Set<string>();
  const approximate = new Set<string>();

  for (const node of nodes) {
    const raw = (node.data as { type?: unknown } | undefined)?.type;
    if (typeof raw !== "string" || !raw) continue;

    const status = getEvalStatus(raw);
    if (status === EvalStatus.Unsupported || !DENSITY_TYPES.has(raw)) {
      unsupported.add(raw);
    } else if (status === EvalStatus.Approximated) {
      approximate.add(raw);
    }
  }

  return { unsupported: [...unsupported].sort(), approximate: [...approximate].sort() };
}

export function computeMetrics(sample: EvaluatedSample | null): DevLabMetrics {
  if (!sample) return {};
  const values = sample.values;
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  let sum = 0;
  let solid = 0;
  let finiteCount = 0;

  for (let i = 0; i < values.length; i++) {
    const v = values[i];
    if (!Number.isFinite(v)) continue;
    finiteCount++;
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    // Matches the runtime rule: strictly greater than zero is solid.
    if (v > 0) solid++;
  }

  if (finiteCount === 0) return { vertexCount: sample.vertexCount, triangleCount: sample.triangleCount };

  return {
    minDensity: min,
    maxDensity: max,
    meanDensity: sum / finiteCount,
    solidRatio: solid / finiteCount,
    vertexCount: sample.vertexCount,
    triangleCount: sample.triangleCount,
    materialFallbackCount: sample.materialFallbackCount,
  };
}

function countNonFinite(sample: EvaluatedSample | null): number {
  if (!sample) return 0;
  let bad = 0;
  for (let i = 0; i < sample.values.length; i++) {
    if (!Number.isFinite(sample.values[i])) bad++;
  }
  return bad;
}

export function runDevLabCase(devCase: DevLabCase, inputs: RunInputs): DevLabResult {
  const startedAt = new Date().toISOString();
  const diagnostics: DevLabDiagnostic[] = [];
  const { unsupported, approximate } = classifyNodeTypes(inputs.nodes);

  /* Layer 1 — structural */

  if (inputs.evaluationError) {
    diagnostics.push({ severity: "error", code: "evaluation-error", message: inputs.evaluationError });
  }

  if (!inputs.nodes.length) {
    diagnostics.push({ severity: "error", code: "empty-graph", message: "Case produced no graph nodes." });
  }

  if (!inputs.sample) {
    diagnostics.push({ severity: "error", code: "no-sample", message: "Evaluation produced no samples." });
  } else if (inputs.sample.values.length === 0) {
    diagnostics.push({ severity: "error", code: "empty-sample", message: "Evaluation produced an empty field." });
  }

  const nonFinite = countNonFinite(inputs.sample);
  if (nonFinite > 0) {
    diagnostics.push({
      severity: "error",
      code: "non-finite",
      message: `${nonFinite} non-finite density values (NaN or Infinity).`,
    });
  }

  for (const required of devCase.expected.requiredNodeTypes ?? []) {
    const present = inputs.nodes.some((n) => (n.data as { type?: unknown })?.type === required);
    if (!present) {
      diagnostics.push({
        severity: "error",
        code: "missing-required-node",
        message: `Expected node type "${required}" is not present in the graph.`,
      });
    }
  }

  for (const forbidden of devCase.expected.forbiddenErrors ?? []) {
    if (inputs.evaluationError?.includes(forbidden)) {
      diagnostics.push({
        severity: "error",
        code: "forbidden-error",
        message: `Evaluation reported a forbidden error containing "${forbidden}".`,
      });
    }
  }

  /* Layer 2 — statistical */

  const metrics: DevLabMetrics = {
    ...computeMetrics(inputs.sample),
    durationMs: inputs.durationMs,
    unsupportedNodeCount: unsupported.length,
    approximateNodeCount: approximate.length,
  };

  for (const [key, band] of Object.entries(devCase.expected.ranges ?? {})) {
    const value = metrics[key as keyof DevLabMetrics];
    if (typeof value !== "number") continue;
    if (band?.min != null && value < band.min) {
      diagnostics.push({
        severity: "warning",
        code: "out-of-range",
        message: `${key} ${value} is below the expected minimum ${band.min}.`,
      });
    }
    if (band?.max != null && value > band.max) {
      diagnostics.push({
        severity: "warning",
        code: "out-of-range",
        message: `${key} ${value} is above the expected maximum ${band.max}.`,
      });
    }
  }

  /* Status */

  const statuses: DevLabStatus[] = [];
  if (diagnostics.some((d) => d.severity === "error")) statuses.push("failed");
  if (unsupported.length > 0) {
    statuses.push("unsupported");
    diagnostics.push({
      severity: "warning",
      code: "unsupported-nodes",
      message: `Not previewable: ${unsupported.join(", ")}.`,
    });
  }
  if (approximate.length > 0) {
    // Approximation is a documented limitation, not a defect — surface it, but
    // only downgrade to warning when the case did not opt in.
    diagnostics.push({
      severity: "info",
      code: "approximate-nodes",
      message: `Approximated: ${approximate.join(", ")}.`,
    });
    if (!devCase.expected.allowApproximation) statuses.push("warning");
  }
  if (diagnostics.some((d) => d.severity === "warning")) statuses.push("warning");
  statuses.push("passed");

  return {
    caseId: devCase.id,
    status: aggregateStatus(statuses),
    metrics,
    diagnostics,
    unsupportedNodeTypes: unsupported,
    approximateNodeTypes: approximate,
    startedAt,
    durationMs: inputs.durationMs,
  };
}

/**
 * Fields that change on every run regardless of the graph. Excluded from the
 * stable serialisation at any depth — a report whose diff is dominated by a
 * timestamp is a report nobody can diff.
 */
const VOLATILE_FIELDS = new Set(["startedAt", "durationMs"]);

/** Recursively sorts object keys so the output is byte-stable across runs. */
function stableClone(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableClone);
  if (value === null || typeof value !== "object") return value;
  // Typed arrays (sample values) would otherwise serialise as index maps.
  if (ArrayBuffer.isView(value)) return Array.from(value as unknown as ArrayLike<number>);

  const source = value as Record<string, unknown>;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(source).sort()) {
    if (VOLATILE_FIELDS.has(key)) continue;
    out[key] = stableClone(source[key]);
  }
  return out;
}

/**
 * Stable JSON for reports and clipboard, so diffs are meaningful.
 *
 * Note the deliberate avoidance of `JSON.stringify(result, keys, 2)`: passing an
 * array as the replacer applies that allowlist at *every* nesting level, so
 * nested keys survive only when they coincidentally match a top-level key name.
 * That silently emptied every `diagnostics` entry and reduced `metrics` to a
 * single field. Sorting keys recursively is what was actually intended.
 */
export function serialiseResult(result: DevLabResult): string {
  return JSON.stringify(stableClone(result), null, 2);
}
