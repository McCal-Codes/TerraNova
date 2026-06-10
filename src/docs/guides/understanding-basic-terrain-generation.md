# Guide: Understanding Basic Terrain Generation

**Difficulty:** Beginner

This guide explains the core concepts behind TerraNova / Hytale WorldGen V2 terrain generation.

> **Biome source assets:** `Examples/Example_Curve_Mapper.json`, `Experimental/Mountains.json`, `Experimental/Plateaus.json`, `Generative/Generative_Arches.json`
>
> Terrain examples on this page are grounded in those Hytale `Examples/`, `Experimental/`, and `Generative/` assets. The graphs below are teaching reductions, not full biome copies.

## World Coordinates

Before anything else, it helps to have the right mental model for how coordinates work in Hytale.

In most 2D math and graphing tools, **Y is up/down and X is left/right**. In 3D games, Y is still the vertical axis — but now **X and Z cover the two horizontal directions**, and Y measures height above the world floor.

The other thing that trips people up: **in games, the sign of axes is often the reverse of what basic math classes teach**. Negative tends to go up and left; positive goes down and right. This is not something you will usually need to think about explicitly in TerraNova, but it is worth knowing if you look at raw density values and they seem backwards from what you expected.

**Practical summary for worldgen:**
- `X`, `Z` — horizontal position across the world
- `Y` — vertical height (Y=0 is the world floor, Y=320 is the ceiling)
- Block columns run from Y=0 to Y=320; every X,Z position has a full column of blocks beneath it

---

## Density and Noisemaps Introduction

### What is Density?

Density is the core principle for generating terrain. It is a value that determines whether a block at a given coordinate (x, y, z) is solid or empty:

- **Positive density** -- solid block
- **Zero or negative density** -- air (empty)

In practice, density values in TerraNova are typically between -1 and 1.

### Noisemaps

Noisemaps are what noise generator nodes output. Each noise generator (e.g., `SimplexNoise2D`) produces a continuous value between -1 and 1 for each coordinate.

For example, a 2D noise map can be thought of as a heightmap where:

- Peaks are close to `1`
- Valleys are close to `-1`

```bounds
{"min": -1, "max": 1, "label": "SimplexNoise2D output — every coordinate produces a value in this range"}
```

These values are then combined with other nodes to produce terrain.

The key parameters on noise nodes are:
- **`Scale`** — controls feature size. Higher values produce larger, smoother features; lower values create smaller, more detailed noise. A Scale of 100 means one full noise cycle spans roughly 100 blocks. Typical values: `200–1000` for broad terrain base shape, `20–100` for surface detail, `1–10` for fine grain texture.
- **`Octaves`** — layers of noise stacked together; more octaves add fine detail at the cost of performance. 4–6 is typical for natural-looking terrain.
- **`Persistence`** — how much each successive octave contributes (around `0.5` by default; higher values produce rougher, craggier terrain)
- **`Lacunarity`** — how much the frequency increases per octave (around `2.0` by default)

---

## CurveMapper and BaseHeight

The **CurveMapper** is a key part of terrain generation. It remaps an input value using a curve (set to the `Manual` type in the properties panel).

The most common pairing is:

- `BaseHeight` crosses `0` at the named height reference and anchors the terrain vertically
- `CurveMapper` remaps that value to shape terrain elevation (hills, cliffs, plateaus)

```nodegraph
{
  "height": 160,
  "nodes": [
    { "id": "bh",  "label": "BaseHeight",  "category": "position", "sub": "Y = 64",        "x": 0,   "y": 60 },
    { "id": "cm",  "label": "CurveMapper", "category": "filter",   "sub": "height profile", "x": 200, "y": 60 },
    { "id": "out", "label": "Terrain Out", "category": "output",                             "x": 420, "y": 60 }
  ],
  "edges": [
    { "from": "bh",  "to": "cm",  "label": "value" },
    { "from": "cm",  "to": "out", "label": "density" }
  ],
  "steps": [
    { "nodeId": "bh",  "text": "BaseHeight anchors the terrain at a named height reference — in this example Y=64. It outputs a density that is strongly positive below that level (solid) and strongly negative above it (air). Think of it as telling the world 'ground starts here'." },
    { "nodeId": "cm",  "text": "CurveMapper remaps the BaseHeight value through your hand-drawn curve. The shape of that curve directly controls the terrain profile — gentle slopes become rolling hills, sharp bends become cliffs. Set Curve type to Manual in the properties panel to draw your own." },
    { "nodeId": "out", "text": "Terrain Out receives the final density. The surface of the world will appear wherever this density crosses zero. Everything above zero is solid; everything below is air." }
  ]
}
```

> In the properties panel, set `CurveMapper`'s Curve type to **Manual** and draw your terrain profile. The x-axis of the curve is the input value from `BaseHeight` (use **Distance: on** so the input is height offset from surface); the y-axis is the output density.

