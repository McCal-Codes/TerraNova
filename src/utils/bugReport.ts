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
import { ALPHA_WHAT_TO_TEST_VERSION } from "@/constants/alphaTestFocus";
import { attachmentPathsForIssueBody } from "@/utils/bugReportAttachments";
import type { GraphDiagnostic } from "@/utils/graphDiagnostics";
import { isMac, isTauriRuntime } from "@/utils/platform";
import { readCrashLog, type PersistedCrash } from "@/components/ErrorBoundary";

export const BUG_REPORT_SCHEMA_VERSION = 2;
export const BUILD_CHANNEL = "closed-alpha" as const;

export type BugReportArea =
  | "Preview"
  | "Export"
  | "Bridge"
  | "Create Pack"
  | "Import"
  | "Onboarding"
  | "Editor"
  | "Other";

export interface BugReportErrorContext {
  message: string;
  stack?: string;
  componentStack?: string;
}

export interface BugReportUserInput {
  area: BugReportArea;
  summary?: string;
  steps?: string;
  expected?: string;
  actual?: string;
}

export interface BugReportAttachmentRef {
  id: string;
  name: string;
  kind: "screenshot" | "file";
  savedPath: string;
  sizeBytes: number;
  mime: string;
}

interface DiagnosticIssue {
  severity: GraphDiagnostic["severity"];
  message: string;
  nodeId: string | null;
  field?: string | null;
  code?: string;
  biomeSection?: string | null;
}

interface LegacySample {
  file: string;
  typeKey: string;
  tier: string;
  replacement: string | null;
}

export interface BugReportBundle {
  schemaVersion: typeof BUG_REPORT_SCHEMA_VERSION;
  buildChannel: typeof BUILD_CHANNEL;
  alphaBuild: string;
  capturedAt: string;
  runtime: "tauri" | "browser";
  appVersion: string;
  os: {
    label: string;
    platform: string;
  };
  display: { width: number; height: number; devicePixelRatio: number };
  hardware: Pick<HardwareInfo, "cpuName" | "cpuCores" | "totalRamMb" | "gpuRenderer" | "estimatedVramMb"> | null;
  report: BugReportUserInput;
  attachments?: BugReportAttachmentRef[];
  session: {
    projectPath: string | null;
    currentFile: string | null;
    isDirty: boolean;
    graph: {
      nodeCount: number;
      edgeCount: number;
      selectedNodeId: string | null;
      selectedNodeType: string | null;
      selectedCount: number;
    };
    validation: {
      total: number;
      errors: number;
      warnings: number;
      info: number;
      topIssues: DiagnosticIssue[];
    };
    preview: {
      mode: string;
      viewMode: string;
      propPreviewMode: string;
      autoRefresh: boolean;
      isLoading: boolean;
      previewError: string | null;
      selectedPreviewNodeId: string | null;
      comparisonEnabled: boolean;
    };
    bridge: {
      connected: boolean;
      host: string;
      port: number;
      savePath: string | null;
      modPath: string | null;
    };
    assets: {
      syncEnabled: boolean;
      sourceChannel: string;
      releasePathConfigured: boolean;
      commonOverlayEnabled: boolean;
    };
    config: {
      debounceMs: number;
      gpuMemoryBudgetMb: number;
      rendererPixelRatio: number;
    };
    legacy: {
      hitCount: number;
      samples: LegacySample[];
    };
  };
  error?: BugReportErrorContext;
  /**
   * Crashes recorded by the ErrorBoundary, newest first. A React crash blanks
   * the window and a reload clears the console, so without this the report of
   * a crash carries no trace of the crash that preceded it.
   */
  recentCrashes?: PersistedCrash[];
}

/** Redact Windows user folder and Unix home segments from paths in public reports. */
export function sanitizeReportPath(path: string | null | undefined): string | null {
  if (!path?.trim()) return null;
  return path
    .replace(/^[A-Za-z]:[\\/]Users[\\/][^\\/]+/i, "~")
    .replace(/([\\/])Users[\\/][^\\/]+/gi, "$1~")
    .replace(/([\\/])home[\\/][^\\/]+/gi, "$1~");
}

export function detectOsLabel(): string {
  const ua = navigator.userAgent;
  if (isMac) {
    return ua.includes("Intel") ? "macOS (Intel)" : "macOS (Apple Silicon)";
  }
  if (ua.includes("Windows")) {
    return ua.includes("Windows 10") ? "Windows 10" : "Windows 11";
  }
  if (ua.includes("Linux")) {
    if (ua.includes("Ubuntu") || ua.includes("Debian")) return "Linux (Debian/Ubuntu)";
    if (ua.includes("Fedora") || ua.includes("Red Hat")) return "Linux (Fedora/RedHat)";
    if (ua.includes("Arch")) return "Linux (Arch)";
    return "Linux (Other)";
  }
  return "Other";
}

