import { useState } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import type { ReactFlowInstance } from "@xyflow/react";
import type { SvgExportSettings } from "@/utils/exportSvg";
import { useSettingsStore } from "@/stores/settingsStore";
import { ExportSvgDialog } from "../ExportSvgDialog";

const defaultSettings: SvgExportSettings = {
  scope: "full",
  background: "dark",
  showGrid: true,
  includeAnnotations: true,
  mode: "presentation",
  padding: 40,
  flowDirection: "canvas",
  resolution: 3840,
};

const { editorState, generateSvgMock, copySvgTextMock } = vi.hoisted(() => ({
  editorState: {
    nodes: [{ id: "n1", selected: false }],
    selectedNodeId: null as string | null,
  },
  generateSvgMock: vi.fn((_rf: ReactFlowInstance, opts: { scope: string }) =>
    `<svg scope="${opts.scope}"/>`,
  ),
  copySvgTextMock: vi.fn(),
}));

vi.mock("@/stores/settingsStore", () => ({
  useSettingsStore: vi.fn(),
}));

vi.mock("@/stores/editorStore", () => ({
  useEditorStore: (selector: (state: typeof editorState) => unknown) => selector(editorState),
}));

vi.mock("@/stores/projectStore", () => ({
  useProjectStore: (selector: (state: { currentFile: string | null }) => unknown) =>
    selector({ currentFile: "C:/Projects/Autumn Forest.terra" }),
}));

vi.mock("@/utils/exportSvg", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/exportSvg")>();
  return {
    ...actual,
    generateSvg: generateSvgMock,
    copySvgTextToClipboard: copySvgTextMock,
    copySvgImageToClipboard: vi.fn(),
    parseSvgExportStats: vi.fn(() => ({
      width: 1920,
      height: 1080,
      nodeCount: 2,
      edgeCount: 1,
      annotationCount: 0,
    })),
  };
});

const reactFlow = {} as ReactFlowInstance;

function renderDialog(
  props: {
    open?: boolean;
    onClose?: () => void;
    onExportSvg?: (options: unknown) => Promise<boolean>;
    onExportPng?: (options: unknown) => Promise<boolean>;
    initialSettings?: SvgExportSettings;
  } = {},
) {
  const onClose = props.onClose ?? vi.fn();
  const onExportSvg = props.onExportSvg ?? vi.fn(async () => true);
  const onExportPng = props.onExportPng ?? vi.fn(async () => true);

  function Harness() {
    const [settings, setSettings] = useState(props.initialSettings ?? defaultSettings);
    vi.mocked(useSettingsStore).mockImplementation((selector) =>
      selector({
        svgExportSettings: settings,
        setSvgExportSettings: (patch: Partial<SvgExportSettings>) =>
          setSettings((current) => ({ ...current, ...patch })),
      } as ReturnType<typeof useSettingsStore.getState>),
    );

    return (
      <ExportSvgDialog
        open={props.open ?? true}
        onClose={onClose}
        onExportSvg={onExportSvg}
        onExportPng={onExportPng}
        reactFlow={reactFlow}
      />
    );
  }

  return {
    ...render(<Harness />),
    onClose,
    onExportSvg,
    onExportPng,
  };
}

describe("ExportSvgDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    editorState.nodes = [{ id: "n1", selected: false }];
    editorState.selectedNodeId = null;
  });

  it("renders Export Graph title and dialog ARIA attributes", () => {
    renderDialog();
    expect(screen.getByText("Export Graph")).toBeInTheDocument();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-labelledby", "export-graph-dialog-title");
  });

  it("copy text uses live export settings", () => {
    renderDialog();
    fireEvent.click(screen.getByText("Viewport"));
    fireEvent.click(screen.getByText("Copy text"));
    expect(copySvgTextMock).toHaveBeenCalledWith('<svg scope="viewport"/>');
  });

  it("disables export when Selected scope has no selection", () => {
    renderDialog({ initialSettings: { ...defaultSettings, scope: "selection" } });
    expect(screen.getByRole("button", { name: "SVG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "PNG" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Copy text" })).toBeDisabled();
  });

  it("awaits export and closes on success", async () => {
    let resolveExport!: (ok: boolean) => void;
    const exportPromise = new Promise<boolean>((resolve) => {
      resolveExport = resolve;
    });
    const onExportSvg = vi.fn(() => exportPromise);
    const { onClose } = renderDialog({ onExportSvg });

    fireEvent.click(screen.getByRole("button", { name: "SVG" }));
    expect(onExportSvg).toHaveBeenCalledTimes(1);
    expect(screen.getAllByText("Exporting…").length).toBeGreaterThan(0);

    resolveExport(true);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it("stays open when export is cancelled or fails", async () => {
    const onExportSvg = vi.fn(async () => false);
    const { onClose } = renderDialog({ onExportSvg });

    fireEvent.click(screen.getByRole("button", { name: "SVG" }));
    await waitFor(() => expect(onExportSvg).toHaveBeenCalledTimes(1));
    expect(onClose).not.toHaveBeenCalled();
  });
});
