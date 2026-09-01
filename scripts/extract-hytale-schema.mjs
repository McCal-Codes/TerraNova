#!/usr/bin/env node
/**
 * Derives TerraNova's node schema from Hytale's own source.
 *
 * The authority is `AssetManager.java`, whose `X.CODEC.register("Name", …)`
 * calls are exactly the set of types the generator will deserialise. Anything
 * outside that list is a type the game rejects; anything inside it that we do
 * not offer is a node the user cannot build.
 *
 * Field names, types and required flags come from each asset class's
 * `BuilderCodec` — `new KeyedCodec<>("WallA", Codec.DOUBLE, true)` — and
 * defaults from the backing Java field initialiser. Inherited fields are
 * collected by walking the `ABSTRACT_CODEC` chain, so every Density type picks
 * up Inputs/Skip/ExportAs.
 *
 * Output is keyed "Category:Type" rather than by bare name: 48 type names are
 * registered in more than one category ("Imported" in 19 of them), so a
 * name-keyed map silently drops all but one.
 *
 *   node scripts/extract-hytale-schema.mjs <shared-source-root> [--out FILE]
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const root = args.find((a) => !a.startsWith("--"));
const outIdx = args.indexOf("--out");
const outPath = outIdx >= 0 ? args[outIdx + 1] : "src/data/hytale-update6-schema.json";

if (!root) {
  console.error("usage: node scripts/extract-hytale-schema.mjs <shared-source-root> [--out FILE]");
  process.exit(2);
}

const GEN_ROOT = path.join(
  root,
  "HytaleServer/builtin/HytaleGenerator/src/main/java/com/hypixel/hytale/builtin/hytalegenerator",
);
const ASSET_MANAGER = path.join(GEN_ROOT, "assets/AssetManager.java");

if (!fs.existsSync(ASSET_MANAGER)) {
  console.error(`Not a Hytale shared-source release: ${ASSET_MANAGER} is missing.`);
  process.exit(2);
}

/* ── Index every asset class by simple name ───────────────────────── */

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith(".java")) out.push(p);
  }
  return out;
}

const javaFiles = walk(GEN_ROOT);
const byClass = new Map();
for (const f of javaFiles) byClass.set(path.basename(f, ".java"), f);

/* ── Registrations: the set of types the generator accepts ────────── */

const managerSrc = fs.readFileSync(ASSET_MANAGER, "utf8");
const registrations = [];
const REGISTER = /([A-Za-z0-9_]+)\.CODEC\.register\(\s*"([^"]+)"\s*,\s*([A-Za-z0-9_]+)\.class/g;
for (const m of managerSrc.matchAll(REGISTER)) {
  registrations.push({
    category: m[1].replace(/Asset$/, ""),
    type: m[2],
    assetClass: m[3],
  });
}

/* ── Field extraction ─────────────────────────────────────────────── */

