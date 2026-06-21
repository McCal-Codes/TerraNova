import { create } from "zustand";
import type { ColormapId } from "@/utils/colormaps";
import type { VoxelMeshData } from "@/utils/voxelMeshBuilder";
import type { WorldMeshResult } from "@/utils/worldMeshBuilder";
import type { LivePlayerCoords } from "@/utils/livePlayerTracking";
import type { EvaluatedPosition } from "@/utils/positionEvaluator";
import type { CellShapeGridResult } from "@/utils/shapePreview/cellShapeGrid";
import type { ContourSegment } from "@/utils/shapePreview/marchingSquaresZeroContour";
import { SDF_DEFAULT_VOXEL_Y } from "@/utils/shapePreview/sdfPreviewDefaults";
import { readStoredPreviewDefaults } from "@/stores/configStore";
import { initial2dPreviewResolution, clamp2dPreviewResolution } from "@/utils/previewResolution";
import { safeStoredJson } from "@/utils/safeLocalStorage";
import type { PreviewRootResolution } from "@/utils/previewRootResolver";
import type { PrefabPreviewMeshData } from "@/utils/hytaleBlockAssets/buildPrefabPreviewMesh";

export type PreviewMode = "2d" | "3d" | "voxel" | "world" | "prefab";
export type PropPreviewMode = "placement" | "prefab3d";
export type ViewMode = "graph" | "preview" | "split" | "compare" | "json";
export type SplitDirection = "horizontal" | "vertical";

export interface AtmosphereSettings {
  skyHorizon: string;
  skyZenith: string;
  sunsetColor: string;       // SkySunsetColors daytime
  sunGlowColor: string;      // SunGlowColors daytime
  cloudDensity: number;
  fogColor: string;
  fogNear: number;           // FogDistance[0] in world units
  fogFar: number;            // FogDistance[1] in world units
  ambientColor: string;
  sunColor: string;
  waterTint: string;         // WaterTint from env file
  sunAngle: number;          // Sun elevation angle in degrees (0=horizon, 90=noon)
}

export interface TintColors {
  /** Band 1 — low density (cool/shaded) */
  color1: string;
  /** Band 2 — mid density */
  color2: string;
  /** Band 3 — high density (sunny/warm) */
  color3: string;
}

export interface CanvasTransform {
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface CrossSectionLine {
  start: { x: number; z: number };
  end: { x: number; z: number };
}

export type CrossSectionProfileMode = "plan" | "section";

interface PreviewState {
  mode: PreviewMode;
  /** Prop-layer preview: 2D placement scatter vs 3D prefab mesh (Props tab only). */
  propPreviewMode: PropPreviewMode;
  /** Browsed prefab path when graph has no Prop:Prefab (session-only, cleared per prop section). */
  propManualPrefabPath: string | null;
  resolution: number;
  rangeMin: number;
  rangeMax: number;
  yLevel: number;
  selectedPreviewNodeId: string | null;
  values: Float32Array | null;
  minValue: number;
  maxValue: number;
  p02Value: number;
  p98Value: number;
  isLoading: boolean;
  previewError: string | null;
  /** Cache key for the last completed 2D/3D density slice (`values`). */
  densityEvalKey: string | null;

  viewMode: ViewMode;
  autoRefresh: boolean;
  /** Property-panel scoped live preview for selected node edits. */
  livePropertyPreview: boolean;
  /** Monotonic token used for one-shot manual refresh when autoRefresh is disabled. */
  manualPreviewRefreshToken: number;
  colormap: ColormapId;
  splitRatio: number;
  showInlinePreviews: boolean;

  canvasTransform: CanvasTransform;
  showContours: boolean;
  contourInterval: number;

  showStatistics: boolean;
  statisticsLogScale: boolean;

  heightScale3D: number;
  showWaterPlane: boolean;
  waterPlaneLevel: number;
  showFog3D: boolean;
  showSky3D: boolean;
  fogDistanceScale: number;
  fogMinSpan: number;

  crossSectionLine: CrossSectionLine | null;
  showCrossSection: boolean;
  /** Plan profile (fixed Y slice) vs vertical wall section through volume. */
  crossSectionProfileMode: CrossSectionProfileMode;
  verticalSectionDensities: Float32Array | null;
  verticalSectionMeta: {
    resolution: number;
    ySlices: number;
    yMin: number;
    yMax: number;
    rangeMin: number;
    rangeMax: number;
  } | null;
  isVerticalSectionLoading: boolean;

  /** Hide voxel geometry above this world Y (cutaway). */
  cutawayEnabled: boolean;
  cutawayLevel: number;
  /** 3D heightfield vs underground volume mesh (reuses voxel pipeline). */
  show3DVolumeView: boolean;

  voxelYMin: number;
  voxelYMax: number;
  voxelYSlices: number;
  voxelResolution: number;
  voxelDensities: Float32Array | null;
  isVoxelLoading: boolean;
  /** Resolution of the in-flight progressive pass (null when idle). */
  voxelEvalProgressRes: number | null;
  /** Resolution currently shown in the voxel mesh (during refine, below target). */
  voxelDisplayedRes: number | null;
  voxelError: string | null;
  showThresholdView: boolean;
  showMaterialColors: boolean;
  showVoxelWireframe: boolean;
  showMaterialLegend: boolean;
  voxelMaterials: Uint8Array | null;
  voxelPalette: Array<{ name: string; color: string }>;
  /** Material names hidden from voxel mesh (legend toggles). */
  hiddenVoxelMaterialNames: string[];
  _voxelSurfaceData: import("@/utils/voxelExtractor").VoxelData | null;
  _voxelVolumeMaterialIds: Uint8Array | null;
  _voxelVolumeRes: number | null;
  _voxelVolumeYSlices: number | null;
  /** Surface voxel count from last volume extract (for HUD). */
  surfaceVoxelCount: number | null;
  /** Last resolved voxel evaluation root (for debug HUD). */
  voxelRootResolution: PreviewRootResolution | null;
  /** Density min/max and solid fraction from last voxel volume. */
  voxelDensityStats: { min: number; max: number; positiveFraction: number } | null;
  voxelMeshData: VoxelMeshData[] | null;
  /** Fingerprint of the graph + params used to build `voxelMeshData`. */
  voxelEvalKey: string | null;
  fluidPlaneConfig: { type: "water" | "lava"; yPosition: number; size?: number } | null;
  showSSAO: boolean;
  showEdgeOutline: boolean;
  showHillShade: boolean;
  /** USGS-style parchment map: brown contours, green wash, relief shading. */
  usgsTopoStyle: boolean;

