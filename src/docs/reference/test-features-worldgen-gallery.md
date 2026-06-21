# Test_Features Worldgen Gallery

**Difficulty:** Reference

Shipped in release **Assets.zip** as Hytale's in-game worldgen QA museum — a teleportable instance with **56 isolated density demos** arranged on a ground grid. Use it for **ground-truth node behavior** (in-game + Bridge World preview) alongside TerraNova's shape-preview gallery.

> **Patchline:** Paths below are **release** (`pnpm sync:hytale` → `templates/hytale-release/`). Pre-release uses isolated saves/mods.

---

## Asset paths

| Asset | Path |
|-------|------|
| Instance | `Server/Instances/Test_Features/instance.bson` |
| World structure | `Server/HytaleGenerator/WorldStructures/Test_Features.json` |
| Biome (gallery) | `Server/HytaleGenerator/Biomes/Test_Features.json` |

**In-game:** `/instance` → **Test Features** (or join from a save that already spawned the instance). Spawns at **Y ≈ 200**; fly down to the patch grid near **Y ≈ 100**.

**Quirk:** biome JSON internal `"Name"` is `"Basic"` — Hytale resolves by **filename** (`Test_Features.json`), not the embedded name.

---

## World layout

```text
                    Z increases (north)
                         ↑
    ┌────────────────────────────────────────┐
    │  PCN return-type rows (Z 300…1500)      │  ← CellValue, Density, Curve,
    │  on TriangularGrid2d / SquareGrid2d/3d │    Distance, Distance2*, etc.
    ├────────────────────────────────────────┤
    │  Noise + CellNoise rows (Z 0…300)      │  ← SimplexNoise2D/3D, CellNoise2D/3D
    ├────────────────────────────────────────┤
    │  SDF primitive row (Z −300…−900)        │  ← Cube, Cuboid, Ellipsoid, Cylinder
    └────────────────────────────────────────┘
         X = 0    150    300    450  →
```

- **Patch spacing:** ~150 blocks on X and Z.
- **Patch radius:** `PositionsCellNoise` `MaxDistance: 50` (100-block diameter disks).
- **Terrain anchor:** world structure `Framework` sets `Base=100`, `Water=100`, `Bedrock=0`.
- **Biome routing:** `NoiseRange` uses a PCN gate at `(0,0,−150)` so the gallery sits in the center biome band (`Test_Features` noise 0…2); outer rings are `Void_Buffer` and `Basic`.

---

## The isolation recipe (copy this)

Every gallery patch reuses the same **side-by-side demo** pattern:

1. **`Max` root** with one input per patch (56 inputs) — patches never overwrite each other.
2. **`PositionsCellNoise`** with **`List`** containing one anchor point `(X, 100, Z)`.
3. **`ReturnType: Curve`** step gate at distance 50 → `50:0, 50.1:1` — sharp circular boundary.
4. **`YOverride: 0`** on the feature branch — evaluates as a **horizontal slice** at ground level (standard for height-field debugging).
5. **`Mix` / `Sum`** with **`CurveMapper` + `BaseHeight`** (`Distance: true`) — blends feature into flat terrain at Y=100.

For full 3D SDF demos (negative Z row), the patch uses **`ReturnType: Density`** with an **`Anchor`** (and often **`Rotator`** or **`Scale`**) wrapping the shape node instead of the flat Mix/BaseHeight stack.

---

## What each zone looks like

### PCN return-type rows (Z 300 … 1500)

Each disk shows **one PositionsCellNoise `ReturnType`** on a repeating grid (`Jitter2d` → `Scaler` → grid). Compare disks to see how the same cell layout changes when the return mode changes.

| ReturnType | Visual read | Use when |
|------------|-------------|----------|
| **CellValue** | Per-cell interior filled with `SimplexNoise2D` (or 3D on `SquareGrid3d`) — **blobby cells** with noisy interiors | Organic cell interiors, mesh sampling (`Generative_Arches` family) |
| **Density** | Smooth density from noise **inside** each cell — softer fills than CellValue | Carve seeds, prop gates, shared paint fields (DFS trails pattern) |
| **Curve** | Distance-to-wall run through a **Manual curve** — banded rings or sharp transitions | Controlled falloff from cell walls |
| **Distance** | Raw **Euclidean distance** to nearest wall — concentric rings fading outward | Simple edge falloff, path corridors |
| **Distance2** | **Squared** distance — steeper, more concentrated near walls | Tighter edge weighting |
| **Distance2Add** | `Distance2 + curve` combo — broader blended zones | Softer additive edge blends |
| **Distance2Sub** | Subtractive squared-distance shaping — **inverted** or hollow reads | Trenches, recessed cell interiors |
| **Distance2Mul** | Multiplicative — **sharpens** cell features | Stronger cell emphasis |
| **Distance2Div** | Divisive — **flattens** variation between cells | Smoother inter-cell blending |

