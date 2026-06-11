import { describe, expect, it, vi } from "vitest";
import {
  BUG_REPORT_SCHEMA_VERSION,
  buildBugReportIssueUrl,
  detectOsLabel,
  formatBugReportClipboard,
  inferBugReportArea,
  sanitizeReportPath,
} from "../bugReport";
import type { BugReportBundle } from "../bugReport";

vi.mock("@/utils/fetchReleases", () => ({
  getAppVersion: vi.fn().mockResolvedValue("0.1.8-alpha.2"),
}));

function minimalBundle(overrides: Partial<BugReportBundle> = {}): BugReportBundle {
  return {
    schemaVersion: BUG_REPORT_SCHEMA_VERSION,
    buildChannel: "closed-alpha",
    alphaBuild: "0.1.8-alpha.2",
    capturedAt: new Date().toISOString(),
    runtime: "tauri",
    appVersion: "0.1.8-alpha.2",
    os: { label: "Windows 11", platform: "Win32" },
    display: { width: 1920, height: 1080, devicePixelRatio: 1 },
    hardware: null,
    report: { area: "Preview", summary: "Heatmap blank" },
    session: {
      projectPath: "~\\Projects\\test",
      currentFile: null,
      isDirty: false,
      graph: {
        nodeCount: 0,
        edgeCount: 0,
        selectedNodeId: null,
        selectedNodeType: null,
        selectedCount: 0,
      },
      validation: { total: 0, errors: 0, warnings: 0, info: 0, topIssues: [] },
      preview: {
        mode: "2d",
        viewMode: "split",
        propPreviewMode: "placement",
        autoRefresh: true,
        isLoading: false,
        previewError: null,
        selectedPreviewNodeId: null,
        comparisonEnabled: false,
      },
      bridge: {
        connected: false,
        host: "127.0.0.1",
        port: 7854,
        savePath: null,
        modPath: null,
      },
      assets: {
        syncEnabled: true,
        sourceChannel: "release",
        releasePathConfigured: true,
        commonOverlayEnabled: false,
      },
      config: { debounceMs: 300, gpuMemoryBudgetMb: 2048, rendererPixelRatio: 1 },
      legacy: { hitCount: 0, samples: [] },
    },
    ...overrides,
  };
}

describe("sanitizeReportPath", () => {
  it("redacts Windows user folder", () => {
    expect(sanitizeReportPath("C:\\Users\\McCal\\Projects\\foo")).toBe("~\\Projects\\foo");
  });
});

describe("inferBugReportArea", () => {
  it("maps preview errors", () => {
    expect(inferBugReportArea({ message: "WebGL context lost" })).toBe("Preview");
  });

  it("maps bridge errors", () => {
    expect(inferBugReportArea({ message: "Bridge connection refused 127.0.0.1:7854" })).toBe("Bridge");
  });
});

describe("buildBugReportIssueUrl", () => {
  it("includes McCal-Codes template and prefilled fields", () => {
    const url = buildBugReportIssueUrl(
      minimalBundle({
        report: {
          area: "Preview",
          summary: "Heatmap blank",
          steps: "1. Open biome\n2. Switch 2D",
          expected: "Heatmap renders",
          actual: "Blank panel",
        },
      }),
    );
    expect(url).toContain("McCal-Codes/TerraNova");
    expect(url).toContain("template=BUG_REPORT.yml");
    expect(url).toContain("appVersion=0.1.8-alpha.2");
    expect(url).toContain("area=Preview");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("title")).toBe("[Bug]: Heatmap blank");
    expect(parsed.searchParams.get("steps")).toContain("Open biome");
    expect(parsed.searchParams.get("steps")).not.toContain("Expected");
    expect(parsed.searchParams.get("expected")).toBe("Heatmap renders");
    expect(parsed.searchParams.get("description")).toContain("Blank panel");
  });
});

describe("formatBugReportClipboard", () => {
  it("includes header and JSON bundle", () => {
    const text = formatBugReportClipboard(minimalBundle());
    expect(text).toContain("closed-alpha 0.1.8-alpha.2");
    expect(text).toContain('"schemaVersion": 2');
    expect(text).toContain("Session snapshot");
  });
});

describe("detectOsLabel", () => {
  it("returns a known label", () => {
    expect(detectOsLabel()).toBeTruthy();
  });
});
