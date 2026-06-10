# Environments and Weathers Folder Guide

> **Scope:** `Server\Environments`, `Server\Weathers`, and `Common\Sky`
> **Use this for:** making your own environment/weather assets, importing built-in Hytale assets, and understanding environment parent chains.

---

## Folder Layout

### `Server\Environments`

Environment JSON files live here.

Use this folder for:
- biome atmosphere and weather routing
- zone variants like `Env_Zone1_Azure`
- cave and encounter variants like `Env_Zone1_Caves_Forests`
- unique sets like `Env_Forgotten_Temple_Exterior`

### `Server\Weathers`

Weather JSON files live here.

Use this folder for:
- sky color tracks
- fog and light tuning
- cloud layer configuration
- moon/star references
- weather files referenced by environment forecasts

### `Common\Sky`

Sky textures referenced by weather files live here.

Typical references include:
- star textures
- moon textures
- cloud textures

If a weather references `Sky\...`, TerraNova treats that as `Common\Sky\...` inside your pack.

---

## Importing From Hytale Assets

There are two main ways to pull in built-in Hytale content:

1. In the file tree, right-click a folder and use `Add Hytale Asset`.
2. In the right pane Asset Tools, use `Import Built-ins` or the per-entry `Import` / `Add` action.

Recommended workflow:
- create the standard folder first with `Add Hytale Folder`
- import a built-in asset close to what you want
- rename or duplicate it
- edit the copy instead of starting blind

This is especially useful for:
- `Server\Environments`
- `Server\Weathers`
- `Common\Sky`

### Manual Cache Setup

If you want TerraNova to use Hytale assets already installed on your machine, open **Settings → Assets → Hytale Asset Cache** and point TerraNova at your local asset source.

**Default channel:** TerraNova prefers the **Release** install when both are present. Use **Pre-release** only if you intentionally work against that build.

Common setups (Windows; macOS/Linux use the same path under your Hytale data root):

- **Release (recommended)** — folder or zip:

```text
%APPDATA%\Hytale\install\release\package\game\latest
%APPDATA%\Hytale\install\release\package\game\latest\Assets.zip
```

The release `latest` folder often contains only `Assets.zip` (not loose `Common/` or `Server/` trees). TerraNova detects the zip and extracts `Common/` and `Server/` into its cache automatically.

- **Pre-release** — usually the zip directly:

```text
%APPDATA%\Hytale\install\pre-release\package\game\latest\Assets.zip
```

After sync, material **Constant** nodes use **block IDs** (for example `Rock_Stone`). Icons load from cached `Common/Icons/ItemsGenerated/{blockId}.png` in the desktop app. Release assets do not use a separate `HytaleGenerator/Materials/` folder the way some older docs implied; materials live inside biome graphs.

If you want extra material art, block PNGs, or overlays, enable the external **Common** source in TerraNova settings and point it at:

```text
C:\Users\<you>\Desktop\Assets\Common
```

or any parent folder that contains `Common`.

The sync flow is:

1. Choose **Release** (or **Pre-release** if you need that build).
2. Point TerraNova at the `latest` folder or `Assets.zip` on your computer.
3. Optionally layer in an external `Common` source.
4. Press **Sync Now** (expect thousands of files for a full release zip, not zero).
5. Use **Add Hytale Asset**, the Issue Log, or the Asset Tools pane against the cached files.

**Biome round-trip:** Opening a Hytale biome imports canvas **comments** and **frames** from `$NodeEditorMetadata` when present. Saving writes them back and preserves imported `$WorkspaceID`, `$Links`, and `$FloatingNodes` even if you do not edit them on the canvas.

---

## Making Your Own Environment

Start from one of these patterns:

- `Env_Zone1` for a broad surface environment base
- `Env_Zone1_Caves` for cave-family variants
- `Env_Default_Void` for void-like setups
- a unique base such as `Env_Forgotten_Temple_Base` for set-piece families

Observed Hytale parent chains:

- `Env_Zone1_Azure` -> `Env_Zone1`
- `Env_Zone1_Caves_Forests` -> `Env_Zone1_Caves`
- `Env_Forgotten_Temple_Exterior` -> `Env_Forgotten_Temple_Base`
- `Env_Zone1_Caves_Volcanic_T2` -> `Env_Zone1_Caves_Volcanic_T1`

Practical rule:
- `Parent` should usually point to the shared family base, not to a duplicate of the current file

Common child overrides:
- `Tags`
- `WaterTint`
- `SpawnDensity`
- local `WeatherForecasts`

If you are unsure, `Env_Zone1` is a safe general-purpose base for zone-style environment work.

---

## Making Your Own Zone Environment Folder

If you want your pack to feel like Hytale's layout, mirror the family folders under `Server\Environments`.

Typical pattern:

```text
Server/
  Environments/
    Zone1/
      Env_Zone1.json
      Env_Zone1_Forests.json
      Env_Zone1_Plains.json
      Env_Zone1_Shores.json
      Env_Zone1_Caves.json
      Env_Zone1_Caves_Forests.json
    Unique/
      Env_My_Setpiece_Base.json
      Env_My_Setpiece_Exterior.json
```

Recommended workflow for a new zone family:

1. Create `Server\Environments\Zone1` or your chosen zone folder.
2. Create the shared base first, for example `Env_Zone1.json`.
3. Create child variants next, such as `Env_Zone1_Forests` or `Env_Zone1_Caves`.
4. Point each child `Parent` back to the family base.
5. Override only the fields that need to differ.

Example family:

- `Env_Zone1` -> broad surface baseline
- `Env_Zone1_Forests` -> `Parent: Env_Zone1`
- `Env_Zone1_Plains` -> `Parent: Env_Zone1`
- `Env_Zone1_Caves` -> cave baseline for underground variants
- `Env_Zone1_Caves_Forests` -> `Parent: Env_Zone1_Caves`

