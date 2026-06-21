# Cave Preview (2D, 3D, Voxel)

**Difficulty:** Beginner

How to **see** cave carving in TerraNova preview modes. Compositional caves (`SimplexNoise3D` → `Inverter` / `SmoothClamp` → `Min` / `SmoothMin`) are fully supported in the evaluator; legacy terrain nodes use **approximated** handlers (yellow badge).

Plan-view habits live in [2D Preview & Topographic Maps](../terrain/2d-preview-topographic-context.md).

---

## Which mode when

| Goal | Mode | Why |
|------|------|-----|
| Tunnel footprint at one depth | **2D** + **Topo** + low **Y level** | Fast plan map; blue wash = air |
| Wall section through tunnels | **2D** → **Section profile** | Vertical topo-style profile |
| Interior void geometry | **Voxel** + **Cutaway** | Surface voxels include cave walls |
| Quick 3D check without switching tabs | **3D** → **Underground view** | Reuses voxel mesh (capped res) |

**3D heightfield** (default) maps one Y per XZ — it **cannot** show underground voids. Use **Underground view** or **Voxel**.

---

## 2D workflows

### Plan slice (topo)

1. **Topo** on, **Contours** + **Terrain** on.
2. Set **Y level** to the cave band.
3. Shift+drag with **Cross-section plot** enabled for a **Plan profile** along a corridor.

### Vertical section

1. Settings → **Cross-section plot** → **Section profile (vertical wall through caves)**.
2. Shift+drag on the heatmap.
3. Read the section plot: **Y** = elevation, blue = air, brown **d = 0** line = solid/air boundary.

---

## Voxel workflows

1. Switch preview to **Voxel**.
2. Enable **Cutaway (hide above Y)** and set **Cutaway Y** below the ceiling (or **Sync cutaway to 2D Y level**).
3. Use **Auto-fit Y range** — graphs with `Min` + `SimplexNoise3D` / `Inverter` branches get a deeper default Y span.

Interior cave walls render via `extractSurfaceVoxels` (density ≥ 0 adjacent to air). Void voxels are invisible (correct).

---

## 3D underground view

1. Stay in **3D** mode; enable **Underground view (volume mesh)** in settings.
2. Share **Cutaway** controls with voxel mode.
3. Expect lower mesh resolution (cap 64) for interactive framerate.

---

## Preview mode matrix

| Feature | 2D topo | 2D section | 3D heightfield | 3D underground | Voxel |
|---------|---------|------------|----------------|----------------|-------|
| Cave plan footprint | ✓ | — | — | — | ✓ (slice) |
| Vertical void band | — | ✓ | — | ✓ | ✓ |
| Interior walls | — | approx | — | ✓ | ✓ |
| Cutaway | — | — | — | ✓ | ✓ |
| Material colors | — | — | ✓ | ✓ | ✓ |

---

## Density node preview coverage

| Status | Meaning | Examples |
|--------|---------|----------|
| **Full** | Handler matches intent closely | `SimplexNoise3D`, `Min`, `Sum`, `BaseHeight` |
| **Remapping** | No meaningful standalone heatmap — edit curve / preview downstream | `CurveMapper`, `SplineFunction`, passthrough/cache nodes |
| **Approximated** | Preview stand-in; yellow badge | `Terrain`, `TerrainBoolean`, `Pipeline`, `CaveDensity`, `DistanceToBiomeEdge`, … |
| **Context-dependent** | Needs upstream wiring | `CellWallDistance` (cell noise ancestor), `Imported` (resolve `ExportAs` / inline `Input`) |
| **Unsupported** | Returns 0 | *(none in current bundle — audit via `densityHandlerCoverage.test.ts`)* |

Legacy **CaveDensity** uses a noise-carve approximation; prefer compositional `Min` + inverted 3D noise for authoring.

---

## Further reading

- [Density Basics Preview](./density-basics-preview.md) — **Min carve** teaching snippet and preview target workflow.
- [Terrain and Caves walkthrough](../../walkthroughs/terrain-and-caves.md) — graph recipes.
- [Expert Terrain Techniques](../terrain/terrain-types-expert.md) — preview vs runtime gaps.
- [Materials Guide](../content/materials-guide.md) — cave floor/ceiling materials (multi-void columns still limited).
