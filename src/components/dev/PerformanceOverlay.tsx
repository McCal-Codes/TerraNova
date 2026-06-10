import { X, GripVertical } from "lucide-react";
import { usePreviewStore } from "@/stores/previewStore";
import { useDevMetricsStore, type EvalMetricRecord } from "@/stores/devMetricsStore";
import { useDeveloperMode } from "@/hooks/useDeveloperMode";
import { usePreviewElapsedMs } from "@/hooks/usePreviewElapsedMs";
import { useDraggableHudPosition } from "@/hooks/useDraggableHudPosition";
import { hudAbsoluteStyle } from "@/utils/hudPositionStyle";
import { DevStatusChip } from "./devUi";
import {
  previewHudPanelClass,
  previewHudPanelHeaderClass,
} from "@/components/preview/previewChromeStyles";

function MetricRow({
  label,
  record,
  liveMs,
  showLane = true,
}: {
  label: string;
  record: EvalMetricRecord | null;
  liveMs: number | null;
  showLane?: boolean;
}) {
  const loading = liveMs != null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
      <span className="text-tn-text-muted">{label}</span>
      {loading ? (
        <span className="text-tn-accent tabular-nums min-w-[4.5rem] text-right">
          {liveMs.toFixed(0)} ms…
        </span>
      ) : record ? (
        <>
          <span className="text-tn-text tabular-nums min-w-[4.5rem] text-right">
            {record.durationMs.toFixed(0)} ms
          </span>
          {record.resolution != null && (
            <span className="text-tn-text-muted/70">{record.resolution}³</span>
          )}
          {record.detail && (
            <span className="text-tn-text-muted/70 truncate max-w-[88px]" title={record.detail}>
              {record.detail}
            </span>
          )}
          {showLane && record.lane && (
            <DevStatusChip tone={record.lane === "worker" ? "ok" : "warn"}>
              {record.lane === "worker" ? "worker" : "main thread"}
            </DevStatusChip>
          )}
        </>
      ) : (
        <span className="text-tn-text-muted/70">—</span>
      )}
    </div>
  );
}

export function PerformanceOverlay() {
  const devActive = useDeveloperMode();
  const show = useDevMetricsStore((s) => s.showPerformanceOverlay);
  const density = useDevMetricsStore((s) => s.density);
  const voxel = useDevMetricsStore((s) => s.voxel);
  const world = useDevMetricsStore((s) => s.world);
  const setShow = useDevMetricsStore((s) => s.setShowPerformanceOverlay);

  const mode = usePreviewStore((s) => s.mode);
  const show3DVolumeView = usePreviewStore((s) => s.show3DVolumeView);
  const isLoading = usePreviewStore((s) => s.isLoading);
  const isVoxelLoading = usePreviewStore((s) => s.isVoxelLoading);
  const isWorldLoading = usePreviewStore((s) => s.isWorldLoading);
  const voxelMeshData = usePreviewStore((s) => s.voxelMeshData);

  const voxelLike = mode === "voxel" || (mode === "3d" && show3DVolumeView);

  const loadingActive = mode === "world"
    ? isWorldLoading
    : voxelLike
      ? isVoxelLoading && !voxelMeshData
      : isLoading;

  const elapsed = usePreviewElapsedMs(loadingActive);

  const defaultTop = mode === "voxel" ? 48 : 8;
  const {
    position,
    onDragMouseDown,
    resetPosition,
  } = useDraggableHudPosition("tn-previewTimingOverlayPos", { x: 0, y: 0 });

  if (!devActive || !show) return null;

  return (
    <div
      className="absolute z-20 pointer-events-auto max-w-[240px]"
      style={hudAbsoluteStyle(position, { x: "right", y: "top" }, { right: 8, top: defaultTop })}
    >
      <div className={`overflow-hidden ${previewHudPanelClass}`}>
        <div
          className={`${previewHudPanelHeaderClass} cursor-grab active:cursor-grabbing`}
          onMouseDown={onDragMouseDown}
        >
          <GripVertical className="w-3 h-3 text-tn-text-muted/60 shrink-0" aria-hidden />
          <span className="text-[10px] font-medium text-tn-text-muted flex-1">Preview timing</span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              resetPosition();
            }}
            className="p-0.5 rounded text-tn-text-muted hover:text-tn-text hover:bg-tn-surface transition-colors text-[9px]"
            title="Reset position"
          >
            ↺
          </button>
          <button
            type="button"
            onClick={() => setShow(false)}
            className="p-0.5 rounded text-tn-text-muted hover:text-tn-text hover:bg-tn-surface transition-colors"
            title="Hide (Settings → Developer)"
            aria-label="Hide preview timing overlay"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
        <div className="px-2 py-1.5 flex flex-col gap-1">
          {(mode === "2d" || mode === "3d") && (
            <MetricRow label="2D" record={density} liveMs={mode === "2d" ? elapsed : null} />
          )}
          {voxelLike && (
            <MetricRow label="Voxel" record={voxel} liveMs={elapsed} />
          )}
          {mode === "world" && (
            <MetricRow label="World" record={world} liveMs={elapsed} showLane={false} />
          )}
          {!loadingActive && mode === "2d" && !density && (
            <p className="text-[10px] text-tn-text-muted">Waiting for preview eval…</p>
          )}
          <p className="text-[9px] text-tn-text-muted/80 leading-snug pt-0.5">
            Drag header to move. Dev Tools → Preview for pipeline snapshot.
          </p>
        </div>
      </div>
    </div>
  );
}
