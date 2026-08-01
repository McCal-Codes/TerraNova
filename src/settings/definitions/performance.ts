import { DEFAULTS, useConfigStore, type GpuPowerPreference } from "@/stores/configStore";
import { defineSetting, type AnySettingDefinition, type CategoryId } from "../types";

const c = () => useConfigStore.getState();

const CATEGORY: CategoryId = "performance";

/**
 * Preview & performance is rendered wholesale by `SystemSettingsPanel`, which
 * keeps its own CPU/GPU/RAM/Defaults sub-tabs. These entries exist so the
 * settings are searchable, show modified state, and can be reset — search
 * results navigate to the owning sub-tab via `deepLink`.
 */
function perf<T>(
  id: string,
  subTab: "cpu" | "gpu" | "ram" | "defaults",
  label: string,
  defaultValue: T,
  read: () => T,
  write: (value: T) => void,
  searchTerms: readonly string[],
  description?: string,
) {
  return defineSetting<T>({
    id,
    storeKey: id.slice(id.indexOf(".") + 1),
    category: CATEGORY,
    section: subTab,
    label,
    description,
    defaultValue,
    scopes: ["user"],
    searchTerms,
    control: { kind: "panel" },
    deepLink: { category: CATEGORY, subTab },
    read,
    write,
  });
}

export const PERFORMANCE_SETTINGS: AnySettingDefinition[] = [
  // ── CPU ──
  perf("performance.cpuCoresAllocated", "cpu", "CPU cores allocated", DEFAULTS.cpuCoresAllocated,
    () => c().cpuCoresAllocated, (v) => c().applyCpuBudget(v),
    ["cpu", "cores", "threads", "budget"]),
  perf("performance.debounceMs", "cpu", "Evaluation debounce", DEFAULTS.debounceMs,
    () => c().debounceMs, (v) => c().setDebounceMs(v),
    ["debounce", "delay", "evaluation", "refresh"],
    "How long to wait after a graph edit before re-evaluating the preview."),
  perf("performance.autoRefresh", "cpu", "Auto-refresh preview", DEFAULTS.autoRefresh,
    () => c().autoRefresh, (v) => c().setAutoRefresh(v),
    ["auto refresh", "live preview", "automatic"]),
  perf("performance.enableProgressiveVoxel", "cpu", "Progressive voxel preview", DEFAULTS.enableProgressiveVoxel,
    () => c().enableProgressiveVoxel, (v) => c().setEnableProgressiveVoxel(v),
    ["progressive", "voxel", "incremental"]),
  perf("performance.maxWorkerThreads", "cpu", "Worker threads", DEFAULTS.maxWorkerThreads,
    () => c().maxWorkerThreads, (v) => c().setMaxWorkerThreads(v),
    ["worker", "threads", "parallel", "concurrency"]),

  // ── GPU ──
  perf("performance.gpuMemoryBudgetMb", "gpu", "GPU memory budget", DEFAULTS.gpuMemoryBudgetMb,
    () => c().gpuMemoryBudgetMb, (v) => c().applyGpuBudget(v),
    ["gpu", "vram", "memory", "budget"]),
  perf<GpuPowerPreference>("performance.gpuPowerPreference", "gpu", "GPU power preference", DEFAULTS.gpuPowerPreference,
    () => c().gpuPowerPreference, (v) => c().setGpuPowerPreference(v),
    ["gpu", "power", "battery", "high performance"]),
  perf("performance.preferredGpuId", "gpu", "Preferred GPU", DEFAULTS.preferredGpuId,
    () => c().preferredGpuId, (v) => c().setPreferredGpuId(v),
    ["gpu", "adapter", "graphics card"]),
  perf("performance.rendererPixelRatio", "gpu", "Renderer pixel ratio", DEFAULTS.rendererPixelRatio,
    () => c().rendererPixelRatio, (v) => c().setRendererPixelRatio(v),
    ["pixel ratio", "resolution", "dpi", "sharpness"]),
  perf("performance.enableShadows", "gpu", "Shadows", DEFAULTS.enableShadows,
    () => c().enableShadows, (v) => c().setEnableShadows(v),
    ["shadow", "lighting", "quality"]),
  perf("performance.shadowMapSize", "gpu", "Shadow map size", DEFAULTS.shadowMapSize,
    () => c().shadowMapSize, (v) => c().setShadowMapSize(v),
    ["shadow", "quality", "resolution"]),
  perf("performance.ssaoSamples", "gpu", "SSAO samples", DEFAULTS.ssaoSamples,
    () => c().ssaoSamples, (v) => c().setSsaoSamples(v),
    ["ssao", "ambient occlusion", "quality"]),

  // ── Memory ──
  perf("performance.ramBudgetMb", "ram", "Memory budget", DEFAULTS.ramBudgetMb,
    () => c().ramBudgetMb, (v) => c().applyRamBudget(v),
    ["ram", "memory", "budget"]),
  perf("performance.maxHistoryEntries", "ram", "History limit", DEFAULTS.maxHistoryEntries,
    () => c().maxHistoryEntries, (v) => c().setMaxHistoryEntries(v),
    ["history", "undo", "limit"]),
  perf("performance.maxPersistedHistory", "ram", "Persisted history limit", DEFAULTS.maxPersistedHistory,
    () => c().maxPersistedHistory, (v) => c().setMaxPersistedHistory(v),
    ["history", "undo", "persist", "limit"]),

  // ── Defaults ──
  perf("performance.defaultPreviewRes", "defaults", "Default 2D preview resolution", DEFAULTS.defaultPreviewRes,
    () => c().defaultPreviewRes, (v) => c().setDefaultPreviewRes(v),
    ["preview", "resolution", "quality", "2d"]),
  perf("performance.defaultVoxelRes", "defaults", "Default voxel resolution", DEFAULTS.defaultVoxelRes,
    () => c().defaultVoxelRes, (v) => c().setDefaultVoxelRes(v),
    ["voxel", "resolution", "quality", "3d"]),
  perf("performance.defaultVoxelYSlices", "defaults", "Default voxel Y slices", DEFAULTS.defaultVoxelYSlices,
    () => c().defaultVoxelYSlices, (v) => c().setDefaultVoxelYSlices(v),
    ["voxel", "slices", "height", "3d"]),
];
