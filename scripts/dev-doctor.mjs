#!/usr/bin/env node
/**
 * Diagnose the TerraNova development environment.
 *
 *   pnpm dev:doctor            human-readable report
 *   pnpm dev:doctor --json     machine-readable, for pasting into an issue
 *
 * Paths are shown relative to the repository or with the home directory replaced
 * by `~`, so the output can be shared without leaking unrelated user paths. No
 * environment variables or tokens are printed.
 */
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import {
  DEV_PORT,
  HYTALE_CHANNELS,
  checkNode,
  currentFingerprint,
  describeHytaleSource,
  formatCheck,
  isPortServing,
  probeVersion,
  readStoredFingerprint,
  repoRoot,
  shouldInstall,
} from "./lib/devEnv.mjs";

const root = repoRoot();
const asJson = process.argv.includes("--json");
const home = process.env.HOME || process.env.USERPROFILE || "";

/** Keep shared output free of unrelated absolute user paths. */
function tidyPath(p) {
  if (!p) return null;
  const rel = relative(root, p);
  if (rel && !rel.startsWith("..")) return rel;
  return home && p.startsWith(home) ? p.replace(home, "~") : p;
}

const checks = [];
const add = (check) => {
  checks.push(check);
  return check;
};

/* ── Toolchain ───────────────────────────────────────────────────── */

add(checkNode());

const pnpmVersion = probeVersion("pnpm");
add({
  name: "pnpm",
  value: pnpmVersion,
  status: pnpmVersion ? "pass" : "fail",
  remedy: pnpmVersion ? null : "corepack enable",
});

const rustc = probeVersion("rustc");
add({
  name: "Rust",
  value: rustc,
  status: rustc ? "pass" : "warn",
  remedy: rustc ? null : "Install from https://rustup.rs — only the desktop build needs it",
});

const cargo = probeVersion("cargo");
add({
  name: "Cargo",
  value: cargo,
  status: cargo ? "pass" : "warn",
  remedy: cargo ? null : "Ships with Rust; browser-only dev works without it (pnpm dev:web)",
});

const tauriCli = existsSync(join(root, "node_modules", ".bin", "tauri"))
  ? "installed (local)"
  : probeVersion("tauri");
add({
  name: "Tauri CLI",
  value: tauriCli,
  status: tauriCli ? "pass" : "warn",
  remedy: tauriCli ? null : "Provided by devDependencies — run pnpm install",
});

add({ name: "Repository root", value: tidyPath(root) || ".", status: "info" });

/* ── Dependencies ────────────────────────────────────────────────── */

const decision = shouldInstall({
  nodeModulesExists: existsSync(join(root, "node_modules")),
  storedFingerprint: readStoredFingerprint(root),
  currentFingerprint: currentFingerprint(root),
  forceInstall: false,
});
add({
  name: "Dependencies",
  value: decision.reason,
  status: decision.install ? "warn" : "pass",
  remedy: decision.install ? "pnpm start  (installs automatically) or pnpm install" : null,
});

/* ── Dev server port ─────────────────────────────────────────────── */

const serving = await isPortServing(DEV_PORT);
add({
  name: `Port ${DEV_PORT}`,
  value: serving ? "in use — a dev server appears to be running" : "free",
  status: serving ? "warn" : "pass",
  remedy: serving ? "Reuse that window, or stop it before running pnpm start" : null,
});

/* ── Hytale sources ──────────────────────────────────────────────── */

const sources = {};
for (const channel of HYTALE_CHANNELS) {
  const source = describeHytaleSource(channel);
  sources[channel] = source;
  add({
    name: `Hytale ${channel} source`,
    value: source.found
      ? `${tidyPath(source.path)}${source.archive?.size ? ` (Assets.zip ${(source.archive.size / 1e9).toFixed(2)} GB)` : ""}`
      : "not detected",
    status: source.found ? "pass" : "info",
    remedy: source.found ? null : "Install this channel via the Hytale launcher if you need it",
  });
}

/* ── TerraNova asset cache ───────────────────────────────────────── */

const cacheRoot = join(root, "templates", "hytale-release");
const manifestPath = join(cacheRoot, "manifest.json");
let manifest = null;
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  } catch {
    manifest = null;
  }
}

add({
  name: "TerraNova asset cache",
  value: manifest
    ? `${manifest.fileCount ?? "?"} files, ${manifest.nodeTypeCount ?? "?"} node types`
    : "not synced",
  status: manifest ? "pass" : "info",
  remedy: manifest ? null : "pnpm sync:hytale",
});

// The current manifest records no channel or content fingerprint. Report that
// plainly rather than guessing which channel the cache came from.
add({
  name: "Cache channel",
  value: manifest?.channel ?? "unknown (manifest records no channel)",
  status: manifest?.channel ? "pass" : "warn",
  remedy: manifest?.channel ? null : "Channel provenance lands with the compatibility scanner",
});

add({
  name: "Cache fingerprint",
  value: manifest?.sourceFingerprint ?? "not recorded",
  status: manifest?.sourceFingerprint ? "pass" : "warn",
  remedy: manifest?.sourceFingerprint ? null : "Fingerprinting lands with the compatibility scanner",
});

if (manifest?.sourcePath) {
  const stale =
    sources.release.archive?.modified &&
    manifest.syncedAt &&
    new Date(sources.release.archive.modified) > new Date(manifest.syncedAt);
  add({
    name: "Cache staleness",
    value: manifest.syncedAt
      ? stale
        ? "stale — game assets are newer than the last sync"
        : "current"
      : "unknown (manifest records no sync time)",
    status: manifest.syncedAt ? (stale ? "warn" : "pass") : "warn",
    remedy: stale ? "pnpm sync:hytale" : null,
  });
}

/* ── Dev Lab reports ─────────────────────────────────────────────── */

const reportDir = join(root, "dev-lab-reports");
let latestReport = null;
if (existsSync(reportDir)) {
  const entries = readdirSync(reportDir)
    .filter((f) => f.endsWith(".json"))
    .map((f) => ({ f, m: statSync(join(reportDir, f)).mtimeMs }))
    .sort((a, b) => b.m - a.m);
  latestReport = entries[0]?.f ?? null;
}
add({
  name: "Latest Dev Lab report",
  value: latestReport ?? "none",
  status: "info",
});

/* ── Output ──────────────────────────────────────────────────────── */

if (asJson) {
  console.log(JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2));
} else {
  console.log("TerraNova dev doctor\n");
  for (const check of checks) console.log(formatCheck(check));
  const fails = checks.filter((c) => c.status === "fail").length;
  const warns = checks.filter((c) => c.status === "warn").length;
  console.log(`\n${fails} failing, ${warns} warning, ${checks.length} checks total`);
  if (fails === 0) console.log("Ready: pnpm start");
}

process.exit(checks.some((c) => c.status === "fail") ? 1 : 0);
