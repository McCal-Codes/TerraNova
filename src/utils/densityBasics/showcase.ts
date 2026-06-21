import type { Edge, Node } from "@xyflow/react";
import type { PreviewMode } from "@/stores/previewStore";
import { getDefaults } from "@/schema/defaults";
import type { SnippetDefinition, SnippetEdgeDef, SnippetNodeDef } from "@/schema/snippets";
import {
  DENSITY_BASICS_CASE_IDS,
  DENSITY_BASICS_CASE_META,
  type DensityBasicsCaseId,
  type DensityBasicsCaseMeta,
} from "./caseMeta";

/** Documented terrain scale for ±64 preview range. */
export const TERRAIN_NOISE_2D_SCALE = 0.008;
/** Cave / 3D noise scale from basic-terrain-generation walkthrough. */
export const CAVE_NOISE_3D_SCALE = 0.04;

function makeEdge(id: string, source: string, target: string, targetHandle: string): Edge {
  return { id, source, target, sourceHandle: "output", targetHandle };
}

function nodeId(caseId: DensityBasicsCaseId, local: string): string {
  return `density-basics-${caseId}-${local}`;
}

function baseNoise2DFields(seed = "A"): Record<string, unknown> {
  return {
    ...getDefaults("SimplexNoise2D"),
    Scale: TERRAIN_NOISE_2D_SCALE,
    Seed: seed,
    Octaves: 3,
  };
}

function baseNoise3DFields(seed = "A"): Record<string, unknown> {
  return {
    ...getDefaults("SimplexNoise3D"),
    Scale: CAVE_NOISE_3D_SCALE,
    Seed: seed,
    Octaves: 2,
  };
}

function baseHeightFields(): Record<string, unknown> {
  return { ...getDefaults("BaseHeight"), BaseHeightName: "Base", Distance: false };
}

export interface DensityBasicsCaseGraph {
  nodes: Node[];
  edges: Edge[];
  outputNodeId: string;
  previewNodeId: string;
  defaultPreviewMode: PreviewMode;
  contentFields: Record<string, number>;
  yLevel: number;
  voxelYMin: number;
  voxelYMax: number;
  mixAltNodeIds?: string[];
}

function metaFor(id: DensityBasicsCaseId): DensityBasicsCaseMeta {
  return DENSITY_BASICS_CASE_META[id];
}

function buildNoise2D(): DensityBasicsCaseGraph {
  const id = "density-noise-2d" as const;
  const m = metaFor(id);
  const noise = nodeId(id, "noise");
  return {
    nodes: [
      {
        id: noise,
        type: "SimplexNoise2D",
        position: { x: 0, y: 0 },
        data: { type: "SimplexNoise2D", fields: baseNoise2DFields(), label: "SimplexNoise2D" },
      },
    ],
    edges: [],
    outputNodeId: noise,
    previewNodeId: noise,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
  };
}

function buildNoise3D(): DensityBasicsCaseGraph {
  const id = "density-noise-3d" as const;
  const m = metaFor(id);
  const noise = nodeId(id, "noise");
  return {
    nodes: [
      {
        id: noise,
        type: "SimplexNoise3D",
        position: { x: 0, y: 0 },
        data: { type: "SimplexNoise3D", fields: baseNoise3DFields(), label: "SimplexNoise3D" },
      },
    ],
    edges: [],
    outputNodeId: noise,
    previewNodeId: noise,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
  };
}

function buildSum2D(): DensityBasicsCaseGraph {
  const id = "density-sum-2d" as const;
  const m = metaFor(id);
  const bh = nodeId(id, "base");
  const noise = nodeId(id, "noise");
  const sum = nodeId(id, "sum");
  return {
    nodes: [
      {
        id: bh,
        type: "BaseHeight",
        position: { x: 0, y: 0 },
        data: { type: "BaseHeight", fields: baseHeightFields(), label: "BaseHeight" },
      },
      {
        id: noise,
        type: "SimplexNoise2D",
        position: { x: 0, y: 120 },
        data: { type: "SimplexNoise2D", fields: baseNoise2DFields(), label: "SimplexNoise2D" },
      },
      {
        id: sum,
        type: "Sum",
        position: { x: 280, y: 60 },
        data: { type: "Sum", fields: {}, label: "Sum" },
      },
    ],
    edges: [
      makeEdge(`${id}-e1`, bh, sum, "Inputs[0]"),
      makeEdge(`${id}-e2`, noise, sum, "Inputs[1]"),
    ],
    outputNodeId: sum,
    previewNodeId: sum,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
  };
}

