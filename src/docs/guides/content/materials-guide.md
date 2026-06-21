# Guide: Material Providers

**Difficulty:** Intermediate

This guide explains what material providers are, how each provider type works, and how to combine them to produce believable surface layers, cave features, and biome-specific geology.

### Names in TerraNova vs exported JSON

| TerraNova editor (palette) | Exported Hytale `Type` | Layer slot in editor |
|---|---|---|
| `Material:SpaceAndDepth` | `SpaceAndDepth` | `Layer:ConstantThickness` → `ConstantThickness` |
| `Material:Queue` | `Queue` | — |

Sync **release** assets in **Settings → Assets** before picking block IDs. Use real IDs such as `Soil_Grass` and `Rock_Stone`, not legacy `hytale:` URIs.

Exported material leaves use `{ "Solid": "<BlockId>", "Fluid": "", "SolidBottomUp": false }` (TerraNova adds `$NodeId` on export).

---

## What Material Providers Do

After the terrain density function has determined *where* solid voxels exist, material providers determine *what block* fills each of those voxels.

Material providers only run on voxels where density is positive (i.e. solid). Air voxels are never evaluated.

For the same split in plain language — **densities carve shape** (positive = solid), **material providers paint blocks** on those solids — see Ashley’s [worldgen intro](https://medium.com/@ashleythedev/surprisingly-simple-world-generation-in-hytale-fcdc1e8bff0e). In TerraNova preview: use the **2D cell map** when tuning PCN / `CellNoise2D` masks; on the **Materials** biome tab, use the dedicated **Column** / **Surface** material preview; switch to **Voxel + Material Colors** on Terrain for full 3D verification of `Queue` / `SpaceAndDepth` or `FieldFunction` delimiter bands.

A `MaterialProviderAsset` wraps a single top-level provider. That provider is evaluated independently for every solid voxel and returns a block reference plus optional rotation.

### Provider types at a glance

| Node | Role |
|---|---|
| `Material:SpaceAndDepth` | Primary layering provider — assigns materials from the surface inward |
| `Material:ConstantThickness` | Fixed-depth layer (e.g. always 1 block of grass) |
| `Material:NoiseThickness` | Layer thickness driven by a 2D noise function |
| `Material:RangeThickness` | Random thickness within a min–max range |
| `Material:WeightedThickness` | Thickness chosen by probability weight |
| `Material:Queue` | Try providers in order; first match wins |
| `Material:DownwardDepth` | Context: depth from top surface downward |
| `Material:UpwardDepth` | Context: depth from cave floor upward |
| `Material:DownwardSpace` | Context: air gap below (cave ceilings) |
| `Material:UpwardSpace` | Context: air gap above (underside features) |

> [!NOTE]
> The material provider is **constructed before terrain density is evaluated**. It cannot inspect the final shape of the terrain around a voxel — it can only use the runtime context fields listed below. See [Common Mistakes](#common-mistakes) for the practical consequence of this constraint.

### Runtime context fields

Every provider has access to these fields at evaluation time:

| Field | Meaning |
|---|---|
| `downwardDepth` | Solid blocks between this voxel and the nearest air gap **above** it. `0` = the top surface block. |
| `upwardDepth` | Solid blocks between this voxel and the nearest air gap **below** it. `0` = the first solid block above a cave floor. |
| `downwardSpace` | Air blocks directly **below** this voxel before hitting solid again. Nonzero at cave ceilings. |
| `upwardSpace` | Air blocks directly **above** this voxel before hitting solid again. |
| `density` | The raw terrain density value at this voxel. |
| `x, y, z` | World coordinates. |

### Block rotation

Any `Material` field accepts an optional rotation object. Each axis accepts `"None"`, `"Ninety"`, `"OneEighty"`, or `"TwoSeventy"`:

```json
{
  "Solid": "Rock_Stone",
  "Yaw": "None",
  "Pitch": "Ninety",
  "Roll": "None"
}
```

---

## SpaceAndDepth — the Primary Provider

`Material:SpaceAndDepth` is the workhorse provider. It walks through an ordered list of **layers** from the surface (or floor) inward, assigning a material to each layer in sequence. Once all layers are consumed, remaining solid voxels get no assignment from this provider (a fallback such as `Material:Queue` is typically placed beneath it).

### Fields

| Field | Type | Description |
|---|---|---|
| `LayerContext` | string | Which surface and direction to measure from. |
| `MaxExpectedDepth` | int | Optimization hint — the maximum depth in blocks this provider needs to reach. |
| `Condition` | provider | Optional condition that must pass for this provider to activate. |
| `Layers` | array | Ordered list of layer definitions (consumed top-to-bottom). |

### LayerContext values

`LayerContext` controls which runtime field drives the depth measurement and which "surface" (solid/air boundary) is used as the origin:

| Value | Origin | Use case |
|---|---|---|
| `DownwardDepth` | Top surface (air above → solid below) | Standard overworld layering — grass, dirt, stone |
| `UpwardDepth` | Cave floor (air below → solid above) | Layering upward from a cave floor |
| `DownwardSpace` | Cave ceiling (solid above, air below) | Hanging features, stalactites |
| `UpwardSpace` | Underside of air pockets above | Less common; inverse of DownwardSpace |

> [!NOTE]
> `DownwardDepth` of `0` is the **topmost exposed surface block** — the block that has air directly above it. Depth increases as you go deeper underground.

### Worked example — grass surface, dirt sublayer, stone

```json
{
  "Type": "SpaceAndDepth",
  "LayerContext": "DownwardDepth",
  "MaxExpectedDepth": 8,
  "Layers": [
    {
      "Type": "ConstantThickness",
      "Thickness": 1,
      "Material": { "Solid": "Soil_Grass", "Fluid": "", "SolidBottomUp": false }
    },
    {
      "Type": "ConstantThickness",
      "Thickness": 3,
      "Material": { "Solid": "Soil_Dirt", "Fluid": "", "SolidBottomUp": false }
    },
    {
      "Type": "ConstantThickness",
      "Thickness": 4,
      "Material": { "Solid": "Rock_Stone", "Fluid": "", "SolidBottomUp": false }
    }
  ]
}
```

The provider starts at `downwardDepth = 0` (the top exposed block) and assigns layers in order. The first layer consumes 1 block (grass), the second consumes the next 3 (dirt), and the third consumes the next 4 (stone). Any solid voxel deeper than 8 blocks from the surface is not covered by these layers and would need a fallback provider beneath this one in a `Queue`.

> [!TIP]
> Set `MaxExpectedDepth` to exactly the sum of all layer thicknesses. The engine uses this as an optimization hint to skip evaluating the provider on voxels it could never reach. Getting it wrong does not break results, but setting it far too high wastes performance.

---

## Layer Types

All layer types are used inside the `Layers` array of a `SpaceAndDepth` provider.

---

### ConstantThickness

Fills exactly `Thickness` blocks with the given material.

```json
{
  "Type": "ConstantThickness",
  "Thickness": 1,
  "Material": { "Solid": "Soil_Grass", "Fluid": "", "SolidBottomUp": false }
}
```

**Use cases:**
- A 1-block grass cap on every surface.
- A consistent bedrock band at a fixed depth.
- Any layer where every column should be the same depth.

---

### NoiseThickness

The thickness of this layer varies across XZ space according to a density function supplied in `ThicknessFunctionXZ`. The function is evaluated at `(x, z)` only; Y is ignored.

```json
{
  "Type": "NoiseThickness",
  "ThicknessFunctionXZ": {
    "Type": "SimplexNoise2D",
    "Scale": 0.05,
    "Min": 2,
    "Max": 6
  },
  "Material": { "Solid": "Soil_Dirt", "Fluid": "", "SolidBottomUp": false }
}
```

**Use cases:**
- A dirt layer that is thin in some columns and thick in others, giving an organic, uneven look.
- Patchy gravel seams that appear only where noise crosses a threshold.
- Any layer whose depth should vary smoothly across the world rather than per-column randomly.

> [!NOTE]
> `ThicknessFunctionXZ` is a standard density function node. You can use any node that produces a numeric output — `SimplexNoise2D` is the most common choice here. Map its output range to meaningful block counts using `Min`/`Max` or a `Remap` node.

---

### RangeThickness

Picks a thickness uniformly at random from the integer range `[RangeMin, RangeMax]` for each column. `Seed` makes the randomness deterministic and reproducible.

```json
{
  "Type": "RangeThickness",
  "RangeMin": 2,
  "RangeMax": 5,
  "Seed": 42,
  "Material": { "Solid": "Rock_Sand", "Fluid": "", "SolidBottomUp": false }
}
```

**Use cases:**
- A sand layer that is 2–5 blocks deep, varying per column.
- Ore vein thickness that varies within a controlled band.
- Any layer where you want simple random variation without noise infrastructure.

---

### WeightedThickness

Picks a thickness from a set of explicit options, each with a relative `Weight`. Thicker or thinner outcomes can be made more or less probable. `Seed` controls reproducibility.

```json
{
  "Type": "WeightedThickness",
  "PossibleThicknesses": [
    { "Value": 1, "Weight": 1 },
    { "Value": 2, "Weight": 3 },
    { "Value": 3, "Weight": 4 },
    { "Value": 5, "Weight": 2 }
  ],
  "Seed": 7,
  "Material": { "Solid": "Soil_Dirt", "Fluid": "", "SolidBottomUp": false }
}
```

With the weights above, a 3-block depth is four times more likely than a 1-block depth.

**Use cases:**
- Soil depth with a "most common" value but occasional thin or deep outliers.
- Simulating geological variation where specific thicknesses are more geologically plausible than a flat random range.

---

## Other Providers

These providers complement `SpaceAndDepth` or act as standalone fallbacks.

| Provider | Key fields | What it does |
|---|---|---|
| `Constant` | `Material` | Returns the same block everywhere. Use as a final fallback in a `Queue`. |
| `DownwardDepth` | `Depth`, `Material` | Assigns the material to every voxel within `Depth` blocks of the top surface. Simpler than SpaceAndDepth when only one surface layer is needed. |
| `UpwardDepth` | `Depth`, `Material` | Same but measured upward from the nearest air gap below — targets cave floors. |
| `DownwardSpace` | `Space`, `Material` | Targets voxels that have at least `Space` air blocks directly below them — cave ceilings and overhangs. |
| `UpwardSpace` | `Space`, `Material` | Targets voxels with at least `Space` air blocks above them. |
| `Striped` | `Stripes` array | Applies repeating horizontal stripes. Each stripe entry specifies a thickness and material. |
| `Queue` | `Queue` array | Evaluates each sub-provider in order; the first one that returns a result wins. Essential for composing complex layering. |
| `Solidity` | `Solid`, `Fluid` | Branches between two sub-providers depending on whether the voxel is solid or fluid. |
| `TerrainDensity` | density ranges | Assigns materials based on the raw density value at the voxel. |

> [!TIP]
> `Queue` is the primary composition tool. Stack specialized providers (cave ceiling detectors, surface layering) at the top and a `Constant` fallback at the bottom so every solid voxel is always covered.

---

## Practical Examples

### Example A: Classic plains biome

Grass on top, 3 blocks of dirt, then stone for everything deeper.

```json
{
  "Type": "Queue",
  "Queue": [
    {
      "Type": "SpaceAndDepth",
      "LayerContext": "DownwardDepth",
      "MaxExpectedDepth": 4,
      "Layers": [
        {
          "Type": "ConstantThickness",
          "Thickness": 1,
          "Material": { "Solid": "Soil_Grass", "Fluid": "", "SolidBottomUp": false }
        },
        {
          "Type": "ConstantThickness",
          "Thickness": 3,
          "Material": { "Solid": "Soil_Dirt", "Fluid": "", "SolidBottomUp": false }
        }
      ]
    },
    {
      "Type": "Constant",
      "Material": { "Solid": "Rock_Stone", "Fluid": "", "SolidBottomUp": false }
    }
  ]
}
```

The `SpaceAndDepth` handles the top 4 blocks. The `Constant` fallback catches everything deeper.

---

### Example B: Desert biome

Sand 2–4 blocks deep (random per column), then sandstone below that.

```json
{
  "Type": "Queue",
  "Queue": [
    {
      "Type": "SpaceAndDepth",
      "LayerContext": "DownwardDepth",
      "MaxExpectedDepth": 4,
      "Layers": [
        {
          "Type": "RangeThickness",
          "RangeMin": 2,
          "RangeMax": 4,
          "Seed": 101,
          "Material": { "Solid": "Rock_Sand", "Fluid": "", "SolidBottomUp": false }
        }
      ]
    },
    {
      "Type": "Constant",
      "Material": { "Solid": "Rock_Sandstone", "Fluid": "", "SolidBottomUp": false }
    }
  ]
}
```

> [!TIP]
> Because `RangeThickness` picks per-column, neighbouring columns naturally have different sand depths. This gives desert dunes a slightly uneven underside without any extra noise setup.

---

### Example C: Cave ceiling stalactites

Use `DownwardSpace` to detect the ceilings of caves and place a different block there — the first solid block above a cave gap.

```json
{
  "Type": "Queue",
  "Queue": [
    {
      "Type": "DownwardSpace",
      "Space": 3,
      "Material": { "Solid": "Rock_Stone_Cobble", "Fluid": "", "SolidBottomUp": false }
    },
    {
      "Type": "Constant",
      "Material": { "Solid": "Rock_Stone", "Fluid": "", "SolidBottomUp": false }
    }
  ]
}
```

`DownwardSpace: 3` matches any solid voxel that has at least 3 air blocks directly below it. The stalactite block is placed there; all other solid voxels fall through to `Constant` and become regular stone.

> [!NOTE]
> `DownwardSpace` detects solid voxels that *overhang* air gaps. It does **not** place blocks in the air itself — material providers only run on already-solid voxels.

---

### Example D: Queue with noise-varied layer and fallback

Try a noise-driven variable dirt layer first; if the noise result would be 0 thickness the provider produces no result, and the fallback `Constant` kicks in with stone.

```json
{
  "Type": "Queue",
  "Queue": [
    {
      "Type": "SpaceAndDepth",
      "LayerContext": "DownwardDepth",
      "MaxExpectedDepth": 5,
      "Layers": [
        {
          "Type": "ConstantThickness",
          "Thickness": 1,
          "Material": { "Solid": "Soil_Grass", "Fluid": "", "SolidBottomUp": false }
        },
        {
          "Type": "NoiseThickness",
          "ThicknessFunctionXZ": {
            "Type": "SimplexNoise2D",
            "Scale": 0.03,
            "Min": 1,
            "Max": 4
          },
          "Material": { "Solid": "Soil_Dirt", "Fluid": "", "SolidBottomUp": false }
        }
      ]
    },
    {
      "Type": "Constant",
      "Material": { "Solid": "Rock_Stone", "Fluid": "", "SolidBottomUp": false }
    }
  ]
}
```

The dirt sublayer is 1–4 blocks depending on noise at that XZ position. Stone fills everything beneath it.

### Example E: Path corridors from a shared density export (DFS pattern)

Community pack **Dragon's Fantasy Scenes** (`DFS_Autumn_Trails`) exports one wide-area density (`DFS_03_WideAreaDensity`) and reuses it for terrain paths, **`FieldFunction` material delimiters**, tint provinces, and prop `Mesh2D` placement. Path bands use a **`Solidity` → `Queue` → `FieldFunction`** stack with tight delimiters (±0.005) mapping to `Soil_Pathway` / `Soil_Dirt_Dry` / `Soil_Mud_Dry` — corridors, not random specks.

Use this when trail paint, tint, and scatter must stay aligned. See [Community Pack Study References](../../reference/community-pack-references.md).

---

## Common Mistakes

### Forgetting to set MaxExpectedDepth

`MaxExpectedDepth` is an optimization hint. If you set it lower than the total thickness of your layers, the provider silently stops evaluating at that depth and deeper layers will not be applied. If you set it much higher than needed, the engine evaluates the provider on voxels it can never reach, wasting CPU.

**Rule of thumb:** set it to the sum of the maximum possible thickness of all layers.

---

### DownwardDepth vs UpwardDepth confusion

These are mirror images of each other and are easy to mix up:

| Field | `0` means... | Increases toward... |
|---|---|---|
| `downwardDepth` | Top exposed surface block (air above) | Deeper underground |
| `upwardDepth` | First solid block above a cave floor | Upward into the ceiling |

If your surface layers are appearing on cave floors instead of the overworld surface, check that `LayerContext` is `DownwardDepth`, not `UpwardDepth`.

---

### Trying to use terrain density to choose block placement

It is tempting to write a provider that places ore only where `density > 0.8`. This seems logical, but remember: **the material provider is built before terrain density is evaluated**. The provider tree is a static structure compiled ahead of time. You cannot branch on the final evaluated density value to make block-placement decisions in the same pass.

The `density` context field gives you the raw density value at a voxel, but this represents the density function output, not the post-processed terrain shape. Use it only for smooth, continuous material gradients — not for threshold-based feature logic that depends on nearby solid/air relationships. For that, use the `downwardDepth`, `upwardDepth`, `downwardSpace`, and `upwardSpace` context fields instead.

---

## See Also

- [Community Pack Study References](../../reference/community-pack-references.md) — DFS path `FieldFunction` stacks
- [Reference Index](../../reference/README.md)
- [Biome System](../world/biome-system.md)
- [Terrain Math Explained](../terrain/terrain-math-explained.md)
