import { describe, expect, it } from "vitest";
import { placeSnippet } from "@/schema/snippets";
import { WORLDGEN_REFERENCE_BLOCKS } from "@/schema/worldgenReferenceBlocks";

describe("WORLDGEN_REFERENCE_BLOCKS", () => {
  it("exposes curated desert and skyreach reference blocks", () => {
    const ids = WORLDGEN_REFERENCE_BLOCKS.map((block) => block.id);
    expect(ids).toContain("desert-river-carve-module");
    expect(ids).toContain("skyreach-ravine-3d-carve");
  });

  it("expands block snippets into graph nodes with provenance metadata", () => {
    const snippet = WORLDGEN_REFERENCE_BLOCKS.find((block) => block.id === "skyreach-ravine-3d-carve");
    expect(snippet).toBeTruthy();
    const placed = placeSnippet(snippet!, { x: 100, y: 200 });

    expect(placed.nodes.length).toBeGreaterThan(0);
    expect(placed.edges.length).toBeGreaterThan(0);
    for (const node of placed.nodes) {
      const data = node.data as Record<string, unknown>;
      const snippetMeta = data._snippetMeta as Record<string, unknown> | undefined;
      expect(snippetMeta?.snippetId).toBe("skyreach-ravine-3d-carve");
      expect(snippetMeta?.snippetLibrary).toBe("worldgen-reference");
      expect(Array.isArray(snippetMeta?.sourceRefs)).toBe(true);
    }
  });
});

