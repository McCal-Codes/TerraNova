import type { Node, Edge } from "@xyflow/react";
import { evaluateDensityVolume, evaluateDensityVolumeSteps } from "../utils/volumeEvaluator";
import type { EvaluationOptions } from "../utils/densityEvaluator";
import type {
  VolumeWorkerRequest,
  VolumeWorkerResponse,
  VolumeWorkerError,
  VolumeWorkerCancel,
  VolumeWorkerProgressiveRequest,
  VolumeWorkerContinueRequest,
  VolumeWorkerOutbound,
} from "../workers/volumeWorkerTypes";
import { useDevMetricsStore } from "@/stores/devMetricsStore";
import {
  isPreviewWorkerLoggingEnabled,
  previewWorkerLog,
  previewWorkerLogFromWorker,
  previewWorkerWarn,
} from "./previewWorkerLog";

const WORKER_TIMEOUT_MS = 30_000;
const WORKER_TIMEOUT_MAX_MS = 120_000;

function volumeEvalTimeoutMs(resolution: number, ySlices: number): number {
  const cells = resolution * resolution * Math.max(1, ySlices);
  return Math.min(WORKER_TIMEOUT_MAX_MS, Math.max(WORKER_TIMEOUT_MS, cells * 0.012));
}

function log(...args: unknown[]) {
  previewWorkerLog("volumeWorkerClient", ...args);
}

function warn(...args: unknown[]) {
  previewWorkerWarn("volumeWorkerClient", ...args);
}

function forwardWorkerLog(data: VolumeWorkerOutbound): boolean {
  if ("type" in data && data.type === "log") {
    previewWorkerLogFromWorker("volume", data.level, data.message, data.data);
    return true;
  }
  return false;
}

export interface VolumeEvalParams {
  nodes: Node[];
  edges: Edge[];
  resolution: number;
  rangeMin: number;
  rangeMax: number;
  yMin: number;
  yMax: number;
  ySlices: number;
  rootNodeId?: string;
  options?: EvaluationOptions;
  sessionKey?: string;
}

export interface VolumeEvalResult {
  densities: Float32Array;
  resolution: number;
  ySlices: number;
  minValue: number;
  maxValue: number;
}

export interface VolumeStepResult extends VolumeEvalResult {
  stepIndex: number;
  totalSteps: number;
  isFinal: boolean;
}

export interface VolumeProgressiveParams {
  sessionKey: string;
  nodes: Node[];
  edges: Edge[];
  rangeMin: number;
  rangeMax: number;
  yMin: number;
  yMax: number;
  rootNodeId?: string;
  options?: EvaluationOptions;
  steps: Array<{ resolution: number; ySlices: number }>;
  pauseAfterFirst: boolean;
}

export type VolumeStepHandler = (
  step: VolumeStepResult,
) => void | Promise<"abort" | void>;

export interface VolumeWorkerInstance {
  evaluate: (params: VolumeEvalParams) => Promise<VolumeEvalResult>;
  evaluateProgressive: (
    params: VolumeProgressiveParams,
    onStep: VolumeStepHandler,
  ) => Promise<void>;
  cancel: () => void;
}

function reportVolumeEval(
  lane: "worker" | "main-thread",
  durationMs: number,
  resolution: number,
  fallbackReason?: string,
) {
  useDevMetricsStore.getState().reportEval({
    kind: "voxelEval",
    lane,
    durationMs,
    resolution,
    fallbackReason,
    at: Date.now(),
  });
}

function toEvalResult(data: {
  densities: Float32Array;
  resolution: number;
  ySlices: number;
  minValue: number;
  maxValue: number;
}): VolumeEvalResult {
  return {
    densities: data.densities,
    resolution: data.resolution,
    ySlices: data.ySlices,
    minValue: data.minValue,
    maxValue: data.maxValue,
  };
}

function evaluateProgressiveOnMainThread(
  params: VolumeProgressiveParams,
  onStep: VolumeStepHandler,
): Promise<void> {
  const started = performance.now();
  const bounds = {
    rangeMin: params.rangeMin,
    rangeMax: params.rangeMax,
    yMin: params.yMin,
    yMax: params.yMax,
  };

  return (async () => {
    const runStepBatch = async (
      stepDefs: Array<{ resolution: number; ySlices: number }>,
      startIndex: number,
    ) => {
      const results = evaluateDensityVolumeSteps(
        params.nodes,
        params.edges,
        params.rootNodeId,
        params.options,
        bounds,
        stepDefs,
      );

      for (let i = 0; i < results.length; i++) {
        const stepIndex = startIndex + i;
        const stepResult: VolumeStepResult = {
          ...results[i],
          stepIndex,
          totalSteps: params.steps.length,
          isFinal: stepIndex === params.steps.length - 1,
        };
        const action = await onStep(stepResult);
        if (action === "abort") return false;
      }
      return true;
    };

    if (params.pauseAfterFirst && params.steps.length > 1) {
      const ok = await runStepBatch([params.steps[0]], 0);
      if (!ok) return;
      await runStepBatch(params.steps.slice(1), 1);
    } else {
      await runStepBatch(params.steps, 0);
    }

    reportVolumeEval(
      "main-thread",
      performance.now() - started,
      params.steps[params.steps.length - 1]?.resolution ?? 0,
      "progressive-fallback",
    );
  })();
}
function evaluateOnMainThread(params: VolumeEvalParams): VolumeEvalResult {
  const result = evaluateDensityVolume(
    params.nodes,
    params.edges,
    params.resolution,
    params.rangeMin,
    params.rangeMax,
    params.yMin,
    params.yMax,
    params.ySlices,
    params.rootNodeId,
    params.options,
  );
  return {
    densities: result.densities,
    resolution: result.resolution,
    ySlices: result.ySlices,
    minValue: result.minValue,
    maxValue: result.maxValue,
  };
}

