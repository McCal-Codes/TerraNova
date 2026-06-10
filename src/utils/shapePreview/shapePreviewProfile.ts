export interface ShapePreviewProfile {
  cells: boolean;
  wall: boolean;
  mesh: boolean;
  sdfZero: boolean;
}

const CELL_TYPES = new Set([
  "PositionsCellNoise",
  "Positions3D",
  "CellNoise2D",
  "CellNoise3D",
  "VoronoiNoise2D",
  "VoronoiNoise3D",
]);

const MESH_TYPES = new Set(["Mesh2D", "Mesh3D"]);

const SDF_TYPES = new Set([
  "Ellipsoid",
  "Cuboid",
  "Cylinder",
  "Plane",
  "Shell",
  "Cube",
  "Axis",
]);

export function getShapePreviewProfile(nodeType: string): ShapePreviewProfile {
  const isCell = CELL_TYPES.has(nodeType);
  const isMesh =
    MESH_TYPES.has(nodeType) ||
    nodeType === "PositionsCellNoise" ||
    nodeType === "Positions3D";
  const isSdf = SDF_TYPES.has(nodeType);
  return {
    cells: isCell,
    wall: isCell,
    mesh: isMesh,
    sdfZero: isSdf,
  };
}

export function defaultShapeLayersForType(nodeType: string): {
  showCellBoundaries: boolean;
  showWallDistance: boolean;
  showMeshSamples: boolean;
  showSdfSurface: boolean;
} {
  const p = getShapePreviewProfile(nodeType);
  return {
    showCellBoundaries: p.cells,
    showWallDistance: p.cells,
    showMeshSamples: p.mesh,
    showSdfSurface: p.sdfZero,
  };
}

export function isCellNoiseType(nodeType: string): boolean {
  return CELL_TYPES.has(nodeType);
}

export function isSdfType(nodeType: string): boolean {
  return SDF_TYPES.has(nodeType);
}

export function supportsShapePreviewCard(nodeType: string): boolean {
  const p = getShapePreviewProfile(nodeType);
  return p.cells || p.mesh || p.sdfZero;
}
