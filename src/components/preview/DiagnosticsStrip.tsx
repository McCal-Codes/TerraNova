import { useState } from "react";
import { AlertCircle, AlertTriangle, ChevronDown, ChevronRight, Info } from "lucide-react";
import { useEditorStore } from "@/stores/editorStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";

const SEVERITY_META = {
  error: { className: "text-red-400", Icon: AlertCircle },
  warning: { className: "text-amber-400", Icon: AlertTriangle },
  info: { className: "text-sky-400", Icon: Info },
} as const;

export function DiagnosticsStrip({ embedded = false }: { embedded?: boolean }) {
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const [expanded, setExpanded] = useState(false);

  if (diagnostics.length === 0) return null;

  const counts = diagnostics.reduce(
    (acc, d) => {
      acc[d.severity] = (acc[d.severity] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  function handleDiagnosticClick(d: GraphDiagnostic) {
    if (d.nodeId) {
      setSelectedNodeId(d.nodeId);
    }
  }

  const Chevron = expanded ? ChevronDown : ChevronRight;

  const summary = (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {counts.error ? (
        <span className="text-red-400">{counts.error} error{counts.error > 1 ? "s" : ""}</span>
      ) : null}
      {counts.warning ? (
        <span className="text-amber-400">{counts.warning} warn{counts.warning > 1 ? "s" : ""}</span>
      ) : null}
      {counts.info ? (
        <span className="text-sky-400/90">{counts.info} info</span>
      ) : null}
    </span>
  );

  if (embedded) {
    return (
      <div className="relative shrink-0 border-l border-tn-border/60 bg-amber-950/15">
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex h-7 items-center gap-1.5 px-2.5 text-[10px] text-tn-text-muted transition-colors hover:bg-tn-surface/40 hover:text-tn-text"
        >
          <Chevron className="h-3 w-3 shrink-0 opacity-70" aria-hidden />
          {summary}
        </button>
        {expanded && (
          <div className="absolute right-0 top-full z-40 w-80 max-w-[calc(100vw-2rem)] border border-tn-border bg-tn-panel shadow-lg">
            <div className="max-h-40 overflow-y-auto px-2 py-1.5">
              {diagnostics.map((d, i) => {
                const meta = SEVERITY_META[d.severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.info;
                const Icon = meta.Icon;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => handleDiagnosticClick(d)}
                    className={`flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-[10px] hover:bg-tn-surface/60 ${
                      d.nodeId ? "cursor-pointer" : "cursor-default"
                    }`}
                  >
                    <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${meta.className}`} aria-hidden />
                    <span className="text-tn-text-muted leading-snug">{d.message}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-tn-border bg-amber-950/15">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-tn-text-muted transition-colors hover:bg-tn-surface/40 hover:text-tn-text"
      >
        <Chevron className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
        {summary}
      </button>

      {expanded && (
        <div className="max-h-32 overflow-y-auto border-t border-tn-border/50 px-2 pb-2 pt-1">
          {diagnostics.map((d, i) => {
            const meta = SEVERITY_META[d.severity as keyof typeof SEVERITY_META] ?? SEVERITY_META.info;
            const Icon = meta.Icon;
            return (
              <button
                key={i}
                type="button"
                onClick={() => handleDiagnosticClick(d)}
                className={`flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-[10px] hover:bg-tn-surface/60 ${
                  d.nodeId ? "cursor-pointer" : "cursor-default"
                }`}
              >
                <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${meta.className}`} aria-hidden />
                <span className="text-tn-text-muted leading-snug">{d.message}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
