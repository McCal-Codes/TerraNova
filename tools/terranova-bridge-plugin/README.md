# TerraNova Bridge (JVM plugin)

In-server companion for [TerraNova Bridge](../../src/docs/reference/bridge.md). Executes queued console commands from `bridge/pending-commands.log` while you iterate worldgen from the editor.

**Does not replace the Rust sidecar** — keep `pnpm bridge:run` for HTTP Connect and World preview until in-process HTTP ships.

## Build

Requires **JDK 25** (matches `com.hypixel.hytale:Server` on Maven) and network access to `maven.hytale.com` (release channel by default).

```powershell
# from repo root
pnpm bridge:plugin:build
```

Output: `build/libs/TerraNova.Bridge-0.3.0.jar`

Pre-release server API:

```powershell
./gradlew jar -Phytale_channel=pre-release
```

## Install (Worldgen V1 / singleplayer)

1. Copy `TerraNova.Bridge-0.3.0.jar` to `%APPDATA%\Hytale\UserData\Mods\`
2. In Hytale, enable **TerraNova: Bridge** on the save (alongside content mods like McCal.*)
3. Start the world, run `pnpm bridge:run`, connect TerraNova Bridge
4. Use **Sync & Reload** / **Regen** — commands run in-game automatically

The sidecar writes `%APPDATA%\Hytale\UserData\bridge-active-save.txt` so the plugin knows which save to poll.

Results append to `<save>/bridge/command-results.log`.

## In-game commands

Use these from the Hytale console while the save is running:

| Command | Description |
|---------|-------------|
| `/tnbridge status` | Polling state, save, queue size, sidecar reachability |
| `/tnbridge save` | Resolved save root and pointer source |
| `/tnbridge pause` | Pause executing queued commands |
| `/tnbridge resume` | Resume queued command execution |
| `/tnbridge doctor` | Health checks with OK/WARN/FAIL guidance |
| `/tnbridge notify on` | Enable in-game chat notifications for queued commands |
| `/tnbridge notify off` | Disable in-game chat notifications |
| `/tnbridge notify status` | Show notification setting |

When enabled (default), players see one short chat message per poll tick, for example:
- `[TerraNova] Ran /worldgen reload --clear (2 more queued)`
- `[TerraNova] Command failed: /worldgen reload --clear`

The `notify on|off` setting is saved in the plugin data folder and survives restarts.

Duplicate messages are throttled to avoid spam during heavy regen loops.

Alias: `/tnb` (same subcommands, e.g. `/tnb status`).

## Architecture

| Component | Role |
|-----------|------|
| Rust sidecar | Loopback HTTP, save-disk chunk preview, queues commands |
| This JAR | `CommandManager.handleCommand(ConsoleSender.INSTANCE, …)` |
| `TerraNova.Bridge/` folder | Optional asset pack sync target (separate from this JAR) |

## See also

- [tools/terranova-bridge/README.md](../terranova-bridge/README.md) — sidecar
- [Hytale command system](https://hytale-docs.pages.dev/modding/plugins/commands/)