**Column differences (same row, different grid):**

| X column | Grid | Extra stack |
|----------|------|-------------|
| **450** | `TriangularGrid2d` | `Sum` + `BaseHeight`/`CurveMapper` on every patch |
| **300** | `SquareGrid3d` | Often `Normalizer`; 3D noise inside cells |
| **150** | `SquareGrid2d` | `Sum` + `Normalizer` + `BaseHeight` |
| **0** | `SquareGrid2d` | Mixed — some patches omit `BaseHeight` for rawer reads |

### Noise + CellNoise rows (Z 0 … 300)

| Demo | Patches (approx.) | Visual read |
|------|-------------------|-------------|
| **SimplexNoise2D** + PCN disk | Z=0, X=0/150 | Rolling 2D noise masked to one circular plot |
| **SimplexNoise3D** + PCN disk | Z=0, X=300 | 3D noise slice through a disk — more variation with Y |
| **CellNoise2D** + PCN | Z=150, X=150/0 | **Voronoi walls** inside the disk (fine cell boundaries) |
| **CellNoise3D** + PCN | Z=150, X=300 | 3D cell structure sliced at Y override |

### SDF primitive row (Z −300 … −900)

Four shape types × three anchor styles — solid **geometric primitives** punched into the flat plane.

| Shape | Visual read |
|-------|-------------|
| **Cube** | Axis-aligned box SDF |
| **Cuboid** | Rectangular box (non-cube proportions) |
| **Ellipsoid** | Smooth oval / egg solid |
| **Cylinder** | Round column |

| X column | Wiring | Effect |
|----------|--------|--------|
| **300** | `Anchor` + **`Rotator`** (45° spin) | Tilted primitives |
| **150** | `Anchor` + **`Scale`** | Stretched / scaled primitives |
| **0** | `Anchor` only | Default orientation/size |

Patches at **(150,−600)** and **(0,−600)** demo **`Distance`** inside `Anchor` — raw distance-field read rather than a named SDF shape.

---

## Full patch catalog (56)

Coordinates are patch centers `(X, Z)` at terrain Y≈100. **Row** follows Z; **column** follows X.

| # | X | Z | Label |
|---|---|---|-------|
| 1 | 450 | 1500 | PCN CellValue — TriangularGrid2d |
| 2 | 450 | 1350 | PCN Density (SimplexNoise2D) — TriangularGrid2d |
| 3 | 450 | 900 | PCN Distance2 — TriangularGrid2d |
| 4 | 450 | 1050 | PCN Distance — TriangularGrid2d |
| 5 | 450 | 1200 | PCN Curve — TriangularGrid2d |
| 6 | 450 | 750 | PCN Distance2Add — TriangularGrid2d |
| 7 | 450 | 600 | PCN Distance2Sub — TriangularGrid2d |
| 8 | 450 | 450 | PCN Distance2Mul — TriangularGrid2d |
| 9 | 450 | 300 | PCN Distance2Div — TriangularGrid2d |
| 10 | 300 | 1500 | PCN CellValue — SquareGrid3d |
| 11 | 300 | 900 | PCN Distance2 — SquareGrid3d |
| 12 | 300 | 750 | PCN Distance2Add — SquareGrid3d |
| 13 | 300 | 1200 | PCN Curve — SquareGrid3d |
| 14 | 300 | 1350 | PCN Density (SimplexNoise3D) — SquareGrid3d |
| 15 | 300 | 1050 | PCN Distance — SquareGrid3d |
| 16 | 300 | 600 | PCN Distance2Sub — SquareGrid3d |
| 17 | 300 | 450 | PCN Distance2Mul — SquareGrid3d |
| 18 | 300 | 0 | SimplexNoise3D field |
| 19 | 300 | 150 | CellNoise3D + PCN |
| 20 | 300 | 300 | PCN Distance2Div — SquareGrid3d |
| 21 | 300 | −300 | SDF Cube (Rotator) |
| 22 | 300 | −450 | SDF Cuboid (Rotator) |
| 23 | 300 | −750 | SDF Ellipsoid (Rotator) |
| 24 | 300 | −900 | SDF Cylinder (Rotator) |
| 25 | 150 | 1500 | PCN CellValue — SquareGrid2d |
| 26 | 150 | 1350 | PCN Density (SimplexNoise2D) — SquareGrid2d |
| 27 | 150 | 1200 | PCN Curve — SquareGrid2d |
| 28 | 150 | 1050 | PCN Distance — SquareGrid2d |
| 29 | 150 | 600 | PCN Distance2Sub — SquareGrid2d |
| 30 | 150 | 900 | PCN Distance2 — SquareGrid2d |
| 31 | 150 | 450 | PCN Distance2Mul — SquareGrid2d |
| 32 | 150 | 150 | CellNoise2D + PCN |
| 33 | 150 | 750 | PCN Distance2Add — SquareGrid2d |
| 34 | 150 | 300 | PCN Distance2Div — SquareGrid2d |
| 35 | 150 | 0 | SimplexNoise2D + BaseHeight |
| 36 | 150 | −900 | SDF Cylinder (Scale) |
| 37 | 150 | −750 | SDF Ellipsoid (Scale) |
| 38 | 150 | −600 | Distance field (Scale) |
| 39 | 150 | −450 | SDF Cuboid (Scale) |
| 40 | 150 | −300 | SDF Cube (Scale) |
| 41 | 0 | 0 | SimplexNoise2D + PCN |
| 42 | 0 | 150 | CellNoise2D + PCN |
| 43 | 0 | 600 | PCN Distance2Sub — SquareGrid2d |
| 44 | 0 | 450 | PCN Distance2Mul — SquareGrid2d |
| 45 | 0 | 1200 | PCN Curve — SquareGrid2d |
| 46 | 0 | 1050 | PCN Distance — SquareGrid2d |
| 47 | 0 | 300 | PCN Distance2Div — SquareGrid2d |
| 48 | 0 | −900 | SDF Cylinder |
| 49 | 0 | 900 | PCN Distance2 — SquareGrid2d |
| 50 | 0 | 750 | PCN Distance2Add — SquareGrid2d |
| 51 | 0 | 1350 | PCN Density (SimplexNoise2D) — SquareGrid2d |
| 52 | 0 | 1500 | PCN CellValue — SquareGrid2d |
| 53 | 0 | −750 | SDF Ellipsoid |
| 54 | 0 | −600 | Distance field |
| 55 | 0 | −450 | SDF Cuboid |
| 56 | 0 | −300 | SDF Cube |