function buildSum3D(): DensityBasicsCaseGraph {
  const id = "density-sum-3d" as const;
  const m = metaFor(id);
  const bh = nodeId(id, "base");
  const noise = nodeId(id, "noise");
  const sum = nodeId(id, "sum");
  return {
    nodes: [
      {
        id: bh,
        type: "BaseHeight",
        position: { x: 0, y: 0 },
        data: { type: "BaseHeight", fields: baseHeightFields(), label: "BaseHeight" },
      },
      {
        id: noise,
        type: "SimplexNoise3D",
        position: { x: 0, y: 120 },
        data: { type: "SimplexNoise3D", fields: baseNoise3DFields(), label: "SimplexNoise3D" },
      },
      {
        id: sum,
        type: "Sum",
        position: { x: 280, y: 60 },
        data: { type: "Sum", fields: {}, label: "Sum" },
      },
    ],
    edges: [
      makeEdge(`${id}-e1`, bh, sum, "Inputs[0]"),
      makeEdge(`${id}-e2`, noise, sum, "Inputs[1]"),
    ],
    outputNodeId: sum,
    previewNodeId: sum,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
  };
}

function buildMinCarve(): DensityBasicsCaseGraph {
  const id = "density-min-carve" as const;
  const m = metaFor(id);
  const bh = nodeId(id, "base");
  const noise = nodeId(id, "noise");
  const inv = nodeId(id, "inv");
  const min = nodeId(id, "min");
  return {
    nodes: [
      {
        id: bh,
        type: "BaseHeight",
        position: { x: 0, y: 0 },
        data: { type: "BaseHeight", fields: baseHeightFields(), label: "BaseHeight" },
      },
      {
        id: noise,
        type: "SimplexNoise3D",
        position: { x: 0, y: 140 },
        data: { type: "SimplexNoise3D", fields: baseNoise3DFields("cave"), label: "SimplexNoise3D" },
      },
      {
        id: inv,
        type: "Inverter",
        position: { x: 220, y: 140 },
        data: { type: "Inverter", fields: {}, label: "Inverter" },
      },
      {
        id: min,
        type: "Min",
        position: { x: 420, y: 60 },
        data: { type: "Min", fields: {}, label: "Min" },
      },
    ],
    edges: [
      makeEdge(`${id}-e1`, bh, min, "Inputs[0]"),
      makeEdge(`${id}-e2`, noise, inv, "Input"),
      makeEdge(`${id}-e3`, inv, min, "Inputs[1]"),
    ],
    outputNodeId: min,
    previewNodeId: min,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
    mixAltNodeIds: [bh, noise],
  };
}

function buildMax2D(): DensityBasicsCaseGraph {
  const id = "density-max-2d" as const;
  const m = metaFor(id);
  const noiseA = nodeId(id, "noiseA");
  const noiseB = nodeId(id, "noiseB");
  const max = nodeId(id, "max");
  return {
    nodes: [
      {
        id: noiseA,
        type: "SimplexNoise2D",
        position: { x: 0, y: 0 },
        data: {
          type: "SimplexNoise2D",
          fields: baseNoise2DFields("A"),
          label: "Noise A",
        },
      },
      {
        id: noiseB,
        type: "SimplexNoise2D",
        position: { x: 0, y: 120 },
        data: {
          type: "SimplexNoise2D",
          fields: { ...baseNoise2DFields("B"), Scale: 0.012 },
          label: "Noise B",
        },
      },
      {
        id: max,
        type: "Max",
        position: { x: 280, y: 60 },
        data: { type: "Max", fields: {}, label: "Max" },
      },
    ],
    edges: [
      makeEdge(`${id}-e1`, noiseA, max, "Inputs[0]"),
      makeEdge(`${id}-e2`, noiseB, max, "Inputs[1]"),
    ],
    outputNodeId: max,
    previewNodeId: max,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
    mixAltNodeIds: [noiseA, noiseB],
  };
}

