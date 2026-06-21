import { describe, it, expect } from "vitest";
import {
  buildDensityPreviewLens,
  lensSelectionFromPreviewTarget,
  previewNodeIdForLensSelection,
} from "@/utils/densityPreviewLens";
import { buildDensityBasicsCase } from "@/utils/densityBasics/showcase";
import { openCompareLensInputs } from "@/utils/comparePreviewActions";
import { usePreviewStore } from "@/stores/previewStore";

describe("densityPreviewLens", () => {
  it("lists result and both inputs for Sum", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-sum-2d");
    const lens = buildDensityPreviewLens(previewNodeId, nodes, edges);
    expect(lens).not.toBeNull();
    expect(lens!.inputs).toHaveLength(2);
    expect(lens!.result.typeName).toBe("Sum");
  });

  it("maps preview target to lens selection", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-sum-2d");
    const lens = buildDensityPreviewLens(previewNodeId, nodes, edges)!;
    const input0 = lens.inputs[0]!.nodeId;

    expect(lensSelectionFromPreviewTarget(lens, previewNodeId)).toBe("result");
    expect(lensSelectionFromPreviewTarget(lens, input0)).toBe(`input-${lens.inputs[0]!.index}`);
    expect(previewNodeIdForLensSelection(lens, "result")).toBe(previewNodeId);
    expect(previewNodeIdForLensSelection(lens, `input-${lens.inputs[0]!.index}`)).toBe(input0);
  });

  it("compare both inputs for Max", () => {
    const { nodes, edges, previewNodeId } = buildDensityBasicsCase("density-max-2d");
    usePreviewStore.setState({ viewMode: "split", compareNodeA: null, compareNodeB: null });
    const result = openCompareLensInputs(previewNodeId, nodes, edges, "inputs");
    expect(result.ok).toBe(true);
    const state = usePreviewStore.getState();
    expect(state.viewMode).toBe("compare");
    expect(state.compareNodeA).toBeTruthy();
    expect(state.compareNodeB).toBeTruthy();
    expect(state.compareNodeA).not.toBe(state.compareNodeB);
  });
});
