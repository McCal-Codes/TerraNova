import { useId, useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";
import {
  normalizeDiagnosticSeverity,
  summarizeDiagnosticsBySeverity,
} from "@/utils/diagnosticSummary";
import {
  DIAGNOSTIC_SEVERITY_META,
  formatSeverityAriaSummary,
} from "@/components/diagnostics/diagnosticSeverityUi";
import { useNavigateToDiagnostic } from "@/hooks/useNavigateToDiagnostic";

interface DiagnosticsStripProps {
  embedded?: boolean;
  /** Legacy hits in other pack files (shown when canvas diagnostics are empty). */
  packWideIssueCount?: number;
}

export function DiagnosticsStrip({ embedded = false, packWideIssueCount = 0 }: DiagnosticsStripProps) {
  const navigateToDiagnostic = useNavigateToDiagnostic();
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const [expanded, setExpanded] = useState(false);
  const listId = useId();

  const counts = useMemo(
    () => summarizeDiagnosticsBySeverity(diagnostics),
    [diagnostics],
  );

  const hasCanvasIssues = diagnostics.length > 0;
  const hasPackOnlyIssues = !hasCanvasIssues && packWideIssueCount > 0;
  if (!hasCanvasIssues && !hasPackOnlyIssues) return null;

  const ariaSummary = hasPackOnlyIssues
    ? `${packWideIssueCount} project-wide issue${packWideIssueCount === 1 ? "" : "s"}`
    : formatSeverityAriaSummary(counts);

  function handleDiagnosticClick(d: GraphDiagnostic) {
    if (d.nodeId || d.biomeSection) {
      navigateToDiagnostic(d);
    }
  }

  function isNavigable(d: GraphDiagnostic): boolean {
    return Boolean(d.nodeId || d.biomeSection);
  }

  const Chevron = expanded ? ChevronDown : ChevronRight;

  const summary = hasPackOnlyIssues ? (
    <span className="text-amber-300/90 whitespace-nowrap">
      {packWideIssueCount} in other file{packWideIssueCount === 1 ? "" : "s"}
    </span>
  ) : (
    <span className="flex items-center gap-1.5 whitespace-nowrap">
      {counts.error > 0 && (
        <span className={DIAGNOSTIC_SEVERITY_META.error.className}>
          {counts.error} {counts.error === 1 ? DIAGNOSTIC_SEVERITY_META.error.countLabel : DIAGNOSTIC_SEVERITY_META.error.countLabelPlural}
        </span>
      )}
      {counts.warning > 0 && (
        <span className={DIAGNOSTIC_SEVERITY_META.warning.className}>
          {counts.warning} {counts.warning === 1 ? DIAGNOSTIC_SEVERITY_META.warning.countLabel : DIAGNOSTIC_SEVERITY_META.warning.countLabelPlural}
        </span>
      )}
      {counts.info > 0 && (
        <span className={DIAGNOSTIC_SEVERITY_META.info.className}>
          {counts.info} {DIAGNOSTIC_SEVERITY_META.info.countLabel}
        </span>
      )}
    </span>
  );

  const toggleButton = (
    <button
      type="button"
      onClick={() => setExpanded(!expanded)}
      aria-expanded={expanded}
      aria-controls={hasCanvasIssues ? listId : undefined}
      aria-label={`${expanded ? "Hide" : "Show"} issues: ${ariaSummary}`}
      className={
        embedded
          ? "flex h-7 items-center gap-1.5 px-2.5 text-[11px] text-tn-text-muted transition-colors hover:bg-tn-surface/40 hover:text-tn-text"
          : "flex w-full items-center gap-2 px-3 py-1.5 text-[11px] text-tn-text-muted transition-colors hover:bg-tn-surface/40 hover:text-tn-text"
      }
    >
      <Chevron className={`${embedded ? "h-3 w-3" : "h-3.5 w-3.5"} shrink-0 opacity-70`} aria-hidden />
      {summary}
    </button>
  );

  const listItems = diagnostics.map((d, i) => {
    const meta = DIAGNOSTIC_SEVERITY_META[normalizeDiagnosticSeverity(d.severity)];
    const Icon = meta.Icon;
    const navigable = isNavigable(d);
    return (
      <button
        key={`${d.code ?? "issue"}-${i}`}
        type="button"
        onClick={() => handleDiagnosticClick(d)}
        disabled={!navigable}
        className={`flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left text-[11px] ${
          navigable ? "cursor-pointer hover:bg-tn-surface/60" : "cursor-default opacity-90"
        }`}
      >
        <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${meta.className}`} aria-hidden />
        <span className="text-tn-text-muted leading-snug">{d.message}</span>
      </button>
    );
  });

  if (embedded) {
    return (
      <div className="relative shrink-0 border-l border-tn-border/60 bg-amber-950/15">
        {toggleButton}
        {expanded && hasCanvasIssues && (
          <div
            id={listId}
            className="absolute right-0 top-full z-40 w-80 max-w-[calc(100vw-2rem)] border border-tn-border bg-tn-panel shadow-lg"
          >
            <div className="max-h-40 overflow-y-auto px-2 py-1.5">{listItems}</div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="shrink-0 border-b border-tn-border bg-amber-950/15">
      {toggleButton}
      {expanded && hasCanvasIssues && (
        <div id={listId} className="max-h-32 overflow-y-auto border-t border-tn-border/50 px-2 pb-2 pt-1">
          {listItems}
        </div>
      )}
    </div>
  );
}
