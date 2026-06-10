import { describe, expect, it } from "vitest";
import { graphToJson } from "../graphToJson";
import { jsonToGraph } from "../jsonToGraph";

/**
 * Inline field shapes edited by the properties panel must round-trip through
 * graphToJson unchanged — this is what Hytale export uses.
 */
describe("property panel field shapes → Hytale export round-trip", () => {
  it("Switch + SwitchCases", () => {
    const original = {
      Type: "Switch",
      SwitchCases: [
        { State: "surface", InputIndex: 0 },
        { State: "caves", InputIndex: 1 },
        { State: "deep", InputIndex: 2 },
      ],
    };
    const { nodes, edges } = jsonToGraph(original);
    expect(graphToJson(nodes, edges)).toEqual(original);
  });

  it("inline Imported reference inside delimiter arrays", () => {
    const original = {
      Type: "FieldFunction",
      Delimiters: [
        {
          Min: -1,
          Max: 0.5,
          Assignments: { Type: "Imported", Name: "AutumnForest_Grasses" },
        },
      ],
    };
    const { nodes, edges } = jsonToGraph(original);
    expect(graphToJson(nodes, edges)).toEqual(original);
  });

  it("bare Points curve object (no Type) stays inline", () => {
    const original = {
      Type: "CustomFilter",
      Threshold: 0.5,
      Envelope: {
        Points: [
          { In: 0, Out: 1 },
          { In: 64, Out: 0.25 },
        ],
      },
    };
    const { nodes, edges } = jsonToGraph(original);
    expect(graphToJson(nodes, edges)).toEqual(original);
  });

  it("FunctionForY height envelope stays inline", () => {
    const original = {
      Type: "Prop:Offset",
      Offset: { x: 0, y: 4, z: 0 },
      FunctionForY: {
        Points: [
          { Y: 8, Out: 1 },
          { Y: 20, Out: 0.36 },
        ],
      },
    };
    const { nodes, edges } = jsonToGraph(original);
    expect(graphToJson(nodes, edges)).toEqual(original);
  });

  it("nested Constant color tint", () => {
    const original = {
      Type: "CustomFilter",
      Threshold: 0.5,
      Tint: { Type: "Constant", Color: "#7ea629" },
    };
    const { nodes, edges } = jsonToGraph(original);
    expect(graphToJson(nodes, edges)).toEqual(original);
  });

  it("nested Constant numeric value", () => {
    const original = {
      Type: "CustomFilter",
      Threshold: 0.5,
      Weight: { Type: "Constant", Value: 0.75 },
    };
    const { nodes, edges } = jsonToGraph(original);
    expect(graphToJson(nodes, edges)).toEqual(original);
  });

  it("2D vector without z", () => {
    const original = {
      Type: "CustomFilter",
      Threshold: 0.5,
      Offset: { x: 1.5, y: -2 },
    };
    const { nodes, edges } = jsonToGraph(original);
    expect(graphToJson(nodes, edges)).toEqual(original);
  });

  it("simulated property edits preserve export shape", () => {
    const before = {
      Type: "Switch",
      SwitchCases: [{ State: "surface", InputIndex: 0 }],
    };
    const { nodes, edges } = jsonToGraph(before);
    const node = nodes[0];
    const fields = (node.data as { fields: Record<string, unknown> }).fields;

    fields.SwitchCases = [
      { State: "surface", InputIndex: 0 },
      { State: "caves", InputIndex: 1 },
    ];

    expect(graphToJson(nodes, edges)).toEqual({
      Type: "Switch",
      SwitchCases: [
        { State: "surface", InputIndex: 0 },
        { State: "caves", InputIndex: 1 },
      ],
    });
  });

  it("simulated Imported name edit preserves Type", () => {
    const before = {
      Type: "FieldFunction",
      Delimiters: [
        {
          Min: -1,
          Max: 0.5,
          Assignments: { Type: "Imported", Name: "Old_Name" },
        },
      ],
    };
    const { nodes, edges } = jsonToGraph(before);
    const node = nodes.find((n) => n.type === "Assignment:FieldFunction")!;
    const fields = (node.data as { fields: Record<string, unknown> }).fields;
    const delimiters = fields.Delimiters as Array<Record<string, unknown>>;
    const assignment = delimiters[0].Assignments as Record<string, unknown>;

    delimiters[0] = {
      ...delimiters[0],
      Assignments: { ...assignment, Type: "Imported", Name: "New_Name" },
    };
    fields.Delimiters = delimiters;

    expect(graphToJson(nodes, edges)).toEqual({
      Type: "FieldFunction",
      Delimiters: [
        {
          Min: -1,
          Max: 0.5,
          Assignments: { Type: "Imported", Name: "New_Name" },
        },
      ],
    });
  });
});
