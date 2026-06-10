import type { Node, Edge } from "@xyflow/react";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useUIStore } from "@/stores/uiStore";
import { useDevMetricsStore } from "@/stores/devMetricsStore";
import { useSettingsStore } from "@/stores/settingsStore";
import { useProjectStore } from "@/stores/projectStore";
import {
  collectExternalImportedNames,
  resolveDensityExportsFromCache,
} from "@/utils/densityExportRegistry";
import { resolve2dPreviewResolutionForZoom } from "@/utils/previewResolution";

export interface DensityImportStatus {
  requested: string[];
  resolved: string[];
  missing: string[];
}

export function getDensityImportStatus(
  nodes: Node[] | null | undefined,
  edges: Edge[] | null | undefined,
): DensityImportStatus {
  const requested = collectExternalImportedNames(nodes, edges);
  const resolvedMap = resolveDensityExportsFromCache(requested);
  const resolved = Object.keys(resolvedMap);
  const missing = requested.filter((name) => !resolvedMap[name]);
  return { requested, resolved, missing };
}

export interface PreviewPipelineSnapshot {
  at: string;
  debugWorkerLogging: boolean;
  preview: {
    mode: string;
    viewMode: string;
    densityEvalKey: string | null;
    voxelEvalKey: string | null;
    isLoading: boolean;
    isVoxelLoading: boolean;
    previewError: string | null;
    voxelError: string | null;
    resolution: number;
    evalResolution: number;
    canvasScale: number;
    rangeMin: number;
    rangeMax: number;
    yLevel: number;
    voxelYMin: number;
    voxelYMax: number;
    voxelResolution: number;
    selectedPreviewNodeId: string | null;
    canvasTransform: { scale: number; offsetX: number; offsetY: number };
    hasValues: boolean;
    hasVoxelMesh: boolean;
  };
  graph: {
    nodeCount: number;
    edgeCount: number;
    outputNodeId: string | null;
    selectedNodeId: string | null;
  };
  imports: DensityImportStatus;
  metrics: {
    density: ReturnType<typeof useDevMetricsStore.getState>["density"];
    voxelEval: ReturnType<typeof useDevMetricsStore.getState>["voxelEval"];
    voxel: ReturnType<typeof useDevMetricsStore.getState>["voxel"];
    world: ReturnType<typeof useDevMetricsStore.getState>["world"];
  };
  layout: {
    rightPanelVisible: boolean;
    rightPanelMode: string;
    inspectingNode: boolean;
  };
  project: {
    projectPath: string | null;
    currentFile: string | null;
  };
}

/** Point-in-time preview pipeline state for debugging copy/paste. */
export function buildPreviewPipelineSnapshot(): PreviewPipelineSnapshot {
  const preview = usePreviewStore.getState();
  const editor = useEditorStore.getState();
  const ui = useUIStore.getState();
  const metrics = useDevMetricsStore.getState();
  const project = useProjectStore.getState();

  const inspectingNode = ui.rightPanelVisible
    && ui.rightPanelMode === "properties"
    && Boolean(editor.selectedNodeId);

  return {
    at: new Date().toISOString(),
    debugWorkerLogging: useSettingsStore.getState().debugWorkerLogging,
    preview: {
      mode: preview.mode,
      viewMode: preview.viewMode,
      densityEvalKey: preview.densityEvalKey,
      voxelEvalKey: preview.voxelEvalKey,
      isLoading: preview.isLoading,
      isVoxelLoading: preview.isVoxelLoading,
      previewError: preview.previewError,
      voxelError: preview.voxelError,
      resolution: preview.resolution,
      evalResolution: resolve2dPreviewResolutionForZoom(
        preview.resolution,
        preview.canvasTransform.scale,
      ),
      canvasScale: preview.canvasTransform.scale,
      rangeMin: preview.rangeMin,
      rangeMax: preview.rangeMax,
      yLevel: preview.yLevel,
      voxelYMin: preview.voxelYMin,
      voxelYMax: preview.voxelYMax,
      voxelResolution: preview.voxelResolution,
      selectedPreviewNodeId: preview.selectedPreviewNodeId,
      canvasTransform: { ...preview.canvasTransform },
      hasValues: preview.values != null,
      hasVoxelMesh: preview.voxelMeshData != null,
    },
    graph: {
      nodeCount: editor.nodes.length,
      edgeCount: editor.edges.length,
      outputNodeId: editor.outputNodeId,
      selectedNodeId: editor.selectedNodeId,
    },
    imports: getDensityImportStatus(editor.nodes, editor.edges),
    metrics: {
      density: metrics.density,
      voxelEval: metrics.voxelEval,
      voxel: metrics.voxel,
      world: metrics.world,
    },
    layout: {
      rightPanelVisible: ui.rightPanelVisible,
      rightPanelMode: ui.rightPanelMode,
      inspectingNode,
    },
    project: {
      projectPath: project.projectPath,
      currentFile: project.currentFile,
    },
  };
}
