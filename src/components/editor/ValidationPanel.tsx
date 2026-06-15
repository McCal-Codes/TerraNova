import type { KeyboardEvent } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Copy, Search, X } from "lucide-react";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useNavigateToDiagnostic } from "@/hooks/useNavigateToDiagnostic";
import { copyTextToClipboard } from "@/utils/devTools";
import { formatIssuesForClipboard } from "@/utils/issuesClipboard";
import type { GraphDiagnostic, DiagnosticSeverity } from "@/utils/graphDiagnostics";
import {
  normalizeDiagnosticSeverity,
  summarizeDiagnosticsBySeverity,
} from "@/utils/diagnosticSummary";
import {
  DIAGNOSTIC_SEVERITY_META,
  DIAGNOSTIC_SEVERITY_ORDER,
  formatSeverityCountParts,
} from "@/components/diagnostics/diagnosticSeverityUi";
import {
  fillDelimiterGaps,
  normalizeDelimiterRanges,
  resolveDelimiterEnvironmentDefaults,
} from "@/utils/environmentDelimiters";
import { findAssetReferenceCandidates } from "@/utils/environmentAssetLookup";
import { getLegacyReplacement } from "@/nodes/shared/legacyTypes";
import { applyLegacyNodeReplacement } from "@/utils/legacyNodeReplace";
import { useProjectLegacyStore } from "@/stores/projectLegacyStore";
import {
  formatLegacyHitLabel,
  groupLegacyHitsByFile,
} from "@/utils/projectLegacyScanner";
import { chromeTypography } from "@/components/ui/editorChrome";