Best practice:

- keep one base file per family
- keep related child variants in the same zone folder
- use `Unique` for special one-off sets with their own base chain
- import a Hytale environment first if you want a reliable starting shape

---

## Making Your Own Weather

When authoring a new weather:

1. Start from a built-in weather if possible.
2. Keep the JSON in `Server\Weathers`.
3. Keep referenced textures in `Common\Sky`.
4. Check the Weather Issue Log for missing fog, cloud, and celestial setup.

Good things to verify:
- `FogDistance` exists and is not inverted
- at least one core sky/fog color track exists
- star/moon references point to valid files
- cloud textures exist if cloud layers are configured

---

## TerraNova-Specific Workflow

### Mental model (read this first)

| Piece | What it is |
|-------|------------|
| **Weather JSON** | One look: sky/fog/cloud tracks over 24 hours (`Server/Weathers`). |
| **Environment JSON** | Schedule: which weather ID runs at each hour, plus parent/tags/water tint (`Server/Environments`). |
| **Biome Atmosphere tab** | Preview sliders for the **terrain 3D view** — not the same as editing weather JSON. |
| **Preview hour** | One shared clock (0–23) across center editors, Asset Inspector scene preview, and biome Atmosphere tab. |
| **Built-in weather** | Resolved from synced Hytale cache — not in your pack until you **Import**. |

Expand the blue **help cards** in each panel for context-specific tips, or use the toolbar **Help** icon to open this guide.

### Center-panel editors

When you open an environment or weather JSON in the canvas, TerraNova switches to a dedicated **Environment** or **Weather** editor in the center panel (instead of the node graph).

**Preview hour:** Both editors share a preview-hour slider with quick jumps (Night, Morning, Afternoon, Evening). The same hour is stored globally — changing it in the Asset Inspector or biome **Atmosphere** tab updates the center editors too. **Simple** mode puts the slider directly under the scene card (with a sky-colored track). **Advanced** mode uses the full slider row above the preview. The environment editor also shows a **scene preview** that samples the dominant resolved weather at the selected hour (sky, sun/moon arc, fog, hills, and water).

The forecast strip shows **real sky colors** from resolved weather JSON at each hour—not placeholder hashes. Click a cell to set the shared preview hour; double-click to open the dominant weather file when it is indexed in Server/Weathers.

**Parent inheritance:** Environment files with a `Parent` inherit missing forecast hours from the parent chain. The Issue Log treats empty local hours on child files as **info** when the parent fills the gap, not as hard errors. Parent chain names are links that open the ancestor environment file.

**Sync to 3D preview (optional, default off):** In **Simple** mode, **Sync 3D** sits under the scene card; in **Advanced**, it is in the toolbar. When enabled, resolved weather/environment colors feed the terrain 3D preview. Biome **Atmosphere** tab sliders are separate unless you change those too. Preference is persisted in local storage.

**Simple vs Advanced:** Both editors default to **Simple** mode — preview, quick edits, and the current hour’s forecasts only. Switch to **Advanced** in the toolbar for full color/value tracks, bulk forecast tools, tags, spawn settings, and raw JSON fields. Your choice is remembered.

**Built-in import banner (Simple):** If referenced weathers exist only in the Hytale cache, an amber banner offers **Import built-in** without opening the full Issue Log.

**Help:** Toolbar **Help** (weather and environment editors) and collapsible help cards open this guide at `guides/world/environments-and-weather`.

### Asset Inspector scene preview

With a weather or environment JSON open (no node selected), the right pane **Scene Preview** section mirrors the center editor at the shared preview hour. Environment mode includes the forecast strip and resolves `Parent` inheritance before picking the dominant weather.

### Biome Atmosphere tab

The **Weather** section shows resolved environment/weather paths, a scene preview, and the **24-Hour Schedule** strip when an environment file is available. Preview hour is shared with weather/environment asset editors (`tn-atmospherePreviewHour`) — use the scene slider or strip to scrub time; **double-click** a strip cell to open the dominant weather file when indexed. `EnvironmentProvider: {}` displays as **uses server default** in the Atmosphere tab and biome dashboard; that is intentional, not a missing value.

### Weather materialization

TerraNova uses one shared pipeline (`materializeWeatherFiles`) for:

- Issue Log **Import** / **Create** actions in the environment editor
- Asset Tools **Import Built-ins** / **Create** in the right pane

Rules:

- **Project wins:** If `Server/Weathers/<name>.json` already exists in your pack, import is skipped unless you explicitly overwrite.
- **No silent auto-import:** Opening an environment file does **not** copy built-in weather files into your pack automatically. Use Issue Log or Asset Tools when you want files materialized.
- **Placeholders:** **Create** writes a minimal default weather JSON (sky/fog tracks) for IDs that do not exist anywhere.

### Environment Editor

Use the Issue Log to:
- assign a suggested `Parent`
- import referenced weather files
- create missing weather placeholders

Use the right pane Asset Tools to:
- filter referenced weather files by category
- import built-in referenced files
- create missing files
- reveal the target folder

### Weather Editor

Use the Issue Log to:
- add default celestial assets
- add default cloud layers
- fix fog distance problems

Use the right pane Asset Tools to:
- review referenced sky assets
- filter by category
- add built-in textures into `Common\Sky`

---

## Naming Guidance

Keep names family-oriented.

Examples:
- `Env_Zone1_Mountains`
- `Env_Zone1_Caves_Rats`
- `Zone1_Cloudy_Medium`
- `Zone1_Rain_Light`

That makes parent inference, search, and weather linking much easier inside TerraNova.
