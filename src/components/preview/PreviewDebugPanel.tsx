import { useCallback, useEffect, useState } from "react";
import { useSettingsStore } from "@/stores/settingsStore";
import { useToastStore } from "@/stores/toastStore";
import { copyTextToClipboard } from "@/utils/devTools";
import {
  buildPreviewPipelineSnapshot,
  type PreviewPipelineSnapshot,
} from "@/utils/previewPipelineSnapshot";
import { DevCheckbox, DevStatusChip } from "@/components/dev/devUi";

function StatusRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-[10px] font-mono">
      <span className="text-tn-text-muted shrink-0">{label}</span>
      <span className="text-tn-text truncate text-right" title={value}>{value}</span>
    </div>
  );
}

function snapshotSummary(snap: PreviewPipelineSnapshot): string[] {
  const lines: string[] = [];
  lines.push(`${snap.preview.mode} · ${snap.preview.viewMode} · Y=${snap.preview.yLevel}`);
  if (snap.preview.densityEvalKey) lines.push(`density key: ${snap.preview.densityEvalKey}`);
  if (snap.preview.voxelEvalKey) lines.push(`voxel key: ${snap.preview.voxelEvalKey}`);
  if (snap.imports.requested.length > 0) {
    lines.push(`imports: ${snap.imports.resolved.length}/${snap.imports.requested.length} resolved`);
    if (snap.imports.missing.length > 0) {
      lines.push(`missing: ${snap.imports.missing.join(", ")}`);
    }
  }
  if (snap.metrics.density) {
    lines.push(`2D ${snap.metrics.density.durationMs.toFixed(0)}ms (${snap.metrics.density.lane})`);
  }
  if (snap.metrics.voxel) {
    lines.push(`voxel ${snap.metrics.voxel.durationMs.toFixed(0)}ms${snap.metrics.voxel.detail ? ` ${snap.metrics.voxel.detail}` : ""}`);
  }
  if (snap.metrics.world) {
    lines.push(`world ${snap.metrics.world.durationMs.toFixed(0)}ms${snap.metrics.world.detail ? ` ${snap.metrics.world.detail}` : ""}`);
  }
  return lines;
}