export function createVolumeWorkerInstance(): VolumeWorkerInstance {
  let worker: Worker | null = null;
  let workerFailed = false;
  let pendingReject: ((reason: unknown) => void) | null = null;
  let activeCleanup: (() => void) | null = null;
  let requestSeq = 0;

  function getWorker(): Worker | null {
    if (workerFailed) return null;
    if (!worker) {
      try {
        worker = new Worker(new URL("../workers/volumeWorker.ts", import.meta.url), {
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

  function signalWorkerCancel(): void {
    if (worker) {
      worker.postMessage({ type: "cancel" } satisfies VolumeWorkerCancel);
    }
  }

  function cancel(): void {
    requestSeq++;
    signalWorkerCancel();
    if (activeCleanup) {
      activeCleanup();
      activeCleanup = null;
    }
    if (pendingReject) {
      pendingReject("cancelled");
      pendingReject = null;
    }
  }

  function evaluate(params: VolumeEvalParams): Promise<VolumeEvalResult> {
    cancel();

    const w = getWorker();
    if (!w) {
      log("Using main-thread fallback (worker unavailable)");
      return new Promise<VolumeEvalResult>((resolve, reject) => {
        const started = performance.now();
        try {
          const result = evaluateOnMainThread(params);
          reportVolumeEval("main-thread", performance.now() - started, params.resolution, "worker-unavailable");
          resolve(result);
        } catch (err) {
          reject(err);
        }
      });
    }

    return new Promise<VolumeEvalResult>((resolve, reject) => {
      pendingReject = reject;
      const requestId = ++requestSeq;
      const started = performance.now();

      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const onMessage = (e: MessageEvent<VolumeWorkerResponse | VolumeWorkerError | VolumeWorkerOutbound>) => {
        if (requestId !== requestSeq) return;
        if (forwardWorkerLog(e.data as VolumeWorkerOutbound)) return;
        cleanup();
        if ("error" in e.data) {
          reject(new Error(e.data.error));
        } else if ("densities" in e.data) {
          log("Worker returned result, densities length:", e.data.densities.length);
          reportVolumeEval("worker", performance.now() - started, params.resolution);
          resolve({
            densities: e.data.densities,
            resolution: e.data.resolution,
            ySlices: e.data.ySlices,
            minValue: e.data.minValue,
            maxValue: e.data.maxValue,
          });
        }
      };

      const onError = (e: ErrorEvent) => {
        if (requestId !== requestSeq) return;
        cleanup();
        warn("Worker error during evaluation:", e.message);
        if (requestId !== requestSeq) return;
        warn("Falling back to main-thread evaluation");
        try {
          const fallbackStarted = performance.now();
          const result = evaluateOnMainThread(params);
          reportVolumeEval(
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
        if (requestId !== requestSeq) return;
        warn(`Worker timed out, falling back to main-thread evaluation`);
        try {
          const fallbackStarted = performance.now();
          const result = evaluateOnMainThread(params);
          reportVolumeEval(
            "main-thread",
            performance.now() - fallbackStarted,
            params.resolution,
            "worker-timeout",
          );
          resolve(result);
        } catch (fallbackErr) {
          reject(fallbackErr);
        }
      }, volumeEvalTimeoutMs(params.resolution, params.ySlices));

      const request: VolumeWorkerRequest = {
        nodes: params.nodes,
        edges: params.edges,
        resolution: params.resolution,
        rangeMin: params.rangeMin,
        rangeMax: params.rangeMax,
        yMin: params.yMin,
        yMax: params.yMax,
        ySlices: params.ySlices,
        rootNodeId: params.rootNodeId,
        options: params.options,
        sessionKey: params.sessionKey,
        debug: isPreviewWorkerLoggingEnabled(),
      };

      log("Posting message to worker", {
        nodes: params.nodes.length,
        resolution: params.resolution,
        ySlices: params.ySlices,
        sessionKey: params.sessionKey,
      });
      w.postMessage(request);
    });
  }

  function evaluateProgressive(
    params: VolumeProgressiveParams,
    onStep: VolumeStepHandler,
  ): Promise<void> {
    cancel();

    const w = getWorker();
    if (!w) {
      return evaluateProgressiveOnMainThread(params, onStep);
    }

    return new Promise<void>((resolve, reject) => {
      pendingReject = reject;
      const requestId = ++requestSeq;
      const started = performance.now();
      const totalSteps = params.steps.length;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;

      const maxRes = params.steps.reduce((m, s) => Math.max(m, s.resolution), 0);
      const maxSlices = params.steps.reduce((m, s) => Math.max(m, s.ySlices), 0);
      let aborted = false;
      let step0Handled = false;
      let gotAwaiting = false;
      let stepChain: Promise<void> = Promise.resolve();

      const sendContinue = () => {
        if (aborted || requestId !== requestSeq) return;
        const continueReq: VolumeWorkerContinueRequest = {
          type: "continue",
          sessionKey: params.sessionKey,
          rangeMin: params.rangeMin,
          rangeMax: params.rangeMax,
          yMin: params.yMin,
          yMax: params.yMax,
          startStepIndex: 1,
          totalSteps,
          steps: params.steps.slice(1),
          debug: isPreviewWorkerLoggingEnabled(),
        };
        log("Sending continue after step 0");
        w.postMessage(continueReq);
      };

      const handleStep = async (data: Extract<VolumeWorkerOutbound, { type: "step" }>) => {
        const stepResult: VolumeStepResult = {
          ...toEvalResult(data),
          stepIndex: data.stepIndex,
          totalSteps: data.totalSteps,
          isFinal: data.stepIndex === data.totalSteps - 1,
        };
        const action = await onStep(stepResult);
        log(`Step ${data.stepIndex + 1}/${data.totalSteps} applied`, {
          resolution: data.resolution,
          ySlices: data.ySlices,
          minValue: data.minValue,
          maxValue: data.maxValue,
        });
        if (action === "abort") {
          aborted = true;
          signalWorkerCancel();
          cleanup();
          resolve();
          return;
        }

        if (data.stepIndex === 0) {
          step0Handled = true;
          if (gotAwaiting) sendContinue();
        }
      };

      const onMessage = (e: MessageEvent<VolumeWorkerOutbound>) => {
        if (requestId !== requestSeq) return;
        const data = e.data;

        if (forwardWorkerLog(data)) return;

        if ("error" in data) {
          cleanup();
          reject(new Error(data.error));
          return;
        }

        if ("type" in data && data.type === "step") {
          stepChain = stepChain
            .then(() => handleStep(data))
            .catch((err) => {
              cleanup();
              reject(err);
            });
          return;
        }

        if ("type" in data && data.type === "awaiting") {
          log("Worker awaiting continue after step 0");
          gotAwaiting = true;
          if (step0Handled) sendContinue();
          return;
        }

        if ("type" in data && data.type === "done") {
          log("Progressive eval done", {
            totalSteps,
            elapsedMs: Math.round(performance.now() - started),
          });
          stepChain
            .then(() => {
              if (requestId !== requestSeq) return;
              cleanup();
              reportVolumeEval("worker", performance.now() - started, maxRes);
              resolve();
            })
            .catch(() => { /* rejected in step handler */ });
          return;
        } else if (!("type" in data)) {
          cleanup();
          reject(new Error("Unexpected worker response"));
        }
      };

      const onError = (e: ErrorEvent) => {
        if (requestId !== requestSeq) return;
        cleanup();
        warn("Worker error during progressive evaluation:", e.message);
        if (requestId !== requestSeq) return;
        evaluateProgressiveOnMainThread(params, onStep).then(resolve).catch(reject);
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
        if (requestId !== requestSeq) return;
        warn("Worker timed out during progressive evaluation, falling back to main thread");
        evaluateProgressiveOnMainThread(params, onStep).then(resolve).catch(reject);
      }, volumeEvalTimeoutMs(maxRes, maxSlices) * Math.max(1, totalSteps * 0.6));

      const request: VolumeWorkerProgressiveRequest = {
        type: "progressive",
        sessionKey: params.sessionKey,
        nodes: params.nodes,
        edges: params.edges,
        rangeMin: params.rangeMin,
        rangeMax: params.rangeMax,
        yMin: params.yMin,
        yMax: params.yMax,
        rootNodeId: params.rootNodeId,
        options: params.options,
        steps: params.steps,
        pauseAfterFirst: params.pauseAfterFirst,
        debug: isPreviewWorkerLoggingEnabled(),
      };

      log("Posting progressive volume eval", {
        steps: params.steps,
        sessionKey: params.sessionKey,
        pauseAfterFirst: params.pauseAfterFirst,
      });
      w.postMessage(request);
    });
  }

  return { evaluate, evaluateProgressive, cancel };
}

// ── Default singleton instance ──

const defaultInstance = createVolumeWorkerInstance();

export function cancelVolumeEvaluation(): void {
  defaultInstance.cancel();
}

export function evaluateVolumeInWorker(params: VolumeEvalParams): Promise<VolumeEvalResult> {
  return defaultInstance.evaluate(params);
}

export function evaluateVolumeProgressive(
  params: VolumeProgressiveParams,
  onStep: VolumeStepHandler,
): Promise<void> {
  return defaultInstance.evaluateProgressive(params, onStep);
}
