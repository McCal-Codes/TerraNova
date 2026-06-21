import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { hytaleToInternalBiome } from "../hytaleToInternal";
import { jsonToGraph } from "../jsonToGraph";
import { mergeImportGraph } from "../importAnnotations";
import { splitImportMetadataBySection, collectBiomeSectionNodeIds } from "../sectionAnnotationRouting";
import { applySectionHytalePositions, VIEWPORT_MARGIN } from "../applyHytaleImportLayout";

const AUTUMN_PATH = "C:/Users/wolft/Downloads/FireFox Downloads/Autumn.json";

describe("Autumn.json layout parity", () => {
  it("preserves terrain relative spacing from Hytale metadata when available locally", async () => {
    if (!existsSync(AUTUMN_PATH)) return;

    const raw = JSON.parse(readFileSync(AUTUMN_PATH, "utf8")) as Record<string, unknown>;
    const { wrapper, metadata } = hytaleToInternalBiome(raw);
    const terrain = wrapper.Terrain as { Density?: Record<string, unknown> } | undefined;
    expect(terrain?.Density).toBeDefined();

    const { nodes, edges } = jsonToGraph(terrain!.Density!, 0, 0, "autumn");
    const slices = splitImportMetadataBySection(
      metadata,
      ["Terrain", "MaterialProvider", "Props[0]"],
      wrapper,
    );
    const terrainMeta = {
      ...metadata,
      hytaleComments: slices.get("Terrain")?.hytaleComments ?? [],
      hytaleGroups: slices.get("Terrain")?.hytaleGroups ?? [],
    };

    const sectionNodeIds = collectBiomeSectionNodeIds(wrapper).Terrain;
    expect(sectionNodeIds?.size).toBeGreaterThan(0);

    const result = await mergeImportGraph(nodes, edges, terrainMeta, {
      nodePositions: metadata.nodePositions,
      sectionNodeIds,
      autoLayoutOnOpen: false,
      flowDirection: "LR",
      autoFrame: { sectionKey: "Terrain", edges, sectionNodeIds },
    });

    expect(result.layoutMode).toBe("hytale");
    const frameNames = result.nodes
      .filter((node) => node.type === "frame")
      .map((node) => (node.data as { name?: string }).name);
    expect(frameNames).toEqual(expect.arrayContaining(["Wall", "Pathway+Valleys"]));

    const wallNodeId = "Min.Density-4cc6c797-4864-48c8-8ffe-6bd07c14c3a3";
    const maxNodeId = "Max.Density-da6f3501-84a8-4966-8fed-170b34b66f4d";
    const wall = result.nodes.find((node) => node.id === wallNodeId);
    const max = result.nodes.find((node) => node.id === maxNodeId);
    expect(wall).toBeDefined();
    expect(max).toBeDefined();

    const hytaleWall = metadata.nodePositions[wallNodeId];
    const hytaleMax = metadata.nodePositions[maxNodeId];
    expect(hytaleWall).toBeDefined();
    expect(hytaleMax).toBeDefined();

    const canvasDx = max!.position.x - wall!.position.x;
    const canvasDy = max!.position.y - wall!.position.y;
    const scale = result.layoutOffset.scale ?? 1;
    expect(canvasDx).toBeCloseTo((hytaleMax!.x - hytaleWall!.x) * scale, 4);
    expect(canvasDy).toBeCloseTo((hytaleMax!.y - hytaleWall!.y) * scale, 4);
  });

  it("routes Autumn terrain frames to the Terrain section slice", () => {
    if (!existsSync(AUTUMN_PATH)) return;

    const raw = JSON.parse(readFileSync(AUTUMN_PATH, "utf8")) as Record<string, unknown>;
    const { wrapper, metadata } = hytaleToInternalBiome(raw);
    const slices = splitImportMetadataBySection(metadata, ["Terrain", "MaterialProvider", "Props[0]"], wrapper);
    const terrainFrames = slices.get("Terrain")?.hytaleGroups.map((group) => group.name) ?? [];
    expect(terrainFrames).toEqual(expect.arrayContaining([
      "Wall",
      "Pathway+Valleys",
      "Sharpness + CellNoise Mask",
    ]));
  });

  it("normalizes Autumn terrain positions into a friendly viewport", () => {
    if (!existsSync(AUTUMN_PATH)) return;

    const raw = JSON.parse(readFileSync(AUTUMN_PATH, "utf8")) as Record<string, unknown>;
    const { wrapper, metadata } = hytaleToInternalBiome(raw);
    const terrain = wrapper.Terrain as { Density?: Record<string, unknown> } | undefined;
    const { nodes } = jsonToGraph(terrain!.Density!, 0, 0, "autumn");
    const applied = applySectionHytalePositions(nodes, metadata.nodePositions);
    expect(applied.usedHytaleLayout).toBe(true);
    const xs = applied.nodes.map((node) => node.position.x);
    const ys = applied.nodes.map((node) => node.position.y);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(VIEWPORT_MARGIN);
  });
});