export function PreviewDebugPanel() {
  const [snap, setSnap] = useState(() => buildPreviewPipelineSnapshot());
  const [live, setLive] = useState(true);
  const debugWorkerLogging = useSettingsStore((s) => s.debugWorkerLogging);
  const setDebugWorkerLogging = useSettingsStore((s) => s.setDebugWorkerLogging);
  const addToast = useToastStore((s) => s.addToast);

  const refresh = useCallback(() => {
    setSnap(buildPreviewPipelineSnapshot());
  }, []);

  useEffect(() => {
    if (!live) return;
    refresh();
    const id = window.setInterval(refresh, 500);
    return () => window.clearInterval(id);
  }, [live, refresh]);

  const copyJson = useCallback(() => {
    const json = JSON.stringify(snap, null, 2);
    void copyTextToClipboard(json).then((ok) => {
      addToast(ok ? "Copied preview pipeline snapshot" : "Copy failed", ok ? "success" : "error");
    });
  }, [snap, addToast]);

  const { preview, imports, metrics, layout } = snap;

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex flex-wrap items-center gap-2 px-2 py-1.5 border-b border-tn-border/60 bg-tn-bg/30">
        <button
          type="button"
          onClick={refresh}
          className="text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/10"
        >
          Refresh
        </button>
        <button
          type="button"
          onClick={copyJson}
          className="text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/10"
        >
          Copy JSON
        </button>
        <DevCheckbox label="Live" checked={live} onChange={setLive} />
        <DevCheckbox
          label="Verbose workers"
          checked={debugWorkerLogging}
          onChange={setDebugWorkerLogging}
        />
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-2 py-2 flex flex-col gap-3">
        <section className="flex flex-col gap-1">
          <p className="text-[10px] font-medium text-tn-text-muted uppercase tracking-wide">Eval</p>
          <StatusRow label="mode" value={`${preview.mode} / ${preview.viewMode}`} />
          <StatusRow label="range" value={`${preview.rangeMin}…${preview.rangeMax}`} />
          <StatusRow label="grid" value={`${preview.evalResolution}² @ ${preview.canvasScale.toFixed(2)}×`} />
          <StatusRow label="loading" value={`2D=${preview.isLoading} voxel=${preview.isVoxelLoading}`} />
          {(preview.previewError || preview.voxelError) && (
            <p className="text-[10px] text-red-400 whitespace-pre-wrap">
              {preview.previewError ?? preview.voxelError}
            </p>
          )}
          {metrics.density && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-tn-text-muted">2D</span>
              <span>{metrics.density.durationMs.toFixed(0)} ms</span>
              <DevStatusChip tone={metrics.density.lane === "worker" ? "ok" : "warn"}>
                {metrics.density.lane}
              </DevStatusChip>
            </div>
          )}
          {metrics.voxel && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-tn-text-muted">voxel</span>
              <span>{metrics.voxel.durationMs.toFixed(0)} ms</span>
              {metrics.voxel.detail && (
                <span className="text-tn-text-muted/70">{metrics.voxel.detail}</span>
              )}
              {metrics.voxel.lane && (
                <DevStatusChip tone={metrics.voxel.lane === "worker" ? "ok" : "warn"}>
                  {metrics.voxel.lane}
                </DevStatusChip>
              )}
            </div>
          )}
          {metrics.world && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono">
              <span className="text-tn-text-muted">world</span>
              <span>{metrics.world.durationMs.toFixed(0)} ms</span>
              {metrics.world.detail && (
                <span className="text-tn-text-muted/70 truncate" title={metrics.world.detail}>
                  {metrics.world.detail}
                </span>
              )}
            </div>
          )}
          {metrics.voxelEval && (
            <div className="flex items-center gap-1.5 text-[10px] font-mono text-tn-text-muted/80">
              <span>eval step</span>
              <span>{metrics.voxelEval.durationMs.toFixed(0)} ms</span>
              {metrics.voxelEval.lane && <span>({metrics.voxelEval.lane})</span>}
            </div>
          )}
        </section>

        <section className="flex flex-col gap-1">
          <p className="text-[10px] font-medium text-tn-text-muted uppercase tracking-wide">Cache keys</p>
          <StatusRow label="density" value={preview.densityEvalKey ?? "—"} />
          <StatusRow label="voxel" value={preview.voxelEvalKey ?? "—"} />
        </section>

        {imports.requested.length > 0 && (
          <section className="flex flex-col gap-1">
            <p className="text-[10px] font-medium text-tn-text-muted uppercase tracking-wide">Density imports</p>
            {imports.resolved.map((name) => (
              <div key={name} className="text-[10px] font-mono text-emerald-400/90">✓ {name}</div>
            ))}
            {imports.missing.map((name) => (
              <div key={name} className="text-[10px] font-mono text-amber-400/90">✗ {name} (sync hytale-assets?)</div>
            ))}
          </section>
        )}

        <section className="flex flex-col gap-1">
          <p className="text-[10px] font-medium text-tn-text-muted uppercase tracking-wide">Layout</p>
          <StatusRow
            label="properties"
            value={layout.inspectingNode ? "open + node selected" : layout.rightPanelMode}
          />
          <StatusRow label="2D zoom" value={`${preview.canvasTransform.scale.toFixed(2)}×`} />
        </section>

        <section className="rounded border border-tn-border/50 bg-tn-bg/40 px-2 py-1.5">
          <p className="text-[9px] text-tn-text-muted mb-1">Summary</p>
          {snapshotSummary(snap).map((line) => (
            <p key={line} className="text-[10px] font-mono text-tn-text-muted leading-relaxed">{line}</p>
          ))}
        </section>
      </div>
    </div>
  );
}
