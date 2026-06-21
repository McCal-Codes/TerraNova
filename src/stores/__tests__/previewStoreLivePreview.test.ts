import { beforeEach, describe, expect, it } from "vitest";
import { usePreviewStore } from "@/stores/previewStore";

describe("previewStore live property preview controls", () => {
  beforeEach(() => {
    usePreviewStore.setState({
      livePropertyPreview: true,
      manualPreviewRefreshToken: 0,
    });
  });

  it("defaults live property preview to enabled for selected-node edits", () => {
    expect(usePreviewStore.getState().livePropertyPreview).toBe(true);
  });

  it("increments manual preview refresh token on demand", () => {
    const before = usePreviewStore.getState().manualPreviewRefreshToken;
    usePreviewStore.getState().requestManualPreviewRefresh();
    const after = usePreviewStore.getState().manualPreviewRefreshToken;
    expect(after).toBe(before + 1);
  });
});

