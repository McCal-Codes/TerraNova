# TerraNova Bridge

Bridge connects TerraNova to a **running Hytale server** through the in-repo **sidecar** (`tools/terranova-bridge`) and optional **JVM plugin** (`tools/terranova-bridge-plugin`). It is for **iterating one file at a time**, not replacing **Export Asset Pack**.

| Task | Use |
|------|-----|
| First deploy of a mod pack | **Export Asset Pack** (`Ctrl+Shift+E`) → install `{Group}.{Name}/` on the server |
| Edit a biome you already deployed | Save in TerraNova → **Bridge** sync current file → reload worldgen on the server |

---

## Setup

### Option A — Bridge sidecar (required for editor HTTP preview)

No separate download. From the TerraNova repo:

```powershell
pnpm bridge:run
```

This starts `tools/terranova-bridge` on `127.0.0.1:7854` for save **Worldgen V1**, writes `bridge/config.json` under that save, and prints an **auth token** in the terminal. Paste the token into TerraNova → Bridge → **Connect**.

Sidecar mode reads **saved** chunk columns from `universe/worlds/<world>/chunks/*.region.bin` (Hytale IndexedStorage + ZSTD + BSON) for World preview. Player position and active instance world come from the save and server log. If a chunk is not on disk yet, the sidecar falls back to a small synthetic heightmap so the preview still renders.

TerraNova **auto-detects** the sidecar from your **Server mod path** (or an open project under `...\Saves\<World>\mods\<Pack>`): it derives the save name, ensures **`TerraNova.Bridge`** exists under that save's `mods` folder (with the TerraNova app icon at `resources/icon-256.png` for Hytale's World Mod Settings UI), **lists every mod pack** in Bridge for you to open or select as the sync target, loads `bridge/config.json` from the save, probes port `7854`, and resolves the live player/world/chunk from the save. Opening a mod pack as a project sets the Bridge path automatically. The status bar shows **Bridge ready** when the listener is up.

### Live player / instance world (best signal)

While the embedded server is running (Bridge port open), TerraNova picks the **active instance** in this order:

1. **Server log membership** — replay `Adding player … to world` / `Removing player … from world` / `joined world` in the newest `logs/*_server.log` (strongest; `PlayerData.World` often lags after hops).
2. **PerWorldData** — world whose `LastPosition` matches the live `Transform` in the newest player JSON under `universe/players/`.
3. **Recent instance activity** — newest writes under `universe/worlds/instance-*`.
4. **PlayerData.World** — fallback when nothing else disagrees.

The **display name** (for example **Autmn Forest**) comes from that instance's `universe/worlds/<id>/config.json` → `WorldGen.WorldStructure`, not from the folder slug (for example `Unknown_Worlds`). Bridge lists all `instance-*` folders and marks the live one. If the save file still points at a different world id, Bridge shows a short stale-save warning.

**Block position** for the active world (in order): `PerWorldData.LastPosition` for that instance (after autosave) → server log join/add lines → `Transform` when `PlayerData.World` matches. Sources are labeled in Bridge (for example `save (PerWorldData)` vs `server log`).

### Debugging Bridge

1. **Bridge** (`Ctrl+B`) → expand **Bridge diagnostics** → **Run snapshot**.
2. Read **warnings** (save missing, log stack empty, save vs sidecar path mismatch, position stale).
3. **Copy JSON** to share in bug reports or compare before/after a world hop.
4. Sidecar terminal: `RUST_LOG=info,terranova_bridge=debug pnpm bridge:run` for chunk load vs synthetic fallback lines.

Player/world resolution is implemented once in `tools/bridge-save` (shared by Tauri and the sidecar).

### Option B — TerraNova Bridge JVM plugin (command executor)

Build from this repo:

```powershell
pnpm bridge:plugin:build
```

