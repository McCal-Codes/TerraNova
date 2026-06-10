import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { createRef } from "react";
import { PreviewSettingsDrawer } from "../PreviewSettingsDrawer";

describe("PreviewSettingsDrawer", () => {
  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <PreviewSettingsDrawer open onClose={onClose} title="Test settings">
        <p>Content</p>
      </PreviewSettingsDrawer>,
    );

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("returns focus to trigger when closed", () => {
    const onClose = vi.fn();
    const triggerRef = createRef<HTMLButtonElement>();
    render(
      <>
        <button type="button" ref={triggerRef}>
          Open
        </button>
        <PreviewSettingsDrawer open onClose={onClose} returnFocusRef={triggerRef}>
          <p>Content</p>
        </PreviewSettingsDrawer>
      </>,
    );

    triggerRef.current?.focus();
    onClose.mockImplementation(() => {
      // simulate parent closing after Escape
    });
    fireEvent.keyDown(window, { key: "Escape" });
    expect(document.activeElement).toBe(triggerRef.current);
  });
});
