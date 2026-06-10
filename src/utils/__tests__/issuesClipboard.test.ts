import { describe, expect, it } from "vitest";
import {
  formatDiagnosticClipboardLine,
  formatIssuesForClipboard,
} from "../issuesClipboard";
import type { GraphDiagnostic } from "../graphDiagnostics";

describe("issuesClipboard", () => {
  it("formats a diagnostic line with metadata", () => {
    const diagnostic: GraphDiagnostic = {
      severity: "error",
      message: "Sum: input disconnected",
      code: "field-constraint",
      nodeId: "sum_1",
      field: "Inputs[0]",
    };
    expect(formatDiagnosticClipboardLine(diagnostic)).toBe(
      "[ERROR] Sum: input disconnected (field-constraint, field: Inputs[0], node: sum_1)",
    );
  });

  it("builds clipboard text for canvas and project-wide issues", () => {
    const text = formatIssuesForClipboard({
      currentFile: "Server/HytaleGenerator/Biomes/Test.json",
      diagnostics: [
        { severity: "warning", message: "Legacy node", code: "legacy-node", nodeId: "n1" },
        {
          severity: "error",
          message: "Missing name",
          code: "biome-name-missing",
          biomeSection: "Biome",
          nodeId: null,
        },
      ] satisfies GraphDiagnostic[],
      projectLegacyHits: [
        {
          file: "Server/HytaleGenerator/Density/Old.json",
          nodeId: "old_1",
          typeKey: "Legacy:Foo",
          bareType: "Foo",
          tier: "deprecated",
          replacement: "Bar",
        },
      ],
    });

    expect(text).toContain("TerraNova issues");
    expect(text).toContain("File: Server/HytaleGenerator/Biomes/Test.json");
    expect(text).toContain("Errors (1)");
    expect(text).toContain("[ERROR] Missing name");
    expect(text).toContain("Warnings (1)");
    expect(text).toContain("[WARNING] Legacy node");
    expect(text).toContain("Project-wide legacy / deprecated (1)");
    expect(text).toContain("old_1: Legacy:Foo (deprecated) → Bar");
  });

  it("returns empty-state text when there are no issues", () => {
    expect(formatIssuesForClipboard({ diagnostics: [], projectLegacyHits: [] })).toContain(
      "No issues found.",
    );
  });
});