  autoFitYEnabled: boolean;
  /** Automatically run fit-to-content when the graph changes (wide 3D probe). */
  autoFitContentEnabled: boolean;
  /** When true, terrain auto-fit anchors to ContentFields Base Y instead of profile zero-crossing. */
  terrainRefUseBaseY: boolean;
  _autoFitGraphHash: string;
  _autoFitContentGraphHash: string;
  _userManualYAdjust: boolean;
  /** User picked preview mode manually — skip auto-voxel routing. */
  _userManualPreviewMode: boolean;
  _autoVoxelGraphHash: string;
  isFitToContentRunning: boolean;

  worldCenterX: number;
  worldCenterZ: number;
  worldRadius: number;
  worldYMin: number;
  worldYMax: number;
  isWorldLoading: boolean;
  worldError: string | null;
  /** Last World preview terrain provenance (from Bridge chunk responses). */
  worldDataSource: "save" | "mixed" | "synthetic" | null;
  /** Hytale texture-sampled block colors resolved for the current world palette. */
  worldBlockColorStats: { textured: number; total: number } | null;
  worldChunkCount: number;
  worldTotalChunks: number;
  worldFollowPlayer: boolean;
  worldSurfaceDepth: number;
  worldLavaLevel: number;
  worldForceLoad: boolean;
  /** Last resolved in-game block position (Bridge discovery / player info). */
  worldLivePlayer: LivePlayerCoords | null;
  /** Layout from last `buildWorldMeshes` — maps block coords to scene space. */
  worldSceneLayout: Pick<WorldMeshResult, "sceneYMin" | "sceneScale" | "worldMidX" | "worldMidZ"> | null;
  showWorldPlayerMarker: boolean;

  prefabMeshData: VoxelMeshData[] | null;
  texturedPrefabMesh: PrefabPreviewMeshData | null;
  prefabTextureStats: { textured: number; total: number; entityCount: number } | null;
  prefabPath: string | null;
  isPrefabLoading: boolean;
  prefabError: string | null;
  setPrefabMeshData: (data: VoxelMeshData[] | null) => void;
  setTexturedPrefabMesh: (mesh: PrefabPreviewMeshData | null) => void;
  setPrefabTextureStats: (stats: { textured: number; total: number; entityCount: number } | null) => void;
  setPrefabPath: (path: string | null) => void;
  setPrefabLoading: (loading: boolean) => void;
  setPrefabError: (error: string | null) => void;

  showPositionOverlay: boolean;
  positionOverlayNodeId: string | null;
  positionOverlayPoints: EvaluatedPosition[];
  positionOverlayColor: string;
  positionOverlaySize: number;
  positionOverlaySeed: number;

  showShapePreview: boolean;
  showShapeCellMap: boolean;
  showCellBoundaries: boolean;
  showWallDistance: boolean;
  showMeshSamples: boolean;
  showSdfSurface: boolean;
  shapePreviewSeed: number;
  cellShapeGrid: CellShapeGridResult | null;
  sdfZeroSegments: ContourSegment[];
  shapePreviewMeshPoints: EvaluatedPosition[];

  compareNodeA: string | null;
  compareNodeB: string | null;
  compareModeA: PreviewMode;
  compareModeB: PreviewMode;
  compareValuesA: Float32Array | null;
  compareValuesB: Float32Array | null;
  compareMinA: number;
  compareMaxA: number;
  compareMinB: number;
  compareMaxB: number;
  compareLoadingA: boolean;
  compareLoadingB: boolean;
  linkCameras3D: boolean;

  splitDirection: SplitDirection;

  fidelityScore: number;

