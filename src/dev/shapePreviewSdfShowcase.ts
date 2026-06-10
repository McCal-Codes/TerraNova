import type { Edge, Node } from "@xyflow/react";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { getNodeType } from "@/utils/density/evalTypes";
import { SDF_DEFAULT_VOXEL_Y } from "@/utils/shapePreview/sdfPreviewDefaults";

/** SDF primitives supported by shape-preview zero contour (density = 0). */
export const SDF_SHOWCASE_TYPES = [
  "Ellipsoid",
  "Cuboid",
  "Cylinder",
  "Plane",
  "Shell",
  "Cube",
] as const;

export type SdfShowcaseType = (typeof SDF_SHOWCASE_TYPES)[number];

/** @deprecated Use SDF_DEFAULT_VOXEL_Y — kept for gallery imports */
export const SDF_GALLERY_VOXEL_Y = SDF_DEFAULT_VOXEL_Y;

/**
 * Manual curve matching Mudcracks_Actual_WIP_11 Cube (In/Out → x/y for jsonToGraph).
 * Hytale export uses In/Out; TerraNova graph eval expects { x, y } on curve points.
 */
const MUDCRACKS_CUBE_CURVE = {
  $NodeId: "ManualCurve-c6b9e5bf-51ea-488d-bd05-0ddc3a4a476e",
  Type: "Manual",
  Points: [
    { $NodeId: "CurvePoint-42a50cb3-5783-4ae8-b5ea-e42f65f0e502", x: 0, y: 1 },
    { $NodeId: "CurvePoint-ce0a8c71-71d8-4d84-91ee-850305c2a184", x: 3, y: -2 },
  ],
};

/** Hytale V2 density subtrees sized for ±64 XZ preview (surface near y=0). */
const SDF_SHOWCASE_ASSETS: Record<SdfShowcaseType, Record<string, unknown>> = {
  Ellipsoid: {
    $NodeId: "sdf-showcase-ellipsoid",
    Type: "Ellipsoid",
    Skip: false,
    Scale: { x: 18, y: 14, z: 18 },
    NewYAxis: { x: 0, y: 1, z: 0 },
    SpinAngle: 0,
  },
  Cuboid: {
    $NodeId: "sdf-showcase-cuboid",
    Type: "Cuboid",
    Skip: false,
    Scale: { x: 16, y: 10, z: 20 },
    NewYAxis: { x: 0, y: 1, z: 0 },
    SpinAngle: 15,
  },
  Cylinder: {
    $NodeId: "sdf-showcase-cylinder",
    Type: "Cylinder",
    Skip: false,
    Radius: 14,
    Height: 28,
    NewYAxis: { x: 0, y: 1, z: 0 },
    SpinAngle: 0,
  },
  Plane: {
    $NodeId: "sdf-showcase-plane",
    Type: "Plane",
    Skip: false,
    // Tilted so the y=0 preview slice crosses density=0 (horizontal plane is flat on slice).
    Normal: { x: 0.4, y: 1, z: 0.25 },
    Distance: 0,
  },
  Shell: {
    $NodeId: "sdf-showcase-shell",
    Type: "Shell",
    Skip: false,
    InnerRadius: 10,
    OuterRadius: 22,
  },
  Cube: {
    $NodeId: "sdf-showcase-cube",
    Type: "Cube",
    Skip: false,
    Curve: MUDCRACKS_CUBE_CURVE,
  },
};

export interface SdfShowcaseGraph {
  nodes: Node[];
  edges: Edge[];
  shapeNodeIds: Record<SdfShowcaseType, string>;
  defaultShape: SdfShowcaseType;
}

export function buildSdfShowcaseGraph(): SdfShowcaseGraph {
  const nodes: Node[] = [];
  const edges: Edge[] = [];
  const shapeNodeIds = {} as Record<SdfShowcaseType, string>;

  let offsetX = 0;
  for (const shapeType of SDF_SHOWCASE_TYPES) {
    const asset = SDF_SHOWCASE_ASSETS[shapeType];
    const { nodes: partNodes, edges: partEdges } = jsonToGraph(
      asset,
      offsetX,
      0,
      `sdf_${shapeType.toLowerCase()}`,
    );

    const root =
      partNodes.find((n) => getNodeType(n) === shapeType) ??
      partNodes.find((n) => n.id.includes("showcase")) ??
      partNodes[0];
    if (!root) {
      throw new Error(`SDF showcase: no root for ${shapeType}`);
    }
    shapeNodeIds[shapeType] = root.id;

    nodes.push(...partNodes);
    edges.push(...partEdges);
    offsetX += 280;
  }

  return {
    nodes,
    edges,
    shapeNodeIds,
    defaultShape: "Ellipsoid",
  };
}

/** Standalone Mudcracks reference Cube (curve-shaped SDF) for gallery UAT. */
export function buildMudcracksCubeGraph(): {
  nodes: Node[];
  edges: Edge[];
  cubeNodeId: string;
} {
  const asset = {
    $NodeId: "Cube.Density-15f2de5f-4436-4b6f-bbae-4fcc3140b81b",
    Type: "Cube",
    Skip: false,
    Curve: MUDCRACKS_CUBE_CURVE,
  };
  const { nodes, edges } = jsonToGraph(asset, 0, 0, "mudcracks_cube");
  const cube =
    nodes.find((n) => getNodeType(n) === "Cube") ?? nodes[0];
  if (!cube) throw new Error("Mudcracks cube graph empty");
  return { nodes, edges, cubeNodeId: cube.id };
}
