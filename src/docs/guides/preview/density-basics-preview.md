# Density Basics Preview

**Difficulty:** Beginner

Learn how TerraNova previews **density combinator** nodes (`Sum`, `Min`, `Max`, `Multiplier`, `Pow`) with **2D and 3D noise** — using tools that already exist in the preview panel.

---

## Quick start

1. Open **Node Palette** or **Quick Add** (`Q`) → category **Density basics**.
2. Insert a teaching snippet (e.g. **Sum (height + 3D noise)**).
3. Preview target is set automatically; **3D cases switch to Voxel once** per graph.
4. Wire the snippet output to **Terrain Out** when you are ready to export.

Gallery UAT (dev server): `/?shape-preview-gallery=1&case=density-noise-3d`

---

## Preview density as (combinators)

When you select a **Sum**, **Min**, **Max**, **Multiplier**, or **Pow** node, the property panel shows **Preview density as**:

| Option | What you see |
|--------|----------------|
| **Result** | The combinator output (e.g. Sum of both branches) |
| **Input 1 / Input 2** | Each wired density field on its own |

This is the fastest way to answer “what does each branch contribute?” before looking at the combined result.

Optional **Compare** buttons open side-by-side 2D slices:

- **Input vs result** — one input next to the combinator output
- **Both inputs** — the two branches before Max/Sum (when both are wired)

For volumetric (3D noise) graphs, switch to **Voxel** after picking a preview target.

---

## Preview target (manual)

| Control | Location |
|---------|----------|
| **Preview target** | Preview settings sidebar → dropdown |
| **Sync from graph** | Select a density node on the canvas |

Set the target to the combinator you are studying (`Sum`, `Min`, `Pow`, …) to see its output directly.

---

## 2D vs Voxel

| Graph type | Best mode | Why |
|------------|-----------|-----|
| `SimplexNoise2D`, `Max`, `Mul`, `Pow` on 2D noise | **2D** | Pattern is driven by X/Z |
| `SimplexNoise3D`, `Sum` with 3D noise, `Min` carve | **Voxel** | Field varies with Y |
| Height + 2D noise (`Sum` with `BaseHeight`) | **2D** for hills; **Voxel** for solid/air boundary | 2D shows XZ hills; voxel shows surface volume |

TerraNova **auto-switches to Voxel once** when the preview target subtree includes 3D noise. Switch back to 2D manually — that choice is remembered until you load a new graph or re-enable auto-fit content.

For caves (`Min` + inverted `SimplexNoise3D`): **Voxel** + **Cutaway** — see [Cave Preview](./cave-preview.md).

---

## Compare inputs (2D)

Use **Preview density as** on the combinator (preferred), or the compare buttons at the bottom of that card:

- Opens the **Compare** layout (toolbar layout presets).
- Left pane: first wired input (`Inputs[0]` or `Input`).
- Right pane: the combinator output.

Compare mode evaluates **2D slices only**. For volumetric A/B, switch preview target between nodes in **Voxel** mode.

---

## Teaching snippets

| Snippet | What to look for |
|---------|------------------|
| Noise 2D | Hills on X/Z at any Y slice |
| Noise 3D | Volume changes when scrubbing Y or in Voxel |
| Sum (height + 2D noise) | Hills on a height anchor |
| Sum (height + 3D noise) | Volumetric terrain bumps |
| Min carve (caves) | Voids where inverted 3D noise wins |
| Max (two 2D noises) | Higher of two masks |
| Multiplier (noise × mask) | Amplitude shaping |
| Pow (sharpen noise) | Peaks sharpened, mid-range flattened |

---

## Gallery cases

Dev gallery (`pnpm tauri dev`, port 1420):

| Case | URL suffix |
|------|------------|
| `density-noise-2d` | `&case=density-noise-2d` |
| `density-noise-3d` | `&case=density-noise-3d` |
| `density-sum-2d` | `&case=density-sum-2d` |
| `density-sum-3d` | `&case=density-sum-3d` |
| `density-min-carve` | `&case=density-min-carve` |
| `density-max-2d` | `&case=density-max-2d` |
| `density-mul-2d` | `&case=density-mul-2d` |
| `density-pow-2d` | `&case=density-pow-2d` |

---

## Related

- [Data Flow First Steps](../../walkthroughs/data-flow-first-steps.md)
- [Basic Terrain Generation](../../walkthroughs/basic-terrain-generation.md)
- [2D Preview & Topographic Maps](../terrain/2d-preview-topographic-context.md)
- [Cave Preview](./cave-preview.md)
