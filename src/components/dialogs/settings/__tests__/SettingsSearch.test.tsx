import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { SettingsSearchInput, SettingsSearchResults } from "../SettingsSearch";
import { CategoryPanel } from "../CategoryPanel";
import { useSettingsStore } from "@/stores/settingsStore";
import "@/settings/index";

vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn(async () => "/picked/path") }));

describe("SettingsSearchInput", () => {
  it("is a labelled search box", () => {
    render(<SettingsSearchInput value="" onChange={() => {}} />);
    expect(screen.getByRole("searchbox", { name: /search settings/i })).toBeInTheDocument();
  });

  it("reports changes", () => {
    const onChange = vi.fn();
    render(<SettingsSearchInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "autosave" } });
    expect(onChange).toHaveBeenCalledWith("autosave");
  });

  it("offers a clear button only when there is a query", () => {
    const onChange = vi.fn();
    const { rerender } = render(<SettingsSearchInput value="" onChange={onChange} />);
    expect(screen.queryByRole("button", { name: /clear search/i })).not.toBeInTheDocument();

    rerender(<SettingsSearchInput value="asset" onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: /clear search/i }));
    expect(onChange).toHaveBeenCalledWith("");
  });
});

describe("SettingsSearchResults", () => {
  beforeEach(() => {
    useSettingsStore.getState().setInstantSaveEnabled(false);
  });

  it("finds a setting by a synonym and shows its breadcrumb", () => {
    render(<SettingsSearchResults query="autosave" developerMode={false} />);
    expect(screen.getByText("Instant save")).toBeInTheDocument();
    // "autosave" legitimately matches both the toggle and its delay, so every
    // result carries its own breadcrumb.
    const breadcrumbs = screen.getAllByText(/editor › saving/i);
    expect(breadcrumbs.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/2 settings match/i)).toBeInTheDocument();
  });

  it("announces the result count in a live region", () => {
    render(<SettingsSearchResults query="autosave" developerMode={false} />);
    const status = screen.getByText(/match/i);
    expect(status).toHaveAttribute("aria-live", "polite");
  });

  it("gives an explicit empty state rather than a blank panel", () => {
    render(<SettingsSearchResults query="zzzznotasetting" developerMode={false} />);
    expect(screen.getByText(/no settings match/i)).toBeInTheDocument();
    expect(screen.getByText(/@modified/)).toBeInTheDocument();
  });

  it("filters to changed settings with @modified", () => {
    useSettingsStore.getState().setInstantSaveEnabled(true);
    render(<SettingsSearchResults query="@modified" developerMode={false} />);
    expect(screen.getByText("Instant save")).toBeInTheDocument();
    useSettingsStore.getState().setInstantSaveEnabled(false);
  });

  it("navigates instead of editing for panel-owned results", () => {
    const onNavigate = vi.fn();
    render(
      <SettingsSearchResults query="worker threads" developerMode={false} onNavigate={onNavigate} />,
    );
    fireEvent.click(screen.getByRole("button", { name: /open worker threads/i }));
    expect(onNavigate).toHaveBeenCalledWith({ category: "performance", subTab: "cpu" });
  });
});

describe("CategoryPanel", () => {
  beforeEach(() => {
    const s = useSettingsStore.getState();
    s.setInstantSaveEnabled(false);
    s.setAutoLayoutOnOpen(false);
    s.setFlowDirection("LR");
  });

  it("renders a category's sections as labelled regions", () => {
    render(<CategoryPanel category="editor" developerMode={false} />);
    expect(screen.getByRole("region", { name: "Saving" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "Graph" })).toBeInTheDocument();
  });

  it("hides developer-only settings unless developer mode is on", () => {
    const { unmount } = render(<CategoryPanel category="developer" developerMode={false} />);
    expect(screen.queryByText("Verbose worker logging")).not.toBeInTheDocument();
    unmount();

    render(<CategoryPanel category="developer" developerMode />);
    expect(screen.getByText("Verbose worker logging")).toBeInTheDocument();
  });

  it("offers a section reset only once something is modified", () => {
    const { unmount } = render(<CategoryPanel category="editor" developerMode={false} />);
    expect(screen.queryByRole("button", { name: /reset section/i })).not.toBeInTheDocument();
    unmount();

    useSettingsStore.getState().setInstantSaveEnabled(true);
    render(<CategoryPanel category="editor" developerMode={false} />);
    expect(screen.getByText(/1 setting differs/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /reset section/i }));
    expect(useSettingsStore.getState().instantSaveEnabled).toBe(false);
  });
});
