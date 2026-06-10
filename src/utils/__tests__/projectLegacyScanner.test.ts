import { describe, it, expect } from "vitest";
import type { Node } from "@xyflow/react";
import {
  overlayEditorHitsForFile,
  scanEditorNodesForLegacyHits,
  scanJsonForLegacyNodes,
} from "@/utils/projectLegacyScanner";

describe("projectLegacyScanner", () => {
  it("finds legacy density alias Product under Input field", () => {
    const hits = scanJsonForLegacyNodes("Biomes/Test.json", {
      Type: "Sum",
      Inputs: [
        { Type: "Product", InputA: { Type: "Constant", Value: 1 }, InputB: { Type: "Constant", Value: 2 } },
      ],
    });

    expect(hits.some((hit) => hit.typeKey === "Product" && hit.replacement === "Multiplier")).toBe(true);
  });

  it("finds deprecated Cache2D nodes", () => {
    const hits = scanJsonForLegacyNodes("Density/Test.json", {
      Type: "Cache2D",
      Input: { Type: "SimplexNoise2D" },
    });

    expect(hits).toHaveLength(1);
    expect(hits[0].typeKey).toBe("Cache2D");
    expect(hits[0].replacement).toBe("Cache");
  });

  it("ignores active V2 types", () => {
    const hits = scanJsonForLegacyNodes("Biomes/Clean.json", {
      Type: "Sum",
      Inputs: [
        { Type: "SimplexNoise2D" },
        { Type: "Constant", Value: 0.5 },
      ],
    });

    expect(hits).toHaveLength(0);
  });

  it("scanEditorNodesForLegacyHits finds legacy nodes in editor state", () => {
    const nodes: Node[] = [
      {
        id: "n1",
        type: "Product",
        position: { x: 0, y: 0 },
        data: { type: "Product", fields: {} },
      },
      {
        id: "n2",
        type: "Sum",
        position: { x: 0, y: 0 },
        data: { type: "Sum", fields: {} },
      },
    ];

    const hits = scanEditorNodesForLegacyHits("Server/HytaleGenerator/Biomes/Test.json", nodes);
    expect(hits).toHaveLength(1);
    expect(hits[0].nodeId).toBe("n1");
    expect(hits[0].typeKey).toBe("Product");
    expect(hits[0].replacement).toBe("Multiplier");
  });

  it("overlayEditorHitsForFile replaces disk hits for the open file only", () => {
    const diskHits = [
      {
        file: "Server/HytaleGenerator/Biomes/A.json",
        nodeId: "old",
        typeKey: "Product",
        bareType: "Product",
        tier: "legacy" as const,
        replacement: "Multiplier",
      },
      {
        file: "Server/HytaleGenerator/Biomes/B.json",
        nodeId: "keep",
        typeKey: "Cache2D",
        bareType: "Cache2D",
        tier: "deprecated" as const,
        replacement: "Cache",
      },
    ];

    const merged = overlayEditorHitsForFile(diskHits, "Server/HytaleGenerator/Biomes/A.json", []);
    expect(merged).toHaveLength(1);
    expect(merged[0].file).toContain("B.json");
    expect(merged[0].nodeId).toBe("keep");
  });
});
