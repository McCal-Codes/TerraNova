import type { Node, Edge } from "@xyflow/react";
import { evaluateDensityGrid, type EvaluationOptions } from "../utils/densityEvaluator";
import type { DensityWorkerRequest, DensityWorkerResponse, DensityWorkerError } from "../workers/densityWorker";
import { useDevMetricsStore } from "@/stores/devMetricsStore";
import { previewWorkerLog, previewWorkerWarn } from "./previewWorkerLog";

const WORKER_TIMEOUT_MS = 30_000;

function log(...args: unknown[]) {
  previewWorkerLog("densityWorkerClient", ...args);
}

function warn(...args: unknown[]) {
  previewWorkerWarn("densityWorkerClient", ...args);
}

export interface EvalParams {
  nodes: Node[];
  edges: Edge[];
  resolution: number;
  rangeMin: number;
  rangeMax: number;
  yLevel: number;
  rootNodeId?: string;
  options?: EvaluationOptions;
}

export interface EvalResult {
  values: Float32Array;
  minValue: number;
  maxValue: number;
  p02Value: number;
  p98Value: number;
}

export interface WorkerInstance {
  evaluate: (params: EvalParams) => Promise<EvalResult>;
  cancel: () => void;
}

function reportDensityEval(
  lane: "worker" | "main-thread",
  durationMs: number,
  resolution: number,
  fallbackReason?: string,
) {
  useDevMetricsStore.getState().reportEval({
    kind: "density",
    lane,
    durationMs,
    resolution,
    fallbackReason,
    at: Date.now(),
  });
}

function evaluateOnMainThread(params: EvalParams): EvalResult {
  const result = evaluateDensityGrid(
    params.nodes,
    params.edges,
    params.resolution,
    params.rangeMin,
    params.rangeMax,
    params.yLevel,
    params.rootNodeId,
    params.options,
  );
  return { values: result.values, minValue: result.minValue, maxValue: result.maxValue, p02Value: result.p02Value, p98Value: result.p98Value };
}

/**
 * Create an independent worker instance with its own evaluate/cancel pair.
 * Used by ComparisonView to run two evaluations in parallel.
 */
export function createWorkerInstance(): WorkerInstance {
  let worker: Worker | null = null;
  let workerFailed = false;
  let pendingReject: ((reason: unknown) => void) | null = null;
  let activeCleanup: (() => void) | null = null;
  let requestSeq = 0;

  function getWorker(): Worker | null {
    if (workerFailed) return null;
    if (!worker) {
      try {
        worker = new Worker(new URL("../workers/densityWorker.ts", import.meta.url), {
          type: "module",
        });
        worker.addEventListener("error", (e) => {
          warn("Worker global error:", e.message);
        });
        log("Worker constructed successfully");
      } catch (err) {
        warn("Failed to construct Worker, will use main-thread fallback:", err);
        workerFailed = true;
        return null;
      }
    }
    return worker;
  }

  function cancel(): void {
    requestSeq++;
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    if (pendingReject) {
      pendingReject("cancelled");
      pendingReject = null;
    }
  }

  function evaluate(params: EvalParams): Promise<EvalResult> {
    cancel();

    const w = getWorker();
    if (!w) {
      log("Using main-thread fallback (worker unavailable)");
      return new Promise<EvalResult>((resolve, reject) => {
        const started = performance.now();
        try {
          const result = evaluateOnMainThread(params);
          reportDensityEval("main-thread", performance.now() - started, params.resolution, "worker-unavailable");
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    }

    return new Promise<EvalResult>((resolve, reject) => {
      pendingReject = reject;
      const requestId = ++requestSeq;
      const started = performance.now();

      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const onMessage = (e: MessageEvent<DensityWorkerResponse | DensityWorkerError>) => {
        if (requestId !== requestSeq) return;
        cleanup();
        if ("error" in e.data) {
          reject(new Error(e.data.error));
        } else {
          log("Worker returned result, values length:", e.data.values.length);
          reportDensityEval("worker", performance.now() - started, params.resolution);
          resolve({
            values: e.data.values,
            minValue: e.data.minValue,
            maxValue: e.data.maxValue,
            p02Value: e.data.p02Value,
            p98Value: e.data.p98Value,
          });
        }
      };

      const onError = (e: ErrorEvent) => {
        if (requestId !== requestSeq) return;
        cleanup();
        warn("Worker error during evaluation:", e.message);
        warn("Falling back to main-thread evaluation");
        try {
          const fallbackStarted = performance.now();
          const result = evaluateOnMainThread(params);
          reportDensityEval(
            "main-thread",
            performance.now() - fallbackStarted,
            params.resolution,
            `worker-error:${e.message}`,
          );
          resolve(result);
        } catch (fallbackErr) {
          reject(fallbackErr);
        }
      };

      function cleanup() {
        if (timeoutId !== null) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        w!.removeEventListener("message", onMessage);
        w!.removeEventListener("error", onError);
        if (activeCleanup === cleanup) activeCleanup = null;
        if (pendingReject === reject) pendingReject = null;
      }

      activeCleanup = cleanup;
      w.addEventListener("message", onMessage);
      w.addEventListener("error", onError);

      timeoutId = setTimeout(() => {
        if (requestId !== requestSeq) return;
        cleanup();
        warn(`Worker timed out after ${WORKER_TIMEOUT_MS}ms, falling back to main-thread evaluation`);
        try {
          const fallbackStarted = performance.now();
          const result = evaluateOnMainThread(params);
          reportDensityEval(
            "main-thread",
            performance.now() - fallbackStarted,
            params.resolution,
            "worker-timeout",
          );
          resolve(result);
        } catch (fallbackErr) {
          reject(fallbackErr);
        }
      }, WORKER_TIMEOUT_MS);

      const request: DensityWorkerRequest = {
        nodes: params.nodes,
        edges: params.edges,
        resolution: params.resolution,
        rangeMin: params.rangeMin,
        rangeMax: params.rangeMax,
        yLevel: params.yLevel,
        rootNodeId: params.rootNodeId,
        options: params.options,
      };

      log("Posting message to worker, nodes:", params.nodes.length, "resolution:", params.resolution);
      w.postMessage(request);
    });
  }

  return { evaluate, cancel };
}

// ── Default singleton instance (used by the main preview) ──

const defaultInstance = createWorkerInstance();

/**
 * Cancel any in-flight evaluation. The promise from the previous
 * evaluateInWorker call will reject with "cancelled".
 */
export function cancelEvaluation(): void {
  defaultInstance.cancel();
}

/**
 * Evaluate the density grid in a background Web Worker.
 * Only one evaluation runs at a time — calling again cancels the previous.
 */
export function evaluateInWorker(params: EvalParams): Promise<EvalResult> {
  return defaultInstance.evaluate(params);
}
