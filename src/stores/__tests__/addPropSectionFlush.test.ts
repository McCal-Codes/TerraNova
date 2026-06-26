import { beforeEach, describe, expect, it } from "vitest";
import { useEditorStore } from "@/stores/editorStore";
import type { BiomeSectionData } from "@/stores/slices/types";

const makeNode = (id: string, x: number, y: number) => ({
  id,
  type: "Constant" as const,
  position: { x, y },
  data: { type: "Constant", fields: {} },
});

function makePropSection(nodes = [makeNode("n1", 0, 0)]): BiomeSectionData {
  return {
    nodes,
    edges: [],
    outputNodeId: null,
    history: [{ nodes, edges: [], outputNodeId: null, label: "Initial" }],
    historyIndex: 0,
  };
}

describe("addPropSectionWithGraph — flushes active section before switching", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
  });

  it("preserves position-only drag changes in the previous section", () => {
    // Set up a biome with Props[0] containing one node
    const initialNode = makeNode("n1", 0, 0);
    useEditorStore.setState({
      biomeSections: {
        "Props[0]": makePropSection([initialNode]),
      },
      biomeConfig: { Name: "test", EnvironmentProvider: {}, TintProvider: {}, propMeta: [{ Runtime: 0, Skip: false }] },
      activeBiomeSection: "Props[0]",
      // Simulate a position-only drag: node moved to (200, 300) via setNodes but
      // biomeSections["Props[0]"] still has the old position (0, 0).
      nodes: [makeNode("n1", 200, 300)],
      edges: [],
      outputNodeId: null,
    });

    // Add a new prop section — this should flush Props[0] with the dragged positions
    useEditorStore.getState().addPropSectionWithGraph([], [], { Runtime: 0, Skip: false });

    const state = useEditorStore.getState();

    // Active section should now be Props[1]
    expect(state.activeBiomeSection).toBe("Props[1]");

    // The flushed Props[0] must reflect the dragged position (200, 300), not (0, 0)
    const flushedNode = state.biomeSections?.["Props[0]"]?.nodes?.[0];
    expect(flushedNode).toBeDefined();
    expect(flushedNode?.position).toEqual({ x: 200, y: 300 });
  });

  it("does not corrupt the new section content", () => {
    useEditorStore.setState({
      biomeSections: {
        "Props[0]": makePropSection(),
      },
      biomeConfig: { Name: "test", EnvironmentProvider: {}, TintProvider: {}, propMeta: [{ Runtime: 0, Skip: false }] },
      activeBiomeSection: "Props[0]",
      nodes: [makeNode("n1", 50, 50)],
      edges: [],
      outputNodeId: null,
    });

    const newNode = makeNode("n2", 100, 100);
    useEditorStore.getState().addPropSectionWithGraph([newNode], [], { Runtime: 1, Skip: true });

    const state = useEditorStore.getState();
    expect(state.activeBiomeSection).toBe("Props[1]");
    // New section nodes should be exactly what was passed in
    expect(state.biomeSections?.["Props[1]"]?.nodes).toHaveLength(1);
    expect(state.biomeSections?.["Props[1]"]?.nodes?.[0]?.id).toBe("n2");
    // Canvas also shows the new section
    expect(state.nodes).toHaveLength(1);
    expect(state.nodes[0].id).toBe("n2");
  });
});
