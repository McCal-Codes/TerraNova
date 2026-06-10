import { describe, expect, it } from "vitest";
import {
  applyUsgsLandCoverWash,
  applyUsgsPaperGrain,
  findUsgsSpotElevations,
  formatContourLabel,
  getUsgsContourLevels,
  isIndexContourLevel,
  pickUsgsScaleBarBlocks,
  sampleUsgsHypsometricTint,
  shadeUsgsReliefPixel,
} from "../topoMapStyle";

describe("topoMapStyle", () => {
  it("marks every 5th contour and zero as index", () => {
    expect(isIndexContourLevel(0, 0.1)).toBe(true);
    expect(isIndexContourLevel(0.5, 0.1)).toBe(true);
    expect(isIndexContourLevel(0.1, 0.1)).toBe(false);
    expect(isIndexContourLevel(1.0, 0.1)).toBe(true);
  });

  it("formats contour labels for map typography", () => {
    expect(formatContourLabel(0)).toBe("0");
    expect(formatContourLabel(750)).toBe("750");
    expect(formatContourLabel(12.4)).toBe("12");
    expect(formatContourLabel(0.42)).toBe("0.4");
  });

  it("samples hypsometric tint from low to high", () => {
    const low = sampleUsgsHypsometricTint(0);
    const high = sampleUsgsHypsometricTint(1);
    expect(low[0]).toBeLessThan(high[0]);
    expect(low[1]).toBeLessThan(high[1]);
  });

  it("includes zero in USGS contour levels when in range", () => {
    const levels = getUsgsContourLevels(-1, 2, 0.5);
    expect(levels).toContain(0);
  });

  it("darkens steep relief pixels for shaded-relief look", () => {
    const flat = shadeUsgsReliefPixel([200, 180, 150], 0.9, 0);
    const steep = shadeUsgsReliefPixel([200, 180, 150], 0.9, 0.8);
    expect(steep[0]).toBeLessThan(flat[0]);
    expect(steep[1]).toBeLessThan(flat[1]);
  });

  it("picks a sensible scale bar length in blocks", () => {
    expect(pickUsgsScaleBarBlocks(512, 72, 4)).toBeGreaterThan(0);
    expect(pickUsgsScaleBarBlocks(512, 72, 4)).toBeLessThanOrEqual(512);
  });

  it("finds spaced spot elevations on a simple hill", () => {
    const n = 9;
    const values = new Float32Array(n * n);
    for (let row = 0; row < n; row++) {
      for (let col = 0; col < n; col++) {
        const dx = col - 4;
        const dz = row - 4;
        values[row * n + col] = 10 - Math.hypot(dx, dz);
      }
    }
    const spots = findUsgsSpotElevations(values, n, 3, 1);
    expect(spots.some((s) => s.kind === "peak")).toBe(true);
    expect(spots.length).toBeGreaterThan(0);
  });

  it("skips hydrography wash on negative density without a water source", () => {
    const values = new Float32Array([-0.5, 0.5]);
    const data = new Uint8ClampedArray([200, 180, 160, 255, 200, 180, 160, 255]);
    applyUsgsLandCoverWash(data, values, -1, 1);
    expect(data[0]).toBe(200);
    expect(data[1]).toBe(180);
    expect(data[2]).toBe(160);
  });

  it("applies hydrography wash when the preview slice is below the water surface", () => {
    const values = new Float32Array([-0.5]);
    const data = new Uint8ClampedArray([200, 180, 160, 255]);
    applyUsgsLandCoverWash(data, values, -1, 1, { yLevel: 90, waterSurfaceY: 100 });
    expect(data[0]).not.toBe(200);
  });

  it("skips hydrography wash when the preview slice is above the water surface", () => {
    const values = new Float32Array([-0.5]);
    const data = new Uint8ClampedArray([200, 180, 160, 255]);
    applyUsgsLandCoverWash(data, values, -1, 1, { yLevel: 110, waterSurfaceY: 100 });
    expect(data[0]).toBe(200);
  });

  it("applies subtle paper grain without clamping all pixels", () => {
    const data = new Uint8ClampedArray([200, 180, 160, 255]);
    applyUsgsPaperGrain(data, 1);
    const changed = data[0] !== 200 || data[1] !== 180 || data[2] !== 160;
    expect(changed).toBe(true);
    expect(data[0]).toBeGreaterThan(190);
    expect(data[0]).toBeLessThan(210);
  });
});
