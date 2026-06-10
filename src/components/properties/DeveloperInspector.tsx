import { useCallback, useMemo, useState } from "react";
import type { Node } from "@xyflow/react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useBridgeStore } from "@/stores/bridgeStore";
import { useToastStore } from "@/stores/toastStore";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";
import {
  buildDevSessionSnapshot,
  buildNodeHytaleRecord,
  buildNodeInternalRecord,
  buildSubgraphClipboard,
  copyTextToClipboard,
  filterExportableNodeFields,
} from "@/utils/devTools";
import { DevIconButton } from "@/components/dev/devUi";

const OPEN_KEY = "tn-dev-inspector-open";
const EMPTY_NODE_DIAGS: GraphDiagnostic[] = [];

function readDefaultOpen(): boolean {
  try {
    return localStorage.getItem(OPEN_KEY) !== "0";
  } catch {
    return true;
  }
}

export function DeveloperInspector({ node }: { node: Node }) {
  const [open, setOpen] = useState(readDefaultOpen);
  const addToast = useToastStore((s) => s.addToast);
  const edges = useEditorStore((s) => s.edges);
  const nodes = useEditorStore((s) => s.nodes);
  const nodeDiags = useDiagnosticsStore((s) => s.byNodeId.get(node.id) ?? EMPTY_NODE_DIAGS);
  const projectPath = useProjectStore((s) => s.projectPath);
  const currentFile = useProjectStore((s) => s.currentFile);
  const isDirty = useProjectStore((s) => s.isDirty);
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const previewMode = usePreviewStore((s) => s.mode);
  const previewViewMode = usePreviewStore((s) => s.viewMode);
  const previewIsLoading = usePreviewStore((s) => s.isLoading);
  const previewError = usePreviewStore((s) => s.previewError);
  const previewSelectedNodeId = usePreviewStore((s) => s.selectedPreviewNodeId);
  const bridgeConnected = useBridgeStore((s) => s.connected);
  const bridgeHost = useBridgeStore((s) => s.host);
  const bridgePort = useBridgeStore((s) => s.port);

  const incoming = useMemo(
    () => edges.filter((e) => e.target === node.id).length,
    [edges, node.id],
  );
  const outgoing = useMemo(
    () => edges.filter((e) => e.source === node.id).length,
    [edges, node.id],
  );

  const data = node.data as Record<string, unknown>;
  const fields = (data.fields as Record<string, unknown> | undefined) ?? {};
  const dataType = typeof data.type === "string" ? data.type : "—";

  const toggleOpen = useCallback(() => {
    setOpen((v) => {
      const next = !v;
      try {
        localStorage.setItem(OPEN_KEY, next ? "1" : "0");
      } catch {
        // ignore
      }
      return next;
    });
  }, []);

  const notifyCopy = useCallback(
    async (label: string, text: string) => {
      const ok = await copyTextToClipboard(text);
      addToast(ok ? `Copied ${label}` : `Could not copy ${label}`, ok ? "success" : "error");
    },
    [addToast],
  );

  return (
    <div className="rounded border border-tn-border bg-tn-bg/40 flex flex-col">
      <button
        type="button"
        onClick={toggleOpen}
        className="flex items-center gap-1.5 px-2.5 py-2 text-left w-full hover:bg-tn-surface/60 transition-colors"
      >
        {open ? (
          <ChevronDown className="h-3 w-3 text-tn-text-muted shrink-0" />
        ) : (
          <ChevronRight className="h-3 w-3 text-tn-text-muted shrink-0" />
        )}
        <span className="text-[11px] font-medium text-tn-text-muted">
          Developer
        </span>
      </button>

      {open && (
        <div className="px-2.5 pb-2.5 flex flex-col gap-2 border-t border-tn-border/60">
          <div className="text-[10px] text-tn-text-muted font-mono flex flex-col gap-0.5 pt-2">
            <div>
              <span className="text-tn-text-muted/70">rf type </span>
              {node.type ?? "—"}
            </div>
            <div>
              <span className="text-tn-text-muted/70">data.type </span>
              {dataType}
            </div>
            <div>
              <span className="text-tn-text-muted/70">wires </span>
              {incoming} in · {outgoing} out
            </div>
            {data._outputNode === true && (
              <div className="text-amber-300/90">marked as graph output (ROOT)</div>
            )}
          </div>

          {nodeDiags.length > 0 && (
            <div className="flex flex-col gap-1">
              <span className="text-[9px] uppercase tracking-wider text-tn-text-muted/70">
                Diagnostics ({nodeDiags.length})
              </span>
              <ul className="text-[10px] text-tn-text-muted flex flex-col gap-0.5 max-h-24 overflow-y-auto">
                {nodeDiags.map((d, i) => (
                  <li key={`${d.code ?? "diag"}-${i}`} className="font-mono break-words">
                    <span
                      className={
                        d.severity === "error"
                          ? "text-red-400"
                          : d.severity === "warning"
                            ? "text-amber-300"
                            : "text-sky-300"
                      }
                    >
                      [{d.code ?? d.severity}]
                    </span>{" "}
                    {d.message}
                    {d.field ? ` · ${d.field}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-1">
            <DevIconButton
              label="Fields"
              icon="copy"
              title="Copy exportable field values"
              onClick={() => {
                void notifyCopy("fields JSON", JSON.stringify(filterExportableNodeFields(fields), null, 2));
              }}
            />
            <DevIconButton
              label="Internal"
              icon="copy"
              title="Copy TerraNova internal node record"
              onClick={() => {
                void notifyCopy("internal JSON", JSON.stringify(buildNodeInternalRecord(node), null, 2));
              }}
            />
            <DevIconButton
              label="Export"
              icon="copy"
              title="Copy single-node Hytale export"
              onClick={() => {
                const hytale = buildNodeHytaleRecord(node);
                if (!hytale) {
                  addToast("Could not build Hytale JSON for this node", "error");
                  return;
                }
                void notifyCopy("Hytale JSON", JSON.stringify(hytale, null, 2));
              }}
            />
            <DevIconButton
              label="Downstream"
              icon="copy"
              title="Copy node plus downstream subgraph"
              onClick={() => {
                const clip = buildSubgraphClipboard(node.id, nodes, edges, "downstream");
                void notifyCopy("downstream subgraph", JSON.stringify(clip, null, 2));
              }}
            />
            <DevIconButton
              label="Upstream"
              icon="copy"
              title="Copy node plus upstream subgraph"
              onClick={() => {
                const clip = buildSubgraphClipboard(node.id, nodes, edges, "upstream");
                void notifyCopy("upstream subgraph", JSON.stringify(clip, null, 2));
              }}
            />
            <DevIconButton
              label="Connected"
              icon="copy"
              title="Copy connected component"
              onClick={() => {
                const clip = buildSubgraphClipboard(node.id, nodes, edges, "both");
                void notifyCopy("connected subgraph", JSON.stringify(clip, null, 2));
              }}
            />
            <DevIconButton
              label="Session"
              icon="copy"
              title="Copy project + graph + validation snapshot"
              onClick={() => {
                const snap = buildDevSessionSnapshot({
                  projectPath,
                  currentFile,
                  isDirty,
                  nodes,
                  edges,
                  selectedNodeId: node.id,
                  diagnostics,
                  preview: {
                    mode: previewMode,
                    viewMode: previewViewMode,
                    isLoading: previewIsLoading,
                    previewError,
                    selectedPreviewNodeId: previewSelectedNodeId,
                  },
                  bridge: {
                    connected: bridgeConnected,
                    host: bridgeHost,
                    port: bridgePort,
                  },
                });
                void notifyCopy("session snapshot", JSON.stringify(snap, null, 2));
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