export function ValidationPanel() {
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const assetValidationBadge = useDiagnosticsStore((s) => s.assetValidationBadge);
  const assetPathIndexByKind = useDiagnosticsStore((s) => s.assetPathIndexByKind);
  const nodes = useEditorStore((s) => s.nodes);
  const biomeConfig = useEditorStore((s) => s.biomeConfig);
  const setBiomeConfig = useEditorStore((s) => s.setBiomeConfig);
  const updateNodeField = useEditorStore((s) => s.updateNodeField);
  const setNodes = useEditorStore((s) => s.setNodes);
  const removeNode = useEditorStore((s) => s.removeNode);
  const removeNodes = useEditorStore((s) => s.removeNodes);
  const commitState = useEditorStore((s) => s.commitState);
  const setDirty = useProjectStore((s) => s.setDirty);
  const projectPath = useProjectStore((s) => s.projectPath);
  const currentFile = useProjectStore((s) => s.currentFile);
  const projectLegacyHits = useProjectLegacyStore((s) => s.hits);
  const projectScanBusy = useProjectLegacyStore((s) => s.busy);
  const addToast = useToastStore((s) => s.addToast);
  const { openFile } = useTauriIO();
  const navigateToDiagnostic = useNavigateToDiagnostic();
  const [projectScanOpen, setProjectScanOpen] = useState(true);
  const [diagnosticFilter, setDiagnosticFilter] = useState("");
  const [copyBusy, setCopyBusy] = useState(false);

  useEffect(() => {
    if (diagnostics.length === 0 && projectLegacyHits.length > 0) {
      setProjectScanOpen(true);
    }
  }, [diagnostics.length, projectLegacyHits.length]);

  const copyableIssueCount = diagnostics.length + projectLegacyHits.length;

  const handleCopyAllIssues = useCallback(async () => {
    if (copyBusy || copyableIssueCount === 0) return;
    setCopyBusy(true);
    const text = formatIssuesForClipboard({
      diagnostics,
      projectLegacyHits,
      currentFile,
    });
    const copied = await copyTextToClipboard(text);
    addToast(
      copied
        ? `Copied ${copyableIssueCount} issue${copyableIssueCount === 1 ? "" : "s"} to clipboard`
        : "Could not copy issues to clipboard",
      copied ? "success" : "error",
    );
    setCopyBusy(false);
  }, [addToast, copyBusy, copyableIssueCount, currentFile, diagnostics, projectLegacyHits]);

  const filteredLegacyHits = useMemo(() => {
    const q = diagnosticFilter.trim().toLowerCase();
    if (!q) return projectLegacyHits;
    return projectLegacyHits.filter((hit) => {
      const label = formatLegacyHitLabel(hit).toLowerCase();
      return (
        label.includes(q)
        || hit.file.toLowerCase().includes(q)
        || hit.typeKey.toLowerCase().includes(q)
        || (hit.replacement?.toLowerCase().includes(q) ?? false)
      );
    });
  }, [diagnosticFilter, projectLegacyHits]);

  const projectLegacyByFile = useMemo(
    () => groupLegacyHitsByFile(filteredLegacyHits),
    [filteredLegacyHits],
  );

  const filteredDiagnostics = useMemo(() => {
    const q = diagnosticFilter.trim().toLowerCase();
    if (!q) return diagnostics;
    return diagnostics.filter((d) => {
      const code = d.code?.toLowerCase() ?? "";
      const message = d.message.toLowerCase();
      const field = d.field?.toLowerCase() ?? "";
      const severity = d.severity.toLowerCase();
      return code.includes(q) || message.includes(q) || field.includes(q) || severity.includes(q);
    });
  }, [diagnostics, diagnosticFilter]);

  const grouped = useMemo(() => {
    const map = new Map<DiagnosticSeverity, GraphDiagnostic[]>();
    for (const d of filteredDiagnostics) {
      const severity = normalizeDiagnosticSeverity(d.severity);
      const list = map.get(severity);
      if (list) {
        list.push(d);
      } else {
        map.set(severity, [d]);
      }
    }
    return map;
  }, [filteredDiagnostics]);

  const counts = summarizeDiagnosticsBySeverity(filteredDiagnostics);

  function updateDelimiterNode(
    nodeId: string,
    updater: (delimiters: unknown[]) => Array<Record<string, unknown>>,
    label: string,
  ) {
    const node = nodes.find((entry) => entry.id === nodeId);
    if (!node) return;
    const data = node.data as Record<string, unknown>;
    const fields = (data.fields as Record<string, unknown> | undefined) ?? {};
    const nextDelimiters = updater(Array.isArray(fields.Delimiters) ? fields.Delimiters : []);
    updateNodeField(nodeId, "Delimiters", nextDelimiters);
    setDirty(true);
    commitState(label);
  }

  function getDelimiterIndex(diagnostic: GraphDiagnostic): number | null {
    const delimiterIndex = diagnostic.meta?.delimiterIndex;
    return typeof delimiterIndex === "number" ? delimiterIndex : null;
  }

  function getDiagnosticAssetCandidates(diagnostic: GraphDiagnostic): string[] {
    const assetKind =
      diagnostic.meta?.assetKind === "environment"
      || diagnostic.meta?.assetKind === "tint"
      || diagnostic.meta?.assetKind === "material"
      || diagnostic.meta?.assetKind === "prop"
        ? diagnostic.meta.assetKind
        : null;
    const importName = typeof diagnostic.meta?.importName === "string" ? diagnostic.meta.importName : null;
    if (!assetKind || !importName) return [];
    return findAssetReferenceCandidates(importName, assetKind, assetPathIndexByKind);
  }

  function getCandidateLabel(path: string): string {
    const normalized = path.replace(/\\/g, "/");
    return normalized.slice(normalized.lastIndexOf("/") + 1);
  }

  function getFixLabel(diagnostic: GraphDiagnostic): string | null {
    const rawType = typeof diagnostic.meta?.rawType === "string" ? diagnostic.meta.rawType : null;
    switch (diagnostic.code) {
      case "env-delimiter-invalid-range":
      case "env-delimiter-overlap":
        return "Normalize ranges";
      case "env-delimiter-gap":
        return "Fill gaps";
      case "env-delimiter-missing-environment":
      case "biome-environment-missing-ref-name":
      case "biome-environment-missing-provider":
      case "biome-environment-no-constants":
        return "Use Default";
      case "env-delimiter-unsupported-provider":
        return rawType === "Imported" || rawType === "Exported" ? "Use Default" : null;
      case "legacy-node": {
        const typeKey = typeof diagnostic.meta?.legacyTypeKey === "string" ? diagnostic.meta.legacyTypeKey : null;
        const replacement = typeKey ? getLegacyReplacement(typeKey) : null;
        return replacement ? `Replace with ${replacement}` : "Remove node";
      }
      case "prerelease-node":
        return "Remove node";
      case "biome-name-missing":
        return "Set name";
      case "biome-tint-missing-provider":
        return "Add default tint";
      case "biome-tint-missing-ref-name":
        return "Use Default";
      case "field-constraint": {
        const min = diagnostic.meta?.constraintMin;
        const max = diagnostic.meta?.constraintMax;
        const required = diagnostic.meta?.constraintRequired;
        if (required) return "Fill with default";
        if (typeof min === "number" || typeof max === "number") return "Clamp to range";
        return null;
      }
      default:
        return null;
    }
  }

  function handleFix(diagnostic: GraphDiagnostic) {
    switch (diagnostic.code) {
      case "env-delimiter-invalid-range":
      case "env-delimiter-overlap":
        if (diagnostic.nodeId) {
          updateDelimiterNode(
            diagnostic.nodeId,
            normalizeDelimiterRanges,
            "Normalize environment delimiters",
          );
        }
        return;
      case "env-delimiter-gap":
        if (diagnostic.nodeId) {
          updateDelimiterNode(
            diagnostic.nodeId,
            fillDelimiterGaps,
            "Fill environment delimiter gaps",
          );
        }
        return;
      case "env-delimiter-missing-environment":
        if (diagnostic.nodeId) {
          const delimiterIndex = getDelimiterIndex(diagnostic);
          updateDelimiterNode(
            diagnostic.nodeId,
            (delimiters) => resolveDelimiterEnvironmentDefaults(
              delimiters,
              delimiterIndex === null ? undefined : [delimiterIndex],
            ),
            "Resolve delimiter environments to Default",
          );
        }
        return;
      case "env-delimiter-unsupported-provider":
        if (
          diagnostic.nodeId
          && (diagnostic.meta?.rawType === "Imported" || diagnostic.meta?.rawType === "Exported")
        ) {
          const delimiterIndex = getDelimiterIndex(diagnostic);
          updateDelimiterNode(
            diagnostic.nodeId,
            (delimiters) => resolveDelimiterEnvironmentDefaults(
              delimiters,
              delimiterIndex === null ? undefined : [delimiterIndex],
            ),
            "Resolve unsupported environment refs to Default",
          );
        }
        return;
      case "biome-environment-missing-ref-name":
      case "biome-environment-missing-provider":
      case "biome-environment-no-constants":
        if (!biomeConfig) return;
        setBiomeConfig({
          ...biomeConfig,
          EnvironmentProvider: { Type: "Default" },
        });
        setDirty(true);
        commitState("Use default biome environment");
        return;
      case "biome-name-missing":
        if (!biomeConfig) return;
        setBiomeConfig({ ...biomeConfig, Name: "NewBiome" });
        setDirty(true);
        commitState("Set biome name to NewBiome");
        return;
      case "biome-tint-missing-provider":
        if (!biomeConfig) return;
        setBiomeConfig({
          ...biomeConfig,
          TintProvider: {
            Type: "DensityDelimited",
            ExportAs: "BiomeTint",
            Delimiters: [
              { Threshold: 0.33, Tint: { Color: "#5b9e28" } },
              { Threshold: 0.66, Tint: { Color: "#6ca229" } },
              { Threshold: 1.0,  Tint: { Color: "#7ea629" } },
            ],
          },
        });
        setDirty(true);
        commitState("Add default DensityDelimited tint");
        return;
      case "biome-tint-missing-ref-name":
        if (!biomeConfig) return;
        setBiomeConfig({ ...biomeConfig, TintProvider: { Type: "Default" } });
        setDirty(true);
        commitState("Reset TintProvider to Default");
        return;
      case "field-constraint": {
        if (!diagnostic.nodeId || !diagnostic.field) return;
        const currentValue = diagnostic.meta?.currentValue;
        const min = typeof diagnostic.meta?.constraintMin === "number" ? diagnostic.meta.constraintMin : undefined;
        const max = typeof diagnostic.meta?.constraintMax === "number" ? diagnostic.meta.constraintMax : undefined;
        const required = diagnostic.meta?.constraintRequired;
        let fixedValue: unknown;
        if (required) {
          // Fill with a sensible default based on the current value type
          fixedValue = typeof currentValue === "number" ? (min ?? 0) : "";
        } else if (typeof currentValue === "number") {
          // Clamp to the constraint boundary
          let v = currentValue;
          if (min !== undefined && v < min) v = min;
          if (max !== undefined && v > max) v = max;
          fixedValue = v;
        } else {
          return;
        }
        updateNodeField(diagnostic.nodeId, diagnostic.field, fixedValue);
        setDirty(true);
        commitState(`Fix ${diagnostic.field} on ${diagnostic.nodeId}`);
        return;
      }
      case "legacy-node": {
        if (!diagnostic.nodeId) return;
        const typeKey = typeof diagnostic.meta?.legacyTypeKey === "string" ? diagnostic.meta.legacyTypeKey : null;
        const replacement = typeKey ? getLegacyReplacement(typeKey) : null;
        if (replacement && typeKey) {
          setNodes(
            nodes.map((n) => {
              if (n.id !== diagnostic.nodeId) return n;
              return applyLegacyNodeReplacement(n, typeKey, replacement);
            }),
          );
          setDirty(true);
          commitState(`Replace legacy ${typeKey} with ${replacement}`);
        } else {
          removeNode(diagnostic.nodeId);
          setDirty(true);
          commitState(`Remove legacy node ${typeKey ?? diagnostic.nodeId}`);
        }
        return;
      }
      case "prerelease-node": {
        if (!diagnostic.nodeId) return;
        const typeKey = typeof diagnostic.meta?.nodeTypeKey === "string" ? diagnostic.meta.nodeTypeKey : diagnostic.nodeId;
        removeNode(diagnostic.nodeId);
        setDirty(true);
        commitState(`Remove pre-release node ${typeKey}`);
        return;
      }
      default:
        return;
    }
  }

  function handleIssueKeyDown(event: KeyboardEvent<HTMLDivElement>, diagnostic: GraphDiagnostic) {
    if (!diagnostic.nodeId && !diagnostic.biomeSection) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    navigateToDiagnostic(diagnostic);
  }

  if (diagnostics.length === 0 && projectLegacyHits.length === 0 && !projectScanBusy && !diagnosticFilter.trim()) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-tn-text-muted gap-2 px-4" role="status" aria-live="polite">
        <span className="text-2xl text-green-400" aria-hidden="true">{"\u2714"}</span>
        <span className="text-xs">No issues found</span>
        <span className="rounded border border-tn-border bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-tn-text-muted">
          {assetValidationBadge.label}
        </span>
        {assetValidationBadge.detail && (
          <span className="text-[10px] text-tn-text-muted/70 text-center">
            {assetValidationBadge.detail}
          </span>
        )}
      </div>
    );
  }

  const summaryParts = formatSeverityCountParts(counts);
  const summaryLine = summaryParts.length > 0
    ? summaryParts.join(", ")
    : diagnosticFilter.trim()
      ? "No matching issues"
      : diagnostics.length === 0 && projectLegacyHits.length > 0
        ? "No issues in this file"
        : "No issues";

  const legacyDiagnostics = filteredDiagnostics.filter((d) => d.code === "legacy-node");

  function handleRemoveAllLegacy() {
    const ids = legacyDiagnostics.map((d) => d.nodeId).filter((id): id is string => id !== null);
    if (ids.length === 0) return;
    removeNodes(ids);
    setDirty(true);
    commitState(`Remove ${ids.length} legacy node${ids.length > 1 ? "s" : ""}`);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary header */}
      <div className={`shrink-0 px-3 py-2 border-b border-tn-border flex flex-col gap-1.5 ${chromeTypography.panelBody}`}>
        {(diagnostics.length > 0 || projectLegacyHits.length > 0) && (
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-tn-text-muted/60 pointer-events-none" aria-hidden />
            <input
              type="search"
              value={diagnosticFilter}
              onChange={(e) => setDiagnosticFilter(e.target.value)}
              placeholder="Filter issues…"
              aria-label="Filter issues"
              className="w-full rounded-md border border-tn-border bg-tn-bg pl-8 pr-7 py-1.5 text-[11px] text-tn-text placeholder:text-tn-text-muted/60 focus:outline-none focus:border-tn-accent/50"
            />
            {diagnosticFilter && (
              <button
                type="button"
                onClick={() => setDiagnosticFilter("")}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 rounded text-tn-text-muted hover:text-tn-text"
                aria-label="Clear filter"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
        <div className="flex items-center justify-between gap-2">
          <span>
            {summaryLine}
            {diagnosticFilter.trim() && diagnostics.length !== filteredDiagnostics.length && (
              <span className="ml-1 text-[10px] text-tn-text-muted/70">
                ({filteredDiagnostics.length} of {diagnostics.length})
              </span>
            )}
          </span>
          {copyableIssueCount > 0 && (
            <button
              type="button"
              onClick={() => { void handleCopyAllIssues(); }}
              disabled={copyBusy}
              aria-label={`Copy all ${copyableIssueCount} issues to clipboard`}
              className="inline-flex shrink-0 items-center gap-1 rounded border border-tn-border bg-white/5 px-2 py-0.5 text-[10px] text-tn-text-muted hover:bg-white/10 hover:text-tn-text transition-colors disabled:opacity-50"
            >
              <Copy className="h-3 w-3" aria-hidden />
              Copy all
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="rounded border border-tn-border bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-tn-text-muted">
            {assetValidationBadge.label}
          </span>
          {assetValidationBadge.detail && (
            <span className="text-[10px] text-tn-text-muted/70">
              {assetValidationBadge.detail}
            </span>
          )}
        </div>
        {legacyDiagnostics.length > 0 && (
          <button
            type="button"
            onClick={handleRemoveAllLegacy}
            aria-label={`Remove all ${legacyDiagnostics.length} legacy node${legacyDiagnostics.length > 1 ? "s" : ""}`}
            className="self-start rounded border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[10px] text-amber-300 hover:bg-amber-500/20 transition-colors"
          >
            Remove all {legacyDiagnostics.length} legacy node{legacyDiagnostics.length > 1 ? "s" : ""}
          </button>
        )}
      </div>

      {/* Grouped diagnostics */}
      <div className="flex-1 overflow-y-auto">
        {diagnosticFilter.trim() && filteredDiagnostics.length === 0 && diagnostics.length > 0 && (
          <p className="px-3 py-6 text-center text-[11px] text-tn-text-muted">
            No issues match &ldquo;{diagnosticFilter.trim()}&rdquo;
          </p>
        )}
        {DIAGNOSTIC_SEVERITY_ORDER.map((severity) => {
          const items = grouped.get(severity);
          if (!items || items.length === 0) return null;
          const meta = DIAGNOSTIC_SEVERITY_META[severity];
          return (
            <div key={severity} className="mb-1">
              <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${meta.className}`}>
                {meta.groupLabel} ({items.length})
              </div>
              {items.map((d, i) => (
                <div
                  key={`${severity}-${i}`}
                  onClick={d.nodeId || d.biomeSection ? () => navigateToDiagnostic(d) : undefined}
                  onKeyDown={(event) => handleIssueKeyDown(event, d)}
                  role={d.nodeId || d.biomeSection ? "button" : undefined}
                  tabIndex={d.nodeId || d.biomeSection ? 0 : -1}
                  aria-label={`${d.message}${d.nodeId ? `, click to navigate to node` : d.biomeSection ? `, click to navigate to ${d.biomeSection}` : ``}`}
                  className={`w-full text-left px-3 py-1 text-[11px] hover:bg-white/5 transition-colors flex items-start gap-1.5 ${
                    d.nodeId || d.biomeSection ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <span className={`shrink-0 ${meta.className}`} aria-hidden="true">
                    {meta.unicodeIcon}
                  </span>
                  <span className="flex-1 flex flex-col gap-0.5">
                    <span className="text-tn-text-muted leading-tight">{d.message}</span>
                    <span className="flex flex-wrap gap-1 text-[10px] text-tn-text-muted/70 uppercase tracking-wide">
                      {d.code && <span className="normal-case font-mono text-[9px]">{d.code}</span>}
                      {d.field && <span>{d.field}</span>}
                      {getDelimiterIndex(d) !== null && <span>{`Delimiter [${getDelimiterIndex(d)}]`}</span>}
                      {d.biomeSection && <span>{`Jump to ${d.biomeSection}`}</span>}
                    </span>
                    {getDiagnosticAssetCandidates(d).length > 0 && (
                      <span className="flex flex-wrap gap-1 pt-1">
                        {getDiagnosticAssetCandidates(d).map((path) => (
                          <button
                            key={path}
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              void openFile(path);
                            }}
                            className="rounded border border-tn-border bg-white/5 px-2 py-0.5 text-[10px] text-tn-text-muted hover:bg-white/10"
                            title={path}
                          >
                            {getCandidateLabel(path)}
                          </button>
                        ))}
                      </span>
                    )}
                  </span>
                  {getFixLabel(d) && (
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        handleFix(d);
                      }}
                      className="shrink-0 rounded border border-tn-border bg-white/5 px-2 py-0.5 text-[10px] uppercase tracking-wide text-tn-text-muted hover:bg-white/10"
                    >
                      {getFixLabel(d)}
                    </button>
                  )}
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {(projectPath || projectScanBusy) && (
        <div className="shrink-0 border-t border-tn-border">
          <button
            type="button"
            onClick={() => setProjectScanOpen((open) => !open)}
            className="w-full px-3 py-2 text-left text-[10px] font-semibold uppercase tracking-wider text-amber-300 hover:bg-white/5"
          >
            Project-wide
            {projectScanBusy
              ? " (scanning…)"
              : projectLegacyHits.length > 0
                ? ` (${projectLegacyHits.length})`
                : " (clean)"}
          </button>
          {projectScanOpen && (
            <div className="max-h-48 overflow-y-auto pb-2">
              {!projectPath && (
                <p className="px-3 py-1 text-[11px] text-tn-text-muted">Open a project to scan pack JSON files.</p>
              )}
              {projectPath && !projectScanBusy && projectLegacyHits.length === 0 && (
                <p className={`px-3 py-1 ${chromeTypography.panelBody}`}>No legacy or deprecated nodes in Server/HytaleGenerator JSON.</p>
              )}
              {projectPath && !projectScanBusy && projectLegacyHits.length > 0 && filteredLegacyHits.length === 0 && diagnosticFilter.trim() && (
                <p className={`px-3 py-3 text-center ${chromeTypography.panelBody}`}>
                  No project-wide issues match &ldquo;{diagnosticFilter.trim()}&rdquo;
                </p>
              )}
              {[...projectLegacyByFile.entries()].map(([file, hits]) => (
                <div key={file} className="px-3 py-1">
                  <button
                    type="button"
                    onClick={() => void openFile(file)}
                    className="text-left text-[11px] text-tn-text hover:text-tn-accent truncate w-full"
                    title={file}
                  >
                    {getCandidateLabel(file)}
                    <span className="ml-1 text-[10px] text-amber-300">({hits.length})</span>
                  </button>
                  <ul className="mt-0.5 space-y-0.5 pl-2">
                    {hits.map((hit, index) => (
                      <li key={`${file}-${hit.nodeId ?? hit.typeKey}-${index}`} className="flex items-start gap-1">
                        <span className="text-[10px] text-tn-text-muted leading-tight flex-1">
                          {formatLegacyHitLabel(hit)}
                        </span>
                        {hit.replacement && (
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(hit.replacement ?? "");
                            }}
                            className="shrink-0 rounded border border-tn-border bg-white/5 px-1.5 py-0.5 text-[9px] uppercase tracking-wide text-tn-text-muted hover:bg-white/10"
                            title={`Copy replacement type ${hit.replacement}`}
                          >
                            Copy
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
