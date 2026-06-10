import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import {
  findPositionsRootNodeId,
  hasPropPlacementProviders,
  isPropEditingContext,
  resolvePropPlacementRootNodeId,
  resolveEffectivePrefabPreviewSource,
  resolvePropPrefabPreviewSource,
} from "../propEditingContext";

describe("isPropEditingContext", () => {
  it("returns true for standalone prop files", () => {
    expect(isPropEditingContext("Prop", null)).toBe(true);
  });

  it("returns true for biome Props sections", () => {
    expect(isPropEditingContext("Biome", "Props[0]")).toBe(true);
  });

  it("returns false for density and other contexts", () => {
    expect(isPropEditingContext("Density", null)).toBe(false);
    expect(isPropEditingContext("Biome", "Terrain")).toBe(false);
    expect(isPropEditingContext(null, null)).toBe(false);
  });
});

describe("findPositionsRootNodeId", () => {
  it("finds node tagged with _biomeField Positions", () => {
    const nodes: Node[] = [
      {
        id: "pos-root",
        position: { x: 0, y: 0 },
        data: { type: "Mesh2D", fields: {}, _biomeField: "Positions" },
      },
      {
        id: "other",
        position: { x: 0, y: 0 },
        data: { type: "Box", fields: {}, _biomeField: "Assignments" },
      },
    ];
    expect(findPositionsRootNodeId(nodes)).toBe("pos-root");
  });

  it("returns null when no Positions tag exists", () => {
    const nodes: Node[] = [
      {
        id: "a",
        position: { x: 0, y: 0 },
        data: { type: "Mesh2D", fields: {} },
      },
    ];
    expect(findPositionsRootNodeId(nodes)).toBeNull();
  });
});

describe("hasPropPlacementProviders", () => {
  it("detects Position provider nodes", () => {
    const nodes: Node[] = [
      {
        id: "grid",
        type: "Position:SquareGrid2d",
        position: { x: 0, y: 0 },
        data: { type: "SquareGrid2d", fields: {} },
      },
      {
        id: "prefab",
        type: "Prop:Imported",
        position: { x: 0, y: 0 },
        data: { type: "Imported", fields: { Name: "AutumnForest_Grasses" } },
      },
    ];
    expect(hasPropPlacementProviders(nodes)).toBe(true);
  });
});

describe("resolvePropPrefabPreviewSource", () => {
  it("prefers selected Prop:Prefab with Path", () => {
    const nodes: Node[] = [
      {
        id: "prefab-a",
        type: "Prop:Prefab",
        position: { x: 0, y: 0 },
        data: { type: "Prefab", fields: { Path: "Trees/Oak" } },
      },
      {
        id: "prefab-b",
        type: "Prop:Prefab",
        position: { x: 0, y: 0 },
        data: { type: "Prefab", fields: { Path: "Ruins/Tower" } },
      },
    ];
    expect(resolvePropPrefabPreviewSource(nodes, "prefab-b")?.path).toBe("Ruins/Tower");
  });

  it("falls back to first prefab node in graph", () => {
    const nodes: Node[] = [
      {
        id: "prefab-a",
        type: "Prop:Prefab",
        position: { x: 0, y: 0 },
        data: { type: "Prefab", fields: { Path: "Bone_Ring_001" } },
      },
    ];
    expect(resolvePropPrefabPreviewSource(nodes, null)?.path).toBe("Bone_Ring_001");
  });
});

describe("resolveEffectivePrefabPreviewSource", () => {
  it("prefers manual browse path over graph prefab when browsing", () => {
    const graph = {
      nodeId: "p1",
      fields: { Path: "From/Graph" },
      path: "From/Graph",
    };
    expect(resolveEffectivePrefabPreviewSource(graph, "Browsed/Path")?.path).toBe("Browsed/Path");
  });

  it("falls back to graph prefab when manual browse is cleared", () => {
    const graph = {
      nodeId: "p1",
      fields: { Path: "From/Graph" },
      path: "From/Graph",
    };
    expect(resolveEffectivePrefabPreviewSource(graph, null)?.path).toBe("From/Graph");
    expect(resolveEffectivePrefabPreviewSource(graph, "   ")?.path).toBe("From/Graph");
  });

  it("uses manual path when graph has no prefab", () => {
    expect(resolveEffectivePrefabPreviewSource(null, "  Grass/Patch  ")?.path).toBe("Grass/Patch");
  });
});

describe("resolvePropPlacementRootNodeId", () => {
  it("prefers selected Position node over tagged root", () => {
    const nodes: Node[] = [
      {
        id: "pos-root",
        position: { x: 0, y: 0 },
        type: "Position:Mesh2D",
        data: { type: "Mesh2D", fields: {}, _biomeField: "Positions" },
      },
      {
        id: "pos-child",
        position: { x: 0, y: 0 },
        type: "Position:List",
        data: { type: "List", fields: {} },
      },
    ];
    expect(resolvePropPlacementRootNodeId(nodes, "pos-child")).toBe("pos-child");
  });

  it("falls back to Positions tag when a Prop node is selected", () => {
    const nodes: Node[] = [
      {
        id: "pos-root",
        position: { x: 0, y: 0 },
        data: { type: "Mesh2D", fields: {}, _biomeField: "Positions" },
      },
      {
        id: "prop-node",
        position: { x: 0, y: 0 },
        type: "Prop:Prefab",
        data: { type: "Prefab", fields: {} },
      },
    ];
    expect(resolvePropPlacementRootNodeId(nodes, "prop-node")).toBe("pos-root");
  });
});
