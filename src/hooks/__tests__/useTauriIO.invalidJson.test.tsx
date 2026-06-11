import { act, render, screen, waitFor } from "@testing-library/react";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { useTauriIO } from "@/hooks/useTauriIO";
import { useEditorStore } from "@/stores/editorStore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { CenterPanel } from "@/components/editor/CenterPanel";
import { exportCurrentJson } from "@/utils/exportAssetPack";

const {
  exportAssetFileMock,
  listDirectoryMock,
  readAssetFileTextMock,
  saveDialogMock,
  writeAssetFileMock,
} = vi.hoisted(() => ({
  exportAssetFileMock: vi.fn(),
  listDirectoryMock: vi.fn(),
  readAssetFileTextMock: vi.fn(),
  saveDialogMock: vi.fn(),
  writeAssetFileMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn(),
  save: saveDialogMock,
}));

vi.mock("@/utils/autoLayout", () => ({
  autoLayout: async (nodes: unknown[]) => nodes,
}));

vi.mock("@/utils/ipc", () => ({
  backupPackDirectory: vi.fn(),
  copyFile: vi.fn(),
  createBlankProject: vi.fn(),
  createDirectory: vi.fn(),
  createFromTemplate: vi.fn(),
  createPackWizard: vi.fn(),
  exportAssetFile: exportAssetFileMock,
  getHytaleAssetCacheRoot: vi.fn(),
  listDirectory: listDirectoryMock,
  openAssetPack: vi.fn(),
  pathExists: vi.fn(),
  readAssetFile: vi.fn(),
  readAssetFileText: readAssetFileTextMock,
  registerProjectRoot: vi.fn(),
  saveAssetPack: vi.fn(),
  unregisterProjectRoot: vi.fn(),
  validateAssetPack: vi.fn(),
  writeAssetFile: writeAssetFileMock,
}));

beforeAll(() => {
  if (typeof Range === "undefined") return;
  const emptyRects = {
    length: 0,
    item: () => null,
    [Symbol.iterator]: function* iterator() {},
  };
  Object.defineProperty(Range.prototype, "getClientRects", {
    configurable: true,
    value: () => emptyRects,
  });
  Object.defineProperty(Range.prototype, "getBoundingClientRect", {
    configurable: true,
    value: () => new DOMRect(0, 0, 0, 0),
  });
});

function renderTauriIO() {
  const apiRef: { current: ReturnType<typeof useTauriIO> | null } = { current: null };

  function Harness() {
    apiRef.current = useTauriIO();
    return null;
  }

  render(<Harness />);
  const api = apiRef.current;
  if (!api) throw new Error("useTauriIO did not render");
  return api;
}

function seedInvalidJsonState() {
  useProjectStore.setState({
    projectPath: "C:/Pack",
    currentFile: "C:/Pack/Server/HytaleGenerator/Density/Broken.json",
    isDirty: false,
    lastError: null,
  });
  useEditorStore.setState({
    nodes: [],
    edges: [],
    originalWrapper: null,
    rawJsonContent: null,
    editingContext: "InvalidJson",
    invalidJsonFile: {
      path: "C:/Pack/Server/HytaleGenerator/Density/Broken.json",
      rawText: "{ invalid",
      error: "Invalid JSON: expected value",
    },
  });
}

describe("useTauriIO invalid JSON open mode", () => {
  beforeEach(() => {
    useEditorStore.getState().reset();
    useProjectStore.getState().reset();
    useToastStore.setState({ toasts: [] });
    exportAssetFileMock.mockReset();
    listDirectoryMock.mockReset().mockResolvedValue([]);
    readAssetFileTextMock.mockReset();
    saveDialogMock.mockReset();
    writeAssetFileMock.mockReset();
  });

  it("opens invalid JSON as read-only and clears stale editable graph state", async () => {
    useProjectStore.setState({
      projectPath: "C:/Pack",
      currentFile: "C:/Pack/Server/HytaleGenerator/Density/Old.json",
      isDirty: true,
      lastError: null,
    });
    useEditorStore.setState({
      nodes: [
        { id: "old", type: "Constant", position: { x: 0, y: 0 }, data: { type: "Constant", fields: {} } },
      ],
      edges: [],
      originalWrapper: { Type: "Constant", Value: 1 },
      editingContext: "Density",
      rawJsonContent: { Type: "Constant", Value: 1 },
    });
    readAssetFileTextMock.mockResolvedValue("{ invalid");

    const api = renderTauriIO();
    await act(async () => {
      await api.openFile("C:/Pack/Server/HytaleGenerator/Density/Broken.json");
    });

    expect(useProjectStore.getState().currentFile).toBe("C:/Pack/Server/HytaleGenerator/Density/Broken.json");
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useEditorStore.getState().editingContext).toBe("InvalidJson");
    expect(useEditorStore.getState().invalidJsonFile).toMatchObject({
      path: "C:/Pack/Server/HytaleGenerator/Density/Broken.json",
      rawText: "{ invalid",
    });
    expect(useEditorStore.getState().nodes).toEqual([]);
    expect(useEditorStore.getState().originalWrapper).toBeNull();

    await act(async () => {
      await api.saveFile();
    });

    expect(writeAssetFileMock).not.toHaveBeenCalled();
    expect(useProjectStore.getState().lastError).toContain("Cannot save: invalid JSON is open read-only");
  });

  it("clears invalid JSON state after the file reopens with valid JSON", async () => {
    seedInvalidJsonState();
    readAssetFileTextMock.mockResolvedValue('{"Type":"Constant","Value":1}');

    const api = renderTauriIO();
    await act(async () => {
      await api.openFile("C:/Pack/Server/HytaleGenerator/Density/Broken.json");
    });

    expect(useEditorStore.getState().editingContext).toBe("Density");
    expect(useEditorStore.getState().invalidJsonFile).toBeNull();
    expect(useEditorStore.getState().nodes.length).toBeGreaterThan(0);
  });

  it("blocks save as and current JSON export before any write dialog or write call", async () => {
    seedInvalidJsonState();

    const api = renderTauriIO();
    await act(async () => {
      await api.saveFileAs();
      await exportCurrentJson();
    });

    expect(saveDialogMock).not.toHaveBeenCalled();
    expect(exportAssetFileMock).not.toHaveBeenCalled();
    expect(writeAssetFileMock).not.toHaveBeenCalled();
  });

  it("renders the invalid JSON banner and raw text in a read-only editor", async () => {
    seedInvalidJsonState();

    const { container } = render(<CenterPanel />);

    expect(screen.getByText("Invalid JSON opened read-only")).toBeInTheDocument();
    expect(screen.getByText(/visual editing and saving are disabled/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(container.textContent).toContain("{ invalid");
    });
    expect(container.querySelector(".cm-content")?.getAttribute("contenteditable")).toBe("false");
  });
});
