import { useCallback, useEffect, useRef, useState } from "react";
import { useEditorStore } from "@/stores/editorStore";
import { buildExportPreviewSnapshot } from "@/utils/buildExportPreview";
import { summarizeJsonDiff, type JsonDiffSummary } from "@/utils/jsonDiffSummary";
import { copyTextToClipboard } from "@/utils/devTools";
import { useToastStore } from "@/stores/toastStore";
import type { ExportPreviewSnapshot } from "@/utils/buildExportPreview";
import { DevCodeBlock, DevIconButton, DevStatusChip, DevToolbar } from "./devUi";

const REFRESH_MS = 500;

function computeDiffViewState(): {
  snapshot: ExportPreviewSnapshot;
  diff: JsonDiffSummary;
  internalJson: string;
  hytaleJson: string;
} {
  const editor = useEditorStore.getState();
  const snapshot = buildExportPreviewSnapshot({
    nodes: editor.nodes,
    edges: editor.edges,
    editingContext: editor.editingContext,
    outputNodeId: editor.outputNodeId,
    originalWrapper: editor.originalWrapper,
    rawJsonContent: editor.rawJsonContent,
    preservedNodeEditorMetadata: editor.preservedNodeEditorMetadata,
  });
  const diff = summarizeJsonDiff(snapshot.internal, snapshot.hytale);
  return {
    snapshot,
    diff,
    internalJson: snapshot.internal ? JSON.stringify(snapshot.internal, null, 2) : "",
    hytaleJson: snapshot.hytale ? JSON.stringify(snapshot.hytale, null, 2) : "",
  };
}

export function ExportDiffView() {
  const [{ snapshot, diff, internalJson, hytaleJson }, setViewState] = useState(computeDiffViewState);
  const addToast = useToastStore((s) => s.addToast);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refresh = useCallback(() => {
    setViewState(computeDiffViewState());
  }, []);

  useEffect(() => {
    refresh();
    const schedule = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(refresh, REFRESH_MS);
    };
    const unsub = useEditorStore.subscribe(schedule);
    return () => {
      unsub();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [refresh]);

  function copySide(side: "internal" | "hytale") {
    const text = side === "internal" ? internalJson : hytaleJson;
    if (!text) {
      addToast("Nothing to copy for this side", "warning");
      return;
    }
    void copyTextToClipboard(text).then((ok) => {
      addToast(ok ? `Copied ${side === "internal" ? "editor" : "export"} JSON` : "Copy failed", ok ? "success" : "error");
    });
  }

  const hasOutput = Boolean(snapshot.internal || snapshot.hytale);

  return (
    <div className="flex flex-col h-full min-h-0">
      <DevToolbar trailing={<DevIconButton label="Refresh" icon="refresh" onClick={refresh} />}>
        <DevStatusChip tone={diff.equal ? "ok" : "warn"}>
          {diff.equal ? "Match" : "Different"}
        </DevStatusChip>
        {hasOutput && (
          <span className="text-[10px] text-tn-text-muted">
            {diff.internalKeys} editor keys · {diff.hytaleKeys} export keys
          </span>
        )}
      </DevToolbar>

      {snapshot.note && (
        <p className="shrink-0 px-3 py-1.5 text-[11px] text-tn-text-muted border-b border-tn-border/50 bg-tn-bg/20">
          {snapshot.note}
        </p>
      )}

      {!hasOutput ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-1 p-6 text-center">
          <p className="text-sm text-tn-text-muted">No export preview for this file</p>
          <p className="text-[11px] text-tn-text-muted/80 max-w-sm">
            Open a density or biome graph with an output node, or use Refresh after editing.
          </p>
        </div>
      ) : (
        <div className="flex-1 min-h-0 grid grid-cols-2 gap-px bg-tn-border/60">
          <div className="flex flex-col min-h-0 bg-tn-panel/50">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-tn-border/60 shrink-0">
              <span className="text-[11px] font-medium text-tn-text-muted">Editor JSON</span>
              <DevIconButton label="Copy" icon="copy" onClick={() => copySide("internal")} />
            </div>
            <DevCodeBlock empty="No editor JSON">{internalJson}</DevCodeBlock>
          </div>
          <div className="flex flex-col min-h-0 bg-tn-panel/50">
            <div className="flex items-center justify-between px-3 py-1.5 border-b border-tn-border/60 shrink-0">
              <span className="text-[11px] font-medium text-tn-text-muted">Hytale export</span>
              <DevIconButton label="Copy" icon="copy" onClick={() => copySide("hytale")} />
            </div>
            <DevCodeBlock empty="No export JSON">{hytaleJson}</DevCodeBlock>
          </div>
        </div>
      )}
    </div>
  );
}