/** `Codec.DOUBLE` / an ArrayCodec / another asset's CODEC → a schema type. */
function codecToType(codecExpr) {
  const e = codecExpr.replace(/\s+/g, " ").trim();
  const prim = /^Codec\.(STRING|DOUBLE|INTEGER|BOOLEAN|FLOAT)$/.exec(e);
  if (prim) {
    return {
      STRING: "string",
      DOUBLE: "number",
      INTEGER: "integer",
      BOOLEAN: "boolean",
      FLOAT: "number",
    }[prim[1]];
  }
  // A few classes use BuilderCodec's re-exported primitives instead of Codec's.
  const builderPrim = /^BuilderCodec\.(STRING|DOUBLE|INTEGER|BOOLEAN|FLOAT)$/.exec(e);
  if (builderPrim) {
    return {
      STRING: "string",
      DOUBLE: "number",
      INTEGER: "integer",
      BOOLEAN: "boolean",
      FLOAT: "number",
    }[builderPrim[1]];
  }
  const arrayPrim = /^new ArrayCodec<[^>]*>\(\s*(?:Codec|BuilderCodec)\.(STRING|DOUBLE|INTEGER|BOOLEAN|FLOAT)/.exec(e);
  if (arrayPrim) {
    return {
      STRING: "string[]",
      DOUBLE: "number[]",
      INTEGER: "integer[]",
      BOOLEAN: "boolean[]",
      FLOAT: "number[]",
    }[arrayPrim[1]];
  }
  const arrayEnum = /^new ArrayCodec<[^>]*>\(\s*([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\.CODEC/.exec(e);
  if (arrayEnum) return `enum:${arrayEnum[1]}.${arrayEnum[2]}[]`;
  const array = /^new ArrayCodec<[^>]*>\(\s*([A-Za-z0-9_]+)\.CODEC/.exec(e);
  if (array) return `${array[1].replace(/Asset$/, "")}[]`;
  const ref = /^([A-Za-z0-9_]+)\.CODEC$/.exec(e);
  if (ref) return ref[1].replace(/Asset$/, "").replace(/Util$/, "");
  // `new EnumCodec<>(NodesEdgeSelector.Operator.class)` — keep the whole path,
  // since the leading segment alone names the declaring class, not the enum.
  const enumCodec = /^new EnumCodec<[^>]*>\(\s*([A-Za-z0-9_.]+)\.class/.exec(e);
  if (enumCodec) return `enum:${enumCodec[1]}`;
  // Colours are serialised by the shared protocol codec, not a generator one.
  if (e === "ProtocolCodecs.COLOR") return "color";
  // A nested enum's own codec, e.g. `TrigDensity.Function.CODEC` or
  // `FastNoiseLite.CellularReturnType.CODEC`.
  const nested = /^([A-Za-z0-9_]+)\.([A-Za-z0-9_]+)\.CODEC$/.exec(e);
  if (nested) return `enum:${nested[1]}.${nested[2]}`;
  return "unknown";
}

/**
 * Constants of a nested enum, so the editor can offer a dropdown instead of a
 * free-text field. Returns null when the enum cannot be located, which is
 * reported rather than guessed at.
 */
function enumConstants(ref) {
  const clean = ref.replace(/\[\]$/, "");
  const parts = clean.split(".");
  // `Outer.Inner` for a nested enum; a bare name for a top-level one, whose
  // declaring file is named after the enum itself.
  const [outer, inner] = parts.length === 2 ? parts : [clean, clean];
  const file = byClass.get(outer);
  if (!file) return null;
  const src = fs.readFileSync(file, "utf8");
  const decl = new RegExp(`enum\\s+${inner}\\b[^{]*\\{([\\s\\S]*?)(?:;|\\n\\s*\\})`);
  const body = decl.exec(src)?.[1];
  if (!body) return null;
  const names = [];
  for (const m of body.matchAll(/^\s*([A-Z][A-Za-z0-9_]*)\s*(?:\(|,|$)/gm)) names.push(m[1]);
  return names.length ? [...new Set(names)] : null;
}

/** Literal Java initialiser → a JSON default, or undefined when not literal. */
function parseDefault(expr) {
  if (expr == null) return undefined;
  const v = expr.trim().replace(/[dDfFlL]$/, "");
  if (v === "true" || v === "false") return v === "true";
  if (/^-?\d+(\.\d+)?([eE]-?\d+)?$/.test(v)) return Number(v);
  const str = /^"([^"]*)"$/.exec(v);
  if (str) return str[1];
  if (v === "null") return null;
  return undefined;
}

/**
 * Balanced-paren scan for `new KeyedCodec<>( … )`, so a codec argument that
 * itself contains commas and parens (ArrayCodec, EnumCodec) is not split.
 */
function keyedCodecs(src) {
  const out = [];
  const MARK = "new KeyedCodec<>(";
  let i = 0;
  while ((i = src.indexOf(MARK, i)) !== -1) {
    let depth = 1;
    let j = i + MARK.length;
    const start = j;
    while (j < src.length && depth > 0) {
      if (src[j] === "(") depth++;
      else if (src[j] === ")") depth--;
      j++;
    }
    const inner = src.slice(start, j - 1);
    // Split on top-level commas only.
    const parts = [];
    let d = 0, last = 0, inStr = false;
    for (let k = 0; k < inner.length; k++) {
      const c = inner[k];
      if (c === '"' && inner[k - 1] !== "\\") inStr = !inStr;
      if (inStr) continue;
      if (c === "(" || c === "<") d++;
      else if (c === ")" || c === ">") d--;
      else if (c === "," && d === 0) { parts.push(inner.slice(last, k)); last = k + 1; }
    }
    parts.push(inner.slice(last));

    const name = /^\s*"([^"]+)"\s*$/.exec(parts[0])?.[1];
    if (name && parts.length >= 2) {
      // The setter lambda right after the codec names the Java field.
      const after = src.slice(j, j + 240);
      const field = /asset\.([A-Za-z0-9_]+)\s*=/.exec(after)?.[1];
      out.push({
        name,
        type: codecToType(parts[1]),
        required: /^\s*true\s*$/.test(parts[2] ?? ""),
        javaField: field,
      });
    }
    i = j;
  }
  return out;
}

/** `private double wallA = -1;` → { wallA: -1 } */
function fieldDefaults(src) {
  const out = {};
  const DECL =
    /(?:private|protected|public)\s+(?:final\s+)?[A-Za-z0-9_<>,\[\]. ]+?\s+([A-Za-z0-9_]+)\s*=\s*([^;]+);/g;
  for (const m of src.matchAll(DECL)) {
    const d = parseDefault(m[2]);
    if (d !== undefined) out[m[1]] = d;
  }
  return out;
}

/** Own fields plus everything inherited via the ABSTRACT_CODEC chain. */
function collectFields(className, seen = new Set()) {
  if (seen.has(className)) return [];
  seen.add(className);
  const file = byClass.get(className);
  if (!file) return [];
  const src = fs.readFileSync(file, "utf8");

  const parents = [];
  for (const m of src.matchAll(/([A-Za-z0-9_]+)\.ABSTRACT_CODEC/g)) {
    if (m[1] !== className) parents.push(m[1]);
  }
  const inherited = parents.flatMap((p) => collectFields(p, seen));

  const defaults = fieldDefaults(src);
  const own = keyedCodecs(src).map((f) => {
    const out = { name: f.name, type: f.type, required: f.required };
    if (f.type.startsWith("enum:")) {
      const values = enumConstants(f.type.slice(5));
      if (values) out.enum = values;
    }
    if (f.javaField && defaults[f.javaField] !== undefined) out.default = defaults[f.javaField];
    return out;
  });

  // Own fields win over an inherited field of the same name.
  const ownNames = new Set(own.map((f) => f.name));
  return [...inherited.filter((f) => !ownNames.has(f.name)), ...own];
}

/* ── Emit ─────────────────────────────────────────────────────────── */

const bundleSourceNote = "HytaleServer/builtin/HytaleGenerator AssetManager.java";

const types = {};
let unresolved = 0;
for (const r of registrations) {
  const key = `${r.category}:${r.type}`;
  if (!byClass.has(r.assetClass)) unresolved++;
  types[key] = {
    category: r.category,
    type: r.type,
    assetClass: r.assetClass,
    fields: collectFields(r.assetClass),
  };
}

const byCategory = {};
for (const t of Object.values(types)) {
  (byCategory[t.category] ??= []).push(t.type);
}
for (const k of Object.keys(byCategory)) byCategory[k].sort();

/* ── Editor node definitions for types the curated bundle lacks ───── */

/**
 * Registry category → the bundle/AssetCategory name the editor uses. Only one
 * differs; the rest are identical, and are listed so that a category appearing
 * in a future release fails loudly here instead of being silently dropped.
 */
const REGISTRY_TO_EDITOR_CATEGORY = {
  Assignments: "Assignment",
  ContentPredicate: "BlockMask",
  Density: "Density",
  Curve: "Curve",
  MaterialProvider: "MaterialProvider",
  Pattern: "Pattern",
  PositionProvider: "PositionProvider",
  Prop: "Prop",
  Scanner: "Scanner",
  VectorProvider: "VectorProvider",
  EnvironmentProvider: "EnvironmentProvider",
  TintProvider: "TintProvider",
  Directionality: "Directionality",
  Layer: "Layer",
  Condition: "Condition",
  PropDistribution: "PropDistribution",
  PointGenerator: "PointGenerator",
  Terrain: "Terrain",
  Framework: "Framework",
  WorldStructure: "WorldStructure",
  Noise: "Noise",
  NodeAction: "NodeAction",
  NodeSelector: "NodeSelector",
  EdgeAction: "EdgeAction",
  EdgeSelector: "EdgeSelector",
  GraphPass: "GraphPass",
  ReturnType: "ReturnType",
  ContentSupplier: "ContentSupplier",
  DistanceFunction: "DistanceFunction",
};

/** Editor key form: Density uses bare names, every other category is prefixed. */
function editorKey(category, type) {
  return category === "Density" ? type : `${category}:${type}`;
}

/**
 * A field becomes an input port only when its codec points at a *registered*
 * category — something the user can actually build a node of. `Density[]` and
 * `Density` both connect to a Density output; the array-ness only affects how
 * many edges the port accepts.
 *
 * Everything else stays a field, even though it is also an asset: `Vector3d`
 * and `RangeDouble` are value structs, and `BlockMask` / `Material` are named
 * assets referenced by name rather than wired up. Offering a port for a
 * category with no registered types would be a handle nothing can connect to.
 */
function referencedCategory(fieldType) {
  const base = fieldType.replace(/\[\]$/, "");
  if (base.startsWith("enum:")) return null;
  if (["number", "integer", "string", "boolean", "color"].includes(base)) return null;
  return REGISTRY_TO_EDITOR_CATEGORY[base] ?? null;
}

/** Registry field type → the vocabulary the editor's field renderer expects. */
function editorFieldType(fieldType) {
  if (fieldType.startsWith("enum:")) return "enum";
  if (fieldType.endsWith("[]")) return "array";
  return fieldType;
}

function toEditorNode(t) {
  const category = REGISTRY_TO_EDITOR_CATEGORY[t.category];
  if (!category) return null;

  const fields = {};
  const inputs = [];
  for (const f of t.fields) {
    // Never a user-visible field: ExportAs is editor plumbing and Skip has its
    // own control, matching how the curated entries treat them.
    if (f.name === "ExportAs" || f.name === "Skip") continue;
    const ref = referencedCategory(f.type);
    if (ref) {
      inputs.push({ id: f.name, handleType: ref, label: f.name });
      continue;
    }
    const def = { type: editorFieldType(f.type), required: f.required };
    if (f.default !== undefined) def.default = f.default;
    // A Java array field has no literal initialiser to read, but its empty
    // value is not in doubt. Seeding it keeps the field visible in the editor
    // instead of the node appearing to have no such field at all.
    else if (f.type.endsWith("[]")) def.default = [];
    if (f.enum) def.enum = f.enum;
    fields[f.name] = def;
  }

  return {
    nodeType: t.type,
    displayName: t.type,
    category,
    subcategory: "",
    // Left empty rather than invented: the codec carries no prose, and a made-up
    // sentence in the palette is worse than none.
    description: "",
    fields,
    inputs,
    outputs: [{ id: "output", handleType: category, label: "output" }],
    /** Marks these as codec-derived, so curated entries can take precedence. */
    derivedFrom: t.assetClass,
  };
}

const editorNodes = {};
const skippedCategories = new Set();
for (const t of Object.values(types)) {
  const node = toEditorNode(t);
  if (!node) { skippedCategories.add(t.category); continue; }
  editorNodes[editorKey(node.category, t.type)] = node;
}

fs.writeFileSync(
  outPath.replace(/\.json$/, "-nodes.json"),
  JSON.stringify(
    {
      format: "hytale-registry-nodes@1",
      source: bundleSourceNote,
      nodes: Object.fromEntries(Object.keys(editorNodes).sort().map((k) => [k, editorNodes[k]])),
    },
    null,
    1,
  ) + "\n",
);

const bundle = {
  format: "hytale-registry@1",
  // Not a build date: this file is a function of the source it was read from,
  // so a timestamp would only make the output churn between runs.
  source: bundleSourceNote,
  categories: Object.keys(byCategory).sort(),
  typesByCategory: byCategory,
  types: Object.fromEntries(Object.keys(types).sort().map((k) => [k, types[k]])),
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(bundle, null, 1) + "\n");

const fieldCount = Object.values(types).reduce((n, t) => n + t.fields.length, 0);
const unknownFields = Object.values(types)
  .flatMap((t) => t.fields)
  .filter((f) => f.type === "unknown").length;

console.log(`${Object.keys(types).length} types across ${bundle.categories.length} categories`);
console.log(`${fieldCount} fields (${unknownFields} of unrecognised codec type)`);
if (unresolved) console.log(`${unresolved} registrations had no asset class on disk`);
console.log(`wrote ${outPath}`);
console.log(
  `${Object.keys(editorNodes).length} editor node definitions -> ${outPath.replace(/\.json$/, "-nodes.json")}`,
);
if (skippedCategories.size) {
  console.log(`categories with no editor mapping: ${[...skippedCategories].join(", ")}`);
}
