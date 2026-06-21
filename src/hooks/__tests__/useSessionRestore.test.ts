import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useSessionRestore, useSessionRestoreFile } from "@/hooks/useSessionRestore";
import { useProjectStore } from "@/stores/projectStore";
import { useToastStore } from "@/stores/toastStore";
import { saveSession, clearSession } from "@/utils/sessionPersist";

vi.mock("@/utils/ipc", () => ({
  listDirectory: vi.fn(),
}));

vi.mock("@/utils/mapDirEntry", () => ({
  default: (entry: { name: string; path: string; is_dir: boolean }) => ({
    name: entry.name,
    path: entry.path,
    isDir: entry.is_dir,
  }),
}));

import { listDirectory } from "@/utils/ipc";

describe("useSessionRestore", () => {
  beforeEach(() => {
    clearSession();
    useProjectStore.setState({
      projectPath: null,
      directoryTree: [],
      sessionRestoreReady: false,
    });
    useToastStore.setState({ toasts: [] });
    vi.mocked(listDirectory).mockReset();
  });

  it("marks sessionRestoreReady when no saved project", async () => {
    renderHook(() => useSessionRestore());
    await waitFor(() => {
      expect(useProjectStore.getState().sessionRestoreReady).toBe(true);
    });
  });

  it("toasts and clears session when project restore fails", async () => {
    saveSession({ projectPath: "C:/missing-pack" });
    vi.mocked(listDirectory).mockRejectedValue(new Error("not found"));

    renderHook(() => useSessionRestore());

    await waitFor(() => {
      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
      expect(useProjectStore.getState().sessionRestoreReady).toBe(true);
      expect(useProjectStore.getState().projectPath).toBeNull();
    });
  });
});

describe("useSessionRestoreFile", () => {
  beforeEach(() => {
    clearSession();
    useProjectStore.setState({
      projectPath: "C:/pack",
      directoryTree: [],
      sessionRestoreReady: false,
    });
    useToastStore.setState({ toasts: [] });
  });

  it("opens saved file when sessionRestoreReady even with empty directory tree", async () => {
    saveSession({
      projectPath: "C:/pack",
      currentFile: "C:/pack/Biomes/Autumn.json",
    });
    const openFile = vi.fn().mockResolvedValue(undefined);

    useProjectStore.setState({ sessionRestoreReady: true });

    renderHook(() => useSessionRestoreFile(openFile));

    await waitFor(() => {
      expect(openFile).toHaveBeenCalledWith("C:/pack/Biomes/Autumn.json");
    });
  });

  it("toasts and clears currentFile when open fails", async () => {
    saveSession({
      projectPath: "C:/pack",
      currentFile: "C:/pack/missing.json",
    });
    const openFile = vi.fn().mockRejectedValue(new Error("missing"));

    useProjectStore.setState({ sessionRestoreReady: true });

    renderHook(() => useSessionRestoreFile(openFile));

    await waitFor(() => {
      expect(useToastStore.getState().toasts.length).toBeGreaterThan(0);
    });
  });
});
