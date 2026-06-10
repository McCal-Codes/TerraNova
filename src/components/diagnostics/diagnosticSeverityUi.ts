import { AlertCircle, AlertTriangle, Info, type LucideIcon } from "lucide-react";
import type { DiagnosticSeverity } from "@/utils/graphDiagnostics";
import type { DiagnosticSeverityCounts } from "@/utils/diagnosticSummary";

export const DIAGNOSTIC_SEVERITY_ORDER: DiagnosticSeverity[] = ["error", "warning", "info"];

export interface DiagnosticSeverityMeta {
  className: string;
  groupLabel: string;
  countLabel: string;
  countLabelPlural: string;
  Icon: LucideIcon;
  unicodeIcon: string;
}

export const DIAGNOSTIC_SEVERITY_META: Record<DiagnosticSeverity, DiagnosticSeverityMeta> = {
  error: {
    className: "text-red-400",
    groupLabel: "Errors",
    countLabel: "error",
    countLabelPlural: "errors",
    Icon: AlertCircle,
    unicodeIcon: "\u2716",
  },
  warning: {
    className: "text-amber-400",
    groupLabel: "Warnings",
    countLabel: "warn",
    countLabelPlural: "warns",
    Icon: AlertTriangle,
    unicodeIcon: "\u26A0",
  },
  info: {
    className: "text-sky-400",
    groupLabel: "Info",
    countLabel: "info",
    countLabelPlural: "info",
    Icon: Info,
    unicodeIcon: "\u2139",
  },
};

export function formatSeverityCountParts(counts: DiagnosticSeverityCounts): string[] {
  const parts: string[] = [];
  if (counts.error > 0) {
    const meta = DIAGNOSTIC_SEVERITY_META.error;
    parts.push(`${counts.error} ${counts.error === 1 ? meta.countLabel : meta.countLabelPlural}`);
  }
  if (counts.warning > 0) {
    const meta = DIAGNOSTIC_SEVERITY_META.warning;
    parts.push(`${counts.warning} ${counts.warning === 1 ? meta.countLabel : meta.countLabelPlural}`);
  }
  if (counts.info > 0) {
    parts.push(`${counts.info} ${DIAGNOSTIC_SEVERITY_META.info.countLabel}`);
  }
  return parts;
}

export function formatSeverityAriaSummary(counts: DiagnosticSeverityCounts): string {
  const parts = formatSeverityCountParts(counts);
  return parts.length > 0 ? parts.join(", ") : "No issues";
}
