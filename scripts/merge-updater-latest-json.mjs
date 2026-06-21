#!/usr/bin/env node
/**
 * Merge partial Tauri updater manifests from parallel CI builds into one latest.json.
 * Usage: node scripts/merge-updater-latest-json.mjs [paths...]
 * If no paths given, reads JSON files from stdin paths via find on updater-json/.
 */
import fs from "node:fs";
import path from "node:path";

function collectJsonFiles(args) {
  if (args.length > 0) {
    return args.filter((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  }
  const root = "updater-json";
  if (!fs.existsSync(root)) return [];
  const out = [];
  const walk = (dir) => {
    for (const name of fs.readdirSync(dir)) {
      const full = path.join(dir, name);
      const st = fs.statSync(full);
      if (st.isDirectory()) walk(full);
      else if (name === "latest.json") out.push(full);
    }
  };
  walk(root);
  return out;
}

const files = collectJsonFiles(process.argv.slice(2));
if (files.length === 0) {
  console.error("merge-updater-latest-json: no latest.json inputs");
  process.exit(1);
}

/** @type {Record<string, unknown> | null} */
let merged = null;

for (const file of files) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!data || typeof data !== "object") continue;
  if (!merged) {
    merged = {
      version: data.version,
      notes: data.notes,
      pub_date: data.pub_date,
      platforms: {},
    };
  }
  if (data.version && !merged.version) merged.version = data.version;
  if (data.notes && !merged.notes) merged.notes = data.notes;
  if (data.pub_date && (!merged.pub_date || data.pub_date > merged.pub_date)) {
    merged.pub_date = data.pub_date;
  }
  Object.assign(merged.platforms, data.platforms || {});
}

if (!merged?.platforms || Object.keys(merged.platforms).length === 0) {
  console.error("merge-updater-latest-json: merged manifest has no platforms");
  process.exit(1);
}

process.stdout.write(`${JSON.stringify(merged, null, 2)}\n`);
