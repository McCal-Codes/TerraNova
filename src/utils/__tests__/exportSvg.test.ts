import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactFlowInstance, Node, Edge } from "@xyflow/react";
import type { SvgExportOptions } from "../exportSvg";

const {
  saveMock,
  exportTextFileMock,
  showInFolderMock,
  addToastMock,
  setExportPathMock,
  setSvgExportSettingsMock,
  editorState,
} = vi.hoisted(() => ({
  saveMock: vi.fn(),
  exportTextFileMock: vi.fn(),
  showInFolderMock: vi.fn(),
  addToastMock: vi.fn(),
  setExportPathMock: vi.fn(),
  setSvgExportSettingsMock: vi.fn(),
  editorState: {
    nodes: [] as Node[],
    edges: [] as Edge[],
    selectedNodeId: null as string | null,
  },
}));

const writeFileMock = vi.hoisted(() => vi.fn());

vi.mock("@tauri-apps/plugin-dialog", () => ({ save: saveMock }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeFile: writeFileMock }));
vi.mock("@/utils/ipc", () => ({
  exportTextFile: exportTextFileMock,
  showInFolder: showInFolderMock,
}));
vi.mock("@/utils/platform", () => ({ isTauriRuntime: () => true }));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: { getState: () => ({ addToast: addToastMock }) },
}));
vi.mock("@/stores/editorStore", () => ({
  useEditorStore: { getState: () => editorState },
}));
vi.mock("@/stores/projectStore", () => ({
  useProjectStore: {
    getState: () => ({ currentFile: "C:/Projects/Autumn Forest.terra" }),
  },
}));
vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: {
    getState: () => ({
      exportPath: "C:/exports",
      setExportPath: setExportPathMock,
      setSvgExportSettings: setSvgExportSettingsMock,
      flowDirection: "RL",
    }),
  },
}));

const rasterizeSvgToPngBlobMock = vi.hoisted(() => vi.fn());

vi.mock("../exportSvgRasterize", () => ({
  rasterizeSvgToPngBlob: rasterizeSvgToPngBlobMock,
}));

import {
  computeSvgOutputDimensions,
  copySvgImageToClipboard,
  copySvgTextToClipboard,
  exportGraphAsPng,
  exportGraphAsSvg,
  generateSvg,
  getSelectedExportNodeIds,
  parseSvgExportStats,
  resolveSvgExportBaseName,
  resolveSvgExportFileName,
  writePngToFile,
  writeSvgToFile,
} from "../exportSvg";

function opts(overrides: Partial<SvgExportOptions> = {}): SvgExportOptions {
  return {
    scope: "full",
    background: "dark",
    showGrid: false,
    includeAnnotations: false,
    mode: "presentation",
    padding: 0,
    flowDirection: "canvas",
    resolution: 3840,
    ...overrides,
  };
}

function makeReactFlow(overrides: Partial<ReactFlowInstance> = {}): ReactFlowInstance {
  return {
    getViewport: () => ({ x: 0, y: 0, zoom: 1 }),
    getInternalNode: () => undefined,
    ...overrides,
  } as ReactFlowInstance;
}

