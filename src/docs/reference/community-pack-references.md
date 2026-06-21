# Community Pack Study References

**Difficulty:** Reference

Curated notes from audited **community worldgen packs** — what each teaches, which files to open first, and how they map to TerraNova work (including McCal save mods). Use these alongside release assets (`pnpm sync:hytale` → `templates/hytale-release/`) and in-repo templates under `templates/references/`.

> **Patchline:** Examples below target the **release** line (`ServerVersion` 0.5.x era unless noted). Pre-release (Update 6) uses isolated saves/mods — verify paths separately if you test on pre-release.

---

## Quick comparison

| Pack | Author | Version | Category | Best for |
|------|--------|---------|----------|----------|
| **Test_Features** | Hytale (shipped) | release Assets.zip | In-game worldgen node gallery (56 patches) | PCN `ReturnType` comparison, SDF primitives, patch-isolation recipe |
| **Skyreach Ravines** | Breadley | 3.6.0 | Single-biome ravine / sky-island showcase | Cliff silhouette, Y-banded fog, Pow-sharpened rib walls |
| **Dragon's Fantasy Scenes (DFS)** | Dragonstone (draakkin) | 1.3.0 | Multi-landscape cinematic instance pack | Path paint from shared density, variant matrix, weather + particles |

| Your project | Skyreach | DFS |
|--------------|----------|-----|
| **McCal.Crownlands** | Primary reference — ribs (Pow 3, YSampled stacks) | Less relevant (low-drama hills + set dressing) |
| **McCal.Autmn Forest** | Ridge crest silhouette (level-design pass) | **Autumn Trails** — path `FieldFunction`, dual env (ground / Y160), weather-heavy variants |

---

## Test_Features (Hytale shipped gallery)

**Role:** In-game **node behavior museum** — 56 circular patches on a grid, not a production biome.

**Full catalog:** [Test_Features Worldgen Gallery](./test-features-worldgen-gallery.md) (all 56 patches, coordinates, visual reads, isolation recipe).

**Best for:** Choosing a PCN `ReturnType`, comparing `TriangularGrid2d` vs `SquareGrid2d`, SDF `Anchor`/`Rotator` wiring, and validating TerraNova preview against Bridge World chunks.

---

## Skyreach Ravines (Breadley 3.6.0)

**Role:** Single-biome ravine and sky-island showcase. **Instance-first** delivery — not an infinite survival overworld graph.

**TerraNova tie-in:** The **Skyreach Ravine 3D Carve** block under **Worldgen References** is a simplified carve branch derived from this pack. See [Worldgen References + Live Preview](./worldgen-references-live-preview.md).

### Worldgen patterns

| Pattern | What to look for |
|---------|------------------|
| **Vertical ravine read** | Deep `YSampled` stacks with `Cache` exports (`biome20fulldensity`, `biome20roots`), `Mix` / `Min` / `Max` cuts, **`Pow` exponent 3** on noise for sharp rib walls — the canonical “hooked cliff” pattern Crownlands v0.3.8 aligned to |
| **Height-delimited atmosphere** | `EnvironmentProvider` is `DensityDelimited` with `CurveMapper` on `BaseHeight` distance, switching env bands around **Y ≈ 80–300** (ravine floor vs rim vs sky) |
| **Instance-first delivery** | `NoiseRange` world structure with a fixed spawn list at **Y ≈ 200**, not procedural overworld routing — good for demo biomes, not infinite survival terrain |
| **Props on sky structures** | Many `WeightedPrefabPaths` toward `skylandsstrucutrespath/*` prefabs (arenas, large platforms) — terrain teaches ravines; prefabs teach floating landmark pacing |

### Beyond worldgen

- `PortalTypes/SkyreachRavines.json` — portal metadata, spawn return portal, void invasion flag
- Custom weather (`Biome1Weather.json`)
- ~294 server files; manifest pins **ServerVersion 0.5.0** (release-era)

### Takeaway

Use Skyreach for **cliff silhouette**, **Y-banded fog/mood**, and **Pow-sharpened ribs** — not for overworld biome graphs or path/stream geology.

### Study order

1. **`Biome20BiomeAsset.json`** — terrain `Cache` / `YSampled` / `Pow` chain
2. Same file — `EnvironmentProvider` height curve (~line 5184 in the Desktop copy)

---

## Dragon's Fantasy Scenes — DFS (Dragonstone 1.3.0)

**Role:** Atmosphere-first **instance landscapes** for VT/TTRPG mood shots — a different product category from survival overworld mods.

**Manifest:** `"ServerVersion": ">=0.5.2 <0.6.0"` (release line).

### Landscapes (6 families + variants)

| Family | Notable variants |
|--------|------------------|
| Autumn Trails | Gloomy, Advanced Weather, No Foliage, No Mountains, … |
| Eclipsed Dunes | Astral, Solar Storm, No Pyramids |
| Cursed Lands | No Buildings |
| Frostfire Ridge | — |
| Forgotten Cliffs | — |
| Midnight Jungle | Cove, Cliffs |
| Experimental Portals Taiga | shore / river / redwood / mountains splits |

**21 pre-baked `instance.bson` scenes** — each variant is a ready `/instance` teleport target with `Time.json`, spawn suppression, etc.

