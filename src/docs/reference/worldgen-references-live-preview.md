# Worldgen References + Live Preview

Use this page for the new custom block flow:

- insert reusable **Worldgen References** blocks,
- edit selected node properties,
- watch preview update immediately.

## What "Worldgen References" are

`Worldgen References` are curated template blocks (macros) built from normal TerraNova nodes.

- They are not special runtime node types.
- Insertion expands into regular nodes + edges on the canvas.
- Every inserted node gets editor-only attribution metadata (`_snippetMeta`) so you can track origin.

Current starter set includes **Desert River Carve**, **Skyreach Ravine 3D Carve**, and **Sky Island Altitude Band**.

### Skyreach Ravine 3D Carve (community source)

Derived from **Skyreach Ravines** v3.6 (Breadley) — a single-biome ravine showcase, not an overworld survival graph. The full pack adds patterns this block does not include:

- **`YSampled` + `Cache` exports** with **`Pow` (exponent 3)** for sharp rib walls (see McCal.Crownlands alignment)
- **Height-delimited `EnvironmentProvider`** — `DensityDelimited` + `CurveMapper` on `BaseHeight` distance (~Y 80–300)
- **Instance-first** `NoiseRange` world structure with spawns at ~Y 200

Use the inserted block as a carve **starter**; study the source biome for silhouette and atmosphere. See [Community Pack Study References](./community-pack-references.md).

## How to use

1. Open Quick Add (`Tab` / `Shift+A`) or Node Palette.
2. Pick a block under **Worldgen References**.
3. Insert it at the cursor/canvas location.
4. Tune the inserted nodes in Properties.

## Live preview behavior

When **Live preview** is enabled in the Properties panel:

- selected-node field edits trigger near-instant refresh,
- updates are debounced for heavy graphs,
- auto-fit protections remain active (Base Y + profile-zero safeguards).

If Live preview is disabled, edits still apply normally; preview refresh can be triggered manually.

## Good usage pattern

- Start from a reference block for structure.
- Rename key nodes so intent stays readable.
- Keep only branches you need; delete extra shaping nodes.
- Validate in 2D + voxel views when carving caves/ravines.

## Related docs

- [Community Pack Study References](./community-pack-references.md) — Skyreach + DFS audit notes and file study order
- [Custom Worldgen Block Promotion Path](./custom-worldgen-block-promotion.md)
- [Terrain Snippets](./terrain-types.md)
- [Node Effects](./node-effects.md)

