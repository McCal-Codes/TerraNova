import { useEffect, useMemo, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { PreviewPanel } from "@/components/preview/PreviewPanel";
import { PreviewEvaluationHost } from "@/components/preview/PreviewEvaluationHost";
import { useEditorStore } from "@/stores/editorStore";
import { usePreviewStore } from "@/stores/previewStore";
import { useProjectStore } from "@/stores/projectStore";
import {
  GALLERY_CASES,
  GALLERY_CONTENT_FIELDS,
  getGalleryCaseSetup,
  parseGalleryCase,
} from "./shapePreviewGalleryCases";
import { getNodeType } from "@/utils/density/evalTypes";
import { PreviewModeToggleGroup } from "@/components/preview/controls/PreviewControlPrimitives";
import { useBridgeStore } from "@/stores/bridgeStore";

/**
 * DEV-only harness using shipped reference biomes:
 * `/?shape-preview-gallery=1&case=…` (see GALLERY_CASES in shapePreviewGalleryCases.ts)
 */
const CASE_EXPECT: Record<string, string> = {
  "underworld-cell": "Expect: white Voronoi cell walls on CellNoise2D slice",
  "underworld-max": "Expect: Max heatmap + merged fine/coarse cell walls (enable shape layers)",
  "tropical-pcn": "Expect: cell walls + amber mesh dots (Mesh2D chain)",
  "sdf-showcase":
    "2D/3D: pink zero contour. Voxel: full 3D mesh (Y ±32 around origin); use shape picker",
  "mudcracks-cube":
    "Small curve-shaped box SDF (~±2 world units). Voxel: wireframe + pink slice at Y=0; enable Material Colors to tint solids",
};

export function ShapePreviewGalleryHarness() {
  const [ready, setReady] = useState(false);
  const previewMode = usePreviewStore((s) => s.mode);
  const setMode = usePreviewStore((s) => s.setMode);
  const bridgeConnected = useBridgeStore((s) => s.connected);
  const caseId = useMemo(
    () => parseGalleryCase(window.location.search),
    [],
  );
  const setup = useMemo(() => getGalleryCaseSetup(caseId), [caseId]);

  useEffect(() => {
    setReady(false);
    const s = getGalleryCaseSetup(caseId);

    useProjectStore.setState({
      projectPath: "dev-shape-preview-gallery",
      currentFile: s.referencePath,
      isDirty: false,
    });

    useEditorStore.setState({
      nodes: s.nodes,
      edges: s.edges,
      outputNodeId: s.outputNodeId,
      contentFields: GALLERY_CONTENT_FIELDS,
      materialConfig: s.materialConfig,
      editingContext: "Biome",
    });

    usePreviewStore.getState().applyShapePreviewPreset(s.preset);
    const isSdfCase = s.preset === "sdf";
    usePreviewStore.setState({
      viewMode: "preview",
      mode: "2d",
      autoRefresh: true,
      showShapePreview: true,
      showShapeCellMap: s.preset !== "sdf",
      // Mudcracks cube is a tiny solid SDF — material tint makes it visible in voxel mode.
      showMaterialColors: caseId === "mudcracks-cube",
      showVoxelWireframe: isSdfCase,
      autoFitYEnabled: !isSdfCase,
      selectedPreviewNodeId: s.previewNodeId,
      rangeMin: -64,
      rangeMax: 64,
      yLevel: s.yLevel,
      resolution: 128,
      voxelYMin: s.voxelYMin,
      voxelYMax: s.voxelYMax,
      voxelResolution: 64,
      voxelYSlices: 64,
    });

    setReady(true);
  }, [caseId, setup]);

  const mixAlts = setup.mixAltNodeIds ?? [];
  const usesSdfPreset = setup.preset === "sdf";
  const showSubTargets =
    mixAlts.length > 0 && (caseId === "underworld-max" || caseId === "sdf-showcase");

  return (
    <ReactFlowProvider>
      <PreviewEvaluationHost />
      <div className="flex h-screen flex-col bg-tn-bg text-tn-text" data-testid="shape-preview-gallery">
        <div className="flex flex-wrap items-center gap-2 border-b border-tn-border px-3 py-2 text-xs">
          <span className="text-tn-text-muted">Shape Preview UAT (reference biomes) —</span>
          {GALLERY_CASES.map((id) => (
            <a
              key={id}
              href={`/?shape-preview-gallery=1&case=${id}`}
              className={`rounded border px-2 py-0.5 ${
                id === caseId
                  ? "border-tn-accent bg-tn-accent/20 text-tn-accent"
                  : "border-tn-border text-tn-text-muted hover:text-tn-text"
              }`}
            >
              {id}
            </a>
          ))}
          <span className="text-tn-text-muted">
            {setup.label} —{" "}
            <span className="text-tn-text-muted/80">({setup.referencePath})</span>{" "}
            {ready ? (
              <span data-testid="gallery-ready" className="text-tn-accent">
                ready
              </span>
            ) : (
              "loading…"
            )}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-b border-tn-border px-3 py-1 text-[10px]">
          <PreviewModeToggleGroup
            mode={previewMode}
            onModeChange={setMode}
            bridgeConnected={bridgeConnected}
          />
          <span className="text-tn-text-muted">{CASE_EXPECT[caseId] ?? ""}</span>
          {setup.preset !== "sdf" && previewMode === "voxel" && (
            <span
              role="status"
              className="rounded border border-amber-500/25 bg-amber-950/50 px-2 py-0.5 text-amber-200/90"
            >
              Voxel misaligns PCN overlays — use 2D + cell map.
            </span>
          )}
        </div>
        {showSubTargets && (
          <div className="flex flex-wrap gap-2 border-b border-tn-border px-3 py-1 text-[10px] text-tn-text-muted">
            {caseId === "sdf-showcase" ? "SDF shapes:" : "TheUnderworld sub-targets:"}
            {caseId === "underworld-max" && (
              <button
                type="button"
                className="rounded border border-tn-border px-2 py-0.5 hover:text-tn-text"
                onClick={() => {
                  usePreviewStore.getState().setSelectedPreviewNodeId(setup.outputNodeId);
                  usePreviewStore.getState().applyShapePreviewPreset("pcn");
                }}
              >
                Max (output)
              </button>
            )}
            {caseId === "sdf-showcase" && setup.previewNodeId && (
              <button
                type="button"
                className="rounded border border-tn-border px-2 py-0.5 hover:text-tn-text"
                onClick={() => {
                  usePreviewStore.getState().setSelectedPreviewNodeId(setup.previewNodeId);
                  usePreviewStore.getState().applyShapePreviewPreset("sdf");
                }}
              >
                Ellipsoid (default)
              </button>
            )}
            {mixAlts.map((nodeId) => {
              const node = setup.nodes.find((n) => n.id === nodeId);
              const type = node ? getNodeType(node) : "?";
              const fields = (node?.data as Record<string, unknown>)?.fields as
                | Record<string, unknown>
                | undefined;
              const freq = fields?.Frequency;
              return (
                <button
                  key={nodeId}
                  type="button"
                  className="rounded border border-tn-border px-2 py-0.5 hover:text-tn-text"
                  onClick={() => {
                    usePreviewStore.getState().setSelectedPreviewNodeId(nodeId);
                    usePreviewStore.getState().applyShapePreviewPreset(
                      usesSdfPreset ? "sdf" : "pcn",
                    );
                  }}
                >
                  {type}
                  {typeof freq === "number" ? ` (f=${freq})` : ""}
                </button>
              );
            })}
          </div>
        )}
        <div className="min-h-0 flex-1">
          <PreviewPanel />
        </div>
      </div>
    </ReactFlowProvider>
  );
}