> **Under the hood:** In release Hytale biomes, `CurveMapper` always carries an **inline nested `Curve`** object in JSON; TerraNova can edit that inline or via a **Curve:Manual** port, and export folds both to the same shape. See [Hytale CurveMapper Conventions](../reference/hytale-curvemapper-conventions.md). `BaseHeight` with **`Distance: true`** feeds most mappers (~83% of release assets). See [Terrain Math Explained](./terrain/terrain-math-explained.md) for the full breakdown.

### How Curve Points Work: In and Out

On a **Curve:Manual** node, each control point has **`In`** (horizontal axis) and **`Out`** (vertical axis). **CurveMapper** samples that curve: whatever value arrives on its **Input** port is looked up on the horizontal axis, and the vertical value becomes output **density**.

With the usual **BaseHeight → CurveMapper** setup:

1. Set **BaseHeight → Distance: on** so Input is **height offset from the named surface** (blocks), not terrain density.
2. Draw the curve with **In = blocks from surface**, **Out = density** (positive = solid, negative = air).

Put simply: *"At this many blocks from the reference surface, output this density."*

The slope between adjacent points controls steepness — steep segments become cliffs; flat segments become shelves. Each point needs a unique **In** value (duplicates cause load errors).

```curve
Example: gentle hills — height offset (In) → density (Out)
{"xLabel": "In (blocks from surface)", "yLabel": "Out (density)"}
[[-80, 1], [-20, 0.4], [0, 0], [40, -0.6], [80, -1]]
```

> [!NOTE]
> Any **Input** value **outside the curve's In range** clamps to the nearest endpoint — runaway terrain or holes at the world ceiling/floor. Extend the curve to cover the full range your upstream node can produce, or add **Clamp** before **CurveMapper**.

When **SimplexNoise2D** (or another signal in roughly **[-1, 1]**) feeds **CurveMapper** directly, the horizontal axis is that input value instead of height offset — same rule: **In = input**, **Out = output density**. See [Troubleshooting — curve range](../troubleshooting.md) for noise-driven graphs.

```curve
Dangerous: curve In range too narrow for noise input
{"xLabel": "In (noise)", "yLabel": "Out (density)"}
[[-0.8, 1], [0, 0], [0.8, -1]]
```

```curve
Safer: cover the full noise range
{"xLabel": "In (noise)", "yLabel": "Out (density)"}
[[-1, 1], [0, 0], [1, -1]]
```

### Curve point tips

**Linear points between two others with the same slope are wasted.** If three points form a straight line, removing the middle one produces identical terrain.

**Steep vs shallow segments.** A steep segment over a narrow **In** range compresses a lot of height change into a small input band (cliffs). A shallow segment spreads change slowly (rolling hills). This applies whether **In** is block offset or noise.

**Keep In values monotonic.** Points are processed in **In** order. Crossing or out-of-order **In** values produce profiles that do not match what you drew unless you are deliberately experimenting.

---

## Adding Noise: SimplexNoise2D

A flat height profile with no noise produces completely flat terrain. Adding `SimplexNoise2D` introduces horizontal variation -- hills, valleys, and uneven ground.

Always route density through `Sum` into `Terrain Out` — even when you have a single source. This matches the correct data flow pattern and makes it easy to add more inputs later.

```nodegraph
{
  "height": 160,
  "nodes": [
    { "id": "sn",  "label": "SimplexNoise2D", "category": "density", "sub": "Scale 300", "x": 0,   "y": 60 },
    { "id": "sum", "label": "Sum",            "category": "math",                          "x": 220, "y": 60 },
    { "id": "out", "label": "Terrain Out",    "category": "output",                        "x": 420, "y": 60 }
  ],
  "edges": [
    { "from": "sn",  "to": "sum", "label": "-1 to 1" },
    { "from": "sum", "to": "out", "label": "density" }
  ]
}
```

---

## CurveMapper + BaseHeight + Noise

To create varied terrain, combine the height-based curve with noise using a `Sum` node.

1. `SimplexNoise2D` creates horizontal variation
2. `CurveMapper` defines the vertical profile
3. `Sum` merges them into a single density per (x,y,z)

