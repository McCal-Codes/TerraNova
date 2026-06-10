import { beforeEach, describe, expect, it, vi } from "vitest";

const { saveMock, writeFileMock, addToastMock } = vi.hoisted(() => ({
  saveMock: vi.fn(),
  writeFileMock: vi.fn(),
  addToastMock: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  save: saveMock,
}));

vi.mock("@tauri-apps/plugin-fs", () => ({
  writeFile: writeFileMock,
}));

vi.mock("@/stores/toastStore", () => ({
  useToastStore: {
    getState: () => ({
      addToast: addToastMock,
    }),
  },
}));

import { compositeHeatmapCanvases, exportCanvasAsPNG, exportPreviewCanvas } from "../exportPreview";

function makeBlob(contents: string): Blob {
  return {
    arrayBuffer: async () => new TextEncoder().encode(contents).buffer,
  } as Blob;
}

function makeCanvas(blob: Blob | null): HTMLCanvasElement {
  return {
    toBlob: (callback: BlobCallback) => callback(blob),
  } as HTMLCanvasElement;
}

describe("exportPreview", () => {
  beforeEach(() => {
    saveMock.mockReset();
    writeFileMock.mockReset();
    addToastMock.mockReset();
  });

  it("returns null when the export dialog is cancelled", async () => {
    saveMock.mockResolvedValue(null);

    const result = await exportCanvasAsPNG(makeCanvas(makeBlob("png")));

    expect(result).toBeNull();
    expect(writeFileMock).not.toHaveBeenCalled();
  });

  it("writes the generated PNG to disk and returns the selected path", async () => {
    saveMock.mockResolvedValue("C:/exports/preview.png");

    const result = await exportCanvasAsPNG(makeCanvas(makeBlob("png")));

    expect(result).toBe("C:/exports/preview.png");
    expect(writeFileMock).toHaveBeenCalledTimes(1);
    expect(writeFileMock).toHaveBeenCalledWith(
      "C:/exports/preview.png",
      expect.any(Uint8Array),
    );
  });

  it("shows a warning toast when no preview canvas is available", async () => {
    const result = await exportPreviewCanvas(null);

    expect(result).toBe(false);
    expect(addToastMock).toHaveBeenCalledWith(
      "No preview canvas is ready to export yet.",
      "warning",
    );
  });

  it("shows a success toast after a completed export", async () => {
    saveMock.mockResolvedValue("C:/exports/preview.png");

    const result = await exportPreviewCanvas(makeCanvas(makeBlob("png")));

    expect(result).toBe(true);
    expect(addToastMock).toHaveBeenCalledWith(
      "Exported PNG to C:/exports/preview.png",
      "success",
    );
  });

  it("applies pan/zoom transform when compositing heatmap canvases", () => {
    const calls: { method: string; args: number[] }[] = [];
    const base = {
      width: 4,
      height: 4,
    } as HTMLCanvasElement;
    const overlay = {
      width: 8,
      height: 8,
    } as HTMLCanvasElement;
    const ctx = {
      save: () => calls.push({ method: "save", args: [] }),
      restore: () => calls.push({ method: "restore", args: [] }),
      translate: (...args: number[]) => calls.push({ method: "translate", args }),
      scale: (...args: number[]) => calls.push({ method: "scale", args }),
      drawImage: (...args: number[]) => calls.push({ method: "drawImage", args }),
    };
    const out = {
      width: 0,
      height: 0,
      getContext: () => ctx,
    } as unknown as HTMLCanvasElement;
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue(out);

    compositeHeatmapCanvases(base, overlay, 100, 100, { scale: 2, offsetX: 10, offsetY: -5 });

    expect(calls.some((c) => c.method === "translate" && c.args[0] === 60 && c.args[1] === 45)).toBe(true);
    expect(calls.some((c) => c.method === "scale" && c.args[0] === 2 && c.args[1] === 2)).toBe(true);
    createElementSpy.mockRestore();
  });

  it("shows an error toast when the canvas cannot produce an image blob", async () => {
    saveMock.mockResolvedValue("C:/exports/preview.png");

    const result = await exportPreviewCanvas(makeCanvas(null));

    expect(result).toBe(false);
    expect(addToastMock).toHaveBeenCalledWith(
      "Export PNG failed: Failed to create image blob",
      "error",
    );
  });
});