---

## What to take into TerraNova work

### High-value patterns

| Pattern | Where in gallery | TerraNova use |
|---------|------------------|---------------|
| **PCN patch isolation** | All 56 patches | Debug one node family in 2D/voxel without graph surgery — copy one `Max` input branch |
| **ReturnType picker** | Z 300…1500 rows | Choose `CellValue` vs `Density` vs `Distance2*` for props, paths, and mesh chains |
| **Grid + Jitter2d** | X 450/300/150 columns | Repeating features with controlled spacing (`TriangularGrid2d` vs `SquareGrid2d`) |
| **Normalizer on PCN output** | X 300/150/0 on several rows | Remap cell distances before `CurveMapper` — common in release biomes |
| **BaseHeight + CurveMapper** | X 450/150 positive-Z rows | Flat terrain anchor + height remap (see [CurveMapper conventions](./hytale-curvemapper-conventions.md)) |
| **SDF + Anchor + Rotator** | Z −300…−900 | Local shapes (tunnels, pillars, voids) positioned in world space |
| **YOverride slice** | Every patch | Explains why TerraNova 2D preview is uniform at one Y for height-only graphs |

### Not worth copying wholesale

- **56-way `Max` combiner** — QA layout only; production biomes merge fewer branches.
- **Empty props / constant materials** — gallery uses `Rock_Stone` + `Empty` only; no material or prop lessons.
- **Instance-first `NoiseRange`** — routing gate is for the museum, not survival overworld design (same category as [Skyreach / DFS](./community-pack-references.md)).

### Study order in TerraNova

1. **DEV gallery UAT** — `/?shape-preview-gallery=1&case=hytale-test-features&patch=32` (pick any patch 1–56; omit `patch` for Max overview). Requires `pnpm sync:hytale` first.
2. **In-game flythrough** at Y≈100 — walk rows by Z, compare disks in one row.
3. **Import** `Test_Features.json` after sync — inspect one patch branch per question.
4. **Bridge World preview** while standing on a patch — validate TerraNova eval vs saved chunks.
5. **Cross-check** smaller shipped examples: `Examples/Example_CellNoise2D.json`, `Generative/Generative_Arches.json`.

---

## Related docs

- [Community Pack Study References](./community-pack-references.md) — Skyreach, DFS (production-adjacent patterns)
- [Node Effects](./node-effects.md) — preview mode per node family
- [Worldgen References + Live Preview](./worldgen-references-live-preview.md) — insertable TerraNova starter blocks
- [Bridge](./bridge.md) — World preview from saved instance chunks
