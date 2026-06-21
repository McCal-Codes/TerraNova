import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useEditorStore } from "@/stores/editorStore";
import { useUIStore } from "@/stores/uiStore";
import { BiomeRangeEditor } from "../BiomeRangeEditor";

vi.mock("@/utils/propSources/listProjectBiomes", () => ({
  listProjectBiomes: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/hooks/useTauriIO", () => ({
  useTauriIO: () => ({ openFile: vi.fn() }),
}));

beforeEach(() => {
  useEditorStore.getState().reset();
  useUIStore.getState().setBiomeMapperUIMode("simple");
});

function switchToAdvanced() {
  fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
}

describe("BiomeRangeEditor", () => {
  it("renders the header and add button", () => {
    render(<BiomeRangeEditor />);
    expect(screen.getByText("Biome Placement")).toBeTruthy();
    expect(screen.getByText("+ Add first biome")).toBeTruthy();
  });

  it("renders biome names in the list from store state", () => {
    useEditorStore.getState().setBiomeRanges([
      { Biome: "forest_hills", Min: -1.0, Max: 1.0 },
      { Biome: "desert", Min: -0.5, Max: 0.5 },
    ]);

    render(<BiomeRangeEditor />);
    expect(screen.getByDisplayValue("forest_hills")).toBeTruthy();
    expect(screen.getByDisplayValue("desert")).toBeTruthy();
  });

  it("displays biome count in the header", () => {
    useEditorStore.getState().setBiomeRanges([
      { Biome: "forest_hills", Min: -0.5, Max: 0.5 },
      { Biome: "desert", Min: 0.1, Max: 0.8 },
    ]);

    render(<BiomeRangeEditor />);
    expect(screen.getByText("(2)")).toBeTruthy();
  });

  it("filters biomes by search query in advanced mode", () => {
    useEditorStore.getState().setBiomeRanges([
      { Biome: "forest_hills", Min: -1.0, Max: 0.0 },
      { Biome: "desert", Min: 0.0, Max: 1.0 },
    ]);

    render(<BiomeRangeEditor />);
    switchToAdvanced();
    const searchInput = screen.getByPlaceholderText("Search…");
    fireEvent.change(searchInput, { target: { value: "forest" } });

    expect(screen.getByDisplayValue("forest_hills")).toBeTruthy();
    expect(screen.queryByDisplayValue("desert")).toBeNull();
  });

  it("adding a biome range increases list count", () => {
    useEditorStore.getState().setBiomeRanges([
      { Biome: "forest_hills", Min: -1.0, Max: 1.0 },
    ]);

    render(<BiomeRangeEditor />);
    expect(screen.getByDisplayValue("forest_hills")).toBeTruthy();

    fireEvent.click(screen.getByText("+ Add"));

    expect(screen.getByDisplayValue("new_biome")).toBeTruthy();
    expect(useEditorStore.getState().biomeRanges).toHaveLength(2);
  });

  it("removing a biome range decreases list count", () => {
    useEditorStore.getState().setBiomeRanges([
      { Biome: "forest_hills", Min: -1.0, Max: 1.0 },
      { Biome: "desert", Min: -0.5, Max: 0.5 },
    ]);

    render(<BiomeRangeEditor />);

    const deleteButtons = screen.getAllByTitle("Remove");
    expect(deleteButtons).toHaveLength(2);

    fireEvent.click(deleteButtons[0]);
    expect(useEditorStore.getState().biomeRanges).toHaveLength(1);
  });

  it("clamping: updateBiomeRange stores value (row inputs clamp on change)", () => {
    useEditorStore.getState().setBiomeRanges([
      { Biome: "test", Min: -0.5, Max: 0.5 },
    ]);

    useEditorStore.getState().updateBiomeRange(0, { Min: -2.0 });
    const ranges = useEditorStore.getState().biomeRanges;
    expect(ranges[0].Min).toBe(-2.0);
  });

  it("renders with empty ranges", () => {
    useEditorStore.getState().setBiomeRanges([]);
    render(<BiomeRangeEditor />);
    expect(screen.getByText("Biome Placement")).toBeTruthy();
  });

  it("shows column headers for sorting in advanced mode", () => {
    render(<BiomeRangeEditor />);
    switchToAdvanced();
    expect(screen.getByText("Name")).toBeTruthy();
    expect(screen.getByText("Range")).toBeTruthy();
    expect(screen.getByText("Min")).toBeTruthy();
    expect(screen.getByText("Max")).toBeTruthy();
  });

  it("selects a biome on row click", () => {
    useEditorStore.getState().setBiomeRanges([
      { Biome: "forest_hills", Min: -1.0, Max: 0.0 },
      { Biome: "desert", Min: 0.0, Max: 1.0 },
    ]);

    render(<BiomeRangeEditor />);
    fireEvent.click(screen.getByDisplayValue("forest_hills").closest("div")!);
    expect(useEditorStore.getState().selectedBiomeIndex).toBe(0);
  });
});
