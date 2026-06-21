import { describe, it, expect, vi, beforeEach } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";
import { ValidationPanel } from "../ValidationPanel";
import { useDiagnosticsStore } from "@/stores/diagnosticsStore";
import { useEditorStore } from "@/stores/editorStore";

const writeText = vi.fn().mockResolvedValue(undefined);
const addToast = vi.fn();

// Mock the stores
vi.mock("@/stores/diagnosticsStore");
vi.mock("@/stores/editorStore");
vi.mock("@/stores/projectStore", () => ({
  useProjectStore: (selector: (state: unknown) => unknown) =>
    selector({
      projectPath: "C:/mods/Test/Server",
      currentFile: "Server/HytaleGenerator/Biomes/Test.json",
      setDirty: vi.fn(),
    }),
}));
vi.mock("@/stores/toastStore", () => ({
  useToastStore: (selector: (state: unknown) => unknown) =>
    selector({ addToast }),
}));
const projectLegacyState = {
  hits: [] as Array<{ file: string; typeKey: string; nodeId?: string; replacement?: string }>,
  busy: false,
  scan: vi.fn(),
};

vi.mock("@/stores/projectLegacyStore", () => ({
  useProjectLegacyStore: (selector: (state: unknown) => unknown) =>
    selector(projectLegacyState),
}));
vi.mock("@/hooks/useTauriIO", () => ({
  useTauriIO: () => ({
    openFile: vi.fn(),
  }),
}));
vi.mock("@xyflow/react", () => ({
  useReactFlow: () => ({
    fitView: vi.fn(),
  }),
}));

