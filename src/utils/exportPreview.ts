import { save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { usePreviewStore } from "@/stores/previewStore";
import type { CanvasTransform } from "@/stores/previewStore";
import { useToastStore } from "@/stores/toastStore";

export async function exportCanvasAsPNG(canvas: HTMLCanvasElement): Promise<string | null> {
  const filePath = await save({
    filters: [{ name: "PNG Image", extensions: ["png"] }],
  });
  if (!filePath) return null;

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Failed to create image blob");
  const buffer = await blob.arrayBuffer();
  await writeFile(filePath, new Uint8Array(buffer));
  return filePath;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Merge base heatmap + overlay canvases for PNG export (shape layers live on overlay). */
export function compositeHeatmapCanvases(
  base: HTMLCanvasElement,
  overlay: HTMLCanvasElement | null,
  width: number,
  height: number,
  transform: CanvasTransform = { scale: 1, offsetX: 0, offsetY: 0 },
): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = width;
  out.height = height;
  const ctx = out.getContext("2d");
  if (!ctx) return base;

  const cx = width / 2;
  const cy = height / 2;
  const { scale, offsetX, offsetY } = transform;

  ctx.save();
  ctx.translate(cx + offsetX, cy + offsetY);
  ctx.scale(scale, scale);
  ctx.drawImage(base, -width / 2, -height / 2, width, height);
  ctx.restore();

  if (overlay && overlay.width > 0) {
    ctx.drawImage(overlay, 0, 0, width, height);
  }
  return out;
}

export async function exportHeatmapFromWrapper(wrapper: HTMLElement): Promise<boolean> {
  const base = wrapper.querySelector("[data-tn-heatmap-base]") as HTMLCanvasElement | null;
  if (!base) {
    return exportPreviewCanvas(null);
  }
  const overlay = wrapper.querySelector("[data-tn-heatmap-overlay]") as HTMLCanvasElement | null;
  const rect = wrapper.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width));
  const h = Math.max(1, Math.round(rect.height));
  const transform = usePreviewStore.getState().canvasTransform;
  const composite = compositeHeatmapCanvases(base, overlay, w, h, transform);
  return exportPreviewCanvas(composite);
}

export async function exportPreviewCanvas(canvas: HTMLCanvasElement | null | undefined): Promise<boolean> {
  const addToast = useToastStore.getState().addToast;

  if (!canvas) {
    addToast("No preview canvas is ready to export yet.", "warning");
    return false;
  }

  try {
    const filePath = await exportCanvasAsPNG(canvas);
    if (!filePath) return false;
    addToast(`Exported PNG to ${filePath}`, "success");
    return true;
  } catch (error) {
    if (import.meta.env.DEV) console.error("Export PNG failed:", error);
    addToast(`Export PNG failed: ${getErrorMessage(error)}`, "error");
    return false;
  }
}
