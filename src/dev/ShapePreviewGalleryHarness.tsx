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
  HYTALE_GALLERY_BIOME_PATHS,
  type GalleryCase,
  type GalleryCaseSetup,
  type HytaleGalleryCaseId,
  getGalleryCaseSetup,
  getHytaleGalleryCaseSetup,
  isHytaleGalleryCase,
  parseGalleryCase,
} from "./shapePreviewGalleryCases";
import { getNodeType } from "@/utils/density/evalTypes";
import { PreviewModeToggleGroup } from "@/components/preview/controls/PreviewControlPrimitives";
import { useBridgeStore } from "@/stores/bridgeStore";
import type { PreviewMode } from "@/stores/previewStore";
import type { BiomeSectionData } from "@/stores/slices/types";
import {
  TEST_FEATURES_CONTENT_FIELDS,
  getTestFeaturesPatchPreset,
  type TestFeaturesPatchCategory,
  testFeaturesPreviewOrigin,
} from "./testFeaturesGalleryPatches";

/**
 * DEV-only harness using shipped reference biomes + synced release Hytale assets:
 * `/?shape-preview-gallery=1&case=…&mode=voxel&cutaway=1&materials=1`
 */
const CASE_EXPECT: Record<string, string> = {
  "underworld-cell": "Expect: white Voronoi cell walls on CellNoise2D slice",
  "underworld-max": "Expect: Max heatmap + merged fine/coarse cell walls (enable shape layers)",
  "tropical-pcn": "Expect: cell walls + amber mesh dots (Mesh2D chain)",
  "sdf-showcase":
    "2D/3D: pink zero contour. Voxel: full 3D mesh (Y ±32 around origin); use shape picker",
  "mudcracks-cube":
    "Small curve-shaped box SDF (~±2 world units). Voxel: wireframe + pink slice at Y=0; enable Material Colors to tint solids",
  "hytale-example-cellnoise2d":
    "2D + cell map: CellNoise2D walls on Example_CellNoise2D (sync Hytale assets first)",
  "hytale-generative-arches":
    "2D + cell map + mesh dots: Generative_Arches PositionsCellNoise → Mesh2D",
  "hytale-generative-veins":
    "2D + cell map: Generative_Veins PCN carved terrain read",
  "hytale-plains1-river":
    "Voxel + Material Colors: rolling hills with hydrography / river channels (Plains1_River.json)",
  "hytale-plains1-deeproot":
    "Voxel + Cutaway: imported cave module voids under terrain (Plains1_Deeproot.json)",
  "hytale-test-features":
    "56-patch node UAT: pick a patch below (or Max for full grid). 2D + cell map for PCN; voxel for SDF row. Sync Hytale assets first.",
  "density-noise-2d": "2D heatmap: SimplexNoise2D hills on X/Z",
  "density-noise-3d": "Voxel: SimplexNoise3D volume — scrub Y or use cutaway",
  "density-sum-2d": "Preview target Sum: BaseHeight + 2D noise hills",
  "density-sum-3d": "Voxel: BaseHeight + 3D noise volumetric hills",
  "density-min-carve": "Voxel + Cutaway: Min carve with inverted SimplexNoise3D",
  "density-max-2d": "Max of two 2D noises — use sub-target buttons for each input",
  "density-mul-2d": "Multiplier: noise × Constant mask",
  "density-pow-2d": "Pow(2) sharpens SimplexNoise2D peaks",
};

const HYTALE_CONTENT_FIELDS: Record<string, number> = {
  Base: 64,
  Water: 64,
  Bedrock: 0,
};

function parseGalleryUrlOptions(search: string): {
  mode: PreviewMode | null;
  cutaway: boolean;
  materials: boolean;
} {
  const params = new URLSearchParams(search);
  const modeRaw = params.get("mode");
  const mode =
    modeRaw === "2d" || modeRaw === "3d" || modeRaw === "voxel" ? modeRaw : null;
  return {
    mode,
    cutaway: params.get("cutaway") === "1",
    materials: params.get("materials") === "1",
  };
}

