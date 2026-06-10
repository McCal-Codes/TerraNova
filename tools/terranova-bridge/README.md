# TerraNova Bridge (sidecar MVP)

Standalone HTTP server that implements the [TerraNova Bridge API](../../src/docs/reference/bridge.md) on loopback port **7854**.

Pair this sidecar with the in-repo JVM plugin (`tools/terranova-bridge-plugin`, `pnpm bridge:plugin:build`) so reload/regen/teleport queues run in-game. The sidecar still owns loopback HTTP and save-disk World preview.

## What works today

| Endpoint | Sidecar behavior |
|----------|------------------|
| `GET /api/status` | OK, reports `bridge_version` `0.2.0-sidecar` |
| `GET /api/blocks/palette` | Built-in block id → name map |
| `GET /api/player/info` | Shared `bridge-save` player/world resolution (log + PerWorldData + save) |
| `GET /api/debug/snapshot` | Structured diagnostics (save, log stack, resolved player, warnings) |
| `POST /api/chunks/data` | Reads `universe/worlds/<world>/chunks/*.region.bin` when present; **synthetic** fallback otherwise |
| `POST /api/worldgen/reload` | Queues `/worldgen reload --clear` |
| `POST /api/chunks/regenerate` | Queues `/chunk regenerate x z` for each chunk in radius (capped) |
| `POST /api/player/teleport` | Queues `/tp <player> x y z` |

File sync still happens inside TerraNova (Tauri copies files); this process does not replace that.

## Run (Windows)

```powershell
cd tools\terranova-bridge
cargo run --release -- --save "$env:APPDATA\Hytale\UserData\Saves\Worldgen V1"
```

On first run it writes:

`%APPDATA%\Hytale\UserData\Saves\Worldgen V1\bridge\config.json`

Copy **`auth_token`** into TerraNova → Bridge (`Ctrl+B`) → **Connect**.

Or from repo root:

```powershell
pnpm bridge:run
```

## TerraNova settings

- Host: `127.0.0.1`
- Port: `7854`
- Auth token: from `bridge/config.json`
- Server mod path: your pack root (e.g. `...\mods\McCal.Volume Lab`)

## Debugging

- Sidecar logs: `RUST_LOG=info,terranova_bridge=debug` (default filter includes `terranova_bridge=debug`).
- TerraNova → Bridge → **Bridge diagnostics** → **Run snapshot** (or `GET /api/debug/snapshot` with Bearer token).
- Player/world logic lives in **`tools/bridge-save`** (shared with Tauri); keep sidecar and app in sync by changing that crate only.

Writes `bridge/ITERATION.md` on first start (console cheat sheet).

`GET /api/status` includes `capabilities`: `save_player`, `save_chunks`, `synthetic_chunk_fallback`, `queue_console_commands`, `debug_snapshot`.

## Roadmap

1. **v0.2 sidecar** (this crate) — connect, player position, save-disk chunk preview, **executable** queued console commands  
2. **v0.3 JVM stub** — tail `pending-commands.log` → `CommandManager.handleCommand(ConsoleSender.INSTANCE, …)` ([server command docs](https://hytale-docs.pages.dev/modding/plugins/commands/))  
3. **v1.0 JVM plugin** — live chunk bytes, in-process reload/regen/teleport  

The editor client in `src-tauri/src/bridge/` stays the same; only the server implementation changes.
