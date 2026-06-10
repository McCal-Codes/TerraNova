import { getAppVersion } from "@/utils/fetchReleases";
import { detectHardware, type HardwareInfo } from "@/utils/hardwareDetect";
import { buildDevSessionSnapshot } from "@/utils/devTools";
import { useBridgeStore } from "@/stores/bridgeStore";
import { useConfigStore } from "@/stores/configStore";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useProjectLegacyStore } from "@/stores/projectLegacyStore";
import { useProjectStore } from "@/stores/projectStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { GITHUB_REPO_URL } from "@/constants/github";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";
import { isMac, isTauriRuntime } from "@/utils/platform";

export type BugReportArea =
  | "Preview"
  | "Export"
  | "Bridge"
  | "Create Pack"
  | "Import"
  | "Editor"
  | "Other";

export interface BugReportErrorContext {
  message: string;
  stack?: string;
  componentStack?: string;
}

export interface BugReportBundle extends ReturnType<typeof buildDevSessionSnapshot> {
  appVersion: string;
  platform: string;
  osLabel: string;
  display: { width: number; height: number; devicePixelRatio: number };
  hardware: Pick<HardwareInfo, "cpuName" | "cpuCores" | "totalRamMb" | "gpuRenderer" | "estimatedVramMb"> | null;
  settings: {
    hytaleAssetSyncEnabled: boolean;
    hytaleAssetSourceChannel: string;
    flowDirection: string;
    exportPath: string | null;
  };
  config: {
    debounceMs: number;
    gpuMemoryBudgetMb: number;
    rendererPixelRatio: number;
  };
  diagnosticsDetail: Array<Pick<GraphDiagnostic, "nodeId" | "field" | "message" | "severity">>;
  legacyHitCount: number;
  reportArea?: BugReportArea;
  userSummary?: string;
  error?: BugReportErrorContext;
}

function detectOsLabel(): string {
  if (isMac) return "macOS (Apple Silicon)";
  const ua = navigator.userAgent;
  if (ua.includes("Windows")) return "Windows 11";
  if (ua.includes("Linux")) return "Linux (Other)";
  return "Other";
}

function topDiagnostics(limit = 20): BugReportBundle["diagnosticsDetail"] {
  const all = useDiagnosticsStore.getState().diagnostics;
  const ranked = [...all].sort((a, b) => {
    const rank = (s: GraphDiagnostic["severity"]) => (s === "error" ? 0 : s === "warning" ? 1 : 2);
    return rank(a.severity) - rank(b.severity);
  });
  return ranked.slice(0, limit).map((d) => ({
    nodeId: d.nodeId,
    field: d.field,
    message: d.message,
    severity: d.severity,
  }));
}

export async function buildBugReportBundle(options?: {
  area?: BugReportArea;
  userSummary?: string;
  error?: BugReportErrorContext;
  hardware?: HardwareInfo | null;
}): Promise<BugReportBundle> {
  const editor = useEditorStore.getState();
  const project = useProjectStore.getState();
  const preview = usePreviewStore.getState();
  const bridge = useBridgeStore.getState();
  const settings = useSettingsStore.getState();
  const config = useConfigStore.getState();
  const legacyHits = useProjectLegacyStore.getState().hits.length;

  let hardware: BugReportBundle["hardware"] = null;
  if (options?.hardware) {
    const h = options.hardware;
    hardware = {
      cpuName: h.cpuName,
      cpuCores: h.cpuCores,
      totalRamMb: h.totalRamMb,
      gpuRenderer: h.gpuRenderer,
      estimatedVramMb: h.estimatedVramMb,
    };
  } else if (isTauriRuntime()) {
    try {
      const h = await detectHardware();
      hardware = {
        cpuName: h.cpuName,
        cpuCores: h.cpuCores,
        totalRamMb: h.totalRamMb,
        gpuRenderer: h.gpuRenderer,
        estimatedVramMb: h.estimatedVramMb,
      };
    } catch {
      hardware = null;
    }
  }

  const session = buildDevSessionSnapshot({
    projectPath: project.projectPath,
    currentFile: project.currentFile,
    isDirty: project.isDirty,
    nodes: editor.nodes,
    edges: editor.edges,
    selectedNodeId: editor.selectedNodeId,
    diagnostics: useDiagnosticsStore.getState().diagnostics,
    preview: {
      mode: preview.mode,
      viewMode: preview.viewMode,
      isLoading: preview.isLoading,
      previewError: preview.previewError,
      selectedPreviewNodeId: preview.selectedPreviewNodeId,
    },
    bridge: {
      connected: bridge.connected,
      host: bridge.host,
      port: bridge.port,
    },
  });

  let appVersion = "unknown";
  try {
    appVersion = await getAppVersion();
  } catch {
    appVersion = import.meta.env.DEV ? "dev" : "unknown";
  }

  return {
    ...session,
    appVersion,
    platform: navigator.platform,
    osLabel: detectOsLabel(),
    display: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    hardware,
    settings: {
      hytaleAssetSyncEnabled: settings.hytaleAssetSyncEnabled,
      hytaleAssetSourceChannel: settings.hytaleAssetSourceChannel,
      flowDirection: settings.flowDirection,
      exportPath: settings.exportPath,
    },
    config: {
      debounceMs: config.debounceMs,
      gpuMemoryBudgetMb: config.gpuMemoryBudgetMb,
      rendererPixelRatio: config.rendererPixelRatio,
    },
    diagnosticsDetail: topDiagnostics(),
    legacyHitCount: legacyHits,
    reportArea: options?.area,
    userSummary: options?.userSummary,
    error: options?.error,
  };
}

export function buildBugReportIssueUrl(bundle: BugReportBundle, titleHint?: string): string {
  const params = new URLSearchParams();
  params.set("template", "BUG_REPORT.yml");
  params.set("appVersion", bundle.appVersion);
  params.set("os", bundle.osLabel);
  if (bundle.reportArea) params.set("area", bundle.reportArea);
  const title = titleHint?.trim() || bundle.userSummary?.trim() || bundle.error?.message;
  if (title) {
    const clipped = title.length > 80 ? `${title.slice(0, 77)}...` : title;
    params.set("title", `[Bug]: ${clipped}`);
  }
  return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}

export function bundleSummaryLines(bundle: BugReportBundle): string[] {
  const lines = [
    `Version ${bundle.appVersion} (${bundle.runtime})`,
    bundle.currentFile ? `Open file: ${bundle.currentFile}` : "No file open",
    `Graph: ${bundle.graph.nodeCount} nodes, ${bundle.graph.edgeCount} edges`,
    `Validation: ${bundle.validation.errors} errors, ${bundle.validation.warnings} warnings`,
  ];
  if (bundle.preview.previewError) {
    lines.push(`Preview error: ${bundle.preview.previewError}`);
  }
  if (bundle.legacyHitCount > 0) {
    lines.push(`Legacy hits: ${bundle.legacyHitCount}`);
  }
  if (bundle.error?.message) {
    lines.push(`Crash: ${bundle.error.message}`);
  }
  return lines;
}
