import { useState } from "react";
import { useBridgeStore } from "@/stores/bridgeStore";
import { useProjectStore } from "@/stores/projectStore";
import { bridgeDebugSnapshot, type BridgeDebugSnapshot } from "@/utils/ipc";
import { livePlayerPositionSourceLabel } from "@/utils/livePlayerTracking";
import { resolveBridgeDiscoveryHints } from "@/utils/resolveBridgeSaveContext";

function formatAge(secs?: number): string {
  if (secs == null) return "—";
  if (secs < 60) return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function BridgeDebugPanel() {
  const host = useBridgeStore((s) => s.host);
  const port = useBridgeStore((s) => s.port);
  const serverModPath = useBridgeStore((s) => s.serverModPath);
  const projectPath = useProjectStore((s) => s.projectPath);
  const [snapshot, setSnapshot] = useState<BridgeDebugSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  async function runSnapshot() {
    setLoading(true);
    setError(null);
    try {
      const hints = resolveBridgeDiscoveryHints(serverModPath, projectPath);
      const snap = await bridgeDebugSnapshot({
        saveName: hints.saveName,
        saveRoot: hints.saveRoot,
        modPackPath: hints.modPackPath ?? serverModPath,
        host,
        port,
      });
      setSnapshot(snap);
      setOpen(true);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }

  function copyJson() {
    if (!snapshot) return;
    void navigator.clipboard.writeText(JSON.stringify(snapshot, null, 2));
  }

  function copyPendingCommands() {
    if (!snapshot?.pendingCommandLines.length) return;
    void navigator.clipboard.writeText(snapshot.pendingCommandLines.join("\n"));
  }

  return (
    <div className="rounded border border-tn-border/80 bg-tn-bg/50 px-2.5 py-2 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className="text-xs font-medium text-tn-text hover:text-tn-accent text-left"
          onClick={() => setOpen((v) => !v)}
        >
          Bridge diagnostics {open ? "▾" : "▸"}
        </button>
        <div className="flex gap-1.5">
          <button
            type="button"
            disabled={loading}
            onClick={() => void runSnapshot()}
            className="text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/15 disabled:opacity-50"
          >
            {loading ? "Running…" : "Run snapshot"}
          </button>
          {snapshot && (
            <>
              {snapshot.pendingCommandLines.length > 0 && (
                <button
                  type="button"
                  onClick={copyPendingCommands}
                  className="text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/15"
                >
                  Copy commands
                </button>
              )}
              <button
                type="button"
                onClick={copyJson}
                className="text-[10px] px-2 py-0.5 rounded border border-tn-border hover:bg-tn-accent/15"
              >
                Copy JSON
              </button>
            </>
          )}
        </div>
      </div>
      {error && <p className="text-[10px] text-red-400">{error}</p>}
      {open && snapshot && (
        <div className="text-[10px] text-tn-text-muted font-mono flex flex-col gap-1 max-h-48 overflow-y-auto">
          <div>save: {snapshot.saveExists ? "ok" : "missing"} · {snapshot.saveRoot}</div>
          <div>
            session: {snapshot.sessionActive ? "active" : "idle"} · live signals:{" "}
            {snapshot.preferLiveSignals ? "on" : "off"}
          </div>
          <div>
            log: {snapshot.logWorldStack ?? "—"} · age {formatAge(snapshot.serverLogAgeSecs)}
          </div>
          <div>
            player file age {formatAge(snapshot.playerFileAgeSecs)} · world{" "}
            {snapshot.resolvedWorldLabel ?? "—"} ({snapshot.resolvedWorldSource ?? "—"})
          </div>
          <div>
            position{" "}
            {snapshot.resolvedX != null
              ? `${Math.floor(snapshot.resolvedX)}, ${Math.floor(snapshot.resolvedY ?? 0)}, ${Math.floor(snapshot.resolvedZ ?? 0)}`
              : "—"}{" "}
            · {livePlayerPositionSourceLabel(snapshot.resolvedPositionSource)}
            {snapshot.playerChunkOnDisk != null &&
              ` · chunk on disk: ${snapshot.playerChunkOnDisk ? "yes" : "no"}`}
          </div>
          {snapshot.saveRootMismatch && snapshot.sidecarSaveRoot && (
            <div className="text-amber-400">
              Sidecar save: {snapshot.sidecarSaveRoot}
            </div>
          )}
          {snapshot.warnings.map((w) => (
            <div key={w} className="text-amber-400/90">
              ⚠ {w}
            </div>
          ))}
          {snapshot.pendingCommandLines.length > 0 && (
            <div className="text-tn-text-muted/80 pt-1 border-t border-tn-border/50">
              pending-commands.log (auto-run when TerraNova.Bridge JVM plugin is installed):
              {snapshot.pendingCommandLines.map((line) => (
                <div key={line} className="truncate">
                  {line}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      {open && !snapshot && !loading && !error && (
        <p className="text-[10px] text-tn-text-muted">Run snapshot to inspect save, log, and player resolution.</p>
      )}
    </div>
  );
}
