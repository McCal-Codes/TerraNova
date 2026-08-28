import { describe, it, expect } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";
import { jsonToGraph } from "@/utils/jsonToGraph";
import { createEvaluationContext } from "@/utils/densityEvaluator";
import { isSolidDensity } from "@/utils/voxelExtractor";
import type { DensityExportMap } from "@/utils/densityExportRegistry";
import { readdirSync } from "node:fs";

/**
 * Render real shipped Hytale biomes through TerraNova's evaluator and write PNGs.
 *
 * This is a visual verification artifact, not an assertion of correctness — it is how
 * you eyeball whether the corrected noise pipeline produces terrain that looks like
 * the biome it came from. The numeric checks live in the parity harnesses.
 *
 * Opt-in: set PREVIEW_CAPTURE=1, or run `pnpm test:preview-capture`. Rendering
 * five biomes through the full evaluator takes minutes, so this must not run as
 * part of the normal suite — it is an artifact generator, not an assertion, and
 * it was previously timing out the default `vitest run` on any machine that
 * happened to have the vanilla assets installed.
 *
 * Also skips when the extracted vanilla assets are not present, so CI and
 * contributors without a game install are unaffected either way.
 *
 * Output: <OUT_DIR>/<biome>-section.png and -heightmap.png
 */

/** Node env without pulling @types/node into the app tsconfig. */
const ENV: Record<string, string | undefined> =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

const ASSET_ROOTS = [
  ENV.HYTALE_WORLDGEN_DIR,
  join(
    ENV.HOME ?? "",
    "Library/Application Support/Hytale/install/pre-release/package/game/latest",
  ),
].filter(Boolean) as string[];

/** Explicit opt-in — see the file docstring. */
const CAPTURE_ENABLED = ENV.PREVIEW_CAPTURE === "1";

/**
 * Extra pre-extracted asset roots, colon-separated, for investigations that
 * unpack the game files somewhere non-standard.
 */
const EXTRACTED = (ENV.HYTALE_EXTRACTED_DIRS ?? "").split(":").filter(Boolean);

// test-results/ is already gitignored, so captures never dirty the tree.
const OUT_DIR = ENV.PREVIEW_CAPTURE_DIR ?? "test-results/preview-capture";

const SKYREACH_BIOME =
  join(ENV.HOME ?? "", "Downloads/Skyreach Ravines - by Breadley - v4.1/Server/HytaleGenerator/Biomes/SkyreachRavines.json");

interface Target {
  label: string;
  file: string;
  /** World Y window to render. */
  yMin: number;
  yMax: number;
  /** Horizontal half-extent in blocks. */
  halfSpan: number;
}