### Worldgen patterns worth studying

#### 1. Variant matrix as separate biomes + world structures

Each mood (Gloomy, Advanced Weather, No Foliage) is its own biome JSON **plus** a matching `NoiseRange` world structure. Same skeleton, swapped env/weather/props — a clean pattern for **one landscape, many camera presets**.

#### 2. Shared carve seed → paint + tint + props

`DFS_Autumn_Trails` exports **`DFS_03_WideAreaDensity`** (wide `Abs(SimplexNoise2D)` at scale 2500–3500). That one field drives:

| Consumer | Mechanism |
|----------|-----------|
| Trail paths in terrain | `CurveMapper` gate at Base+6…7 on narrow noise |
| Path materials | `FieldFunction` on imported density, delimiter ±0.005 → `Soil_Pathway` / `Soil_Dirt_Dry` / `Soil_Mud_Dry` stack |
| Tint provinces | `DensityDelimited` tint: path `#B57F2D`, grass noise bands `#FFD000`, etc. |
| Spawn mesh | `Framework` → `FieldFunction` + `Mesh2D` on the same density |

Paths are **corridors**, not random specks — the “shared carve/paint seed” design bar for McCal.Autmn Forest-style work.

#### 3. Materials stack (community-correct)

Root `MaterialProvider` = **`Solidity` → `Queue` → `FieldFunction` / `SpaceAndDepth`** — not top-level `DensityDelimited`. Path bands use weighted soil mixes, not lone grass blocks. See [Material Providers](../guides/content/materials-guide.md).

#### 4. Props without a separate Assignments folder

Heavy inline **`PropDistribution` `Union`** with nested `FieldFunction` gates and `WeightedPrefabPaths` — same family as CAPZlock-style packs, but entirely inside the biome graph. See [Props and Placement](../guides/content/props-and-placement.md).

#### 5. Dual-height environment

`EnvironmentProvider` splits at **~Y 60** (`BaseHeight` + tight `CurveMapper`): ground env vs `Env_*_Y160` sky layer. Pairs with separate weather JSON for the high layer.

#### 6. Terrain tricks beyond Autumn

**Frostfire_Ridge** uses `SmoothMin`, `Multiplier` plateau noise, exported `PlateauDensity` / crack masks — mesa + fissure reads.

#### 7. World structure spawn recipe

```json
"SpawnPositions": {
  "Type": "Offset",
  "OffsetY": 132,
  "Positions": { "Type": "Imported", "Name": "..._Spawns" }
}
```

`ContentFields` set **Base 200**, **Water 90**, **Cave 80** — high cinematic floor, not low survival Y.

### Beyond worldgen (DFS specialty)

| Layer | What DFS teaches |
|-------|------------------|
| **Weather** | Hour-keyed `SkyTopColors`, moon cycle overrides, particle `SystemId` hooks |
| **Particles** | Custom `.particlesystem` / `.particlespawner` per landscape (cloud layers, fog, storm, sun beams) |
| **Weather spawner items** | Placeable Empty blocks with `Particles: [{ SystemId: ... }]` — invisible cloud/fog/storm emitters for set dressing |
| **Environments** | `WeatherForecasts` per hour slot; day vs night aurora weights |
| **Instances** | Full scene shipping: `bson` + `Time.json` + `SpawnSuppressionController` |
| **Product design** | `/instance` VT tabletop positioning; variant toggles (No Foliage for clean shots) |

### Takeaway

Use DFS for **mood variants**, **path/material/tint from one density export**, and **weather + particle stacks** — not for spire-mountain ribs or survival-height terrain.

### Study order

1. **`DFS_Autumn_Trails.json`** — `DFS_03_WideAreaDensity` export
2. Same file — materials (~line 544) → tint (~line 2635) → env split (~line 2578)
3. **Advanced Weather variant** — weather JSON + weather spawner items + `Env_*_Y160`
4. **In-game** — open *Autumn Trails - Advanced Weather*; compare to *No Foliage* to isolate props vs atmosphere

---

## Practical study order (both packs)

1. **Skyreach** — `Biome20BiomeAsset.json`: terrain + height-delimited `EnvironmentProvider`
2. **DFS Autumn Trails** — shared density → materials → tint → env
3. **DFS Advanced Weather** — full atmosphere stack (weather + spawners + Y160 env)
4. **DFS instances** — in-game variant comparison (foliage on vs off)

---

## Related TerraNova docs

- [Worldgen References + Live Preview](./worldgen-references-live-preview.md) — insert Skyreach-style carve blocks
- [Hytale CurveMapper Conventions](./hytale-curvemapper-conventions.md) — `BaseHeight` + `CurveMapper` height bands
- [Curves Reference](./curves.md) — Pow exponent 3 for sharp ribs
- [Environments and Weather](../guides/world/environments-and-weather.md) — editing weather/env assets in TerraNova
- [Material Providers](../guides/content/materials-guide.md) — `Queue` + `FieldFunction` path stacks
- [Props and Placement](../guides/content/props-and-placement.md) — inline `Union` + `FieldFunction` gates
- [Sky Islands Walkthrough](../walkthroughs/sky-islands.md) — teaching reconstruction for floating terrain
