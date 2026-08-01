import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CategoryRail } from "../CategoryRail";

function renderRail(overrides: Partial<React.ComponentProps<typeof CategoryRail>> = {}) {
  const onSelect = vi.fn();
  render(
    <CategoryRail active="general" onSelect={onSelect} developerMode={false} {...overrides} />,
  );
  return { onSelect };
}

describe("CategoryRail", () => {
  it("exposes a vertical tablist", () => {
    renderRail();
    const rail = screen.getByRole("tablist", { name: /settings categories/i });
    expect(rail).toHaveAttribute("aria-orientation", "vertical");
  });

  it("uses a roving tabindex so the rail is one Tab stop, not ten", () => {
    renderRail();
    const tabs = screen.getAllByRole("tab");
    const reachable = tabs.filter((t) => t.getAttribute("tabindex") === "0");
    expect(reachable).toHaveLength(1);
    expect(reachable[0]).toHaveAccessibleName(/general/i);
    expect(tabs.filter((t) => t.getAttribute("tabindex") === "-1")).toHaveLength(tabs.length - 1);
  });

  it("marks exactly one tab selected", () => {
    renderRail({ active: "editor" });
    const selected = screen.getAllByRole("tab").filter((t) => t.getAttribute("aria-selected") === "true");
    expect(selected).toHaveLength(1);
    expect(selected[0]).toHaveAccessibleName(/editor/i);
  });

  it("hides the developer category until developer mode is on", () => {
    renderRail();
    expect(screen.queryByRole("tab", { name: /developer/i })).not.toBeInTheDocument();
    screen.getAllByRole("tab").forEach((t) => t.remove());
    renderRail({ developerMode: true });
    expect(screen.getByRole("tab", { name: /developer/i })).toBeInTheDocument();
  });

  describe("manual activation", () => {
    // Arrowing must not select — these panels mount hardware detection and
    // asset staleness checks, so passing over a category must not fire them.
    it("moves focus on ArrowDown without selecting", () => {
      const { onSelect } = renderRail();
      const first = screen.getByRole("tab", { name: /general/i });
      first.focus();
      fireEvent.keyDown(first, { key: "ArrowDown" });

      expect(onSelect).not.toHaveBeenCalled();
      expect(document.activeElement).toHaveAccessibleName(/editor/i);
    });

    it("selects on Enter", () => {
      const { onSelect } = renderRail();
      const first = screen.getByRole("tab", { name: /general/i });
      first.focus();
      fireEvent.keyDown(first, { key: "Enter" });
      expect(onSelect).toHaveBeenCalledWith("general");
    });

    it("selects on Space", () => {
      const { onSelect } = renderRail();
      const first = screen.getByRole("tab", { name: /general/i });
      first.focus();
      fireEvent.keyDown(first, { key: " " });
      expect(onSelect).toHaveBeenCalledWith("general");
    });

    it("wraps from the first to the last on ArrowUp", () => {
      renderRail();
      const first = screen.getByRole("tab", { name: /general/i });
      first.focus();
      fireEvent.keyDown(first, { key: "ArrowUp" });
      expect(document.activeElement).toHaveAccessibleName(/about/i);
    });

    it("jumps to the ends with Home and End", () => {
      renderRail();
      const first = screen.getByRole("tab", { name: /general/i });
      first.focus();
      fireEvent.keyDown(first, { key: "End" });
      expect(document.activeElement).toHaveAccessibleName(/about/i);
      fireEvent.keyDown(document.activeElement!, { key: "Home" });
      expect(document.activeElement).toHaveAccessibleName(/general/i);
    });
  });

  it("selects on click", () => {
    const { onSelect } = renderRail();
    fireEvent.click(screen.getByRole("tab", { name: /editor/i }));
    expect(onSelect).toHaveBeenCalledWith("editor");
  });

  it("shows a modified count that is announced, not colour-only", () => {
    renderRail({ modifiedCounts: { editor: 3 } });
    expect(screen.getByLabelText("3 modified")).toHaveTextContent("3");
  });
});