function resolveVanillaRoot(): string | null {
  for (const dir of EXTRACTED) if (existsSync(dir)) return dir;
  for (const root of ASSET_ROOTS) {
    const candidate = join(root, "Server/HytaleGenerator");
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Build the cross-file export table from Server/HytaleGenerator/Density.
 *
 * Real biomes reference shared densities by name — Plains1_River alone imports
 * `World-River-Map` five times — and those names are exported from *nested* nodes
 * inside the Density files, not just their roots. Without this the imports resolve to
 * nothing and the terrain renders flat, which looks like an evaluator bug but is a
 * missing input.
 */
function loadDensityExports(root: string): DensityExportMap {
  const map: DensityExportMap = {};
  const dir = join(root, "Density");
  if (!existsSync(dir)) return map;

  for (const file of readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    let parsed: unknown;
    try {
      parsed = JSON.parse(readFileSync(join(dir, file), "utf8"));
    } catch {
      continue;
    }
    walk(parsed);
  }
  return map;

  function walk(node: unknown): void {
    if (Array.isArray(node)) {
      for (const child of node) walk(child);
      return;
    }
    if (!node || typeof node !== "object") return;
    const obj = node as Record<string, unknown>;
    const exportAs = obj.ExportAs;
    if (typeof exportAs === "string" && exportAs.length > 0 && !(exportAs in map)) {
      try {
        const { nodes, edges } = jsonToGraph(obj as never, 0, 0, `exp_${exportAs}`);
        map[exportAs] = { nodes, edges };
      } catch {
        /* a subtree we cannot graph is simply not registered */
      }
    }
    for (const value of Object.values(obj)) walk(value);
  }
}

/* ── Minimal PNG encoder (no dependencies) ───────────────────────── */

function crc32(buf: Buffer): number {
  let c: number;
  const table: number[] = [];
  for (let n = 0; n < 256; n++) {
    c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  let crc = 0xffffffff;
  for (const byte of buf) crc = table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typed = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typed));
  return Buffer.concat([len, typed, crc]);
}

/** rgb is a width*height*3 byte buffer. */
function encodePng(width: number, height: number, rgb: Buffer): Buffer {
  const stride = width * 3;
  // One filter byte (0 = None) per scanline.
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;
    rgb.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

/* ── Colour ramps ────────────────────────────────────────────────── */

/** Solid vs air, with the zero isosurface as the visible boundary. */
function sectionColor(d: number): [number, number, number] {
  if (isSolidDensity(d)) {
    // Warmer / brighter deeper into solid.
    const t = Math.min(1, d / 0.6);
    return [90 + t * 110, 74 + t * 76, 58 + t * 40];
  }
  const t = Math.min(1, -d / 0.6);
  return [22 + (1 - t) * 40, 30 + (1 - t) * 55, 44 + (1 - t) * 80];
}

function heightColor(y: number | null, yMin: number, yMax: number): [number, number, number] {
  if (y === null) return [16, 20, 28];
  const t = Math.max(0, Math.min(1, (y - yMin) / Math.max(1, yMax - yMin)));
  // Low = green, mid = tan, high = pale rock.
  if (t < 0.5) {
    const u = t / 0.5;
    return [60 + u * 130, 110 + u * 70, 60 + u * 40];
  }
  const u = (t - 0.5) / 0.5;
  return [190 + u * 55, 180 + u * 60, 100 + u * 130];
}

describe("Hytale asset preview capture", () => {
  const root = resolveVanillaRoot();

  const targets: Target[] = [
    { label: "Example_Runtime", file: "Biomes/Examples/Example_Runtime.json", yMin: 40, yMax: 200, halfSpan: 400 },
    { label: "Plains1_River", file: "Biomes/Plains1/Plains1_River.json", yMin: 40, yMax: 200, halfSpan: 400 },
    { label: "Plains1_Deeproot", file: "Biomes/Plains1/Plains1_Deeproot.json", yMin: 0, yMax: 200, halfSpan: 400 },
    { label: "Desert1_Stacks", file: "Biomes/Desert1/Desert1_Stacks.json", yMin: 40, yMax: 220, halfSpan: 400 },
    // Test_Features is Hypixel's own node-coverage biome — the widest single
    // sample of node types in one graph, so it is the best single image for
    // spotting a handler that has gone wrong.
    { label: "Test_Features", file: "Biomes/Test_Features.json", yMin: 0, yMax: 220, halfSpan: 400 },
    // The two MultiMix examples. These are the graphs whose evaluation is
    // currently suspect, and a section render says at a glance whether the node
    // produces structure or a flat field — which a range statistic does not.
    { label: "Example_Multi_Mixer_Curve", file: "Biomes/Examples/Example_Multi_Mixer_Curve.json", yMin: 0, yMax: 220, halfSpan: 400 },
    { label: "Example_Multi_Mixer_Horizontal", file: "Biomes/Examples/Example_Multi_Mixer_Horizontal.json", yMin: 0, yMax: 220, halfSpan: 400 },
    // A known-good reference: cell noise in isolation. If this looks wrong the
    // problem is upstream of anything MultiMix-specific.
    { label: "Example_CellNoise2D", file: "Biomes/Examples/Example_CellNoise2D.json", yMin: 0, yMax: 220, halfSpan: 400 },
  ];

  it.runIf(CAPTURE_ENABLED && root !== null)(
    "renders shipped biomes to PNG",
    () => {
    mkdirSync(OUT_DIR, { recursive: true });
    const W = 480;
    const H = 240;
    const contentFields = { Base: 100, Water: 100, Bedrock: 0 };
    const rendered: string[] = [];
    const externalDensityExports = loadDensityExports(root!);
     
    console.log(`resolved ${Object.keys(externalDensityExports).length} external density exports`);

    const all: Array<Target & { path: string }> = targets.map((t) => ({ ...t, path: join(root!, t.file) }));
    if (existsSync(SKYREACH_BIOME)) {
      all.push({
        label: "SkyreachRavines",
        file: SKYREACH_BIOME,
        path: SKYREACH_BIOME,
        yMin: -100,
        yMax: 320,
        halfSpan: 600,
      });
    }

    for (const t of all) {
      if (!existsSync(t.path)) continue;
      const biome = JSON.parse(readFileSync(t.path, "utf8"));
      const densityJson = biome?.Terrain?.Density ?? biome?.Density ?? biome;
      const { nodes, edges } = jsonToGraph(densityJson);
      const ctx = createEvaluationContext(nodes, edges, undefined, {
        contentFields,
        externalDensityExports,
      });
      if (!ctx) continue;

      // Vertical section: X across, Y up, Z fixed.
      const section = Buffer.alloc(W * H * 3);
      for (let px = 0; px < W; px++) {
        const wx = -t.halfSpan + (px / (W - 1)) * (2 * t.halfSpan);
        for (let py = 0; py < H; py++) {
          const wy = t.yMax - (py / (H - 1)) * (t.yMax - t.yMin);
          const [r, g, b] = sectionColor(ctx.evaluate(ctx.rootId, wx, wy, 0));
          const o = (py * W + px) * 3;
          section[o] = r; section[o + 1] = g; section[o + 2] = b;
        }
      }
      const sectionPath = join(OUT_DIR, `${t.label}-section.png`);
      writeFileSync(sectionPath, encodePng(W, H, section));
      rendered.push(sectionPath);

      // Top-down heightmap: topmost solid Y per column.
      const HM = 240;
      const heights = Buffer.alloc(HM * HM * 3);
      const step = (t.yMax - t.yMin) / 96;
      for (let pz = 0; pz < HM; pz++) {
        const wz = -t.halfSpan + (pz / (HM - 1)) * (2 * t.halfSpan);
        for (let px = 0; px < HM; px++) {
          const wx = -t.halfSpan + (px / (HM - 1)) * (2 * t.halfSpan);
          let top: number | null = null;
          for (let wy = t.yMax; wy >= t.yMin; wy -= step) {
            if (isSolidDensity(ctx.evaluate(ctx.rootId, wx, wy, wz))) { top = wy; break; }
          }
          const [r, g, b] = heightColor(top, t.yMin, t.yMax);
          const o = (pz * HM + px) * 3;
          heights[o] = r; heights[o + 1] = g; heights[o + 2] = b;
        }
      }
      const hmPath = join(OUT_DIR, `${t.label}-heightmap.png`);
      writeFileSync(hmPath, encodePng(HM, HM, heights));
      rendered.push(hmPath);
    }

     
      console.log(`captured ${rendered.length} images:\n  ${rendered.join("\n  ")}`);
      expect(rendered.length).toBeGreaterThan(0);
    },
    // Five biomes at full evaluator fidelity measured ~12 minutes on an M-series
    // Mac. The old 120s budget could never have passed; it only looked green
    // because the assets were absent everywhere it ran.
    20 * 60_000,
  );
});
