#!/usr/bin/env node
/**
 * Ensure the embedded TerraNova Bridge plugin JAR exists before Rust compile/test.
 * Run `pnpm bridge:plugin:build` locally when missing (requires JDK 25).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const jarPath = path.join(root, "src-tauri/assets/bridge-plugin/TerraNova.Bridge.jar");

if (!fs.existsSync(jarPath)) {
  console.error(
    "Missing bundled Bridge plugin JAR at src-tauri/assets/bridge-plugin/TerraNova.Bridge.jar\n" +
      "Run: pnpm bridge:plugin:build   (JDK 25; CI builds this automatically)",
  );
  process.exit(1);
}

const size = fs.statSync(jarPath).size;
if (size < 1024) {
  console.error(`Bundled Bridge plugin JAR is too small (${size} bytes). Rebuild with pnpm bridge:plugin:build`);
  process.exit(1);
}

console.log(`Bridge plugin bundle OK (${size} bytes)`);
