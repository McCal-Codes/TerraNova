import { normalizeDiagnosticSeverity } from "@/utils/diagnosticSummary";
import type { GraphDiagnostic, DiagnosticSeverity } from "@/utils/graphDiagnostics";
import {
  formatLegacyHitLabel,
  groupLegacyHitsByFile,
  type ProjectLegacyHit,
} from "@/utils/projectLegacyScanner";

const SEVERITY_ORDER: DiagnosticSeverity[] = ["error", "warning", "info"];

const SEVERITY_LABELS: Record<DiagnosticSeverity, string> = {
  error: "Errors",
  warning: "Warnings",
  info: "Info",
};

export function formatDiagnosticClipboardLine(diagnostic: GraphDiagnostic): string {
  const severity = normalizeDiagnosticSeverity(diagnostic.severity).toUpperCase();
  const meta: string[] = [];
  if (diagnostic.code) meta.push(diagnostic.code);
  if (diagnostic.field) meta.push(`field: ${diagnostic.field}`);
  if (diagnostic.nodeId) meta.push(`node: ${diagnostic.nodeId}`);
  if (diagnostic.biomeSection) meta.push(`section: ${diagnostic.biomeSection}`);
  const suffix = meta.length > 0 ? ` (${meta.join(", ")})` : "";
  return `[${severity}] ${diagnostic.message}${suffix}`;
}

export function formatIssuesForClipboard(options: {
  diagnostics: GraphDiagnostic[];
  projectLegacyHits: ProjectLegacyHit[];
  currentFile?: string | null;
}): string {
  const { diagnostics, projectLegacyHits, currentFile } = options;
  const lines: string[] = ["TerraNova issues"];

  if (currentFile) {
    lines.push(`File: ${currentFile.replace(/\\/g, "/")}`);
  }

  if (diagnostics.length === 0 && projectLegacyHits.length === 0) {
    lines.push("", "No issues found.");
    return lines.join("\n");
  }

  const grouped = new Map<DiagnosticSeverity, GraphDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const severity = normalizeDiagnosticSeverity(diagnostic.severity);
    const list = grouped.get(severity);
    if (list) {
      list.push(diagnostic);
    } else {
      grouped.set(severity, [diagnostic]);
    }
  }

  if (diagnostics.length > 0) {
    lines.push("", "Canvas");
    for (const severity of SEVERITY_ORDER) {
      const items = grouped.get(severity);
      if (!items || items.length === 0) continue;
      lines.push("", `${SEVERITY_LABELS[severity]} (${items.length})`);
      for (const diagnostic of items) {
        lines.push(`- ${formatDiagnosticClipboardLine(diagnostic)}`);
      }
    }
  }

  if (projectLegacyHits.length > 0) {
    lines.push("", `Project-wide legacy / deprecated (${projectLegacyHits.length})`);
    for (const [file, hits] of groupLegacyHitsByFile(projectLegacyHits)) {
      lines.push("", file.replace(/\\/g, "/"));
      for (const hit of hits) {
        lines.push(`- ${formatLegacyHitLabel(hit)}`);
      }
    }
  }

  return lines.join("\n");
}
