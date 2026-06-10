import type { Node, Edge } from "@xyflow/react";
import type { EvaluationOptions } from "../utils/densityEvaluator";

export interface VolumeWorkerRequest {
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
  /** When set, reuse eval context across requests with the same key. */
  sessionKey?: string;
  /** Forward worker-side progress to the main-thread console. */
  debug?: boolean;
}

export interface VolumeWorkerCancel {
  type: "cancel";
}

export interface VolumeWorkerResponse {
  densities: Float32Array;
  resolution: number;
  ySlices: number;
  minValue: number;
  maxValue: number;
}

export interface VolumeWorkerError {
  error: string;
}

export interface VolumeWorkerProgressiveRequest {
  type: "progressive";
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
  /** When true, worker stops after step 0 until a continue message. */
  pauseAfterFirst: boolean;
  debug?: boolean;
}

export interface VolumeWorkerContinueRequest {
  type: "continue";
  sessionKey: string;
  rangeMin: number;
  rangeMax: number;
  yMin: number;
  yMax: number;
  startStepIndex: number;
  totalSteps: number;
  steps: Array<{ resolution: number; ySlices: number }>;
  debug?: boolean;
}

export interface VolumeWorkerStepMessage {
  type: "step";
  stepIndex: number;
  totalSteps: number;
  densities: Float32Array;
  resolution: number;
  ySlices: number;
  minValue: number;
  maxValue: number;
}

export interface VolumeWorkerAwaitingMessage {
  type: "awaiting";
  sessionKey: string;
}

export interface VolumeWorkerDoneMessage {
  type: "done";
}

export interface VolumeWorkerLogMessage {
  type: "log";
  level: "log" | "warn";
  message: string;
  data?: unknown;
}

export type VolumeWorkerInbound =
  | VolumeWorkerRequest
  | VolumeWorkerCancel
  | VolumeWorkerProgressiveRequest
  | VolumeWorkerContinueRequest;

export type VolumeWorkerOutbound =
  | VolumeWorkerResponse
  | VolumeWorkerError
  | VolumeWorkerStepMessage
  | VolumeWorkerAwaitingMessage
  | VolumeWorkerDoneMessage
  | VolumeWorkerLogMessage;
