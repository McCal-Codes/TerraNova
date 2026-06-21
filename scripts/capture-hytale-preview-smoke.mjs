#!/usr/bin/env node
/**
 * Capture voxel preview screenshots for Hytale release gallery cases.
 *
 * Prerequisites:
 *   - Synced hytale-assets (%LOCALAPPDATA%/TerraNova/hytale-assets)
 *   - Vite dev server on :1420 (or pass PREVIEW_SMOKE_BASE_URL)
 *   - playwright: npx playwright install chromium (first run)
 *
 * Usage:
 *   node scripts/capture-hytale-preview-smoke.mjs
 *   PREVIEW_SMOKE_BASE_URL=http://127.0.0.1:1420 node scripts/capture-hytale-preview-smoke.mjs
 */
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "test-results", "hytale-preview-smoke");
const baseUrl = process.env.PREVIEW_SMOKE_BASE_URL ?? "http://127.0.0.1:1420";

const CASES = [
  {
    id: "hytale-plains1-river",
    query: "mode=voxel&materials=1",
    waitMs: 12000,
  },
  {
    id: "hytale-plains1-deeproot",
    query: "mode=voxel&cutaway=1&materials=1",
    waitMs: 14000,
  },
];

async function isServerUp(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok || res.status === 404;
  } catch {
    return false;
  }
}

function startDevServer() {
  const isWin = process.platform === "win32";
  const child = spawn(isWin ? "pnpm.cmd" : "pnpm", ["dev"], {
    cwd: repoRoot,
    stdio: "inherit",
    shell: isWin,
    env: { ...process.env },
  });
  return child;
}

async function waitForServer(url, timeoutMs = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await isServerUp(url)) return;
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error(`Dev server not reachable at ${url} after ${timeoutMs}ms`);
}

async function loadPlaywright() {
  try {
    return await import("playwright");
  } catch {
    try {
      return require("playwright");
    } catch {
      throw new Error(
        "playwright is not installed. Run: pnpm add -D playwright && npx playwright install chromium",
      );
    }
  }
}

async function captureCase(browser, caseDef) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = `${baseUrl}/?shape-preview-gallery=1&case=${caseDef.id}&${caseDef.query}`;
  console.log(`→ ${url}`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForSelector('[data-testid="gallery-ready"]', { timeout: 60000 });
  await page.waitForTimeout(caseDef.waitMs);

  const shotPath = path.join(outDir, `${caseDef.id}.png`);
  await page.screenshot({ path: shotPath, fullPage: false });
  await page.close();
  return shotPath;
}

async function main() {
  await mkdir(outDir, { recursive: true });

  let devChild = null;
  if (!(await isServerUp(baseUrl))) {
    console.log("Starting vite dev server…");
    devChild = startDevServer();
    await waitForServer(baseUrl);
  }

  const pw = await loadPlaywright();
  const browser = await pw.chromium.launch({ headless: true });

  const manifest = [];
  try {
    for (const caseDef of CASES) {
      const shotPath = await captureCase(browser, caseDef);
      manifest.push({ case: caseDef.id, screenshot: path.relative(repoRoot, shotPath) });
      console.log(`✓ ${caseDef.id} → ${shotPath}`);
    }
  } finally {
    await browser.close();
    if (devChild) devChild.kill("SIGTERM");
  }

  const manifestPath = path.join(outDir, "manifest.json");
  await writeFile(manifestPath, `${JSON.stringify({ capturedAt: new Date().toISOString(), cases: manifest }, null, 2)}\n`);
  console.log(`\nWrote ${manifestPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