function buildMul2D(): DensityBasicsCaseGraph {
  const id = "density-mul-2d" as const;
  const m = metaFor(id);
  const noise = nodeId(id, "noise");
  const mask = nodeId(id, "mask");
  const mul = nodeId(id, "mul");
  return {
    nodes: [
      {
        id: noise,
        type: "SimplexNoise2D",
        position: { x: 0, y: 0 },
        data: { type: "SimplexNoise2D", fields: baseNoise2DFields(), label: "SimplexNoise2D" },
      },
      {
        id: mask,
        type: "Constant",
        position: { x: 0, y: 120 },
        data: { type: "Constant", fields: { Value: 0.5 }, label: "Constant" },
      },
      {
        id: mul,
        type: "Multiplier",
        position: { x: 280, y: 60 },
        data: { type: "Multiplier", fields: {}, label: "Multiplier" },
      },
    ],
    edges: [
      makeEdge(`${id}-e1`, noise, mul, "Inputs[0]"),
      makeEdge(`${id}-e2`, mask, mul, "Inputs[1]"),
    ],
    outputNodeId: mul,
    previewNodeId: mul,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
  };
}

function buildPow2D(): DensityBasicsCaseGraph {
  const id = "density-pow-2d" as const;
  const m = metaFor(id);
  const noise = nodeId(id, "noise");
  const pow = nodeId(id, "pow");
  return {
    nodes: [
      {
        id: noise,
        type: "SimplexNoise2D",
        position: { x: 0, y: 0 },
        data: { type: "SimplexNoise2D", fields: baseNoise2DFields(), label: "SimplexNoise2D" },
      },
      {
        id: pow,
        type: "Pow",
        position: { x: 280, y: 0 },
        data: { type: "Pow", fields: { Exponent: 2 }, label: "Pow" },
      },
    ],
    edges: [makeEdge(`${id}-e1`, noise, pow, "Input")],
    outputNodeId: pow,
    previewNodeId: pow,
    defaultPreviewMode: m.defaultPreviewMode,
    contentFields: m.contentFields,
    yLevel: m.yLevel,
    voxelYMin: m.voxelYMin,
    voxelYMax: m.voxelYMax,
  };
}

const BUILDERS: Record<DensityBasicsCaseId, () => DensityBasicsCaseGraph> = {
  "density-noise-2d": buildNoise2D,
  "density-noise-3d": buildNoise3D,
  "density-sum-2d": buildSum2D,
  "density-sum-3d": buildSum3D,
  "density-min-carve": buildMinCarve,
  "density-max-2d": buildMax2D,
  "density-mul-2d": buildMul2D,
  "density-pow-2d": buildPow2D,
};

export function buildDensityBasicsCase(caseId: DensityBasicsCaseId): DensityBasicsCaseGraph {
  return BUILDERS[caseId]();
}

/** Snippet node layout mirrors showcase graphs (single source for fields). */
function graphToSnippetDefs(caseId: DensityBasicsCaseId): {
  nodes: SnippetNodeDef[];
  edges: SnippetEdgeDef[];
} {
  const graph = buildDensityBasicsCase(caseId);
  const localFromId = new Map<string, string>();
  for (const n of graph.nodes) {
    const suffix = n.id.replace(`density-basics-${caseId}-`, "");
    localFromId.set(n.id, suffix);
  }

  const nodes: SnippetNodeDef[] = graph.nodes.map((n, i) => {
    const localId = localFromId.get(n.id) ?? `n${i}`;
    const data = n.data as Record<string, unknown>;
    return {
      localId,
      type: n.type ?? String(data.type),
      displayType: String(data.type),
      label: typeof data.label === "string" ? data.label : undefined,
      fields: { ...((data.fields as Record<string, unknown>) ?? {}) },
      offsetX: n.position.x,
      offsetY: n.position.y,
    };
  });

  const edges: SnippetEdgeDef[] = graph.edges.map((e) => ({
    sourceLocal: localFromId.get(e.source) ?? e.source,
    targetLocal: localFromId.get(e.target) ?? e.target,
    targetHandle: e.targetHandle ?? "Input",
  }));

  return { nodes, edges };
}

export function densityBasicsSnippetDefinitions(): SnippetDefinition[] {
  return DENSITY_BASICS_CASE_IDS.map((id) => {
    const meta = metaFor(id);
    const { nodes, edges } = graphToSnippetDefs(id);
    return {
      id,
      name: meta.name,
      description: meta.description,
      category: "Density basics",
      tags: ["density-basics", "learning"],
      nodes,
      edges,
    };
  });
}
