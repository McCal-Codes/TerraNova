import { describe, expect, it } from "vitest";
import type { Node } from "@xyflow/react";
import { VIEWPORT_MARGIN } from "../applyHytaleImportLayout";
import { buildBiomeOverviewGraph } from "../biomeUnifiedCanvas";
import type { BiomeSectionData } from "@/stores/slices/types";

function section(nodes: Node[]): BiomeSectionData {
  return {
    nodes,
    edges: [],
    history: [{ nodes, edges: [], outputNodeId: null, label: "Initial" }],
    historyIndex: 0,
  };
}

describe("buildBiomeOverviewGraph", () => {
  it("places sections in shared global space when hytale layout metadata is available", () => {
    const terrainNode: Node = {
      id: "t1",
      type: "Constant",
      position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
      data: {},
    };
    const materialNode: Node = {
      id: "m1",
      type: "Constant",
      position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
      data: {},
    };

    const graph = buildBiomeOverviewGraph(
      {
        Terrain: section([terrainNode]),
        MaterialProvider: section([materialNode]),
      },
      "hytale",
      {
        Terrain: { x: 0, y: 0, originX: 1000, originY: 2000, scale: 2 },
        MaterialProvider: { x: 0, y: 0, originX: 8000, originY: 9000, scale: 2 },
      },
    );

    const terrain = graph.nodes.find((node) => node.id === "Terrain::t1");
    const material = graph.nodes.find((node) => node.id === "MaterialProvider::m1");
    expect(terrain).toBeDefined();
    expect(material).toBeDefined();
    expect(terrain!.position.x).not.toEqual(material!.position.x);
    expect(terrain!.position.y).not.toEqual(material!.position.y);
  });

  it("includes props and atmosphere sections in global overview layout", () => {
    const propNode: Node = {
      id: "p1",
      type: "Constant",
      position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
      data: {},
    };
    const envNode: Node = {
      id: "e1",
      type: "Constant",
      position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
      data: {},
    };

    const graph = buildBiomeOverviewGraph(
      {
        Terrain: section([
          {
            id: "t1",
            type: "Constant",
            position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
            data: {},
          },
        ]),
        "Props[0]": section([propNode]),
        EnvironmentProvider: section([envNode]),
      },
      "hytale",
      {
        Terrain: { x: 0, y: 0, originX: 1000, originY: 2000, scale: 2 },
        "Props[0]": { x: 0, y: 0, originX: 12000, originY: 3000, scale: 2 },
        EnvironmentProvider: { x: 0, y: 0, originX: 5000, originY: 8000, scale: 2 },
      },
    );

    expect(graph.nodes.some((n) => n.id === "Props[0]::p1")).toBe(true);
    expect(graph.nodes.some((n) => n.id === "EnvironmentProvider::e1")).toBe(true);
  });

  it("separates overlapping hytale sections in overview layout", () => {
    const sharedOffset = { x: 0, y: 0, originX: 1000, originY: 2000, scale: 2 };
    const nodeAtOrigin: Node = {
      id: "n1",
      type: "Constant",
      position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
      data: {},
    };

    const graph = buildBiomeOverviewGraph(
      {
        Terrain: section([{ ...nodeAtOrigin, id: "t1" }]),
        MaterialProvider: section([{ ...nodeAtOrigin, id: "m1" }]),
        "Props[0]": section([{ ...nodeAtOrigin, id: "p1" }]),
      },
      "hytale",
      {
        Terrain: sharedOffset,
        MaterialProvider: sharedOffset,
        "Props[0]": sharedOffset,
      },
    );

    const backdrops = graph.nodes.filter((node) => node.type === "overviewSection");
    expect(backdrops).toHaveLength(3);

    for (let i = 0; i < backdrops.length; i++) {
      for (let j = i + 1; j < backdrops.length; j++) {
        const a = backdrops[i];
        const b = backdrops[j];
        const aWidth = (a.data as { width: number }).width;
        const aHeight = (a.data as { height: number }).height;
        const bWidth = (b.data as { width: number }).width;
        const bHeight = (b.data as { height: number }).height;
        const overlapX = Math.min(a.position.x + aWidth, b.position.x + bWidth) - Math.max(a.position.x, b.position.x);
        const overlapY = Math.min(a.position.y + aHeight, b.position.y + bHeight) - Math.max(a.position.y, b.position.y);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
      }
    }
  });

  it("separates many overlapping hytale prop sections without 2D backdrop overlap", () => {
    const sharedOffset = { x: 0, y: 0, originX: 1000, originY: 2000, scale: 2 };
    const sections: Record<string, ReturnType<typeof section>> = {
      Terrain: section([
        {
          id: "t1",
          type: "Constant",
          position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
          data: {},
        },
      ]),
    };
    const offsets: Record<string, typeof sharedOffset> = {
      Terrain: sharedOffset,
    };

    for (let i = 0; i < 13; i++) {
      const key = `Props[${i}]`;
      sections[key] = section([
        {
          id: `p${i}`,
          type: "Constant",
          position: { x: VIEWPORT_MARGIN, y: VIEWPORT_MARGIN },
          data: {},
        },
      ]);
      offsets[key] = sharedOffset;
    }

    const graph = buildBiomeOverviewGraph(sections, "hytale", offsets);
    const backdrops = graph.nodes.filter((node) => node.type === "overviewSection");
    expect(backdrops).toHaveLength(14);

    for (let i = 0; i < backdrops.length; i++) {
      for (let j = i + 1; j < backdrops.length; j++) {
        const a = backdrops[i];
        const b = backdrops[j];
        const aWidth = (a.data as { width: number }).width;
        const aHeight = (a.data as { height: number }).height;
        const bWidth = (b.data as { width: number }).width;
        const bHeight = (b.data as { height: number }).height;
        const overlapX = Math.min(a.position.x + aWidth, b.position.x + bWidth) - Math.max(a.position.x, b.position.x);
        const overlapY = Math.min(a.position.y + aHeight, b.position.y + bHeight) - Math.max(a.position.y, b.position.y);
        expect(overlapX <= 0 || overlapY <= 0).toBe(true);
      }
    }
  });

  it("stacks non-hytale sections vertically instead of overlapping them", () => {
    const terrainNode: Node = {
      id: "t1",
      type: "Constant",
      position: { x: 120, y: 80 },
      data: {},
    };
    const materialNode: Node = {
      id: "m1",
      type: "Constant",
      position: { x: 140, y: 100 },
      data: {},
    };

    const graph = buildBiomeOverviewGraph(
      {
        Terrain: section([terrainNode]),
        MaterialProvider: section([materialNode]),
      },
      "autolayout",
      null,
    );

    const terrain = graph.nodes.find((node) => node.id === "Terrain::t1");
    const material = graph.nodes.find((node) => node.id === "MaterialProvider::m1");
    expect(terrain?.position).toEqual({ x: 120, y: 80 });
    expect(material?.position.y).toBeGreaterThan(terrain!.position.y);
  });
});
