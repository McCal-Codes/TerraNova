# Tint System Reference

> **Scope:** biome `TintProvider` graphs and Atmosphere tab tint editing  
> **See also:** [Environments & Weather](../guides/world/environments-and-weather.md), [Materials Guide](../guides/content/materials-guide.md)

---

## How tint works in Hytale

The tint system is **2D**: tint is calculated per `(x, z)` column and ignores `y`. Every block in a column shares the same tint color. The engine uses a 2D tint map for performance, so true height-based tinting is not possible without engine changes.

**Density as a proxy:** Use terrain density to approximate height. A common pipeline:

```text
TerrainDensity
  → SliderDensity (SlideY = -25)
  → Delimiter(s)
  → TintProvider
```

**Why SliderDensity helps:** `SlideY = -25` samples density 25 blocks below the current position. That sample is more stable (less surface flicker) than sampling exactly at the surface.

---

## What tint can do

- Snow caps, valley greens, stone exposure, and shoreline gradients
- Cliff tint and erosion bands via dual-sample difference (see below)

## What tint cannot do

- Stack independent tints for floating islands, caves, and ground at the same `(x, z)` column — only one tint per column.

---

## Standard DensityDelimited pattern

```text
TerrainDensity
  → SliderDensity (SlideY = -25)
  → Delimiter(s)
  → TintProviders

Range split example:
  0.0 – 0.35  → grass tint
  0.35 – 0.65 → rock tint
  0.65 – 1.0  → snow tint
```

Real Hytale biomes often use `SimplexNoise2D` density with Seed `tints`, Scale `100`, Octaves `2`, Persistence `0.2`, Lacunarity `5`.

---

## Dual-sample slope approximation

Sample two densities (surface + 25 blocks below) and use their **difference** to approximate slope or exposure. That creates cliff tint, erosion bands, and snow ridges — richer than a single threshold split.

These stacks stay graph-only in TerraNova: use **Open Tint graph** on the Atmosphere tab when the density chain is not SimplexNoise2D.

---

## Editing in TerraNova

| Pattern | Where to edit |
|---------|----------------|
| `DensityDelimited` + `SimplexNoise2D` | Biome **Atmosphere** tab — Seed, Scale, Octaves, Persistence, Lacunarity, and delimiter bands |
| Constant single-color tint | Atmosphere tab shows a read-only note; multi-band editing is graph-only for now |
| TerrainDensity / SliderDensity / dual-sample | Atmosphere tab → **Open Tint graph** |

---

## Future

If the engine exposes `height(x, z)`, true height-based tinting becomes straightforward. Until then, density-proxy patterns above match shipped Hytale biomes.
