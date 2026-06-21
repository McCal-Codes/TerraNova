# Node Effects: How Each Node Changes Terrain

This reference describes the most important node families and how they affect terrain.

> **Biome source assets:** `Examples/Example_CellNoise2D.json`, `Examples/Example_Curve_Mapper.json`, `Examples/Example_Mixer_Gradient.json`, `Experimental/Arches.json`, `Experimental/Dunes.json`, `Experimental/Mountains.json`, `Experimental/Plateaus.json`, `Generative/Generative_Arches.json`, `Generative/Generative_Pillars_Marble_Large.json`, `Generative/Generative_Veins.json`
>
> The summaries below are grounded in those terrain-bearing Hytale biome assets and the active TerraNova node set. Example chains are schematic summaries unless called out as direct source fragments.

## Core concept: graph = terrain

In TerraNova, terrain is a directed graph of nodes. Each node computes a value at every `(x, y, z)` position. The final value determines whether that point is solid or air.

```text
density > 0  -> solid block
density < 0  -> air
density = 0  -> the surface
```

The recurring shape logic in the audited biome assets reduces to some variation of:

```text
density(x, y, z) = terrain_height(x, z) - y
```

Below the surface the result is positive, so terrain is solid. Above the surface it is negative, so the point is air.

---

## Key node categories

### Density generators

| Node | What it produces | Common use |
|---|---|---|
| `SimplexNoise2D` | Smooth 2D noise over X/Z | Hills, plains, biome masks |
| `SimplexNoise3D` | Smooth 3D noise over X/Y/Z | Caves, undersides, volumetric variation |
| `CellNoise2D` | Cell/Voronoi regions | Region masks, fractured terrain |
| `CellNoise3D` | 3D cell noise | Volumetric cell patterns |

### Anchors and coordinate inputs

| Node | What it returns | Common use |
|---|---|---|
| `YValue` | Current world Y coordinate | Teaching height formula, altitude masks |
| `BaseHeight` | Named terrain anchor (`Distance: off` → `baseY − y` density). `Distance: on` → signed height offset for curve shaping | Ground planes, altitude bands with `CurveMapper` |
| `CurveMapper` | Remaps **Input** through inline or port-connected **Manual** curve → density; exports as Hytale `Inputs[]` + nested `Curve`. Preview **Sum** / **Terrain Out** | Vertical profiles, masks, noise shaping — see [Hytale CurveMapper Conventions](./hytale-curvemapper-conventions.md) |
| `DistanceToBiomeEdge` | Distance from the nearest biome boundary | Transition masks, edge effects |
| `Constant` | Fixed numeric value | Height offsets, weights, amplitude scales |

### Combining nodes

| Node | What it does | Common use |
|---|---|---|
| `Sum` | Adds inputs | Height anchor + noise, layered terrain |
| `Multiplier` | Multiplies inputs | Scale a signal, apply masks |
| `AmplitudeConstant` | Source-asset constant scaling stage | `noise * 40` style remaps in Hytale-native assets |
| `Min` / `Max` | Keeps the lower / higher input | Carving, unions, shape cuts |
| `SmoothMin` / `SmoothMax` | Blended min/max | Organic merges |
| `Mix` | Weighted blend between branches | Terrain transitions, selector-driven blends |
| `Normalizer` | Remaps one numeric range to another | Prepare a selector, stabilize sums |
| `FastGradientWarp` | Distorts coordinates before lookup | Organic boundaries, warped masks |
| `YSampled` | Samples a child graph at coarser Y intervals | Vertical amortization for expensive terrain |

### Curves and remapping

Curves reshape an input value before it continues through the graph.

> **See the visual reference:** [Curves Reference](./curves.md)

Most common tools:

- `Curve:Manual` for custom remaps and hand-drawn profiles
- `Curve:DistanceExponential` for center-to-edge falloff
- `Curve:DistanceS` for smooth transition bands
- `Curve:Clamp` and `Normalizer` for range control
- `Curve:Not` / `Curve:Inverter` for mask flipping

### Materials, positions, and scanners

These do not change terrain density directly, but they use terrain outputs to decide what gets placed and where.