```nodegraph
{
  "height": 200,
  "nodes": [
    { "id": "bh",  "label": "BaseHeight",    "category": "position", "sub": "Y = 64",        "x": 0,   "y": 20 },
    { "id": "cm",  "label": "CurveMapper",   "category": "filter",   "sub": "height profile", "x": 200, "y": 20 },
    { "id": "sn",  "label": "SimplexNoise2D","category": "generative","sub": "Scale 300",     "x": 0,   "y": 130 },
    { "id": "sum", "label": "Sum",           "category": "math",                              "x": 400, "y": 75 },
    { "id": "out", "label": "Terrain Out",   "category": "output",                            "x": 580, "y": 75 }
  ],
  "edges": [
    { "from": "bh",  "to": "cm"  },
    { "from": "cm",  "to": "sum", "label": "shaped height" },
    { "from": "sn",  "to": "sum", "label": "±1 noise" },
    { "from": "sum", "to": "out", "label": "density" }
  ],
  "steps": [
    { "nodeId": "bh",  "text": "BaseHeight with Distance: on outputs height offset from the named surface (y − baseY). That signed distance is what CurveMapper remaps — not raw terrain density." },
    { "nodeId": "cm",  "text": "CurveMapper remaps Input through your Manual curve (In = input value, Out = density). Steep segments create cliffs; flat segments create shelves. Preview from Terrain Out, not from CurveMapper alone." },
    { "nodeId": "sn",  "text": "SimplexNoise2D produces horizontal variation across X and Z. The same column of terrain repeats at every Y — so this noise raises and lowers the surface across the world, but cannot create overhangs on its own." },
    { "nodeId": "sum", "text": "Sum adds the curve-shaped profile and the noise together. The CurveMapper controls the overall vertical shape; the noise adds local variation on top." },
    { "nodeId": "out", "text": "Terrain Out receives the final density. The terrain surface sits wherever this value equals zero. Tune CurveMapper for broad shape; tune noise Scale and amplitude for surface variety." }
  ]
}
```

### How values combine

- **SimplexNoise2D** outputs roughly **[-1, 1]**; **BaseHeight** and **CurveMapper** outputs depend on mode and curve shape — not a fixed band.
- **Sum** adds inputs — ranges can exceed [-1, 1]. The world treats **any positive value** as solid.
- The **CurveMapper** curve sets the vertical profile; noise adds surface variation on top.

```bounds
{"min": -1, "max": 1, "label": "SimplexNoise2D — typical [-1, 1]"}
```

```bounds
{"min": -2, "max": 2, "label": "Sum of noise + shaped profile — can exceed [-1, 1]. Positive = solid, negative = air."}
```

---

## Adding Caves with SimplexNoise3D

To carve caves, evaluate a 3D noise field and use `Min` to keep only regions that are solid in *both* the terrain and the cave mask.

```nodegraph
{
  "height": 220,
  "nodes": [
    { "id": "terrain", "label": "Sum (terrain)", "category": "density", "sub": "from above",  "x": 0,   "y": 60 },
    { "id": "sn3",     "label": "SimplexNoise3D","category": "density", "sub": "ScaleXZ 40", "x": 0,   "y": 155 },
    { "id": "inv",     "label": "Inverter",      "category": "density", "sub": "flip caves",  "x": 200, "y": 155 },
    { "id": "min",     "label": "Min",           "category": "density", "sub": "carve",       "x": 370, "y": 100 },
    { "id": "out",     "label": "Terrain Out",   "category": "output",                        "x": 540, "y": 100 }
  ],
  "edges": [
    { "from": "terrain", "to": "min" },
    { "from": "sn3",     "to": "inv" },
    { "from": "inv",     "to": "min", "label": "cave mask" },
    { "from": "min",     "to": "out", "label": "density" }
  ]
}
```

> `Inverter` flips the noise so that high-noise areas become negative (empty), carving caves out of otherwise solid terrain. A typical cave noise setup uses `ScaleXZ: 30–60` (room width) and `ScaleY: 15–30` (room height) with `Octaves: 2–3` — too many octaves makes caves look noisy and thin; too few produces large featureless voids.

---

## Performance: YSampled

Evaluating a full density graph at every Y level is expensive. `YSampled` wraps any density subgraph and samples it at coarse Y intervals (default: every 4 blocks), then linearly interpolates between samples -- giving ~4x speedup with minimal visual change.

```nodegraph
{
  "height": 180,
  "nodes": [
    { "id": "cm",  "label": "CurveMapper", "category": "density",                       "x": 0,   "y": 70 },
    { "id": "ys",  "label": "YSampled",    "category": "density", "sub": "SampleDistance 4",    "x": 200, "y": 70 },
    { "id": "sum", "label": "Sum",         "category": "density",                       "x": 380, "y": 70 },
    { "id": "out", "label": "Terrain Out", "category": "output",                        "x": 540, "y": 70 }
  ],
  "edges": [
    { "from": "cm",  "to": "ys",  "label": "wrap" },
    { "from": "ys",  "to": "sum" },
    { "from": "sum", "to": "out" }
  ]
}
```

---

> [!TIP]
> Experiment with simple graphs in the editor to see how changing node parameters affects density output. Start with just `BaseHeight -> Terrain Out`, then layer in `CurveMapper` and noise one step at a time.

---

## See Also

- [Terrain Math Explained](./terrain/terrain-math-explained.md) — the formulas behind noise Scale, Octaves, Persistence, and how combining nodes produces specific terrain shapes
- [Curves Explained](./world/curves-explained.md) — detailed guide to curve types (Manual, DistanceExponential, DistanceS, Clamp, and more) used inside CurveMapper
- [Node Combinations](./world/node-combinations.md) — practical wiring patterns for common terrain setups
