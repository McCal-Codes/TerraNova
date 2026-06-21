# Environment Parent Inheritance

> **Scope:** `Server/Environments/*.json` and biome `EnvironmentProvider` references  
> **See also:** [Environments & Weather](../guides/world/environments-and-weather.md)

---

## What `Parent` means

Hytale environment assets can set a **`Parent`** field pointing at another environment JSON file. The parent is a **shared base**, not a duplicate of the current filename.

Child environments usually override only a small set of fields (`Tags`, `WaterTint`, a narrow weather slice) while inheriting sky, fog, and forecast structure from the parent chain.

---

## Observed inheritance trees

| Variant | Inherits from |
|---------|----------------|
| `Env_Zone1_Azure`, `Env_Zone1_Plains` | `Env_Zone1` |
| `Env_Zone1_Caves_Forests` | `Env_Zone1_Caves` |
| `Env_Zone2_Caves_Deserts` | `Env_Zone2_Caves` |
| `Env_Forgotten_Temple_Exterior` | `Env_Forgotten_Temple_Base` |
| `Env_Zone1_Caves_Volcanic_T2` | `Env_Zone1_Caves_Volcanic_T1` |

**Practical rule:** point `Parent` at the family base (`Env_Zone1`, `Env_Zone1_Caves`, `Env_Forgotten_Temple_Base`), not at a sibling variant.

---

## Safe defaults by family

When authoring new environments, start from one of these bases:

| Base | Use for |
|------|---------|
| `Env_ZoneX` | Broad surface zone atmospheres |
| `Env_ZoneX_Caves` | Cave-family variants under that zone |
| `Env_Default_Flat` | Flat overworld fallback |
| `Env_Default_Void` | Void / empty setups |
| Unique bases (e.g. `Env_Forgotten_Temple_Base`) | Set-piece families with exterior/interior variants |

Import a close built-in match with **Add Hytale Asset**, duplicate, rename, then edit the copy.

---

## TerraNova display

| Surface | Behavior |
|---------|----------|
| Biome dashboard | **Environment** badge shows resolved `Env_*` for `Constant` providers, or **uses server default** when `EnvironmentProvider` is `{}` or `Default` |
| Atmosphere tab | Environment section mirrors the linked `Env_*` asset; export warns on name collisions |
| Biome browser (Atmosphere tab) | Project/template biome rows show resolved environment label beside each entry |

TerraNova does not yet visualize full parent-chain diffs in the environment editor — open the `Env_*` JSON in the file tree to inspect `Parent` and overrides.