| Family | Common examples | What they do |
|---|---|---|
| Material providers | `SpaceAndDepth`, `DownwardDepth`, `Striped` | Choose which block fills solid voxels |
| Position providers | `Mesh2D`, `FieldFunction`, `SimpleHorizontal` | Choose candidate prop positions |
| Scanners | `ColumnLinear`, `Origin` | Resolve placement against terrain |

---

## Common source-backed patterns

### Height-anchored terrain profile (`Examples/Example_Curve_Mapper.json`)

```text
SimplexNoise2D
  + CurveMapper(Manual)
      <- BaseHeight(Distance: true, Name: "Base")
  -> Sum
```

This is the simplest recurring production pattern in the audited terrain examples: a named height anchor comes through `BaseHeight`, a manual `CurveMapper` shapes that vertical distance, and `SimplexNoise2D` adds horizontal variation.

### Cell-based regions (`Examples/Example_CellNoise2D.json`)

```text
CellNoise2D (CellType: Distance2Div)
  + CurveMapper(Manual)
      <- BaseHeight(Distance: true, Name: "Base")
  -> Sum
```

This example asset uses cell noise directly in terrain density while `CurveMapper(BaseHeight)` still controls the vertical anchor.

### Experimental blend masks (`Experimental/Dunes.json`)

```text
Gradient / Imported mask
  -> Normalizer
  -> Mix / Max / Min
```

In the audited dunes terrain, `Gradient`, `Normalizer`, `Mix`, `Max`, and `Min` work together as a boundary-shaping pipeline. The important source-backed pattern is the blend stack itself, not one isolated node.

### Shared production stacks (`Experimental/Mountains.json`, `Experimental/Plateaus.json`, `Generative/Generative_Pillars_Marble_Large.json`)

```text
Imported / Cache / BaseHeight
                     -> CurveMapper
                     -> Mix / Normalizer
                     -> Sum / Min / Max
```

The heavier experimental and generative terrain assets reuse expensive subgraphs instead of recomputing them. `Imported`, `Cache`, `CurveMapper`, `Mix`, `Normalizer`, `Sum`, `Min`, and `Max` show up together when a biome needs layered terrain or shared selectors across systems.

### Shape-driven terrain carving (`Experimental/Arches.json`, `Generative/Generative_Arches.json`, `Generative/Generative_Veins.json`)

```text
PositionsCellNoise -> Mesh2D / Mesh3D
                   -> SmoothMin / Max / Sum
                   -> CurveMapper or Normalizer
```

The arches, pillars, and veins assets use position providers plus mesh-driven shapes to build terrain that reads as carved, suspended, or volumetric. These are good source-backed examples when a doc needs terrain built from reusable shapes instead of just noise.

---

## Using biome graphs as reference

When you open a Hytale biome JSON in TerraNova, inspect the exact node graph used in the source assets.

1. Open a biome file under `Server/HytaleGenerator/Biomes`.
2. Find the terrain or material subgraph you want to study.
3. Trace it from the root backward.
4. Copy only the part you understand, then retune it in your own graph.

---

## Quick reference

| What you want | Use |
|---|---|
| Vertical terrain anchor | `BaseHeight` + `CurveMapper`, or `Constant - YValue` for a direct teaching height formula |
| Surface variation | `SimplexNoise2D` |
| 3D variation for caves or undersides | `SimplexNoise3D` |
| Cell-shaped regions | `CellNoise2D` or `PositionsCellNoise` |
| Visualize PCN cell layout | Preview panel → **Shape Preview** + **Cell map** (2D sidebar, top-down XZ) |
| Full solid terrain / materials | **Voxel** preview on biome output (Root / Max) |
| In-game ground truth | **Bridge** world preview |

### Recommended preview mode by node type

