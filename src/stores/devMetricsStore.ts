import { create } from "zustand";

export type EvalLane = "worker" | "main-thread";
export type EvalKind = "density" | "voxelEval" | "voxel" | "world";

export interface EvalMetricRecord {
  kind: EvalKind;
  lane?: EvalLane;
  durationMs: number;
  resolution?: number;
  /** Extra context (chunk count, y-slices, data source). */
  detail?: string;
  fallbackReason?: string;
  at: number;
}

type MetricKey = "density" | "voxelEval" | "voxel" | "world";

function metricKey(kind: EvalKind): MetricKey {
  return kind;
}

interface DevMetricsState {
  density: EvalMetricRecord | null;
  /** Voxel density worker step only (sub-timing). */
  voxelEval: EvalMetricRecord | null;
  /** End-to-end voxel preview (eval + mesh). */
  voxel: EvalMetricRecord | null;
  world: EvalMetricRecord | null;
  showPerformanceOverlay: boolean;
  reportEval: (record: EvalMetricRecord) => void;
  setShowPerformanceOverlay: (value: boolean) => void;
}

export const useDevMetricsStore = create<DevMetricsState>((set) => ({
  density: null,
  voxelEval: null,
  voxel: null,
  world: null,
  showPerformanceOverlay: true,
  reportEval: (record) => {
    set((state) => {
      const key = metricKey(record.kind);
      const prev = state[key];
      if (
        prev
        && prev.lane === record.lane
        && prev.durationMs === record.durationMs
        && prev.resolution === record.resolution
        && prev.detail === record.detail
        && prev.fallbackReason === record.fallbackReason
      ) {
        return state;
      }
      return { [key]: record };
    });
  },
  setShowPerformanceOverlay: (value) => set({ showPerformanceOverlay: value }),
}));
