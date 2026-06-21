# Hytale CurveMapper Conventions

**Difficulty:** Reference

> **Biome source assets:** Release — `Examples/Example_Curve_Mapper.json`, `Examples/Example_Curve_Remapping.json`, `Experimental/Mountains.json`, `Experimental/Plateaus.json`, `Generative/Generative_Pillars_Marble_Large.json`, plus biomes under `Plains1/`, `Boreal1/`, `Desert1/`, `Taiga1/`, `Volcanic1/` (`pnpm sync:hytale` → `templates/hytale-release/`). Community — `templates/references/` (TwistWorld, TheUnderworld, Lycheesis, HiveWorld, …), `templates/tropical-pirate-islands/`, save mods such as `McCal.Autmn Forest` (Worldgen V1), and audited Desktop packs **Skyreach Ravines** v3.6 / **Dragon's Fantasy Scenes** v1.3.0 ([study notes](./community-pack-references.md)).

This page documents how **release Hytale biome assets** use `CurveMapper`, and how TerraNova’s graph editor maps to that JSON.

For curve *types* and shape semantics, see [Curves Explained](../guides/world/curves-explained.md). For step-by-step terrain recipes, see [Understanding Basic Terrain Generation](../guides/understanding-basic-terrain-generation.md).

---

## Hytale JSON shape (export target)

In Hytale files, `CurveMapper` always looks like this:

```json
{
  "Type": "CurveMapper",
  "Skip": false,
  "Curve": {
    "Type": "Manual",
    "Points": [
      { "In": 0, "Out": 1 },
      { "In": 200, "Out": -1 }
    ]
  },
  "Inputs": [
    {
      "Type": "BaseHeight",
      "BaseHeightName": "Base",
      "Distance": true
    }
  ]
}
```

Important details:

| Hytale field | Meaning |
|---|---|
| **`Curve`** | Inline nested curve asset — almost always `Manual` with `{ In, Out }` points |
| **`Inputs[]`** | Single density input (not a named `Input` property) |
| **`Skip: false`** | Present on density nodes in shipped biomes |

Release audit (`templates/hytale-release`, ~453 `CurveMapper` nodes):

| Input to `CurveMapper` | Share | Typical use |
|---|---|---|
| `BaseHeight` (`Distance: true`) | ~83% | Height profile from surface offset |
| `DistanceToBiomeEdge` | ~4% | Biome boundary falloff |
| `Sum` | ~4% | Remap a combined signal |
| `YValue` | ~2% | Depth / altitude gates (caves, bands) |
| `SimplexNoise2D` | <1% | Remap normalized noise (see official example) |
| Other | small | `Inverter`, `Imported`, nested chains |

Curve asset types: **Manual ~97%**, `Imported` rare, other inline types rare.

Parent nodes (where `CurveMapper` sits in the tree): **`Sum` ~64%**, **`Mix` ~17%**, then `Normalizer`, `YSampled`, `DensityDelimited`, etc.

Hytale **never** stores a separate graph node for the curve in JSON — the curve is always nested under **`Curve`**.

---

## Community mod audit (external packs)

TerraNova cross-checked release patterns against **community biome packs** in the repo and on a local save. The same JSON rules apply — community authors use the same inline `Curve` + `Inputs[]` shape as release.

| Source | Files | `CurveMapper` count | Inline `Curve` | `Inputs[]` (not `Input`) | `BaseHeight` + `Distance` |
|---|---:|---:|---:|---:|---:|
| Release (`templates/hytale-release`) | 220 | 453 | 446/453 | 453/453 | 378/453 (~83%) |
| Repo references (`templates/references/`) | 8 | 57 | 57/57 | 57/57 | 54/57 (~95%) |
| Tropical Pirate Islands (`templates/tropical-pirate-islands/`) | 4 | 7 | 7/7 | 7/7 | 7/7 (100%) |
| McCal.Autmn Forest (save mod) | 132 | 26 | 26/26 | 26/26 | 23/26 (~88%) |

**Takeaways:**

- **100% inline curves** in every community sample — no separate curve graph nodes in JSON.
- **`Inputs[]` only** in shipped/community biomes. The lone exception found was a TerraNova WIP export (`DevMcCal.TestingTerranova/MyBiome.json`) that used a named **`Input`** key instead of **`Inputs[]`** — fixed in TerraNova export (`translationMaps` now maps `CurveMapper` → `Inputs[]`).
- **Manual curves dominate** (references: 56/57 Manual; McCal: 26/26 Manual). One reference pack uses inline `Floor` curve type under `CurveMapper`.
- **Parent nodes vary by pack** — release favors **`Sum`** (~64%); McCal.Autmn Forest also uses **`Max`**, **`Multiplier`**, and **`MultiMix`** heavily, but every `CurveMapper` still feeds density combiners the same way.
- **Alternate inputs** (same as release): `Normalizer → CurveMapper` on normalized noise (e.g. `Lycheesis_Terrain_01.json`, McCal layers with `Normalizer` input), occasional **`YValue`** depth gates, rare **`SimplexNoise2D`** direct input when curve In/Out is in ~[-1, 1].

