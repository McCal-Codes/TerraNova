import { describe, expect, it, vi } from "vitest";
import { buildBugReportIssueUrl } from "../bugReport";
import type { BugReportBundle } from "../bugReport";

vi.mock("@/utils/fetchReleases", () => ({
  getAppVersion: vi.fn().mockResolvedValue("0.1.7"),
}));

function minimalBundle(overrides: Partial<BugReportBundle> = {}): BugReportBundle {
  return {
    capturedAt: new Date().toISOString(),
    runtime: "tauri",
    projectPath: null,
    currentFile: null,
    isDirty: false,
    graph: { nodeCount: 0, edgeCount: 0, selectedNodeId: null, selectedCount: 0 },
    validation: { total: 0, errors: 0, warnings: 0, info: 0 },
    preview: {
      mode: "density",
      viewMode: "2d",
      isLoading: false,
      previewError: null,
      selectedPreviewNodeId: null,
    },
    bridge: { connected: false, host: "127.0.0.1", port: 7854 },
    appVersion: "0.1.7",
    platform: "Win32",
    osLabel: "Windows 11",
    display: { width: 1920, height: 1080, devicePixelRatio: 1 },
    hardware: null,
    settings: {
      hytaleAssetSyncEnabled: true,
      hytaleAssetSourceChannel: "release",
      flowDirection: "LR",
      exportPath: null,
    },
    config: { debounceMs: 300, gpuMemoryBudgetMb: 2048, rendererPixelRatio: 1 },
    diagnosticsDetail: [],
    legacyHitCount: 0,
    ...overrides,
  };
}

describe("buildBugReportIssueUrl", () => {
  it("includes McCal-Codes template and version prefills", () => {
    const url = buildBugReportIssueUrl(minimalBundle({ reportArea: "Preview" }), "Heatmap blank");
    expect(url).toContain("McCal-Codes/TerraNova");
    expect(url).toContain("template=BUG_REPORT.yml");
    expect(url).toContain("appVersion=0.1.7");
    expect(url).toContain("os=Windows");
    expect(url).toContain("area=Preview");
    const parsed = new URL(url);
    expect(parsed.searchParams.get("title")).toBe("[Bug]: Heatmap blank");
  });
});
