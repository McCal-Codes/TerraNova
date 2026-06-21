import { describe, it, expect, beforeEach } from "vitest";
import { useToastStore, TOAST_DURATION } from "@/stores/toastStore";

describe("toastStore", () => {
  beforeEach(() => {
    useToastStore.setState({ toasts: [] });
  });

  it("adds toast with default error type", () => {
    useToastStore.getState().addToast("Something failed");
    expect(useToastStore.getState().toasts).toHaveLength(1);
    expect(useToastStore.getState().toasts[0]?.type).toBe("error");
  });

  it("supports optional title", () => {
    useToastStore.getState().addToast("Details", "info", undefined, "Sync complete");
    expect(useToastStore.getState().toasts[0]?.title).toBe("Sync complete");
  });

  it("clearToasts removes all", () => {
    useToastStore.getState().addToast("a");
    useToastStore.getState().addToast("b");
    useToastStore.getState().clearToasts();
    expect(useToastStore.getState().toasts).toHaveLength(0);
  });

  it("defines duration tiers", () => {
    expect(TOAST_DURATION.error).toBeGreaterThan(TOAST_DURATION.info);
  });
});

describe("Toast duration constants", () => {
  it("errors linger longer than success", () => {
    expect(TOAST_DURATION.error).toBeGreaterThan(TOAST_DURATION.success);
  });
});