Example from **McCal.Autmn Forest** (`Autmn Forest Bones.json`) — typical height profile:

```json
{
  "Type": "CurveMapper",
  "Curve": {
    "Type": "Manual",
    "Points": [
      { "In": -52, "Out": 1 },
      { "In": -28, "Out": 1 },
      { "In": -18, "Out": 0.55 },
      { "In": -12, "Out": 0 }
    ]
  },
  "Inputs": [
    {
      "Type": "BaseHeight",
      "BaseHeightName": "Base",
      "Distance": true
    }
  ]
}
```

Re-run the audit locally: `node scripts/audit-curvemapper.mjs` (release, references, tropical-pirate, and configured save-mod paths).

### Height-band `CurveMapper` in community packs

Beyond terrain profiles, community packs use **`CurveMapper(BaseHeight, Distance: true)`** inside **`DensityDelimited`** providers:

| Pack | Use |
|------|-----|
| **Skyreach Ravines** | `EnvironmentProvider` switches env bands around **Y ≈ 80–300** (ravine floor / rim / sky) |
| **DFS Autumn Trails** | Ground env vs **`Env_*_Y160`** sky layer split at **~Y 60** |

Same `CurveMapper` JSON shape as terrain — different parent (`EnvironmentProvider` or `TintProvider` delimiters). See [Community Pack Study References](./community-pack-references.md).

---

## TerraNova editor equivalents

TerraNova supports two editor patterns that export to the same Hytale shape:

| Editor pattern | Export result |
|---|---|
| **Inline curve** — set `Curve` type Manual in the properties panel on `CurveMapper` | Nested `Curve: { Type, Points }` |
| **Connected curve** — `Curve:Manual` node → `CurveMapper` **Curve** port | Same nested `Curve` object (points from the child node) |
| **Density input** — wire `BaseHeight` → **Input** port | `Inputs: [ { Type: "BaseHeight", … } ]` |

On **import**, nested Hytale `Curve` objects become a **`Curve:Manual`** child node with an edge to the **Curve** port. That is an editor convenience; re-export folds them back inline.

### Canonical terrain stack (matches release biomes)

```text
SimplexNoise2D
  → CurveMapper ← Manual curve (In ≈ noise range, e.g. -1…1)
BaseHeight (Distance: on)
  → CurveMapper ← Manual curve (In = block offsets from surface, Out = density)
                 ├→ Sum → … → Terrain Out
CurveMapper (noise) out ─┘
```

Official Hytale tutorial biome `Examples/Example_Curve_Mapper.json` uses exactly this: a **Sum** of two **CurveMapper** branches — noise remapped on **[-1, 1]**, height on **BaseHeight Distance** with In up to ~200 blocks.

**Do not** wire `SimplexNoise2D` directly into `Sum` beside `CurveMapper(BaseHeight)` — raw noise + height profile yields sparse pillars and void, not continuous ground.

### Do not wire curves into Sum

**`Curve:Manual` → `Sum` is not a Hytale pattern.** Sum expects **density** inputs. Connect noise or `CurveMapper` **output** to Sum; connect Manual only to **CurveMapper.Curve** (or use inline curve on the mapper).

### BaseHeight Distance mode

When feeding **CurveMapper**, set **Distance: on**. Hytale release assets use `Distance: true` on virtually every `BaseHeight → CurveMapper` link. In that mode:

- **Input** to `CurveMapper` = signed height offset from the named surface (blocks)
- Curve **In** axis = those block offsets
- Curve **Out** axis = output **density**

Without Distance, `BaseHeight` outputs terrain anchor density — wrong input semantics for profile curves.

---

## Validation and preview

| Check | Behavior |
|---|---|
| Missing inline `Curve` but **Curve** port connected | Valid (TerraNova treats connected curve as satisfying the required field) |
| Missing both inline curve and **Curve** port | Error — Hytale requires `Curve` |
| 2D preview on `CurveMapper` alone | Not meaningful — preview **Sum** or **Terrain Out** |
| Flat uniform 2D slice on `BaseHeight` | Normal at one Y — move Y slice or preview downstream |

---

## Related pages

- [Curves Explained](../guides/world/curves-explained.md) — curve types and shapes
- [Node Effects: CurveMapper](./node-effects.md) — preview and port summary
- [Exporting](./exporting.md) — `Input` → `Inputs[]`, point `{ x, y }` → `{ In, Out }`
- [Troubleshooting](../troubleshooting.md) — curve In range vs upstream output range
