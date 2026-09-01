/**
 * Dev Lab type surface.
 *
 * Kept free of React and of rendering concerns so the registry and runner can be
 * unit tested, and so adding a case never means touching a component.
 */

export const DEV_LAB_CATEGORIES = [
  "Density",
  "Combiners",
  "Curves",
  "Positions and Cells",
  "Materials",
  "Props",
  "Imported Assets",
  "World Structures",
  "Known Regressions",
  "Experimental",
] as const;

export type DevLabCaseCategory = (typeof DEV_LAB_CATEGORIES)[number];

export type DevLabChannel = "release" | "pre-release" | "either";

export type DevLabPreviewMode = "2d" | "3d" | "voxel";

/**
 * Case outcome.
 *
 * `unsupported` is deliberately distinct from `failed`: a graph using a node
 * TerraNova cannot evaluate is not a regression, and reporting it as one trains
 * people to ignore failures.
 */
export type DevLabStatus =
  | "not-run"
  | "running"
  | "passed"
  | "warning"
  | "failed"
  | "unsupported";

export interface DevLabCase {
  id: string;
  title: string;
  description: string;
  category: DevLabCaseCategory;
  tags: string[];

  source:
    | { kind: "synthetic"; setupId: string }
    | { kind: "hytale-cache"; relativePath: string; channel?: DevLabChannel };

  preview: {
    mode: DevLabPreviewMode;
    targetNodeId?: string;
    yLevel?: number;
    voxelYMin?: number;
    voxelYMax?: number;
    resolution?: number;
    voxelResolution?: number;
    voxelYSlices?: number;
    cutaway?: boolean;
    materials?: boolean;
    wireframe?: boolean;
    cellMap?: boolean;
  };

  expected: {
    summary: string;
    requiredNodeTypes?: string[];
    forbiddenErrors?: string[];
    allowApproximation?: boolean;
    /**
     * Broad sanity bands, not tight thresholds — floating-point drift across
     * platforms must not turn into a red build.
     */
    ranges?: Partial<Record<DevLabMetricKey, { min?: number; max?: number }>>;
  };
}

export const DEV_LAB_METRIC_KEYS = [
  "minDensity",
  "maxDensity",
  "meanDensity",
  "solidRatio",
  "vertexCount",
  "triangleCount",
  "durationMs",
  "unsupportedNodeCount",
  "approximateNodeCount",
  "materialFallbackCount",
] as const;

export type DevLabMetricKey = (typeof DEV_LAB_METRIC_KEYS)[number];

export type DevLabMetrics = Partial<Record<DevLabMetricKey, number>>;

export interface DevLabDiagnostic {
  severity: "info" | "warning" | "error";
  code: string;
  message: string;
}

export interface DevLabResult {
  caseId: string;
  status: DevLabStatus;
  metrics: DevLabMetrics;
  diagnostics: DevLabDiagnostic[];
  /** Node types the graph uses that the evaluator does not implement. */
  unsupportedNodeTypes: string[];
  /** Node types evaluated with a known approximation. */
  approximateNodeTypes: string[];
  startedAt: string;
  durationMs: number;
  screenshotPath?: string;
}

export function isDevLabCategory(value: unknown): value is DevLabCaseCategory {
  return typeof value === "string" && (DEV_LAB_CATEGORIES as readonly string[]).includes(value);
}

/**
 * Reject anything that could escape the managed asset cache.
 *
 * Cases are data, and data can arrive from a contributor's branch, so the path is
 * validated rather than trusted.
 */
export function isSafeCacheRelativePath(path: string): boolean {
  if (!path || typeof path !== "string") return false;
  if (path.startsWith("/") || path.startsWith("\\")) return false;
  if (/^[A-Za-z]:/.test(path)) return false;
  const segments = path.split(/[\\/]+/);
  if (segments.some((s) => s === "..")) return false;
  return segments.every((s) => s.length > 0);
}

/** Worst status wins, so a run summary never looks healthier than its cases. */
export function aggregateStatus(statuses: DevLabStatus[]): DevLabStatus {
  const order: DevLabStatus[] = ["failed", "unsupported", "warning", "passed", "running", "not-run"];
  for (const candidate of order) {
    if (statuses.includes(candidate)) return candidate;
  }
  return "not-run";
}