Copy `tools/terranova-bridge-plugin/build/libs/TerraNova.Bridge.jar` to `%APPDATA%\Hytale\UserData\Mods\`, enable **TerraNova: Bridge** on your save, and keep the **sidecar** running for editor HTTP preview.

The plugin polls `bridge/pending-commands.log` on the active save (see `UserData/bridge-active-save.txt` while the sidecar runs) and runs queued console commands in-game.

### Option C — Full in-server HTTP (future)

When `bridge_mode: plugin` ships, the JVM plugin will expose the same loopback API as the sidecar so you can stop `pnpm bridge:run` for Connect-only workflows.

### Per-save mods (embedded world server)

Some worlds keep mods under the save folder instead of global `UserData/Mods`:

```text
%APPDATA%\Hytale\UserData\Saves\<Save Name>\mods\<PackFolder>\
```

Example (Worldgen V1):

| Use as **Server mod path** | Not this |
|----------------------------|----------|
| `...\Saves\Worldgen V1\mods\McCal.Volume Lab` | `...\Saves\Worldgen V1\mods` (parent folder) |

The pack folder must contain `Server\HytaleGenerator\...` (and usually `manifest.json`). In Bridge (`Ctrl+B`), use the **McCal — Volume Lab** or **McCal — Autmn Forest** shortcut if present.

### View an existing world mod (easiest path)

If the mod is already enabled on **Worldgen V1** (for example **McCal.Volume Lab**):

1. **Bridge** (`Ctrl+B`) → **Open pack — McCal — Volume Lab** (sets Server mod path and opens that folder as your TerraNova project, with a starter biome file).
2. Start **TerraNovaBridge** with the world loaded, enter your token, **Connect**.
3. Preview → **World** (enabled after connect). Turn on **Follow player** or set chunk center from **Player info** in Bridge.
4. You see **real server blocks** in TerraNova — not an offline re-simulation of the graph. Edits still require Save → **Sync & Reload** → **Regenerate Chunks** in-game.

You can also **File → Open** (`Ctrl+O`) and pick `...\Saves\Worldgen V1\mods\McCal.Volume Lab` manually; use the preset buttons only to set the Bridge path without reopening the project.

### Separate TerraNova test mod (recommended)

To test your own pack **without overwriting** McCal mods:

1. **File → Export Asset Pack** (`Ctrl+Shift+E`) and choose:

   `...\UserData\Saves\Worldgen V1\mods`

   TerraNova creates a **new** folder: `TerraNova.{ProjectName}\` (for example `TerraNova.Forest-Hills`).

2. In Hytale, open the **Worldgen V1** world settings and **enable** that mod (alongside any others you still want).

3. In TerraNova **Bridge** (`Ctrl+B`), click **My test mod (TerraNova.…)** or set Server mod path to that folder (not the parent `mods` directory).

4. Save → **Sync & Reload** → **Regenerate Chunks** → Preview **World**.

Exporting into the save `mods` folder also sets the Bridge path automatically when TerraNova detects that location.

---

## Sync current file

**Sync** copies only the **currently open project file** into `serverModPath`, preserving its path relative to the project root.

Requirements:

- A project is open (`manifest.json` + `Server/HytaleGenerator/...`).
- A file is active in the editor (for example a biome under `Server/HytaleGenerator/Biomes/`).
- **Server mod path** is set and points at the deployed pack root.

After sync, use **Reload worldgen** (and chunk regen if needed) on the server to see changes. Bridge does **not** upload the whole pack or create missing folders for unrelated assets.

---

## Other bridge actions

| Action | Purpose |
|--------|---------|
| Reload worldgen | Ask the server to reload generator definitions |
| Regenerate chunks | Regenerate terrain around X/Z with a radius |
| Teleport | Move a player for in-world inspection |
| Player info | Read player position for test coordinates |

---

## How this compares to other tools (external)

| Approach | What it does | Gap vs TerraNova sidecar today |
|----------|----------------|----------------------------------|
| **In-game Node Editor** ([HytaleModding tutorial](https://github.com/HytaleModding/site/blob/main/content/docs/en/official-documentation/worldgen/worldgen-tutorial/README.mdx)) | Edit biomes in-world; **`/viewport --radius N`** live-reloads around you | No offline graph editor; no TerraNova validation |
| **VS Code Hytale Devtools** ([Marketplace](https://marketplace.visualstudio.com/items?itemName=jrddp.hytale-devtools)) | Worldgen node editor + companion mod when you run the server from VS Code | Different workflow (mod dev in VS Code, not McCal save packs) |
| **Vanilla commands** ([`/worldgen`](https://www.hytalecommands.com/worldgen), [`/chunk`](https://www.hytalecommands.com/chunk)) | Reload defs, regen one chunk at a time | Manual; sidecar now **queues** these lines for paste |
| **ReChunk / SafeRegen** ([rechunk](https://github.com/renancmd/rechunk), [SafeRegen](https://hytaletools.cc/mods/saferegen)) | Bulk regen with base protection | World maintenance, not biome JSON sync |
| **TerraNovaBridge JVM plugin** (planned; [CommandManager API](https://hytale-docs.pages.dev/modding/plugins/commands/)) | `handleCommand(ConsoleSender.INSTANCE, "worldgen reload --clear")` etc. | Not public yet; sidecar uses `bridge/pending-commands.log` until then |

**McCal.\*** and other content packs are normal asset packs ([asset pack docs](https://github.com/HytaleModding/site/blob/main/content/docs/en/official-documentation/worldgen/pack-tutorial/asset-packs.mdx)) — enable on the save, sync into that folder, reload in-game. **`TerraNova.Bridge`** is only an optional empty sync slot.

### Sidecar capabilities (`GET /api/status`)

| Capability | Meaning |
|------------|---------|
| `save_player` | Player/world from save + server log (`bridge-save`) |
| `save_chunks` | Read `*.region.bin` when explored |
| `synthetic_chunk_fallback` | Heightmap placeholder if chunk not on disk |
| `queue_console_commands` | Append to `bridge/pending-commands.log` |
| `debug_snapshot` | `GET /api/debug/snapshot` |

On first run the sidecar writes **`bridge/ITERATION.md`** under the save with copy-paste commands.

### Roadmap (sidecar → plugin)

1. **Now** — executable queued commands, save-disk preview, shared `bridge-save`.
2. **Next** — minimal JVM mod: tail `pending-commands.log`, call `CommandManager.handleCommand`.
3. **Then** — live chunk bytes, palette from server, `bridge_mode: plugin`, drop synthetic fallback where possible.

---

## See also

- [Exporting](./exporting.md) — full pack export and Hytale JSON layout