export function inferBugReportArea(
  error?: BugReportErrorContext | null,
  previewError?: string | null,
): BugReportArea | undefined {
  const blob = [error?.message, error?.componentStack, previewError]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  if (!blob) return undefined;
  if (blob.includes("bridge") || blob.includes("127.0.0.1:7854")) return "Bridge";
  if (blob.includes("export") || blob.includes("asset pack")) return "Export";
  if (blob.includes("preview") || blob.includes("webgl") || blob.includes("voxel")) return "Preview";
  if (blob.includes("import") || blob.includes("json")) return "Import";
  if (blob.includes("pack wizard") || blob.includes("create pack")) return "Create Pack";
  if (blob.includes("onboarding") || blob.includes("sync")) return "Onboarding";
  return undefined;
}

function topDiagnostics(limit = 8): DiagnosticIssue[] {
  const all = useDiagnosticsStore.getState().diagnostics;
  const ranked = [...all].sort((a, b) => {
    const rank = (s: GraphDiagnostic["severity"]) => (s === "error" ? 0 : s === "warning" ? 1 : 2);
    return rank(a.severity) - rank(b.severity);
  });
  return ranked.slice(0, limit).map((d) => ({
    severity: d.severity,
    message: d.message,
    nodeId: d.nodeId,
    field: d.field,
    code: d.code,
    biomeSection: d.biomeSection,
  }));
}

function legacySamples(limit = 5): LegacySample[] {
  return useProjectLegacyStore
    .getState()
    .hits.slice(0, limit)
    .map((h) => ({
      file: h.file,
      typeKey: h.typeKey,
      tier: h.tier,
      replacement: h.replacement,
    }));
}

function selectedNodeType(nodes: ReturnType<typeof useEditorStore.getState>["nodes"], id: string | null): string | null {
  if (!id) return null;
  const node = nodes.find((n) => n.id === id);
  if (!node) return null;
  const data = node.data as Record<string, unknown>;
  return typeof data.type === "string" ? data.type : node.type ?? null;
}

export async function buildBugReportBundle(options?: {
  report?: Partial<BugReportUserInput>;
  error?: BugReportErrorContext;
  hardware?: HardwareInfo | null;
  attachments?: BugReportAttachmentRef[];
}): Promise<BugReportBundle> {
  const editor = useEditorStore.getState();
  const project = useProjectStore.getState();
  const preview = usePreviewStore.getState();
  const bridge = useBridgeStore.getState();
  const settings = useSettingsStore.getState();
  const config = useConfigStore.getState();
  const diagnostics = useDiagnosticsStore.getState().diagnostics;

  const inferredArea = inferBugReportArea(options?.error, preview.previewError);
  const report: BugReportUserInput = {
    area: options?.report?.area ?? inferredArea ?? "Other",
    summary: options?.report?.summary?.trim() || undefined,
    steps: options?.report?.steps?.trim() || undefined,
    expected: options?.report?.expected?.trim() || undefined,
    actual: options?.report?.actual?.trim() || undefined,
  };

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
    diagnostics,
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
    schemaVersion: BUG_REPORT_SCHEMA_VERSION,
    buildChannel: BUILD_CHANNEL,
    alphaBuild: ALPHA_WHAT_TO_TEST_VERSION,
    capturedAt: session.capturedAt,
    runtime: session.runtime,
    appVersion,
    os: {
      label: detectOsLabel(),
      platform: navigator.platform,
    },
    display: {
      width: window.innerWidth,
      height: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    },
    hardware,
    report,
    attachments: options?.attachments?.length ? options.attachments : undefined,
    session: {
      projectPath: sanitizeReportPath(session.projectPath),
      currentFile: session.currentFile,
      isDirty: session.isDirty,
      graph: {
        nodeCount: session.graph.nodeCount,
        edgeCount: session.graph.edgeCount,
        selectedNodeId: session.graph.selectedNodeId,
        selectedNodeType: selectedNodeType(editor.nodes, session.graph.selectedNodeId),
        selectedCount: session.graph.selectedCount,
      },
      validation: {
        total: session.validation.total,
        errors: session.validation.errors,
        warnings: session.validation.warnings,
        info: session.validation.info,
        topIssues: topDiagnostics(),
      },
      preview: {
        mode: preview.mode,
        viewMode: preview.viewMode,
        propPreviewMode: preview.propPreviewMode,
        autoRefresh: preview.autoRefresh,
        isLoading: preview.isLoading,
        previewError: preview.previewError,
        selectedPreviewNodeId: preview.selectedPreviewNodeId,
        comparisonEnabled: preview.viewMode === "compare",
      },
      bridge: {
        connected: bridge.connected,
        host: bridge.host,
        port: bridge.port,
        savePath: sanitizeReportPath(bridge.discovery?.saveRoot ?? null),
        modPath: sanitizeReportPath(bridge.serverModPath || bridge.discovery?.modPackPath || null),
      },
      assets: {
        syncEnabled: settings.hytaleAssetSyncEnabled,
        sourceChannel: settings.hytaleAssetSourceChannel,
        releasePathConfigured: settings.hytaleReleaseAssetsPath.trim().length > 0,
        commonOverlayEnabled: settings.hytaleCommonAssetsEnabled,
      },
      config: {
        debounceMs: config.debounceMs,
        gpuMemoryBudgetMb: config.gpuMemoryBudgetMb,
        rendererPixelRatio: config.rendererPixelRatio,
      },
      legacy: {
        hitCount: useProjectLegacyStore.getState().hits.length,
        samples: legacySamples(),
      },
    },
    error: options?.error,
    recentCrashes: readCrashLog(),
  };
}

