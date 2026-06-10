import { describe, it, expect } from "vitest";
import { graphToJson } from "../graphToJson";
import { jsonToGraph } from "../jsonToGraph";

describe("Hytale assignment shapes round-trip", () => {
  it("Assignment:Imported preserves Name", () => {
    const json = { Type: "Imported", Name: "AutumnForest_Grasses" };
    const { nodes, edges } = jsonToGraph(json, 0, 0, "asgn", "Assignments");
    expect(nodes).toHaveLength(1);
    expect(nodes[0].type).toBe("Assignment:Imported");
    expect(graphToJson(nodes, edges)).toEqual(json);
  });

  it("Assignment:Weighted keeps WeightedAssignments inline (Hytale entry shape)", () => {
    const json = {
      Type: "Weighted",
      SkipChance: 0.5,
      Seed: "A",
      WeightedAssignments: [
        {
          Weight: 5,
          Assignments: {
            Type: "Constant",
            Prop: { Type: "Prefab", Path: "Trees/Oak/Stage_1" },
          },
        },
        {
          Weight: 1,
          Assignments: {
            Type: "Constant",
            Prop: { Type: "Prefab", Path: "Trees/Birch/Stage_1" },
          },
        },
      ],
    };
    const { nodes, edges } = jsonToGraph(json, 0, 0, "asgn", "Assignments");
    const weighted = nodes.find((n) => n.type === "Assignment:Weighted");
    expect(weighted).toBeDefined();
    expect(graphToJson(nodes, edges)).toEqual(json);
  });

  it("Assignment:FieldFunction wires density; Delimiters stay inline", () => {
    const json = {
      Type: "FieldFunction",
      FieldFunction: { Type: "SimplexNoise2D", Scale: 50, Seed: "A" },
      Delimiters: [
        {
          Min: -1,
          Max: 0.3,
          Assignments: {
            Type: "Constant",
            Prop: { Type: "Prefab", Path: "Rock_Formations/Rocks/Slate/Medium" },
          },
        },
      ],
    };
    const { nodes, edges } = jsonToGraph(json, 0, 0, "asgn", "Assignments");
    expect(nodes.find((n) => n.type === "Assignment:FieldFunction")).toBeDefined();
    expect(nodes.find((n) => n.type === "SimplexNoise2D")).toBeDefined();
    expect(edges.some((e) => e.targetHandle === "FieldFunction")).toBe(true);
    expect(graphToJson(nodes, edges)).toEqual(json);
  });
});