function applyGallerySetup(
  caseId: GalleryCase,
  s: GalleryCaseSetup,
  urlOpts: ReturnType<typeof parseGalleryUrlOptions>,
) {
  const isHytale = isHytaleGalleryCase(caseId);
  const isTestFeatures = caseId === "hytale-test-features";
  const isHytaleRiver = caseId === "hytale-plains1-river";
  const isHytaleCave = caseId === "hytale-plains1-deeproot";
  const isSdfCase = s.preset === "sdf";
  const shapeEnabled = s.shapePreviewEnabled;
  const defaultMode: PreviewMode = urlOpts.mode ?? s.defaultPreviewMode;
  const previewOrigin = isTestFeatures
    ? testFeaturesPreviewOrigin(s.testFeaturesPatchIndex ?? null, s.testFeaturesPatchIndex == null)
    : { previewOriginX: 0, previewOriginZ: 0 };

  const biomeSections: Record<string, BiomeSectionData> | null =
    s.materialNodes.length > 0
      ? {
          MaterialProvider: {
            nodes: s.materialNodes,
            edges: s.materialEdges,
            outputNodeId: s.materialNodes[s.materialNodes.length - 1]?.id ?? null,
            history: [
              {
                nodes: s.materialNodes,
                edges: s.materialEdges,
                outputNodeId: s.materialNodes[s.materialNodes.length - 1]?.id ?? null,
                label: "Initial",
              },
            ],
            historyIndex: 0,
          },
        }
      : null;

  useProjectStore.setState({
    projectPath: "dev-shape-preview-gallery",
    currentFile: s.referencePath,
    isDirty: false,
  });

  useEditorStore.setState({
    nodes: s.nodes,
    edges: s.edges,
    outputNodeId: s.outputNodeId,
    contentFields: isTestFeatures
      ? { ...TEST_FEATURES_CONTENT_FIELDS, ...previewOrigin }
      : s.contentFields && Object.keys(s.contentFields).length > 0
        ? s.contentFields
        : isHytale
          ? HYTALE_CONTENT_FIELDS
          : GALLERY_CONTENT_FIELDS,
    materialConfig: s.materialConfig,
    biomeSections,
    editingContext: "Biome",
  });

  if (shapeEnabled) {
    usePreviewStore.getState().applyShapePreviewPreset(s.preset);
  }
  usePreviewStore.setState({
    viewMode: "preview",
    mode: defaultMode,
    autoRefresh: true,
    showShapePreview: shapeEnabled,
    showShapeCellMap: shapeEnabled && s.preset !== "sdf",
    showMaterialColors:
      urlOpts.materials || isHytaleRiver || caseId === "mudcracks-cube" || caseId === "tropical-pcn",
    showVoxelWireframe: isSdfCase,
    autoFitYEnabled: !isSdfCase,
    cutawayEnabled: urlOpts.cutaway || isHytaleCave,
    cutawayLevel: 72,
    selectedPreviewNodeId: s.previewNodeId,
    rangeMin: -64,
    rangeMax: 64,
    yLevel: s.yLevel,
    resolution: isTestFeatures ? 96 : 128,
    voxelYMin: s.voxelYMin,
    voxelYMax: s.voxelYMax,
    voxelResolution: 64,
    voxelYSlices: 64,
  });
}

