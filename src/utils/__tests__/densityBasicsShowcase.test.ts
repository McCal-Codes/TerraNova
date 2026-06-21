import { describe, it, expect } from "vitest";
import { evaluateDensityGrid } from "@/utils/density/evaluateGrid";
import { isUniformDensitySlice } from "@/utils/previewSliceHints";
import {
  buildDensityBasicsCase,
  TERRAIN_NOISE_2D_SCALE,
  CAVE_NOISE_3D_SCALE,
} from "@/utils/densityBasics/showcase";
import { DENSITY_BASICS_CASE_IDS } from "@/utils/densityBasics/caseMeta";
import { getNodeType } from "@/utils/density/evalTypes";

describe("densityBasics showcase", () => {
  it.each(DENSITY_BASICS_CASE_IDS)("%s builds valid graph with preview target", (caseId) => {
    const graph = buildDensityBasicsCase(caseId);
    expect(graph.nodes.length).toBeGreaterThan(0);
    expect(graph.previewNodeId).toBeTruthy();
    expect(graph.nodes.some((n) => n.id === graph.previewNodeId)).toBe(true);
    const previewType = getNodeType(graph.nodes.find((n) => n.id === graph.previewNodeId)!);
    expect(previewType).toBeTruthy();
  });

  it("uses documented noise scales", () => {
    const n2d = buildDensityBasicsCase("density-noise-2d");
    const noise2d = n2d.nodes.find((n) => getNodeType(n) === "SimplexNoise2D");
    expect((noise2d?.data as Record<string, unknown>).fields).toMatchObject({
      Scale: TERRAIN_NOISE_2D_SCALE,
    });

    const n3d = buildDensityBasicsCase("density-noise-3d");
    const noise3d = n3d.nodes.find((n) => getNodeType(n) === "SimplexNoise3D");
    expect((noise3d?.data as Record<string, unknown>).fields).toMatchObject({
      Scale: CAVE_NOISE_3D_SCALE,
    });
  });

  it("min-carve wires terrain and inverted cave mask to Min", () => {
    const { nodes, edges } = buildDensityBasicsCase("density-min-carve");
    const min = nodes.find((n) => getNodeType(n) === "Min")!;
    const intoMin = edges.filter((e) => e.target === min.id);
    expect(intoMin).toHaveLength(2);
    expect(intoMin.map((e) => e.targetHandle).sort()).toEqual(["Inputs[0]", "Inputs[1]"]);

    const invEdge = edges.find((e) => e.targetHandle === "Input");
    expect(invEdge).toBeTruthy();
    const inv = nodes.find((n) => n.id === invEdge!.target);
    expect(getNodeType(inv!)).toBe("Inverter");
  });

  it("density-noise-2d produces varying 2D grid", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-noise-2d");
    const { minValue, maxValue } = evaluateDensityGrid(
      nodes,
      edges,
      64,
      -64,
      64,
      64,
      previewNodeId,
      { contentFields: {} },
    );
    expect(isUniformDensitySlice(minValue, maxValue)).toBe(false);
  });

  it("density-sum-2d varies horizontally from 2D noise on the slice", () => {
    const { nodes, edges, previewNodeId, yLevel, contentFields } =
      buildDensityBasicsCase("density-sum-2d");
    const { minValue, maxValue } = evaluateDensityGrid(
      nodes,
      edges,
      64,
      -64,
      64,
      yLevel,
      previewNodeId,
      { contentFields },
    );
    expect(isUniformDensitySlice(minValue, maxValue)).toBe(false);
  });

  it("density-sum-3d varies on 2D slice at one Y", () => {
    const { nodes, edges, previewNodeId, yLevel, contentFields } =
      buildDensityBasicsCase("density-sum-3d");
    const { minValue, maxValue } = evaluateDensityGrid(
      nodes,
      edges,
      64,
      -64,
      64,
      yLevel,
      previewNodeId,
      { contentFields },
    );
    expect(isUniformDensitySlice(minValue, maxValue)).toBe(false);
  });
});
