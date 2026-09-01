#!/usr/bin/env node
/**
 * One-command development startup for TerraNova.
 *
 *   pnpm start            full desktop (Tauri) dev build
 *   pnpm start --web      browser-only Vite
 *   pnpm start --lab      desktop, opening straight into Dev Lab
 *   pnpm start --install  force a dependency install first
 *   pnpm start --sync release | pre-release
 *
 * Ownership of the Vite dev server matters here. `tauri dev` already starts Vite
 * through `beforeDevCommand` in src-tauri/tauri.conf.json, so this script must NOT
 * start one as well — doing both is what produced two Vite processes fighting over
 * port 1420, with the second silently landing on a different port that `devUrl`
 * never points at.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  DEV_PORT,
  checkNode,
  currentFingerprint,
  isPortServing,
  parseLauncherArgs,
  probeVersion,
  readStoredFingerprint,
  repoRoot,
  shouldInstall,
  writeStoredFingerprint,
} from "./lib/devEnv.mjs";

const root = repoRoot();
const args = parseLauncherArgs(process.argv.slice(2));

function log(message) {
  console.log(`terranova ▸ ${message}`);
}

function fail(message, remedy) {
  console.error(`terranova ▸ ${message}`);
  if (remedy) console.error(`            → ${remedy}`);
  process.exit(1);
}

if (args.help) {
  console.log(`TerraNova development launcher

  pnpm start                 desktop dev build (Tauri + Vite)
  pnpm start --web           browser-only Vite
  pnpm start --lab           desktop, opening into Dev Lab
  pnpm start --install       force dependency install
  pnpm start --sync <chan>   sync Hytale assets first (release | pre-release)

  pnpm dev:doctor            diagnose the environment`);
  process.exit(0);
}

for (const unknown of args.unknown) {
  console.warn(`terranova ▸ ignoring unrecognised argument: ${unknown}`);
}

/* ── Preflight ───────────────────────────────────────────────────── */

const node = checkNode();
if (node.status === "fail") fail(`Node ${node.value} is too old.`, node.remedy);

const pnpmVersion = probeVersion("pnpm");
if (!pnpmVersion) {
  fail("pnpm was not found on PATH.", "corepack enable  (or: npm install -g pnpm)");
}

if (args.mode === "desktop") {
  const cargo = probeVersion("cargo");
  if (!cargo) {
    fail(
      "cargo was not found on PATH, which the desktop build requires.",
      "Install Rust from https://rustup.rs, then reopen your terminal. Browser-only: pnpm start --web",
    );
  }
}

/* ── Dependencies ────────────────────────────────────────────────── */

const decision = shouldInstall({
  nodeModulesExists: existsSync(join(root, "node_modules")),
  storedFingerprint: readStoredFingerprint(root),
  currentFingerprint: currentFingerprint(root),
  forceInstall: args.install,
});

if (decision.install) {
  log(`installing dependencies (${decision.reason})`);
  const install = spawn("pnpm", ["install", "--frozen-lockfile"], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const code = await new Promise((r) => install.on("exit", r));
  if (code !== 0) {
    fail(`dependency install failed with exit code ${code}.`, "pnpm install");
  }
  writeStoredFingerprint(currentFingerprint(root), root);
} else {
  log(`dependencies are current (${decision.reason})`);
}

/* ── Optional asset sync ─────────────────────────────────────────── */

if (args.sync) {
  log(`syncing Hytale assets from the ${args.sync} channel`);
  const sync = spawn("pnpm", ["sync:hytale", "--channel", args.sync], {
    cwd: root,
    stdio: "inherit",
    shell: process.platform === "win32",
  });
  const code = await new Promise((r) => sync.on("exit", r));
  if (code !== 0) {
    console.warn(`terranova ▸ asset sync exited with ${code}; continuing without it.`);
  }
}

/* ── Port ownership ──────────────────────────────────────────────── */

if (await isPortServing(DEV_PORT)) {
  fail(
    `port ${DEV_PORT} is already serving — a TerraNova dev server is probably running.`,
    `Use that window, or stop it and re-run. This launcher will not start a second Vite.`,
  );
}

/* ── Launch ──────────────────────────────────────────────────────── */

// Consumed by the app to open straight into Dev Lab. Vite exposes VITE_-prefixed
// variables to client code; the launcher only has to set it.
const env = { ...process.env };
if (args.lab) env.VITE_TERRANOVA_DEV_LAB = "1";

const command = args.mode === "web" ? ["dev"] : ["tauri", "dev"];
log(
  args.mode === "web"
    ? `starting Vite on http://localhost:${DEV_PORT}${args.lab ? " (Dev Lab)" : ""}`
    : `starting desktop dev build${args.lab ? " (Dev Lab)" : ""} — Tauri owns the Vite server`,
);

const child = spawn("pnpm", command, {
  cwd: root,
  stdio: "inherit",
  env,
  shell: process.platform === "win32",
});

// Forward termination so Ctrl-C reaches Tauri and Vite instead of orphaning them.
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    if (!child.killed) child.kill(signal);
  });
}

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  else process.exit(code ?? 0);
});
