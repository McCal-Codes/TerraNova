import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { normalizeImportWithMeta } from "../fileTypeDetection";
import { jsonToGraph } from "../jsonToGraph";

const FLOWERS_PATH = join(
  homedir(),
  "AppData/Roaming/Hytale/UserData/Saves/Worldgen V1/mods/McCal.Autmn Forest/Server/HytaleGenerator/Assignments/McCal/AutumnForest_Flowers_RY.json",
);

const FLOWERS_FIXTURE = {
  Type: "Weighted",
  ExportAs: "AutumnForest_Flowers_RY",
  SkipChance: 0.04,
  Seed: "AutumnForest_FlowersRY",
  WeightedAssignments: [
    {
      Weight: 35,
      Assignments: {
        Type: "Constant",
        Prop: {
          Type: "Column",
          ColumnBlocks: [{ Y: 0, Material: { Solid: "Plant_Flower_Common_Red2" } }],
        },
      },
    },
    {
      Weight: 65,
      Assignments: {
        Type: "Constant",
        Prop: {
          Type: "Column",
          ColumnBlocks: [{ Y: 0, Material: { Solid: "Plant_Flower_Common_Yellow2" } }],
        },
      },
    },
  ],
  $Purpose: "Red/yellow forest flowers.",
  $Comment: "Random prop pick by Weight + Seed.",
  $Title: "[ROOT] Weighted Assignments",
  $WorkspaceID: "HytaleGenerator - Assignments",
  $Comments: [
    {
      $Position: { $x: 400, $y: -1200 },
      $width: 2200,
      $height: 320,
      $name: "Comment",
      $text: "Red/yellow forest flowers.\n\nImported in biomes via Type: Imported, Name: AutumnForest_Flowers_RY.",
      $fontSize: 24,
    },
  ],
  $Groups: [
    {
      $Position: { $x: 400, $y: -700 },
      $width: 4800,
      $height: 1200,
      $name: "Assignment - AutumnForest_Flowers_RY",
    },
  ],
};

describe("Weighted assignment import with Hytale editor metadata", () => {
  it("strips root $ keys and maps $Comment to _comment", () => {
    const { content, metadata } = normalizeImportWithMeta(FLOWERS_FIXTURE);
    expect(content.Type).toBe("Weighted");
    expect(content.ExportAs).toBe("AutumnForest_Flowers_RY");
    expect(content._comment).toBe("Random prop pick by Weight + Seed.");
    expect(content.WeightedAssignments).toHaveLength(2);
    expect("$Purpose" in content).toBe(false);
    expect("$Title" in content).toBe(false);
    expect("$WorkspaceID" in content).toBe(false);
    expect("$Comments" in content).toBe(false);
    expect("$Groups" in content).toBe(false);
    expect(metadata?.hytaleComments).toHaveLength(1);
    expect(metadata?.hytaleComments?.[0]?.text).toContain("Red/yellow forest flowers");
    expect(metadata?.hytaleGroups?.[0]?.name).toBe("Assignment - AutumnForest_Flowers_RY");
  });

  it("produces a single Assignment:Weighted node without leaked metadata fields", () => {
    const { content } = normalizeImportWithMeta(FLOWERS_FIXTURE);
    const { nodes } = jsonToGraph(content, 0, 0, "asgn", "Assignments");
    expect(nodes).toHaveLength(1);
    const node = nodes[0];
    expect(node.type).toBe("Assignment:Weighted");
    const fields = (node.data as { fields?: Record<string, unknown> }).fields ?? {};
    expect((node.data as Record<string, unknown>).type).toBe("Weighted");
    expect(fields._comment).toBe("Random prop pick by Weight + Seed.");
    expect(Array.isArray(fields.WeightedAssignments)).toBe(true);
    expect(Object.keys(fields).some((k) => k.startsWith("$"))).toBe(false);
  });

  it("round-trips McCal AutumnForest_Flowers_RY when installed", () => {
    let raw: Record<string, unknown>;
    try {
      raw = JSON.parse(readFileSync(FLOWERS_PATH, "utf8")) as Record<string, unknown>;
    } catch {
      return;
    }
    const { content } = normalizeImportWithMeta(raw);
    expect(content._comment).toBe("Random prop pick by Weight + Seed.");
    expect("$Purpose" in content).toBe(false);
    const entries = content.WeightedAssignments as Array<{ Weight: number }>;
    expect(entries).toHaveLength(2);
    expect(entries[0].Weight + entries[1].Weight).toBe(100);
  });
});