describe("ValidationPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    projectLegacyState.hits = [];
    projectLegacyState.busy = false;
    writeText.mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    
    // Setup default mock returns
    vi.mocked(useDiagnosticsStore).mockImplementation((selector) => {
      const state = {
        diagnostics: [],
        assetValidationBadge: {
          label: "All assets validated",
          detail: "0 missing, 0 unknown",
        },
        assetPathIndexByKind: {},
      };
      return selector(state as unknown as Parameters<Parameters<typeof useDiagnosticsStore>[0]>[0]);
    });

    vi.mocked(useEditorStore).mockImplementation((selector) => {
      const state = {
        nodes: [],
        biomeConfig: null,
        biomeSections: null,
        setBiomeConfig: vi.fn(),
        setSelectedNodeId: vi.fn(),
        setEditingContext: vi.fn(),
        switchBiomeSection: vi.fn(),
        updateNodeField: vi.fn(),
        setNodes: vi.fn(),
        removeNode: vi.fn(),
        removeNodes: vi.fn(),
        commitState: vi.fn(),
      };
      return selector(state as unknown as Parameters<Parameters<typeof useEditorStore>[0]>[0]);
    });
  });

  it("renders no issues message when diagnostics are empty", () => {
    render(<ValidationPanel />);
    expect(screen.getByText("No issues found")).toBeInTheDocument();
  });

  it("renders asset validation badge", () => {
    render(<ValidationPanel />);
    expect(screen.getByText("All assets validated")).toBeInTheDocument();
  });

  it("shows file-clean summary when only project-wide legacy hits exist", () => {
    projectLegacyState.hits = [
      {
        file: "Server/HytaleGenerator/Biomes/Other.json",
        typeKey: "SimplexRidgeNoise2D",
        nodeId: "legacy-1",
        replacement: "SimplexNoise2D",
      },
    ];

    render(<ValidationPanel />);
    expect(screen.getByText("No issues in this file")).toBeInTheDocument();
    expect(screen.getByText(/Project-wide \(1\)/i)).toBeInTheDocument();
  });

  it("renders diagnostic items when present", () => {
    vi.mocked(useDiagnosticsStore).mockImplementation((selector) => {
      const state = {
        diagnostics: [
          {
            code: "test-error",
            severity: "error",
            message: "Test error message",
            nodeId: "node-1",
            field: "TestField",
          },
        ],
        assetValidationBadge: {
          label: "Some issues",
          detail: "1 error",
        },
        assetPathIndexByKind: {},
      };
      return selector(state as unknown as Parameters<Parameters<typeof useDiagnosticsStore>[0]>[0]);
    });

    render(<ValidationPanel />);
    expect(screen.getByText("Test error message")).toBeInTheDocument();
    expect(screen.getAllByText("1 error")).toHaveLength(2);
  });

  it("has aria-live region for dynamic content", () => {
    render(<ValidationPanel />);
    const statusRegion = screen.getByRole("status");
    expect(statusRegion).toHaveAttribute("aria-live", "polite");
  });

  it("diagnostic items have proper ARIA labels when clickable", () => {
    vi.mocked(useDiagnosticsStore).mockImplementation((selector) => {
      const state = {
        diagnostics: [
          {
            code: "test-error",
            severity: "error",
            message: "Test error message",
            nodeId: "node-1",
            field: "TestField",
          },
        ],
        assetValidationBadge: {
          label: "Some issues",
          detail: "1 error",
        },
        assetPathIndexByKind: {},
      };
      return selector(state as unknown as Parameters<Parameters<typeof useDiagnosticsStore>[0]>[0]);
    });

    render(<ValidationPanel />);
    const diagnosticItem = screen.getByRole("button", { name: /click to navigate to node/i });
    expect(diagnosticItem).toHaveAttribute("aria-label", expect.stringContaining("click to navigate to node"));
  });

  it("navigates to biome section when issue has biomeSection only", () => {
    const switchBiomeSection = vi.fn();
    const setEditingContext = vi.fn();
    const setSelectedNodeId = vi.fn();

    vi.mocked(useEditorStore).mockImplementation((selector) => {
      const state = {
        nodes: [],
        biomeConfig: { Name: "Test", TintProvider: { Type: "Default" } },
        biomeSections: {
          TintProvider: { outputNodeId: "tint-root", nodes: [], edges: [], history: [], historyIndex: 0 },
        },
        setBiomeConfig: vi.fn(),
        setSelectedNodeId,
        setEditingContext,
        switchBiomeSection,
        updateNodeField: vi.fn(),
        setNodes: vi.fn(),
        removeNode: vi.fn(),
        removeNodes: vi.fn(),
        commitState: vi.fn(),
      };
      return selector(state as unknown as Parameters<Parameters<typeof useEditorStore>[0]>[0]);
    });
    vi.mocked(useEditorStore).getState = () => ({
      biomeSections: {
        TintProvider: { outputNodeId: "tint-root", nodes: [], edges: [], history: [], historyIndex: 0 },
      },
    }) as unknown as ReturnType<typeof useEditorStore.getState>;

    vi.mocked(useDiagnosticsStore).mockImplementation((selector) => {
      const state = {
        diagnostics: [
          {
            code: "biome-tint-missing-ref-name",
            severity: "warning",
            message: "TintProvider Imported is missing a Name reference",
            biomeSection: "TintProvider",
          },
        ],
        assetValidationBadge: { label: "Some issues", detail: "1 warning" },
        assetPathIndexByKind: {},
      };
      return selector(state as unknown as Parameters<Parameters<typeof useDiagnosticsStore>[0]>[0]);
    });

    render(<ValidationPanel />);
    fireEvent.click(screen.getByRole("button", { name: /click to navigate to TintProvider/i }));
    expect(setEditingContext).toHaveBeenCalledWith("Biome");
    expect(switchBiomeSection).toHaveBeenCalledWith("TintProvider");
  });

  it("copies all issues to the clipboard", async () => {
    vi.mocked(useDiagnosticsStore).mockImplementation((selector) => {
      const state = {
        diagnostics: [
          {
            code: "test-error",
            severity: "error",
            message: "Test error message",
            nodeId: "node-1",
          },
        ],
        assetValidationBadge: {
          label: "Some issues",
          detail: "1 error",
        },
        assetPathIndexByKind: {},
      };
      return selector(state as unknown as Parameters<Parameters<typeof useDiagnosticsStore>[0]>[0]);
    });

    render(<ValidationPanel />);
    fireEvent.click(screen.getByRole("button", { name: /copy all 1 issues/i }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });
    expect(writeText.mock.calls[0][0]).toContain("Test error message");
    expect(addToast).toHaveBeenCalledWith("Copied 1 issue to clipboard", "success");
  });

  it("severity icons are hidden from screen readers", () => {
    vi.mocked(useDiagnosticsStore).mockImplementation((selector) => {
      const state = {
        diagnostics: [
          {
            code: "test-error",
            severity: "error",
            message: "Test error message",
            nodeId: "node-1",
            field: "TestField",
          },
        ],
        assetValidationBadge: {
          label: "Some issues",
          detail: "1 error",
        },
        assetPathIndexByKind: {},
      };
      return selector(state as unknown as Parameters<Parameters<typeof useDiagnosticsStore>[0]>[0]);
    });

    render(<ValidationPanel />);
    const icons = screen.getAllByText("✖");
    icons.forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
    });
  });
});
