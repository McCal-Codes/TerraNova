import type { DiagnosticSeverity, GraphDiagnostic } from "@/utils/graphDiagnostics";

export interface DiagnosticSeverityCounts {
  error: number;
  warning: number;
  info: number;
}

const SEVERITIES: DiagnosticSeverity[] = ["error", "warning", "info"];

export function normalizeDiagnosticSeverity(
  severity: string | undefined,
): DiagnosticSeverity {
  if (severity === "error" || severity === "warning" || severity === "info") {
    return severity;
  }
  if (severity === "warn") return "warning";
  return "info";
}

export function summarizeDiagnosticsBySeverity(
  diagnostics: GraphDiagnostic[],
): DiagnosticSeverityCounts {
  const counts: DiagnosticSeverityCounts = { error: 0, warning: 0, info: 0 };
  for (const diagnostic of diagnostics) {
    counts[normalizeDiagnosticSeverity(diagnostic.severity)] += 1;
  }
  return counts;
}

export function formatDiagnosticSeveritySummary(
  counts: DiagnosticSeverityCounts,
): string[] {
  const parts: string[] = [];
  if (counts.error > 0) {
    parts.push(`${counts.error} error${counts.error === 1 ? "" : "s"}`);
  }
  if (counts.warning > 0) {
    parts.push(`${counts.warning} warn${counts.warning === 1 ? "" : "s"}`);
  }
  if (counts.info > 0) {
    parts.push(`${counts.info} info`);
  }
  return parts;
}

export function hasDiagnosticIssues(counts: DiagnosticSeverityCounts): boolean {
  return SEVERITIES.some((severity) => counts[severity] > 0);
}