| Node family | Best mode | Shape layers |
|-------------|-----------|--------------|
| `PositionsCellNoise`, `CellNoise2D/3D`, Voronoi | **2D** heatmap + cell map | Cell boundaries, wall distance, mesh if wired |
| `Mesh2D`, `Mesh3D` | **2D** | Mesh samples (amber dots) |
| Ellipsoid, Cuboid, Cylinder, Plane, Shell, Cube | **2D** for zero contour; **Voxel** for solid mesh | SDF surface (pink); voxel Y ±32 around origin |
| `Max`, `Mix`, combiners | **2D** on output; pick a child for one layer | Merged upstream cells when layers on |
| Biome terrain output | **2D** / **3D** / **Voxel** | Shape layers optional on subgraph targets |

PCN and mesh layouts are horizontal (XZ). **Do not use Voxel** to debug cell walls — overlays use a different scene transform than the voxel mesh grid.

### Shape Preview (DEV gallery)

Reference-backed UAT (Vite dev server, port 1420):

| URL case | Reference | What to verify |
|----------|-----------|----------------|
| `?shape-preview-gallery=1&case=underworld-cell` | `templates/references/TheUnderworld.json` | White Voronoi walls on fine `CellNoise2D` (Frequency 0.05) |
| `?shape-preview-gallery=1&case=underworld-max` | Same | Max heatmap with merged upstream cell walls; sub-target buttons pick a single `CellNoise2D` |
| `?shape-preview-gallery=1&case=sdf-showcase` | DEV SDF graph (Hytale-style fields) | Pink zero contour for Ellipsoid, Cuboid, Cylinder, Plane, Shell, Cube — use shape picker row |
| `?shape-preview-gallery=1&case=mudcracks-cube` | `Mudcracks_Actual_WIP_11.json` Cube subtree | Reference Manual curve on Cube SDF |
| `?shape-preview-gallery=1&case=density-noise-3d` | DEV density basics | SimplexNoise3D volume (Voxel default) |
| `?shape-preview-gallery=1&case=density-min-carve` | DEV density basics | Min carve with inverted SimplexNoise3D |
| `?shape-preview-gallery=1&case=density-max-2d` | DEV density basics | Max of two SimplexNoise2D layers |
| `?shape-preview-gallery=1&case=tropical-pcn` | `templates/references/Tropical_Pirate_Islands.json` | `PositionsCellNoise` cell walls + amber mesh samples (Mesh2D via Occurrence); **Material Colors** shows delimiter-driven soil bands |
| `?shape-preview-gallery=1&case=hytale-example-cellnoise2d` | `Examples/Example_CellNoise2D.json` (synced release) | Merged `CellNoise2D` walls on terrain output combiner |
| `?shape-preview-gallery=1&case=hytale-generative-arches` | `Generative/Generative_Arches.json` (synced release) | **PCN** cell map + mesh dots (`PositionsCellNoise` → `Mesh2D`) |
| `?shape-preview-gallery=1&case=hytale-generative-veins` | `Generative/Generative_Veins.json` (synced release) | PCN cell map on carved generative terrain |
| `?shape-preview-gallery=1&case=hytale-plains1-river` | `Plains1/Plains1_River.json` (synced release) | **Voxel-first** hills + hydrography (not a PCN showcase) |
| `?shape-preview-gallery=1&case=hytale-plains1-deeproot` | `Plains1/Plains1_Deeproot.json` (synced release) | Voxel + cutaway cave voids from imported module |
| `?shape-preview-gallery=1&case=hytale-test-features&patch=32` | `Test_Features.json` (synced release) | **56-patch node UAT** — pick patch 1–56 (PCN return types, noise, SDF); omit `patch` for Max overview |

Use the gallery header **2D / 3D / Voxel** buttons. PCN / cell cases default to **2D** with the cell map overlay; survival hydro cases (`hytale-plains1-*`) default to **Voxel**. The harness warns if you switch a PCN case to Voxel. Voxel **Material Colors** uses the biome `MaterialProvider` graph when present (not only flat `materialConfig`). Legacy `?case=pcn` and `?case=mix` redirect to `underworld-cell` and `underworld-max`.

| Organic boundary distortion | `FastGradientWarp` |
| Blend terrain branches | `Mix` + `Normalizer` |
| Reuse expensive graph results | `Cache` + `Exported` / `Imported` |
| Reduce vertical evaluation cost | `YSampled` |
