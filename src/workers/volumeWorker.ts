import type { Node, Edge } from "@xyflow/react";
import { createEvaluationContext, type EvaluationContext, type EvaluationOptions } from "../utils/densityEvaluator";
import { evaluateDensityGrid3D } from "../utils/volumeEvaluationCore";
import type { VolumeWorkerRequest } from "./volumeWorkerTypes";

export type {
  VolumeWorkerRequest,
  VolumeWorkerCancel,
  VolumeWorkerResponse,
  VolumeWorkerError,
  VolumeWorkerProgressiveRequest,
  VolumeWorkerContinueRequest,
  VolumeWorkerStepMessage,
  VolumeWorkerDoneMessage,
  VolumeWorkerInbound,
} from "./volumeWorkerTypes";

let cancelled = false;
let debugLogging = false;

function wlog(message: string, data?: unknown): void {
  if (!debugLogging) return;
  (self as unknown as Worker).postMessage({
    type: "log",
    level: "log",
    message,
    ...(data !== undefined ? { data } : {}),
  } satisfies { type: "log"; level: "log"; message: string; data?: unknown });
}

interface CachedSession {
  sessionKey: string;
  ctx: EvaluationContext;
}

let cachedSession: CachedSession | null = null;

function boundsFromRequest(req: {
  rangeMin: number;
  rangeMax: number;
  yMin: number;
  yMax: number;
}) {
  return {
    rangeMin: req.rangeMin,
    rangeMax: req.rangeMax,
    yMin: req.yMin,
    yMax: req.yMax,
  };
}

function getOrCreateSession(
  sessionKey: string,
  nodes: Node[],
  edges: Edge[],
  rootNodeId: string | undefined,
  options: EvaluationOptions | undefined,
): EvaluationContext | null {
  if (cachedSession?.sessionKey === sessionKey) {
    return cachedSession.ctx;
  }
  const ctx = createEvaluationContext(nodes, edges, rootNodeId, options);
  if (!ctx) {
    cachedSession = null;
    return null;
  }
  cachedSession = { sessionKey, ctx };
  return ctx;
}

function postStep(
  stepIndex: number,
  totalSteps: number,
  result: ReturnType<typeof evaluateDensityGrid3D>,
) {
  wlog(`step ${stepIndex + 1}/${totalSteps} complete`, {
    resolution: result.resolution,
    ySlices: result.ySlices,
    minValue: result.minValue,
    maxValue: result.maxValue,
    cells: result.densities.length,
  });
  (self as unknown as Worker).postMessage(
    {
      type: "step",
      stepIndex,
      totalSteps,
      densities: result.densities,
      resolution: result.resolution,
      ySlices: result.ySlices,
      minValue: result.minValue,
      maxValue: result.maxValue,
    },
    [result.densities.buffer],
  );
}

function runSteps(
  ctx: EvaluationContext,
  bounds: ReturnType<typeof boundsFromRequest>,
  steps: Array<{ resolution: number; ySlices: number }>,
  startIndex: number,
  totalSteps: number,
) {
  for (let i = 0; i < steps.length; i++) {
    if (cancelled) return;
    const step = steps[i];
    wlog(`evaluating step ${startIndex + i + 1}/${totalSteps}`, step);
    const result = evaluateDensityGrid3D(
      ctx,
      { ...bounds, resolution: step.resolution, ySlices: step.ySlices },
      () => cancelled,
    );
    if (cancelled) return;
    postStep(startIndex + i, totalSteps, result);
  }
  if (!cancelled) {
    wlog("progressive run finished");
    (self as unknown as Worker).postMessage({ type: "done" } satisfies { type: "done" });
  }
}

function runSingle(req: VolumeWorkerRequest) {
  wlog("single eval", {
    resolution: req.resolution,
    ySlices: req.ySlices,
    nodes: req.nodes.length,
    sessionKey: req.sessionKey ?? "single",
  });
  const sessionKey = req.sessionKey ?? "single";
  const ctx = getOrCreateSession(
    sessionKey,
    req.nodes,
    req.edges,
    req.rootNodeId,
    req.options,
  );
  if (!ctx) {
    (self as unknown as Worker).postMessage({ error: "Failed to create evaluation context" });
    return;
  }

  const result = evaluateDensityGrid3D(
    ctx,
    {
      ...boundsFromRequest(req),
      resolution: req.resolution,
      ySlices: req.ySlices,
    },
    () => cancelled,
  );

  if (cancelled) return;

  wlog("single eval complete", {
    resolution: result.resolution,
    ySlices: result.ySlices,
    minValue: result.minValue,
    maxValue: result.maxValue,
  });

  (self as unknown as Worker).postMessage(
    {
      densities: result.densities,
      resolution: result.resolution,
      ySlices: result.ySlices,
      minValue: result.minValue,
      maxValue: result.maxValue,
    },
    [result.densities.buffer],
  );
}

self.onmessage = (e: MessageEvent<import("./volumeWorkerTypes").VolumeWorkerInbound>) => {
  const data = e.data;

  if ("type" in data && data.type === "cancel") {
    wlog("cancel received");
    cancelled = true;
    return;
  }

  cancelled = false;
  debugLogging = Boolean(
    ("debug" in data && data.debug)
    || (!("type" in data) && (data as VolumeWorkerRequest).debug),
  );

  try {
    if ("type" in data && data.type === "continue") {
      wlog("continue", {
        sessionKey: data.sessionKey,
        startStepIndex: data.startStepIndex,
        steps: data.steps.length,
      });
      const ctx = cachedSession?.sessionKey === data.sessionKey ? cachedSession.ctx : null;
      if (!ctx) {
        (self as unknown as Worker).postMessage({ error: "Volume session expired — restart evaluation" });
        return;
      }
      runSteps(ctx, boundsFromRequest(data), data.steps, data.startStepIndex, data.totalSteps);
      return;
    }

    if ("type" in data && data.type === "progressive") {
      wlog("progressive start", {
        sessionKey: data.sessionKey,
        steps: data.steps,
        pauseAfterFirst: data.pauseAfterFirst,
        nodes: data.nodes.length,
      });
      const ctx = getOrCreateSession(
        data.sessionKey,
        data.nodes,
        data.edges,
        data.rootNodeId,
        data.options,
      );
      if (!ctx) {
        (self as unknown as Worker).postMessage({ error: "Failed to create evaluation context" });
        return;
      }

      const bounds = boundsFromRequest(data);
      if (data.steps.length === 0) {
        (self as unknown as Worker).postMessage({ type: "done" });
        return;
      }

      const first = data.steps[0];
      wlog("evaluating step 1/" + data.steps.length, first);
      const firstResult = evaluateDensityGrid3D(
        ctx,
        { ...bounds, resolution: first.resolution, ySlices: first.ySlices },
        () => cancelled,
      );
      if (cancelled) return;

      postStep(0, data.steps.length, firstResult);

      if (data.steps.length === 1) {
        if (!cancelled) (self as unknown as Worker).postMessage({ type: "done" });
        return;
      }

      if (data.pauseAfterFirst) {
        wlog("paused after first step, awaiting continue");
        (self as unknown as Worker).postMessage({ type: "awaiting", sessionKey: data.sessionKey });
        return;
      }

      runSteps(ctx, bounds, data.steps.slice(1), 1, data.steps.length);
      return;
    }

    runSingle(data as VolumeWorkerRequest);
  } catch (err) {
    if (cancelled || (err instanceof Error && err.message === "cancelled")) return;
    (self as unknown as Worker).postMessage({
      error: err instanceof Error ? err.message : String(err),
    });
  }
};
