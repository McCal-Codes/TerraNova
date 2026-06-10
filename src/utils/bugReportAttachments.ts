import { open, save } from "@tauri-apps/plugin-dialog";
import { writeFile } from "@tauri-apps/plugin-fs";
import { compositeHeatmapCanvases } from "@/utils/exportPreview";
import { usePreviewStore } from "@/stores/previewStore";
import { sanitizeReportPath } from "@/utils/bugReport";
import { isTauriRuntime } from "@/utils/platform";

export type BugReportAttachmentKind = "screenshot" | "file";

export interface BugReportAttachment {
  id: string;
  name: string;
  kind: BugReportAttachmentKind;
  savedPath: string;
  sizeBytes: number;
  mime: string;
}

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "webp", "gif", "bmp"]);
const FILE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "gif", "bmp", "json", "txt", "log", "zip"];

function newAttachmentId(): string {
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function guessMime(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "json") return "application/json";
  if (ext === "zip") return "application/zip";
  return "application/octet-stream";
}

export function findActivePreviewCanvas(): HTMLCanvasElement | null {
  const root = document.querySelector("[data-tn-heatmap-root]") as HTMLElement | null;
  if (root) {
    const base = root.querySelector("[data-tn-heatmap-base]") as HTMLCanvasElement | null;
    const overlay = root.querySelector("[data-tn-heatmap-overlay]") as HTMLCanvasElement | null;
    if (base?.width) {
      const rect = root.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      const transform = usePreviewStore.getState().canvasTransform;
      return compositeHeatmapCanvases(base, overlay, w, h, transform);
    }
  }

  const previewPane = document.querySelector(".relative.w-full.h-full canvas") as HTMLCanvasElement | null;
  if (previewPane?.width) return previewPane;
  return null;
}

export async function capturePreviewScreenshotAttachment(): Promise<BugReportAttachment | null> {
  if (!isTauriRuntime()) {
    throw new Error("Screenshot capture requires the TerraNova desktop app.");
  }

  const canvas = findActivePreviewCanvas();
  if (!canvas) {
    throw new Error("No preview canvas is ready — open a preview (2D/3D/Voxel) first.");
  }

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (!blob) {
    throw new Error("Failed to encode preview screenshot.");
  }

  const defaultName = `terranova-preview-${Date.now()}.png`;
  const filePath = await save({
    filters: [{ name: "PNG Image", extensions: ["png"] }],
    defaultPath: defaultName,
  });
  if (!filePath || typeof filePath !== "string") return null;

  const buffer = new Uint8Array(await blob.arrayBuffer());
  await writeFile(filePath, buffer);

  const name = filePath.replace(/^.*[/\\]/, "") || defaultName;
  return {
    id: newAttachmentId(),
    name,
    kind: "screenshot",
    savedPath: filePath,
    sizeBytes: buffer.byteLength,
    mime: "image/png",
  };
}

export async function pickBugReportFileAttachments(): Promise<BugReportAttachment[]> {
  if (!isTauriRuntime()) {
    throw new Error("File attachments require the TerraNova desktop app.");
  }

  const selected = await open({
    multiple: true,
    title: "Attach files to bug report",
    filters: [{ name: "Screenshots & logs", extensions: FILE_EXTENSIONS }],
  });
  if (!selected) return [];

  const paths = Array.isArray(selected) ? selected : [selected];
  return paths.map((savedPath) => {
    const name = savedPath.replace(/^.*[/\\]/, "") || savedPath;
    return {
      id: newAttachmentId(),
      name,
      kind: IMAGE_EXTENSIONS.has(name.split(".").pop()?.toLowerCase() ?? "") ? "screenshot" : "file",
      savedPath,
      sizeBytes: 0,
      mime: guessMime(name),
    } satisfies BugReportAttachment;
  });
}

export function formatAttachmentForBundle(att: BugReportAttachment): BugReportAttachment {
  return {
    ...att,
    savedPath: sanitizeReportPath(att.savedPath) ?? att.savedPath,
  };
}

export function attachmentPathsForIssueBody(attachments: BugReportAttachment[]): string {
  if (attachments.length === 0) return "";
  return attachments
    .map((a, i) => `${i + 1}. ${a.name} (${a.kind}) — ${sanitizeReportPath(a.savedPath) ?? a.savedPath}`)
    .join("\n");
}