describe("exportSvg", () => {
  beforeEach(() => {
    saveMock.mockReset();
    exportTextFileMock.mockReset();
    showInFolderMock.mockReset();
    addToastMock.mockReset();
    setExportPathMock.mockReset();
    setSvgExportSettingsMock.mockReset();
    rasterizeSvgToPngBlobMock.mockReset();
    writeFileMock.mockReset();
    editorState.nodes = [];
    editorState.edges = [];
    editorState.selectedNodeId = null;
  });

  it("renders group nodes with name, child count, and grouped body text", () => {
    editorState.nodes = [
      {
        id: "group-1",
        type: "group",
        position: { x: 40, y: 40 },
        data: {
          type: "group",
          name: "Noise Chain",
          internalNodes: [{ id: "a" }, { id: "b" }],
          externalConnectionMap: [],
        },
      },
    ];

    const svg = generateSvg(makeReactFlow(), opts());
    expect(svg).toContain("Noise Chain");
    expect(svg).toContain("2 nodes grouped");
    expect(svg).toContain("Double-click to expand");
  });

  it("renders ROOT graph output body separately from the header", () => {
    editorState.nodes = [
      {
        id: "root",
        type: "Root",
        position: { x: 0, y: 0 },
        data: { type: "Root", fields: {} },
      },
    ];

    const svg = generateSvg(makeReactFlow(), opts());
    expect(svg).toContain("Graph Output");
  });

  it("generates SVG for realistic density graph nodes", () => {
    editorState.nodes = [
      {
        id: "root",
        type: "Root",
        position: { x: 0, y: 0 },
        data: { type: "Root", fields: {} },
      },
      {
        id: "noise",
        type: "SimplexNoise2D",
        position: { x: 260, y: 40 },
        data: { type: "SimplexNoise2D", fields: { Scale: 256, Seed: "main" } },
      },
      {
        id: "note",
        type: "comment",
        position: { x: 10, y: 10 },
        data: { type: "comment", text: "ignored" },
      },
    ];
    editorState.edges = [
      { id: "e1", source: "noise", target: "root", sourceHandle: "output", targetHandle: "input" },
    ];

    const svg = generateSvg(makeReactFlow(), opts({ showGrid: true, mode: "debug", padding: 20 }));
    expect(svg).toContain("SimplexNoise2D");
    expect(svg).toContain("Output");
    expect(svg).toContain("Scale");
    expect(svg).toContain("256");
    expect(svg).not.toContain("ignored");
    expect(svg).toContain('width="3840"');
    expect(svg).toContain('fill="#1c1a17"');
  });

  it("supports light and transparent backgrounds", () => {
    editorState.nodes = [
      {
        id: "root",
        type: "Root",
        position: { x: 0, y: 0 },
        data: { type: "Root", fields: {} },
      },
    ];

    const light = generateSvg(makeReactFlow(), opts({ background: "light" }));
    expect(light).toContain('fill="#f5f4f0"');
    expect(light).toContain('fill="#ffffff"');
    expect(light).not.toContain('fill="#1c1a17"');
    expect(light).not.toContain('fill="#262320"');

    const transparent = generateSvg(makeReactFlow(), opts({ background: "transparent" }));
    expect(transparent).not.toContain('fill="#1c1a17"');
    expect(transparent).not.toContain('fill="#f5f4f0"');
    expect(transparent).toContain('fill="#ffffff"');
  });

  it("embeds svg metadata and supports standard resolution", () => {
    editorState.nodes = [
      {
        id: "root",
        type: "Root",
        position: { x: 0, y: 0 },
        data: { type: "Root", fields: {} },
      },
    ];

    const svg = generateSvg(makeReactFlow(), opts({ resolution: 1920 }));
    expect(svg).toContain("<title>Autumn Forest</title>");
    expect(svg).toContain("<desc>");
    expect(svg).toContain('width="1920"');
  });

  it("exports comments and frames when annotations are enabled", () => {
    editorState.nodes = [
      {
        id: "frame-1",
        type: "frame",
        position: { x: 0, y: 0 },
        data: { type: "frame", name: "Noise section", width: 320, height: 180 },
      },
      {
        id: "comment-1",
        type: "comment",
        position: { x: 20, y: 220 },
        data: { type: "comment", text: "Tune this chain first", width: 200, height: 90 },
      },
    ];

    const svg = generateSvg(makeReactFlow(), opts({ includeAnnotations: true }));
    expect(svg).toContain('class="annotations"');
    expect(svg).toContain("Noise section");
    expect(svg).toContain("Tune this chain first");
    expect(parseSvgExportStats(svg)?.annotationCount).toBe(2);
  });

  it("exports selected nodes with internal and external edges", () => {
    editorState.nodes = [
      {
        id: "a",
        type: "SimplexNoise2D",
        selected: true,
        position: { x: 0, y: 0 },
        data: { type: "SimplexNoise2D", fields: {} },
      },
      {
        id: "b",
        type: "Sum",
        selected: true,
        position: { x: 300, y: 0 },
        data: { type: "Sum", fields: {} },
      },
      {
        id: "c",
        type: "Clamp",
        position: { x: 600, y: 0 },
        data: { type: "Clamp", fields: {} },
      },
    ];
    editorState.edges = [
      { id: "e1", source: "a", target: "b", sourceHandle: "output", targetHandle: "Inputs[0]" },
      { id: "e2", source: "b", target: "c", sourceHandle: "output", targetHandle: "Input" },
    ];

    const svg = generateSvg(makeReactFlow(), opts({ scope: "selection" }));
    expect(svg).not.toContain("Clamp");
    expect(svg).toContain("Sum");
    expect(svg).toContain("SimplexNoise2D");
    const stats = parseSvgExportStats(svg);
    expect(stats?.edgeCount).toBe(2);
    expect(stats?.nodeCount).toBe(2);
    const paths = svg.match(/<path[^>]*>/g) ?? [];
    expect(paths.filter((p) => p.includes('stroke-dasharray="8 6"'))).toHaveLength(1);
    expect(paths.filter((p) => !p.includes("stroke-dasharray"))).toHaveLength(1);
  });

  it("includes annotations overlapping a selection bbox", () => {
    editorState.nodes = [
      {
        id: "frame-1",
        type: "frame",
        position: { x: -10, y: -10 },
        data: { type: "frame", name: "Noise section", width: 360, height: 180 },
      },
      {
        id: "a",
        type: "Sum",
        selected: true,
        position: { x: 40, y: 40 },
        data: { type: "Sum", fields: {} },
      },
    ];

    const svg = generateSvg(
      makeReactFlow(),
      opts({ scope: "selection", includeAnnotations: true }),
    );
    expect(svg).toContain("Noise section");
    expect(svg).toContain("Sum");
  });

  it("places handles according to export flow direction", () => {
    editorState.nodes = [
      {
        id: "noise",
        type: "SimplexNoise2D",
        position: { x: 0, y: 0 },
        data: { type: "SimplexNoise2D", fields: {} },
      },
    ];

    const lr = generateSvg(makeReactFlow(), opts({ flowDirection: "LR" }));
    const rl = generateSvg(makeReactFlow(), opts({ flowDirection: "RL" }));
    expect(lr).toContain('cx="220"');
    expect(rl).toContain('cx="0"');
  });

  it("resolves project-based export filenames", () => {
    expect(resolveSvgExportBaseName("C:/Projects/Autumn Forest.terra")).toBe("Autumn Forest");
    expect(resolveSvgExportFileName("Autumn Forest", "selection", "svg")).toBe(
      "Autumn Forest-selection.svg",
    );
    expect(resolveSvgExportFileName("Autumn Forest", "viewport", "png")).toBe(
      "Autumn Forest-viewport.png",
    );
  });

  it("computes fixed output dimensions for sharper SVG rendering", () => {
    expect(computeSvgOutputDimensions(800, 400)).toEqual({ width: 3840, height: 1920 });
    expect(computeSvgOutputDimensions(400, 800)).toEqual({ width: 1920, height: 3840 });
  });

  it("collects selected export node ids including the active node", () => {
    editorState.nodes = [
      { id: "a", type: "Sum", selected: false, position: { x: 0, y: 0 }, data: {} },
      { id: "b", type: "Clamp", selected: true, position: { x: 0, y: 0 }, data: {} },
    ];
    expect(getSelectedExportNodeIds(editorState.nodes, "a")).toEqual(new Set(["b"]));
    expect(getSelectedExportNodeIds([{ id: "a", type: "Sum" }], "a")).toEqual(new Set(["a"]));
  });

  it("generates SVG with an empty graph", () => {
    const svg = generateSvg(makeReactFlow(), opts());
    expect(svg).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(svg).toContain("<svg");
    expect(svg).toContain('class="nodes"');
  });

  it("writes SVG through export_text_file with a project-based default path", async () => {
    saveMock.mockResolvedValue("C:/Users/wolft/Desktop/Autumn Forest-graph.svg");
    exportTextFileMock.mockResolvedValue(undefined);
    showInFolderMock.mockResolvedValue(undefined);

    await writeSvgToFile("<svg></svg>");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "C:/exports/Autumn Forest-graph.svg" }),
    );
    expect(addToastMock).toHaveBeenCalledWith(
      "Exported SVG to C:/Users/wolft/Desktop/Autumn Forest-graph.svg",
      "success",
      expect.objectContaining({ label: "Show in folder" }),
    );
  });

  it("persists export settings and blocks empty selection exports", async () => {
    await exportGraphAsSvg(
      makeReactFlow(),
      opts({ scope: "selection", showGrid: true, padding: 24 }),
    );

    expect(setSvgExportSettingsMock).not.toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith(
      "Select one or more nodes to export a selection.",
      "warning",
    );
  });

  it("copies svg text and image to the clipboard", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const write = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("ClipboardItem", class ClipboardItem {
      constructor(public items: Record<string, Blob>) {}
    });
    vi.stubGlobal("navigator", {
      ...navigator,
      clipboard: { writeText, write },
    });

    await copySvgTextToClipboard("<svg></svg>");
    expect(writeText).toHaveBeenCalledWith("<svg></svg>");
    expect(addToastMock).toHaveBeenCalledWith("Copied SVG text to clipboard", "success");

    rasterizeSvgToPngBlobMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    const svg = generateSvg(makeReactFlow(), opts());
    await copySvgImageToClipboard(svg);

    expect(rasterizeSvgToPngBlobMock).toHaveBeenCalled();
    expect(write).toHaveBeenCalled();
    expect(addToastMock).toHaveBeenCalledWith("Copied PNG image to clipboard", "success");

    vi.unstubAllGlobals();
  });

  it("writes PNG exports with scope-based filenames", async () => {
    saveMock.mockResolvedValue("C:/Users/wolft/Desktop/Autumn Forest-selection.png");
    writeFileMock.mockResolvedValue(undefined);
    rasterizeSvgToPngBlobMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    await writePngToFile(new Blob(["png"], { type: "image/png" }), "selection");

    expect(saveMock).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPath: "C:/exports/Autumn Forest-selection.png" }),
    );
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(addToastMock).toHaveBeenCalledWith(
      "Exported PNG to C:/Users/wolft/Desktop/Autumn Forest-selection.png",
      "success",
      expect.objectContaining({ label: "Show in folder" }),
    );
  });

  it("exports graph png through rasterization", async () => {
    editorState.nodes = [
      {
        id: "a",
        type: "Sum",
        selected: true,
        position: { x: 0, y: 0 },
        data: { type: "Sum", fields: {} },
      },
    ];
    saveMock.mockResolvedValue("C:/exports/Autumn Forest-selection.png");
    writeFileMock.mockResolvedValue(undefined);
    rasterizeSvgToPngBlobMock.mockResolvedValue(new Blob(["png"], { type: "image/png" }));

    await exportGraphAsPng(
      makeReactFlow(),
      opts({ scope: "selection", resolution: 1920 }),
    );

    expect(rasterizeSvgToPngBlobMock).toHaveBeenCalled();
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(setSvgExportSettingsMock).toHaveBeenCalled();
  });

  it("formats export stats with singular labels", async () => {
    const { formatSvgExportStatsLine } = await import("../exportSvg");
    expect(
      formatSvgExportStatsLine({
        width: 1920,
        height: 1080,
        nodeCount: 1,
        edgeCount: 1,
        annotationCount: 1,
      }),
    ).toBe("1920 × 1080 px · 1 node · 1 edge · 1 note");
    expect(
      formatSvgExportStatsLine({
        width: 3840,
        height: 2160,
        nodeCount: 12,
        edgeCount: 20,
        annotationCount: 0,
      }),
    ).toBe("3840 × 2160 px · 12 nodes · 20 edges");
  });

  it("flags large exports by node count or dimensions", async () => {
    const { isLargeSvgExport } = await import("../exportSvg");
    expect(
      isLargeSvgExport({
        width: 1920,
        height: 1080,
        nodeCount: 149,
        edgeCount: 0,
        annotationCount: 0,
      }),
    ).toBe(false);
    expect(
      isLargeSvgExport({
        width: 3840,
        height: 2160,
        nodeCount: 150,
        edgeCount: 0,
        annotationCount: 0,
      }),
    ).toBe(true);
    expect(
      isLargeSvgExport({
        width: 3200,
        height: 1800,
        nodeCount: 10,
        edgeCount: 0,
        annotationCount: 0,
      }),
    ).toBe(true);
  });

  it("shows a scoped error when export write fails", async () => {
    saveMock.mockResolvedValue("C:/Users/wolft/Desktop/Autumn Forest-graph.svg");
    exportTextFileMock.mockRejectedValue(new Error("permission denied"));

    await writeSvgToFile("<svg></svg>");

    expect(addToastMock).toHaveBeenCalledWith("Export SVG failed: permission denied", "error");
    expect(setExportPathMock).not.toHaveBeenCalled();
  });
});
