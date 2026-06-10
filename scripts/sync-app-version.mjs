#!/usr/bin/env node
/**
 * Sync package.json, tauri.conf.json (incl. WiX MSI version), and Cargo.toml.
 * Usage: node scripts/sync-app-version.mjs 0.1.8-alpha.1
 */
import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { semverToWixVersion } from "./wix-version.mjs";

const version = process.argv[2];
if (!version) {
  console.error("sync-app-version: pass version (e.g. 0.1.8-alpha.1)");
  process.exit(1);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const wixVersion = semverToWixVersion(version);

const tauriConfPath = resolve(root, "src-tauri/tauri.conf.json");
const tauriConf = JSON.parse(readFileSync(tauriConfPath, "utf8"));
tauriConf.version = version;
tauriConf.bundle ??= {};
tauriConf.bundle.windows ??= {};
tauriConf.bundle.windows.wix ??= {};
tauriConf.bundle.windows.wix.version = wixVersion;
writeFileSync(tauriConfPath, `${JSON.stringify(tauriConf, null, 2)}\n`);

const pkgPath = resolve(root, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
pkg.version = version;
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`);

const cargoPath = resolve(root, "src-tauri/Cargo.toml");
let cargo = readFileSync(cargoPath, "utf8");
cargo = cargo.replace(/^version = ".*"/m, `version = "${version}"`);
writeFileSync(cargoPath, cargo);

console.log(`Synced app version ${version} (WiX ${wixVersion})`);
