import { describe, it, expect } from "vitest";
import { computeIssueBadgeCount } from "@/utils/issueBadgeCount";
import type { ProjectLegacyHit } from "@/utils/projectLegacyScanner";

const hit = (file: string, nodeId: string): ProjectLegacyHit => ({
  file,
  nodeId,
  typeKey: "Product",
  bareType: "Product",
  tier: "legacy",
  replacement: "Multiplier",
});

describe("computeIssueBadgeCount", () => {
  it("adds diagnostics and legacy hits in other files", () => {
    const openFile = "C:/pack/Server/HytaleGenerator/Biomes/Open.json";
    const otherFile = "C:/pack/Server/HytaleGenerator/Biomes/Other.json";
    const projectHits = [
      hit(openFile, "n1"),
      hit(otherFile, "n2"),
      hit(otherFile, "n3"),
    ];

    expect(computeIssueBadgeCount(2, projectHits, openFile)).toBe(4);
  });

  it("counts all project hits when no file is open", () => {
    const projectHits = [hit("Server/HytaleGenerator/Biomes/A.json", "n1")];
    expect(computeIssueBadgeCount(0, projectHits, null)).toBe(1);
  });

  it("uses only diagnostics when project scan is clean", () => {
    expect(computeIssueBadgeCount(3, [], "Server/HytaleGenerator/Biomes/Open.json")).toBe(3);
  });
});