export function buildBugReportIssueUrl(bundle: BugReportBundle): string {
  const params = new URLSearchParams();
  params.set("template", "BUG_REPORT.yml");
  params.set("appVersion", bundle.appVersion);
  params.set("os", bundle.os.label);
  params.set("area", bundle.report.area);

  const title =
    bundle.report.summary?.trim()
    || bundle.error?.message
    || `${bundle.report.area} issue`;
  const clipped = title.length > 80 ? `${title.slice(0, 77)}...` : title;
  params.set("title", `[Bug]: ${clipped}`);

  const descriptionParts = [
    bundle.report.summary?.trim(),
    bundle.report.actual?.trim() ? `**Observed:** ${bundle.report.actual.trim()}` : null,
  ].filter(Boolean);
  if (descriptionParts.length > 0) {
    params.set("description", descriptionParts.join("\n\n"));
  }

  const steps = bundle.report.steps?.trim();
  if (steps) {
    params.set("steps", steps);
  }

  const expected = bundle.report.expected?.trim();
  if (expected) {
    params.set("expected", expected);
  }

  const attachmentNote = attachmentPathsForIssueBody(bundle.attachments ?? []);
  if (attachmentNote) {
    params.set(
      "screenshots",
      `${attachmentNote}\n\nDrag these files onto the GitHub issue after it opens.`,
    );
  }

  return `${GITHUB_REPO_URL}/issues/new?${params.toString()}`;
}

export function bundleSummaryLines(bundle: BugReportBundle): string[] {
  const lines = [
    `${bundle.buildChannel} ${bundle.appVersion} (${bundle.runtime})`,
    `Area: ${bundle.report.area}`,
    bundle.session.currentFile
      ? `Open file: ${bundle.session.currentFile}`
      : "No file open",
    `Graph: ${bundle.session.graph.nodeCount} nodes, ${bundle.session.graph.edgeCount} edges`,
  ];
  if (bundle.session.graph.selectedNodeType) {
    lines.push(`Selection: ${bundle.session.graph.selectedNodeType}`);
  }
  lines.push(
    `Validation: ${bundle.session.validation.errors} errors, ${bundle.session.validation.warnings} warnings`,
  );
  lines.push(
    `Preview: ${bundle.session.preview.mode} / ${bundle.session.preview.viewMode}${
      bundle.session.preview.previewError ? " — error" : ""
    }`,
  );
  if (bundle.session.assets.syncEnabled) {
    lines.push(
      `Assets: ${bundle.session.assets.sourceChannel} sync${
        bundle.session.assets.releasePathConfigured ? "" : " (path not set)"
      }`,
    );
  }
  if (bundle.session.bridge.connected) {
    lines.push(`Bridge: connected ${bundle.session.bridge.host}:${bundle.session.bridge.port}`);
  }
  if (bundle.session.legacy.hitCount > 0) {
    lines.push(`Legacy hits: ${bundle.session.legacy.hitCount}`);
  }
  if (bundle.error?.message) {
    lines.push(`Crash: ${bundle.error.message}`);
  }
  if (bundle.attachments?.length) {
    lines.push(`Attachments: ${bundle.attachments.length} file(s)`);
  }
  return lines;
}

/** Clipboard payload: short triage header + compact JSON for GitHub Session snapshot. */
export function formatBugReportClipboard(bundle: BugReportBundle): string {
  const headerParts: (string | null)[] = [
    `TerraNova ${bundle.buildChannel} ${bundle.appVersion}`,
    `Captured: ${bundle.capturedAt}`,
    `OS: ${bundle.os.label}`,
    `Area: ${bundle.report.area}`,
    bundle.report.summary ? `Summary: ${bundle.report.summary}` : null,
    "",
    "— Session —",
    ...bundleSummaryLines(bundle).slice(1),
    "",
  ];
  if (bundle.attachments?.length) {
    headerParts.push(
      "— Attachments (drag onto GitHub issue) —",
      attachmentPathsForIssueBody(bundle.attachments),
      "",
    );
  }
  headerParts.push("— Debug bundle (paste below into GitHub Session snapshot) —");

  const header = headerParts.filter((line) => line !== null).join("\n");

  return `${header}\n${JSON.stringify(bundle, null, 2)}`;
}