  // Actions
  setMode: (mode: PreviewMode, options?: { automated?: boolean }) => void;
  setPropPreviewMode: (mode: PropPreviewMode) => void;
  setPropManualPrefabPath: (path: string | null) => void;
  setResolution: (res: number) => void;
  setRange: (min: number, max: number) => void;
  setYLevel: (y: number) => void;
  setSelectedPreviewNodeId: (id: string | null) => void;
  setValues: (values: Float32Array | null, min: number, max: number, p02?: number, p98?: number) => void;
  setLoading: (loading: boolean) => void;
  setPreviewError: (error: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setLivePropertyPreview: (enabled: boolean) => void;
  requestManualPreviewRefresh: () => void;
  setColormap: (id: ColormapId) => void;
  setSplitRatio: (ratio: number) => void;
  setShowInlinePreviews: (enabled: boolean) => void;

  setCanvasTransform: (transform: CanvasTransform) => void;
  resetCanvasTransform: () => void;
  setShowContours: (show: boolean) => void;
  setContourInterval: (interval: number) => void;

  setShowStatistics: (show: boolean) => void;
  setStatisticsLogScale: (log: boolean) => void;

  setHeightScale3D: (scale: number) => void;
  setShowWaterPlane: (show: boolean) => void;
  setWaterPlaneLevel: (level: number) => void;
  setShowFog3D: (show: boolean) => void;
  setShowSky3D: (show: boolean) => void;
  setFogDistanceScale: (scale: number) => void;
  setFogMinSpan: (span: number) => void;

  setCrossSectionLine: (line: CrossSectionLine | null) => void;
  setShowCrossSection: (show: boolean) => void;
  setCrossSectionProfileMode: (mode: CrossSectionProfileMode) => void;
  setVerticalSectionDensities: (
    densities: Float32Array | null,
    meta: PreviewState["verticalSectionMeta"],
  ) => void;
  setVerticalSectionLoading: (loading: boolean) => void;
  setCutawayEnabled: (enabled: boolean) => void;
  setCutawayLevel: (level: number) => void;
  setShow3DVolumeView: (show: boolean) => void;

  setVoxelYMin: (y: number) => void;
  setVoxelYMax: (y: number) => void;
  setVoxelYSlices: (s: number) => void;
  setVoxelResolution: (r: number) => void;
  setVoxelDensities: (d: Float32Array | null) => void;
  setVoxelLoading: (loading: boolean) => void;
  setVoxelEvalProgressRes: (res: number | null) => void;
  setVoxelError: (error: string | null) => void;
  setShowThresholdView: (show: boolean) => void;
  setShowMaterialColors: (show: boolean) => void;
  setShowVoxelWireframe: (show: boolean) => void;
  setShowMaterialLegend: (show: boolean) => void;
  setVoxelMaterials: (materials: Uint8Array | null, palette: Array<{ name: string; color: string }>) => void;
  setVoxelMeshData: (data: VoxelMeshData[] | null) => void;
  toggleVoxelMaterialVisibility: (name: string) => void;
  setFluidPlaneConfig: (config: { type: "water" | "lava"; yPosition: number; size?: number } | null) => void;
  setShowSSAO: (show: boolean) => void;
  setShowEdgeOutline: (show: boolean) => void;
  setShowHillShade: (show: boolean) => void;
  setUsgsTopoStyle: (enabled: boolean) => void;

  setAutoFitYEnabled: (enabled: boolean) => void;
  setAutoFitContentEnabled: (enabled: boolean) => void;
  setTerrainRefUseBaseY: (useBaseY: boolean) => void;
  _setAutoFitGraphHash: (hash: string) => void;
  _setAutoFitContentGraphHash: (hash: string) => void;
  _setUserManualYAdjust: (manual: boolean) => void;
  _setUserManualPreviewMode: (manual: boolean) => void;
  _setAutoVoxelGraphHash: (hash: string) => void;
  setFitToContentRunning: (running: boolean) => void;

  setWorldCenterX: (x: number) => void;
  setWorldCenterZ: (z: number) => void;
  setWorldRadius: (r: number) => void;
  setWorldYMin: (y: number) => void;
  setWorldYMax: (y: number) => void;
  setWorldLoading: (loading: boolean) => void;
  setWorldError: (error: string | null) => void;
  setWorldDataSource: (source: "save" | "mixed" | "synthetic" | null) => void;
  setWorldBlockColorStats: (stats: { textured: number; total: number } | null) => void;
  setWorldProgress: (loaded: number, total: number) => void;
  setWorldFollowPlayer: (follow: boolean) => void;
  setWorldSurfaceDepth: (depth: number) => void;
  setWorldLavaLevel: (level: number) => void;
  setWorldForceLoad: (forceLoad: boolean) => void;
  setWorldLivePlayer: (player: LivePlayerCoords | null) => void;
  setWorldSceneLayout: (
    layout: Pick<WorldMeshResult, "sceneYMin" | "sceneScale" | "worldMidX" | "worldMidZ"> | null,
  ) => void;
  setShowWorldPlayerMarker: (show: boolean) => void;

  setShowPositionOverlay: (show: boolean) => void;
  setPositionOverlayNodeId: (id: string | null) => void;
  setPositionOverlayPoints: (points: EvaluatedPosition[]) => void;
  setPositionOverlayColor: (color: string) => void;
  setPositionOverlaySize: (size: number) => void;
  setPositionOverlaySeed: (seed: number) => void;

  setShowShapePreview: (show: boolean) => void;
  setShowShapeCellMap: (show: boolean) => void;
  setShowCellBoundaries: (show: boolean) => void;
  setShowWallDistance: (show: boolean) => void;
  setShowMeshSamples: (show: boolean) => void;
  setShowSdfSurface: (show: boolean) => void;
  setShapePreviewSeed: (seed: number) => void;
  setCellShapeGrid: (grid: CellShapeGridResult | null) => void;
  setSdfZeroSegments: (segments: ContourSegment[]) => void;
  setShapePreviewMeshPoints: (points: EvaluatedPosition[]) => void;
  applyShapePreviewPreset: (preset: "pcn" | "pcnMesh" | "sdf") => void;

  setCompareNodeA: (id: string | null) => void;
  setCompareNodeB: (id: string | null) => void;
  setCompareModeA: (mode: PreviewMode) => void;
  setCompareModeB: (mode: PreviewMode) => void;
  setCompareValuesA: (values: Float32Array | null, min: number, max: number) => void;
  setCompareValuesB: (values: Float32Array | null, min: number, max: number) => void;
  setCompareLoadingA: (loading: boolean) => void;
  setCompareLoadingB: (loading: boolean) => void;
  setLinkCameras3D: (link: boolean) => void;

  setSplitDirection: (dir: SplitDirection) => void;

  setFidelityScore: (score: number) => void;

  atmosphereSettings: AtmosphereSettings;
  setAtmosphereSettings: (settings: AtmosphereSettings) => void;

  tintColors: TintColors;
  setTintColors: (colors: TintColors) => void;
}

// ---------------------------------------------------------------------------
// Centralized persistence — one declarative map replaces 42 manual calls
// ---------------------------------------------------------------------------

const PERSIST_MAP: Record<string, string> = {
  viewMode: "tn-viewMode",
  colormap: "tn-colormap",
  splitRatio: "tn-splitRatio",
  showInlinePreviews: "tn-showInlinePreviews",
  showContours: "tn-showContours",
  contourInterval: "tn-contourInterval",
  showStatistics: "tn-showStatistics",
  statisticsLogScale: "tn-statisticsLogScale",
  heightScale3D: "tn-heightScale3D",
  showWaterPlane: "tn-showWaterPlane",
  waterPlaneLevel: "tn-waterPlaneLevel",
  showFog3D: "tn-showFog3D",
  showSky3D: "tn-showSky3D",
  fogDistanceScale: "tn-fogDistanceScale",
  fogMinSpan: "tn-fogMinSpan",
  showCrossSection: "tn-showCrossSection",
  crossSectionProfileMode: "tn-crossSectionProfileMode",
  cutawayEnabled: "tn-cutawayEnabled",
  cutawayLevel: "tn-cutawayLevel",
  show3DVolumeView: "tn-show3DVolumeView",
  voxelYMin: "tn-voxelYMin",
  voxelYMax: "tn-voxelYMax",
  voxelYSlices: "tn-voxelYSlices",
  voxelResolution: "tn-voxelResolution",
  showThresholdView: "tn-showThresholdView",
  showMaterialColors: "tn-showMaterialColors",
  showVoxelWireframe: "tn-showVoxelWireframe",
  showMaterialLegend: "tn-showMaterialLegend",
  showSSAO: "tn-showSSAO",
  showEdgeOutline: "tn-showEdgeOutline",
  showHillShade: "tn-showHillShade",
  usgsTopoStyle: "tn-usgsTopoStyle",
  autoFitYEnabled: "tn-autoFitYEnabled",
  autoFitContentEnabled: "tn-autoFitContentEnabled",
  terrainRefUseBaseY: "tn-terrainRefUseBaseY",
  worldCenterX: "tn-worldCenterX",
  worldCenterZ: "tn-worldCenterZ",
  worldRadius: "tn-worldRadius",
  worldYMin: "tn-worldYMin",
  worldYMax: "tn-worldYMax",
  worldFollowPlayer: "tn-worldFollowPlayer",
  worldSurfaceDepth: "tn-worldSurfaceDepth",
  worldLavaLevel: "tn-worldLavaLevel",
  worldForceLoad: "tn-worldForceLoad",
  showPositionOverlay: "tn-showPositionOverlay",
  positionOverlayColor: "tn-positionOverlayColor",
  positionOverlaySize: "tn-positionOverlaySize",
  positionOverlaySeed: "tn-positionOverlaySeed",
  showShapePreview: "tn-showShapePreview",
  showShapeCellMap: "tn-showShapeCellMap",
  showCellBoundaries: "tn-showCellBoundaries",
  showWallDistance: "tn-showWallDistance",
  showMeshSamples: "tn-showMeshSamples",
  showSdfSurface: "tn-showSdfSurface",
  shapePreviewSeed: "tn-shapePreviewSeed",
  livePropertyPreview: "tn-livePropertyPreview",
  compareNodeA: "tn-compareNodeA",
  compareNodeB: "tn-compareNodeB",
  compareModeA: "tn-compareModeA",
  compareModeB: "tn-compareModeB",
  linkCameras3D: "tn-linkCameras3D",
  splitDirection: "tn-splitDirection",
  propPreviewMode: "tn-propPreviewMode",
  atmosphereSettings: "tn-atmosphereSettings",
  tintColors: "tn-tintColors",
};

function getStored(key: string): string | null {
  return typeof localStorage !== "undefined" ? localStorage.getItem(key) : null;
}

function getStoredBool(key: string, fallback: boolean): boolean {
  const v = getStored(key);
  if (v === null) return fallback;
  return v === "true";
}

function getStoredFloat(key: string, fallback: number): number {
  const v = getStored(key);
  if (v === null) return fallback;
  const n = parseFloat(v);
  return isNaN(n) ? fallback : n;
}

function hydratePersistedState() {
  const configDefaults = readStoredPreviewDefaults();
  return {
    viewMode: (getStored("tn-viewMode") as ViewMode | null) ?? "graph",
    livePropertyPreview: getStoredBool("tn-livePropertyPreview", true),
    colormap: (getStored("tn-colormap") as ColormapId | null) ?? "blue-red",
    splitRatio: getStoredFloat("tn-splitRatio", 0.6),
    showInlinePreviews: getStoredBool("tn-showInlinePreviews", false),
    showContours: (() => {
      const stored = getStored("tn-showContours");
      if (stored !== null) return stored === "true";
      return getStoredBool("tn-usgsTopoStyle", true);
    })(),
    contourInterval: getStoredFloat("tn-contourInterval", 0.1),
    showStatistics: getStoredBool("tn-showStatistics", true),
    statisticsLogScale: getStoredBool("tn-statisticsLogScale", false),
    heightScale3D: getStoredFloat("tn-heightScale3D", 20),
    showWaterPlane: getStoredBool("tn-showWaterPlane", false),
    waterPlaneLevel: getStoredFloat("tn-waterPlaneLevel", 0.5),
    showFog3D: getStoredBool("tn-showFog3D", false),
    showSky3D: getStoredBool("tn-showSky3D", true),
    fogDistanceScale: getStoredFloat("tn-fogDistanceScale", 0.12),
    fogMinSpan: getStoredFloat("tn-fogMinSpan", 24),
    showCrossSection: getStoredBool("tn-showCrossSection", false),
    crossSectionProfileMode: ((): CrossSectionProfileMode => {
      const v = getStored("tn-crossSectionProfileMode");
      return v === "section" ? "section" : "plan";
    })(),
    cutawayEnabled: getStoredBool("tn-cutawayEnabled", false),
    cutawayLevel: getStoredFloat("tn-cutawayLevel", 60),
    show3DVolumeView: getStoredBool("tn-show3DVolumeView", false),
    // Default voxel window should be tall enough to include terrain peaks by default.
    voxelYMin: getStoredFloat("tn-voxelYMin", 0),
    voxelYMax: getStoredFloat("tn-voxelYMax", 256),
    voxelYSlices: getStoredFloat("tn-voxelYSlices", configDefaults.defaultVoxelYSlices),
    voxelResolution: getStoredFloat("tn-voxelResolution", configDefaults.defaultVoxelRes),
    showThresholdView: getStoredBool("tn-showThresholdView", false),
    showMaterialColors: getStoredBool("tn-showMaterialColors", true),
    showVoxelWireframe: getStoredBool("tn-showVoxelWireframe", false),
    showMaterialLegend: getStoredBool("tn-showMaterialLegend", true),
    showSSAO: getStoredBool("tn-showSSAO", false),
    showEdgeOutline: getStoredBool("tn-showEdgeOutline", false),
    showHillShade: getStoredBool("tn-showHillShade", true),
    usgsTopoStyle: getStoredBool("tn-usgsTopoStyle", true),
    autoFitYEnabled: getStoredBool("tn-autoFitYEnabled", true),
    autoFitContentEnabled: getStoredBool("tn-autoFitContentEnabled", true),
    // Terrain graphs read best when anchored to Base Y (ContentFields) by default.
    terrainRefUseBaseY: getStoredBool("tn-terrainRefUseBaseY", true),
    worldCenterX: getStoredFloat("tn-worldCenterX", 0),
    worldCenterZ: getStoredFloat("tn-worldCenterZ", 0),
    worldRadius: getStoredFloat("tn-worldRadius", 2),
    worldYMin: getStoredFloat("tn-worldYMin", 0),
    worldYMax: getStoredFloat("tn-worldYMax", 256),
    worldFollowPlayer: getStoredBool("tn-worldFollowPlayer", false),
    worldSurfaceDepth: Math.min(getStoredFloat("tn-worldSurfaceDepth", 32), 40),
    worldLavaLevel: getStoredFloat("tn-worldLavaLevel", 0),
    worldForceLoad: getStoredBool("tn-worldForceLoad", false),
    showPositionOverlay: getStoredBool("tn-showPositionOverlay", false),
    positionOverlayColor: getStored("tn-positionOverlayColor") ?? "#22c55e",
    positionOverlaySize: getStoredFloat("tn-positionOverlaySize", 1.5),
    positionOverlaySeed: getStoredFloat("tn-positionOverlaySeed", 42),
    showShapePreview: getStoredBool("tn-showShapePreview", false),
    showShapeCellMap: getStoredBool("tn-showShapeCellMap", true),
    showCellBoundaries: getStoredBool("tn-showCellBoundaries", true),
    showWallDistance: getStoredBool("tn-showWallDistance", true),
    showMeshSamples: getStoredBool("tn-showMeshSamples", true),
    showSdfSurface: getStoredBool("tn-showSdfSurface", true),
    shapePreviewSeed: getStoredFloat("tn-shapePreviewSeed", 42),
    compareNodeA: getStored("tn-compareNodeA") || null,
    compareNodeB: getStored("tn-compareNodeB") || null,
    compareModeA: (getStored("tn-compareModeA") as PreviewMode | null) ?? "2d",
    compareModeB: (getStored("tn-compareModeB") as PreviewMode | null) ?? "2d",
    linkCameras3D: getStoredBool("tn-linkCameras3D", true),
    splitDirection: (getStored("tn-splitDirection") as SplitDirection | null) ?? "horizontal",
    propPreviewMode: (() => {
      const v = getStored("tn-propPreviewMode");
      return (v === "prefab3d" ? "prefab3d" : "placement") as PropPreviewMode;
    })(),
    propManualPrefabPath: null,
    atmosphereSettings: (() => {
      const parsed = safeStoredJson<Record<string, unknown>>("tn-atmosphereSettings", {});
      if (Object.keys(parsed).length > 0) return { ...DEFAULT_ATMOSPHERE_SETTINGS, ...parsed } as AtmosphereSettings;
      return DEFAULT_ATMOSPHERE_SETTINGS;
    })(),
    tintColors: (() => {
      const parsed = safeStoredJson<Record<string, unknown>>("tn-tintColors", {});
      if (Object.keys(parsed).length > 0) return { ...DEFAULT_TINT_COLORS, ...parsed } as TintColors;
      return DEFAULT_TINT_COLORS;
    })(),
  };
}

const DEFAULT_CANVAS_TRANSFORM: CanvasTransform = { scale: 1, offsetX: 0, offsetY: 0 };

const DEFAULT_ATMOSPHERE_SETTINGS: AtmosphereSettings = {
  skyHorizon: "#8fd8f8",
  skyZenith: "#077ddd",
  sunsetColor: "#ffb951",
  sunGlowColor: "#ffffff",
  cloudDensity: 0.3,
  fogColor: "#8fd8f8",
  fogNear: -96,
  fogFar: 1024,
  ambientColor: "#6080a0",
  sunColor: "#ffffff",
  waterTint: "#1983d9",
  sunAngle: 60,              // Default ~mid-morning
};

const DEFAULT_TINT_COLORS: TintColors = {
  color1: "#5b9e28",
  color2: "#6ca229",
  color3: "#7ea629",
};

export const usePreviewStore = create<PreviewState>((originalSet) => {
  // Wrap set() to auto-persist any key in PERSIST_MAP
  const persistedSet: typeof originalSet = (partial) => {
    originalSet(partial);
    // Resolve the actual update object
    const updates = typeof partial === "function"
      ? partial(usePreviewStore.getState())
      : partial;
    for (const [key, lsKey] of Object.entries(PERSIST_MAP)) {
      if (key in updates) {
        const val = (updates as Record<string, unknown>)[key];
        const serialized = val !== null && typeof val === "object" ? JSON.stringify(val) : String(val ?? "");
        localStorage.setItem(lsKey, serialized);
      }
    }
  };

  const hydrated = hydratePersistedState();
  const configDefaults = readStoredPreviewDefaults();

  return {
    mode: "2d",
    resolution: initial2dPreviewResolution(configDefaults.defaultPreviewRes),
    rangeMin: -64,
    rangeMax: 64,
    yLevel: 64,
    selectedPreviewNodeId: null,
    values: null,
    minValue: 0,
    maxValue: 1,
    p02Value: 0,
    p98Value: 1,
    isLoading: false,
    previewError: null,
    densityEvalKey: null,
    autoRefresh: true,
    manualPreviewRefreshToken: 0,
    canvasTransform: { ...DEFAULT_CANVAS_TRANSFORM },
    crossSectionLine: null,
    verticalSectionDensities: null,
    verticalSectionMeta: null,
    isVerticalSectionLoading: false,
    voxelDensities: null,
    isVoxelLoading: false,
    voxelEvalProgressRes: null,
    voxelDisplayedRes: null,
    voxelError: null,
    voxelMaterials: null,
    voxelPalette: [],
    hiddenVoxelMaterialNames: [],
    _voxelSurfaceData: null,
    _voxelVolumeMaterialIds: null,
    _voxelVolumeRes: null,
    _voxelVolumeYSlices: null,
    surfaceVoxelCount: null,
    voxelRootResolution: null,
    voxelDensityStats: null,
    voxelMeshData: null,
    voxelEvalKey: null,
    fluidPlaneConfig: null,
    isWorldLoading: false,
    worldError: null,
    worldDataSource: null,
    worldBlockColorStats: null,
    worldChunkCount: 0,
    worldTotalChunks: 0,
    worldLivePlayer: null,
    worldSceneLayout: null,
    showWorldPlayerMarker: true,
    prefabMeshData: null,
    texturedPrefabMesh: null,
    prefabTextureStats: null,
    prefabPath: null,
    isPrefabLoading: false,
    prefabError: null,
    positionOverlayNodeId: null,
    positionOverlayPoints: [],
    cellShapeGrid: null,
    sdfZeroSegments: [],
    shapePreviewMeshPoints: [],
    compareValuesA: null,
    compareValuesB: null,
    compareMinA: 0,
    compareMaxA: 1,
    compareMinB: 0,
    compareMaxB: 1,
    compareLoadingA: false,
    compareLoadingB: false,
    fidelityScore: 100,
    _autoFitGraphHash: "",
    _autoFitContentGraphHash: "",
    _userManualYAdjust: false,
    _userManualPreviewMode: false,
    _autoVoxelGraphHash: "",
    isFitToContentRunning: false,

    // Hydrated persisted values
    ...hydrated,

    // ── Actions ──
    setMode: (mode, options) => {
      const state = usePreviewStore.getState();
      if (!options?.automated) {
        originalSet({ _userManualPreviewMode: true });
      }
      if (mode === "2d") {
        const resolution = clamp2dPreviewResolution(state.resolution);
        if (resolution !== state.resolution) {
          originalSet({ mode, resolution });
          return;
        }
      }
      originalSet({ mode });
    },
    setPropPreviewMode: (propPreviewMode) => persistedSet({ propPreviewMode }),
    setPropManualPrefabPath: (propManualPrefabPath) => originalSet({ propManualPrefabPath }),
    setResolution: (resolution) => {
      const state = usePreviewStore.getState();
      originalSet({
        resolution: state.mode === "2d" ? clamp2dPreviewResolution(resolution) : resolution,
      });
    },
    setRange: (rangeMin, rangeMax) => originalSet({ rangeMin, rangeMax }),
    setYLevel: (yLevel) => originalSet({ yLevel }),
    setSelectedPreviewNodeId: (id) => originalSet({ selectedPreviewNodeId: id }),
    setValues: (values, minValue, maxValue, p02Value, p98Value) => originalSet({ values, minValue, maxValue, p02Value: p02Value ?? minValue, p98Value: p98Value ?? maxValue }),
    setLoading: (isLoading) => originalSet((s) => (s.isLoading === isLoading ? s : { isLoading })),
    setPreviewError: (error) => originalSet((s) => (s.previewError === error ? s : { previewError: error })),
    setAutoRefresh: (autoRefresh) => originalSet({ autoRefresh }),
    setLivePropertyPreview: (livePropertyPreview) => persistedSet({ livePropertyPreview }),
    requestManualPreviewRefresh: () => originalSet((s) => ({ manualPreviewRefreshToken: s.manualPreviewRefreshToken + 1 })),
    setCanvasTransform: (canvasTransform) => originalSet({ canvasTransform }),
    resetCanvasTransform: () => originalSet({ canvasTransform: { ...DEFAULT_CANVAS_TRANSFORM } }),
    setCrossSectionLine: (crossSectionLine) => originalSet({ crossSectionLine }),
    setCrossSectionProfileMode: (crossSectionProfileMode) => persistedSet({ crossSectionProfileMode }),
    setVerticalSectionDensities: (verticalSectionDensities, verticalSectionMeta) =>
      originalSet({ verticalSectionDensities, verticalSectionMeta }),
    setVerticalSectionLoading: (isVerticalSectionLoading) => originalSet({ isVerticalSectionLoading }),
    setCutawayEnabled: (cutawayEnabled) => persistedSet({ cutawayEnabled }),
    setCutawayLevel: (cutawayLevel) => persistedSet({ cutawayLevel }),
    setShow3DVolumeView: (show3DVolumeView) => persistedSet({ show3DVolumeView }),
    setVoxelDensities: (voxelDensities) => originalSet({ voxelDensities }),
    setVoxelLoading: (isVoxelLoading) => originalSet({ isVoxelLoading }),
    setVoxelEvalProgressRes: (voxelEvalProgressRes) => originalSet({ voxelEvalProgressRes }),
    setVoxelError: (voxelError) => originalSet({ voxelError }),
    setVoxelMaterials: (voxelMaterials, voxelPalette) =>
      originalSet((state) => {
        const paletteNames = new Set(voxelPalette.map((entry) => entry.name));
        const hiddenVoxelMaterialNames = state.hiddenVoxelMaterialNames.filter((name) =>
          paletteNames.has(name),
        );
        return { voxelMaterials, voxelPalette, hiddenVoxelMaterialNames };
      }),
    setVoxelMeshData: (voxelMeshData) =>
      originalSet({
        voxelMeshData,
        ...(voxelMeshData == null
          ? {
              surfaceVoxelCount: null,
              voxelDensityStats: null,
              _voxelSurfaceData: null,
              _voxelVolumeMaterialIds: null,
              _voxelVolumeRes: null,
              _voxelVolumeYSlices: null,
            }
          : {}),
      }),
    toggleVoxelMaterialVisibility: (name) => {
      const state = usePreviewStore.getState();
      const hidden = state.hiddenVoxelMaterialNames.includes(name)
        ? state.hiddenVoxelMaterialNames.filter((n) => n !== name)
        : [...state.hiddenVoxelMaterialNames, name];
      originalSet({ hiddenVoxelMaterialNames: hidden });
      void import("@/utils/finishVoxelFromVolume").then((m) => m.rebuildVoxelMeshFromCache());
    },
    setFluidPlaneConfig: (fluidPlaneConfig) => originalSet({ fluidPlaneConfig }),
    setWorldLoading: (isWorldLoading) => originalSet({ isWorldLoading }),
    setWorldError: (worldError) => originalSet({ worldError }),
    setWorldDataSource: (worldDataSource) => originalSet({ worldDataSource }),
    setWorldBlockColorStats: (worldBlockColorStats) => originalSet({ worldBlockColorStats }),
    setWorldProgress: (worldChunkCount, worldTotalChunks) => originalSet({ worldChunkCount, worldTotalChunks }),
    setPositionOverlayNodeId: (positionOverlayNodeId) => originalSet({ positionOverlayNodeId }),
    setPositionOverlayPoints: (positionOverlayPoints) => originalSet({ positionOverlayPoints }),
    setCompareValuesA: (compareValuesA, compareMinA, compareMaxA) => originalSet({ compareValuesA, compareMinA, compareMaxA }),
    setCompareValuesB: (compareValuesB, compareMinB, compareMaxB) => originalSet({ compareValuesB, compareMinB, compareMaxB }),
    setCompareLoadingA: (compareLoadingA) => originalSet({ compareLoadingA }),
    setCompareLoadingB: (compareLoadingB) => originalSet({ compareLoadingB }),
    setFidelityScore: (fidelityScore) => originalSet((s) => (s.fidelityScore === fidelityScore ? s : { fidelityScore })),
    _setAutoFitGraphHash: (_autoFitGraphHash) => originalSet({ _autoFitGraphHash }),
    _setAutoFitContentGraphHash: (_autoFitContentGraphHash) => originalSet({ _autoFitContentGraphHash }),
    _setUserManualYAdjust: (_userManualYAdjust) => originalSet({ _userManualYAdjust }),
    _setUserManualPreviewMode: (_userManualPreviewMode) => originalSet({ _userManualPreviewMode }),
    _setAutoVoxelGraphHash: (_autoVoxelGraphHash) => originalSet({ _autoVoxelGraphHash }),
    setFitToContentRunning: (isFitToContentRunning) => originalSet({ isFitToContentRunning }),

    // Persisted setters — use persistedSet for auto-localStorage sync
    setViewMode: (viewMode) => persistedSet({ viewMode }),
    setColormap: (colormap) => persistedSet({ colormap }),
    setSplitRatio: (splitRatio) => persistedSet({ splitRatio }),
    setShowInlinePreviews: (showInlinePreviews) => persistedSet({ showInlinePreviews }),
    setShowContours: (showContours) => persistedSet({ showContours }),
    setContourInterval: (contourInterval) => persistedSet({ contourInterval }),
    setShowStatistics: (showStatistics) => persistedSet({ showStatistics }),
    setStatisticsLogScale: (statisticsLogScale) => persistedSet({ statisticsLogScale }),
    setHeightScale3D: (heightScale3D) => persistedSet({ heightScale3D }),
    setShowWaterPlane: (showWaterPlane) => persistedSet({ showWaterPlane }),
    setWaterPlaneLevel: (waterPlaneLevel) => persistedSet({ waterPlaneLevel }),
    setShowFog3D: (showFog3D) => persistedSet({ showFog3D }),
    setShowSky3D: (showSky3D) => persistedSet({ showSky3D }),
    setFogDistanceScale: (fogDistanceScale) => persistedSet({ fogDistanceScale }),
    setFogMinSpan: (fogMinSpan) => persistedSet({ fogMinSpan }),
    setShowCrossSection: (showCrossSection) => persistedSet({ showCrossSection }),
    setVoxelYMin: (voxelYMin) => persistedSet({ voxelYMin }),
    setVoxelYMax: (voxelYMax) => persistedSet({ voxelYMax }),
    setVoxelYSlices: (voxelYSlices) => persistedSet({ voxelYSlices }),
    setVoxelResolution: (voxelResolution) => persistedSet({ voxelResolution }),
    setShowThresholdView: (showThresholdView) => persistedSet({ showThresholdView }),
    setShowMaterialColors: (showMaterialColors) => persistedSet({ showMaterialColors }),
    setShowVoxelWireframe: (showVoxelWireframe) => persistedSet({ showVoxelWireframe }),
    setShowMaterialLegend: (showMaterialLegend) => persistedSet({ showMaterialLegend }),
    setShowSSAO: (showSSAO) => persistedSet({ showSSAO }),
    setShowEdgeOutline: (showEdgeOutline) => persistedSet({ showEdgeOutline }),
    setShowHillShade: (showHillShade) => persistedSet({ showHillShade }),
    setUsgsTopoStyle: (usgsTopoStyle) => {
      if (usgsTopoStyle) {
        persistedSet({ usgsTopoStyle: true, showContours: true, showHillShade: true });
      } else {
        persistedSet({ usgsTopoStyle: false });
      }
    },
    setAutoFitYEnabled: (autoFitYEnabled) => persistedSet({ autoFitYEnabled }),
    setAutoFitContentEnabled: (autoFitContentEnabled) => {
      persistedSet({ autoFitContentEnabled });
      if (autoFitContentEnabled) {
        originalSet({ _autoFitContentGraphHash: "", _userManualYAdjust: false, _userManualPreviewMode: false, _autoVoxelGraphHash: "" });
      }
    },
    setTerrainRefUseBaseY: (terrainRefUseBaseY) => persistedSet({ terrainRefUseBaseY }),
    setWorldCenterX: (worldCenterX) => persistedSet({ worldCenterX }),
    setWorldCenterZ: (worldCenterZ) => persistedSet({ worldCenterZ }),
    setWorldRadius: (worldRadius) => persistedSet({ worldRadius }),
    setWorldYMin: (worldYMin) => persistedSet({ worldYMin }),
    setWorldYMax: (worldYMax) => persistedSet({ worldYMax }),
    setWorldFollowPlayer: (worldFollowPlayer) => persistedSet({ worldFollowPlayer }),
    setWorldSurfaceDepth: (worldSurfaceDepth) => persistedSet({ worldSurfaceDepth }),
    setWorldLavaLevel: (worldLavaLevel) => persistedSet({ worldLavaLevel }),
    setWorldForceLoad: (worldForceLoad) => persistedSet({ worldForceLoad }),
    setWorldLivePlayer: (worldLivePlayer) => originalSet({ worldLivePlayer }),
    setWorldSceneLayout: (worldSceneLayout) => originalSet({ worldSceneLayout }),
    setShowWorldPlayerMarker: (showWorldPlayerMarker) => originalSet({ showWorldPlayerMarker }),
    setPrefabMeshData: (prefabMeshData) => originalSet({ prefabMeshData }),
    setTexturedPrefabMesh: (texturedPrefabMesh) => originalSet({ texturedPrefabMesh }),
    setPrefabTextureStats: (prefabTextureStats) => originalSet({ prefabTextureStats }),
    setPrefabPath: (prefabPath) => originalSet({ prefabPath }),
    setPrefabLoading: (isPrefabLoading) => originalSet({ isPrefabLoading }),
    setPrefabError: (prefabError) => originalSet({ prefabError }),
    setShowPositionOverlay: (showPositionOverlay) => persistedSet({ showPositionOverlay }),
    setPositionOverlayColor: (positionOverlayColor) => persistedSet({ positionOverlayColor }),
    setPositionOverlaySize: (positionOverlaySize) => persistedSet({ positionOverlaySize }),
    setPositionOverlaySeed: (positionOverlaySeed) => persistedSet({ positionOverlaySeed }),
    setShowShapePreview: (showShapePreview) => persistedSet({ showShapePreview }),
    setShowShapeCellMap: (showShapeCellMap) => persistedSet({ showShapeCellMap }),
    setShowCellBoundaries: (showCellBoundaries) => persistedSet({ showCellBoundaries }),
    setShowWallDistance: (showWallDistance) => persistedSet({ showWallDistance }),
    setShowMeshSamples: (showMeshSamples) => persistedSet({ showMeshSamples }),
    setShowSdfSurface: (showSdfSurface) => persistedSet({ showSdfSurface }),
    setShapePreviewSeed: (shapePreviewSeed) => persistedSet({ shapePreviewSeed }),
    setCellShapeGrid: (cellShapeGrid) => originalSet((s) => (
      s.cellShapeGrid === cellShapeGrid ? s : { cellShapeGrid }
    )),
    setSdfZeroSegments: (sdfZeroSegments) => originalSet((s) => {
      if (
        s.sdfZeroSegments === sdfZeroSegments
        || (s.sdfZeroSegments.length === 0 && sdfZeroSegments.length === 0)
      ) {
        return s;
      }
      return { sdfZeroSegments };
    }),
    setShapePreviewMeshPoints: (shapePreviewMeshPoints) => originalSet((s) => (
      s.shapePreviewMeshPoints === shapePreviewMeshPoints
      || (s.shapePreviewMeshPoints.length === 0 && shapePreviewMeshPoints.length === 0)
        ? s
        : { shapePreviewMeshPoints }
    )),
    applyShapePreviewPreset: (preset) => {
      if (preset === "pcn") {
        persistedSet({
          showShapePreview: true,
          showShapeCellMap: true,
          showCellBoundaries: true,
          showWallDistance: true,
          showMeshSamples: false,
          showSdfSurface: false,
        });
      } else if (preset === "pcnMesh") {
        persistedSet({
          showShapePreview: true,
          showShapeCellMap: true,
          showCellBoundaries: true,
          showWallDistance: true,
          showMeshSamples: true,
          showSdfSurface: false,
        });
      } else {
        persistedSet({
          showShapePreview: true,
          showCellBoundaries: false,
          showWallDistance: false,
          showMeshSamples: false,
          showSdfSurface: true,
          showVoxelWireframe: true,
          autoFitYEnabled: false,
          yLevel: 0,
          voxelYMin: SDF_DEFAULT_VOXEL_Y.min,
          voxelYMax: SDF_DEFAULT_VOXEL_Y.max,
        });
      }
    },
    setCompareNodeA: (compareNodeA) => persistedSet({ compareNodeA }),
    setCompareNodeB: (compareNodeB) => persistedSet({ compareNodeB }),
    setCompareModeA: (compareModeA) => persistedSet({ compareModeA }),
    setCompareModeB: (compareModeB) => persistedSet({ compareModeB }),
    setLinkCameras3D: (linkCameras3D) => persistedSet({ linkCameras3D }),

    setSplitDirection: (splitDirection) => persistedSet({ splitDirection }),

    setAtmosphereSettings: (atmosphereSettings) => persistedSet({ atmosphereSettings }),
    setTintColors: (tintColors) => persistedSet({ tintColors }),
  };
});