export function ShapePreviewGalleryHarness() {
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [setup, setSetup] = useState<GalleryCaseSetup | null>(null);
  const previewMode = usePreviewStore((s) => s.mode);
  const setMode = usePreviewStore((s) => s.setMode);
  const bridgeConnected = useBridgeStore((s) => s.connected);
  const caseId = useMemo(
    () => parseGalleryCase(window.location.search),
    [],
  );
  const urlOpts = useMemo(
    () => parseGalleryUrlOptions(window.location.search),
    [],
  );

  useEffect(() => {
    let cancelled = false;
    setReady(false);
    setLoadError(null);
    setSetup(null);

    async function load() {
      try {
        let s: GalleryCaseSetup;
        if (isHytaleGalleryCase(caseId)) {
          const rel = HYTALE_GALLERY_BIOME_PATHS[caseId as HytaleGalleryCaseId];
          const res = await fetch(`/dev/hytale-cache/${rel}`);
          if (!res.ok) {
            const detail = (await res.text()).trim();
            throw new Error(
              detail || `Failed to load ${rel} (${res.status}). Sync Hytale assets first.`,
            );
          }
          const biome = (await res.json()) as Record<string, unknown>;
          s = getHytaleGalleryCaseSetup(
            caseId as HytaleGalleryCaseId,
            biome,
            {},
            window.location.search,
          );
        } else {
          s = getGalleryCaseSetup(caseId);
        }

        if (cancelled) return;
        applyGallerySetup(caseId, s, urlOpts);
        setSetup(s);
        setReady(true);
      } catch (err) {
        if (!cancelled) {
          setLoadError(err instanceof Error ? err.message : String(err));
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [caseId, urlOpts]);

  const mixAlts = setup?.mixAltNodeIds ?? [];
  const usesSdfPreset = setup?.preset === "sdf";
  const isTestFeaturesCase = caseId === "hytale-test-features";
  const showSubTargets =
    mixAlts.length > 0 &&
    (caseId === "underworld-max" ||
      caseId === "sdf-showcase" ||
      caseId === "density-max-2d" ||
      caseId === "density-min-carve" ||
      isTestFeaturesCase);
  const [patchCategory, setPatchCategory] = useState<TestFeaturesPatchCategory | "all">("all");

  function selectTestFeaturesPatch(patchIndex: number | null) {
    if (!setup || !isTestFeaturesCase) return;
    const patch =
      patchIndex == null
        ? null
        : setup.testFeaturesPatches?.find((p) => p.index === patchIndex) ?? null;
    const viewAll = patchIndex == null;
    const previewNodeId = viewAll
      ? setup.outputNodeId
      : (patch?.nodeId ?? setup.previewNodeId);
    const preset = patch ? getTestFeaturesPatchPreset(patch.category) : "pcn";
    const origin = testFeaturesPreviewOrigin(patchIndex, viewAll);

    useEditorStore.setState({
      contentFields: { ...TEST_FEATURES_CONTENT_FIELDS, ...origin },
    });
    usePreviewStore.getState().applyShapePreviewPreset(preset);
    usePreviewStore.setState({
      selectedPreviewNodeId: previewNodeId,
      showShapeCellMap: preset !== "sdf",
      showVoxelWireframe: preset === "sdf",
      yLevel: setup.yLevel,
    });

    const params = new URLSearchParams(window.location.search);
    if (patchIndex == null) params.delete("patch");
    else params.set("patch", String(patchIndex));
    const next = `${window.location.pathname}?${params.toString()}`;
    window.history.replaceState(null, "", next);
  }

  return (
    <ReactFlowProvider>
      <PreviewEvaluationHost />
      <div className="flex h-screen flex-col bg-tn-bg text-tn-text" data-testid="shape-preview-gallery">
        <div className="flex flex-wrap items-center gap-2 border-b border-tn-border px-3 py-2 text-xs">
          <span className="text-tn-text-muted">Shape Preview UAT —</span>
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
            {setup?.label ?? caseId} —{" "}
            <span className="text-tn-text-muted/80">({setup?.referencePath ?? "…"})</span>{" "}
            {loadError ? (
              <span data-testid="gallery-error" className="text-red-400">
                {loadError}
              </span>
            ) : ready ? (
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
          {setup && setup.preset !== "sdf" && previewMode === "voxel" && !isHytaleGalleryCase(caseId) && (
            <span
              role="status"
              className="rounded border border-amber-500/25 bg-amber-950/50 px-2 py-0.5 text-amber-200/90"
            >
              Voxel misaligns PCN overlays — use 2D + cell map.
            </span>
          )}
        </div>
        {showSubTargets && setup && isTestFeaturesCase && (
          <div className="flex flex-wrap items-center gap-2 border-b border-tn-border px-3 py-1 text-[10px] text-tn-text-muted">
            <span>Test_Features patch:</span>
            <button
              type="button"
              className={`rounded border px-2 py-0.5 hover:text-tn-text ${
                setup.testFeaturesPatchIndex == null
                  ? "border-tn-accent text-tn-accent"
                  : "border-tn-border"
              }`}
              onClick={() => selectTestFeaturesPatch(null)}
            >
              Max (all 56)
            </button>
            {(["all", "pcn", "noise", "sdf"] as const).map((cat) => (
              <button
                key={cat}
                type="button"
                className={`rounded border px-2 py-0.5 hover:text-tn-text ${
                  patchCategory === cat ? "border-tn-accent text-tn-accent" : "border-tn-border"
                }`}
                onClick={() => setPatchCategory(cat)}
              >
                {cat}
              </button>
            ))}
            <select
              className="max-w-md rounded border border-tn-border bg-tn-bg px-2 py-0.5 text-[10px] text-tn-text"
              value={setup.testFeaturesPatchIndex ?? ""}
              onChange={(e) => {
                const raw = e.target.value;
                selectTestFeaturesPatch(raw ? Number.parseInt(raw, 10) : null);
              }}
            >
              <option value="">— pick patch —</option>
              {(setup.testFeaturesPatches ?? [])
                .filter((p) => patchCategory === "all" || p.category === patchCategory)
                .map((p) => (
                  <option key={p.index} value={p.index}>
                    #{p.index} ({p.x},{p.z}) — {p.label}
                  </option>
                ))}
            </select>
          </div>
        )}
        {showSubTargets && setup && !isTestFeaturesCase && (
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
        <div className="min-h-0 flex-1" data-testid="gallery-preview-pane">
          {setup && <PreviewPanel />}
        </div>
      </div>
    </ReactFlowProvider>
  );
}
