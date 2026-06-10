import { describe, expect, it } from "vitest";
import {
  formatDiagnosticSeveritySummary,
  normalizeDiagnosticSeverity,
  summarizeDiagnosticsBySeverity,
} from "../diagnosticSummary";
import type { GraphDiagnostic } from "../graphDiagnostics";

describe("diagnosticSummary", () => {
  it("normalizes warn alias to warning", () => {
    expect(normalizeDiagnosticSeverity("warn")).toBe("warning");
    expect(normalizeDiagnosticSeverity("error")).toBe("error");
    expect(normalizeDiagnosticSeverity(undefined)).toBe("info");
  });

  it("counts severities consistently", () => {
    const diagnostics: GraphDiagnostic[] = [
      { nodeId: "a", message: "cycle", severity: "error" },
      { nodeId: "b", message: "legacy", severity: "warning" },
      { nodeId: "c", message: "hint", severity: "info" },
      { nodeId: "d", message: "alias", severity: "warn" as GraphDiagnostic["severity"] },
    ];
    expect(summarizeDiagnosticsBySeverity(diagnostics)).toEqual({
      error: 1,
      warning: 2,
      info: 1,
    });
    expect(formatDiagnosticSeveritySummary(summarizeDiagnosticsBySeverity(diagnostics))).toEqual([
      "1 error",
      "2 warns",
      "1 info",
    ]);
  });
});
