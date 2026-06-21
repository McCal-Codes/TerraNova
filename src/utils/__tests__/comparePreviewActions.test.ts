import { describe, it, expect, beforeEach } from "vitest";
import { openCompareForDensityNode } from "@/utils/comparePreviewActions";
import { buildDensityBasicsCase } from "@/utils/densityBasics/showcase";
import { usePreviewStore } from "@/stores/previewStore";

describe("comparePreviewActions", () => {
  beforeEach(() => {
    usePreviewStore.setState({
      viewMode: "split",
      compareNodeA: null,
      compareNodeB: null,
      compareModeA: "2d",
      compareModeB: "2d",
    });
  });

  it("opens compare for Sum with Inputs[0] vs Sum output", () => {
    const { nodes, edges } = buildDensityBasicsCase("density-sum-2d");
    const sum = nodes.find((n) => (n.data as { type: string }).type === "Sum")!;
    const result = openCompareForDensityNode(sum.id, nodes, edges);
    expect(result.ok).toBe(true);

    const state = usePreviewStore.getState();
    expect(state.viewMode).toBe("compare");
    expect(state.compareModeA).toBe("2d");
    expect(state.compareModeB).toBe("2d");
    expect(state.compareNodeB).toBe(sum.id);

    const base = nodes.find((n) => (n.data as { type: string }).type === "BaseHeight")!;
    expect(state.compareNodeA).toBe(base.id);
  });

  it("opens compare for Pow with Input vs Pow", () => {
    const { nodes, edges } = buildDensityBasicsCase("density-pow-2d");
    const pow = nodes.find((n) => (n.data as { type: string }).type === "Pow")!;
    const noise = nodes.find((n) => (n.data as { type: string }).type === "SimplexNoise2D")!;
    const result = openCompareForDensityNode(pow.id, nodes, edges);
    expect(result.ok).toBe(true);
    expect(usePreviewStore.getState().compareNodeA).toBe(noise.id);
    expect(usePreviewStore.getState().compareNodeB).toBe(pow.id);
  });

  it("fails when combinator has no wired input", () => {
    const { nodes } = buildDensityBasicsCase("density-max-2d");
    const max = nodes.find((n) => (n.data as { type: string }).type === "Max")!;
    const result = openCompareForDensityNode(max.id, nodes, []);
    expect(result.ok).toBe(false);
  });
});
