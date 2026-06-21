#!/usr/bin/env node
/**
 * Rank Hytale release biomes by PCN / cell noise / field-driven material patterns.
 * Run after `pnpm sync:hytale` (reads templates/hytale-release + optional LOCALAPPDATA cache).
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

function walkJsonFiles(root) {
  const out = [];
  if (!existsSync(root)) return out;
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (name.endsWith(".json")) out.push(p);
    }
  }
  walk(root);
  return out;
}

function bump(map, key, n = 1) {
  map[key] = (map[key] ?? 0) + n;
}

function walkBiome(value, stats) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    for (const item of value) walkBiome(item, stats);
    return;
  }
  const record = value;
  const type = record.Type;
  if (typeof type === "string") {
    if (type === "PositionsCellNoise") bump(stats, "positionsCellNoise");
    if (type === "CellNoise2D" || type === "CellNoise3D") bump(stats, "cellNoise");
    if (type === "CellWallDistance") bump(stats, "cellWallDistance");
    if (type === "FieldFunction" && record.Delimiters) {
      bump(stats, "fieldFunctionDelimiters");
      if (Array.isArray(record.Delimiters)) {
        stats.delimiterBands += record.Delimiters.length;
      }
    }
    if (type === "FieldFunction" && !record.Delimiters) bump(stats, "fieldFunctionBinary");
    if (type === "Queue") bump(stats, "queueProvider");
    if (type === "SpaceAndDepth") bump(stats, "spaceAndDepth");
    if (type === "Imported" || type === "Exported") {
      const name = String(record.ExportAs ?? record.Name ?? "").trim();
      if (name && stats.inMaterialTree) stats.materialImports.add(name);
    }
  }

  const inMp = stats.inMaterialTree;
  if (record.MaterialProvider) {
    stats.inMaterialTree = true;
    walkBiome(record.MaterialProvider, stats);
    stats.inMaterialTree = inMp;
    return;
  }

  for (const v of Object.values(record)) walkBiome(v, stats);
}

function auditFile(fp) {
  let json;
  try {
    json = JSON.parse(readFileSync(fp, "utf8"));
  } catch {
    return null;
  }
  const stats = {
    positionsCellNoise: 0,
    cellNoise: 0,
    cellWallDistance: 0,
    fieldFunctionDelimiters: 0,
    fieldFunctionBinary: 0,
    delimiterBands: 0,
    queueProvider: 0,
    spaceAndDepth: 0,
    materialImports: new Set(),
    inMaterialTree: false,
  };
  walkBiome(json, stats);
  const score =
    stats.positionsCellNoise * 8 +
    stats.cellNoise * 4 +
    stats.cellWallDistance * 2 +
    stats.fieldFunctionDelimiters * 6 +
    stats.delimiterBands +
    stats.queueProvider;
  return { fp, stats, score };
}

function relPath(root, fp) {
  const norm = fp.replace(/\\/g, "/");
  const idx = norm.indexOf("/HytaleGenerator/");
  if (idx >= 0) return norm.slice(idx + "/HytaleGenerator/".length);
  return norm.replace(root.replace(/\\/g, "/"), "").replace(/^\//, "");
}

function auditRoot(label, root) {
  const rows = [];
  for (const fp of walkJsonFiles(join(root, "HytaleGenerator", "Biomes"))) {
    const row = auditFile(fp);
    if (!row) continue;
    if (row.score <= 0) continue;
    rows.push({ ...row, rel: relPath(root, fp) });
  }
  rows.sort((a, b) => b.score - a.score);
  return { label, root, rows };
}

const roots = [];
const repoRoot = process.cwd();
const templates = join(repoRoot, "templates", "hytale-release");
roots.push(auditRoot("templates/hytale-release", templates));

const local = process.env.LOCALAPPDATA;
if (local) {
  const cache = join(local, "TerraNova", "hytale-assets", "Server");
  roots.push(auditRoot("LOCALAPPDATA/TerraNova/hytale-assets", cache));
}

for (const { label, root, rows } of roots) {
  console.log(`\n=== ${label} (${root}) ===`);
  if (rows.length === 0) {
    console.log("No scored biomes — run pnpm sync:hytale first.");
    continue;
  }
  console.log("rank | score | PCN | Cell | FF delim | bands | path");
  rows.slice(0, 25).forEach((r, i) => {
    const s = r.stats;
    console.log(
      `${String(i + 1).padStart(4)} | ${String(r.score).padStart(5)} | ${String(s.positionsCellNoise).padStart(3)} | ${String(s.cellNoise).padStart(4)} | ${String(s.fieldFunctionDelimiters).padStart(8)} | ${String(s.delimiterBands).padStart(5)} | ${r.rel}`,
    );
  });
}

console.log("\nGallery smoke candidates: Generative_Arches, Generative_Veins, Example_CellNoise2D");
