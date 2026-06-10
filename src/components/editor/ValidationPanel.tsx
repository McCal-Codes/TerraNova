import type { KeyboardEvent } from "react";
import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { useReactFlow } from "@xyflow/react";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useTauriIO } from "@/hooks/useTauriIO";
import type { GraphDiagnostic, DiagnosticSeverity } from "@/utils/graphDiagnostics";
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

const SEVERITY_ORDER: DiagnosticSeverity[] = ["error", "warning", "info"];

const SEVERITY_COLORS: Record<DiagnosticSeverity, string> = {
  error: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
};

const SEVERITY_ICONS: Record<DiagnosticSeverity, string> = {
  error: "\u2716",
  warning: "\u26A0",
  info: "\u2139",
};

const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

export function ValidationPanel() {
  const diagnostics = useDiagnosticsStore((s) => s.diagnostics);
  const assetValidationBadge = useDiagnosticsStore((s) => s.assetValidationBadge);
  const assetPathIndexByKind = useDiagnosticsStore((s) => s.assetPathIndexByKind);
  const nodes = useEditorStore((s) => s.nodes);
  const biomeConfig = useEditorStore((s) => s.biomeConfig);
  const setBiomeConfig = useEditorStore((s) => s.setBiomeConfig);
  const setSelectedNodeId = useEditorStore((s) => s.setSelectedNodeId);
  const setEditingContext = useEditorStore((s) => s.setEditingContext);
  const switchBiomeSection = useEditorStore((s) => s.switchBiomeSection);
  const updateNodeField = useEditorStore((s) => s.updateNodeField);
  const setNodes = useEditorStore((s) => s.setNodes);
  const removeNode = useEditorStore((s) => s.removeNode);
  const removeNodes = useEditorStore((s) => s.removeNodes);
  const commitState = useEditorStore((s) => s.commitState);
  const setDirty = useProjectStore((s) => s.setDirty);
  const projectPath = useProjectStore((s) => s.projectPath);
  const projectLegacyHits = useProjectLegacyStore((s) => s.hits);
  const projectScanBusy = useProjectLegacyStore((s) => s.busy);
  const { openFile } = useTauriIO();
  const reactFlow = useReactFlow();
  const [projectScanOpen, setProjectScanOpen] = useState(true);
  const [diagnosticFilter, setDiagnosticFilter] = useState("");

  const projectLegacyByFile = useMemo(
    () => groupLegacyHitsByFile(projectLegacyHits),
    [projectLegacyHits],
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

  // Group by severity
  const grouped = new Map<DiagnosticSeverity, GraphDiagnostic[]>();
  for (const d of filteredDiagnostics) {
    const list = grouped.get(d.severity);
    if (list) {
      list.push(d);
    } else {
      grouped.set(d.severity, [d]);
    }
  }

  const counts = {
    error: grouped.get("error")?.length ?? 0,
    warning: grouped.get("warning")?.length ?? 0,
    info: grouped.get("info")?.length ?? 0,
  };

  function handleClick(d: GraphDiagnostic) {
    if (d.nodeId) {
      setSelectedNodeId(d.nodeId);
      reactFlow.fitView({
        nodes: [{ id: d.nodeId }],
        padding: 0.3,
        duration: 300,
      });
      return;
    }

    if (!d.biomeSection) return;

    setEditingContext("Biome");
    switchBiomeSection(d.biomeSection);

    const sectionOutputId = useEditorStore.getState().biomeSections?.[d.biomeSection]?.outputNodeId ?? null;
    if (sectionOutputId) {
      setSelectedNodeId(sectionOutputId);
      reactFlow.fitView({
        nodes: [{ id: sectionOutputId }],
        padding: 0.3,
        duration: 300,
      });
    } else {
      setSelectedNodeId(null);
    }
  }

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
      default:
        return;
    }
  }

  function handleIssueKeyDown(event: KeyboardEvent<HTMLDivElement>, diagnostic: GraphDiagnostic) {
    if (!diagnostic.nodeId && !diagnostic.biomeSection) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleClick(diagnostic);
  }

  if (filteredDiagnostics.length === 0 && projectLegacyHits.length === 0 && !projectScanBusy && !diagnosticFilter.trim()) {
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

  const summaryParts = [
    counts.error > 0 && `${counts.error} error${counts.error > 1 ? "s" : ""}`,
    counts.warning > 0 && `${counts.warning} warning${counts.warning > 1 ? "s" : ""}`,
    counts.info > 0 && `${counts.info} info`,
  ].filter(Boolean);

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
      <div className="shrink-0 px-3 py-2 border-b border-tn-border text-[11px] text-tn-text-muted flex flex-col gap-1.5">
        {diagnostics.length > 0 && (
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
        <div>
          {summaryParts.length > 0 ? summaryParts.join(", ") : diagnosticFilter.trim() ? "No matching issues" : "No issues"}
          {diagnosticFilter.trim() && diagnostics.length !== filteredDiagnostics.length && (
            <span className="ml-1 text-[10px] text-tn-text-muted/70">
              ({filteredDiagnostics.length} of {diagnostics.length})
            </span>
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
        {SEVERITY_ORDER.map((severity) => {
          const items = grouped.get(severity);
          if (!items || items.length === 0) return null;
          return (
            <div key={severity} className="mb-1">
              <div className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider ${SEVERITY_COLORS[severity]}`}>
                {SEVERITY_LABELS[severity]} ({items.length})
              </div>
              {items.map((d, i) => (
                <div
                  key={`${severity}-${i}`}
                  onClick={d.nodeId || d.biomeSection ? () => handleClick(d) : undefined}
                  onKeyDown={(event) => handleIssueKeyDown(event, d)}
                  role={d.nodeId || d.biomeSection ? "button" : undefined}
                  tabIndex={d.nodeId || d.biomeSection ? 0 : -1}
                  aria-label={`${d.message}${d.nodeId ? `, click to navigate to node` : d.biomeSection ? `, click to navigate to ${d.biomeSection}` : ``}`}
                  className={`w-full text-left px-3 py-1 text-[11px] hover:bg-white/5 transition-colors flex items-start gap-1.5 ${
                    d.nodeId || d.biomeSection ? "cursor-pointer" : "cursor-default"
                  }`}
                >
                  <span className={`shrink-0 ${SEVERITY_COLORS[severity]}`} aria-hidden="true">
                    {SEVERITY_ICONS[severity]}
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
                <p className="px-3 py-1 text-[11px] text-tn-text-muted">No legacy or deprecated nodes in Server/HytaleGenerator JSON.</p>
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
