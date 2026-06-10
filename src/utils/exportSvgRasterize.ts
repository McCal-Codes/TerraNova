const DEFAULT_RASTER_SIZE = 3840;

function loadSvgImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Failed to load SVG for rasterization"));
    img.src = url;
  });
}

/** Rasterize SVG markup to a PNG blob at the given output dimensions. */
export async function rasterizeSvgToPngBlob(
  svg: string,
  width = DEFAULT_RASTER_SIZE,
  height = DEFAULT_RASTER_SIZE,
): Promise<Blob> {
  const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
  const url = URL.createObjectURL(svgBlob);

  try {
    const img = await loadSvgImage(url);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas is unavailable");

    ctx.drawImage(img, 0, 0, width, height);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("Failed to encode PNG"))),
        "image/png",
      );
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}
