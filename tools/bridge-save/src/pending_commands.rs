//! Console commands queued for the in-server TerraNovaBridge plugin (or manual paste).
//! Sidecar cannot execute server commands yet; lines match Hytale console syntax.

use std::io::Write;
use std::path::Path;

/// Max chunk regen lines per request (~11×11) to avoid huge logs.
pub const MAX_REGEN_COMMANDS: usize = 121;

/// Hard cap on regen radius (chunk coords).
pub const MAX_REGEN_RADIUS: u32 = 5;

pub fn append_pending_command(save_root: &Path, line: &str) {
    let dir = save_root.join("bridge");
    let _ = std::fs::create_dir_all(&dir);
    let path = dir.join("pending-commands.log");
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)
    {
        let _ = writeln!(f, "{line}");
    }
}

pub fn append_pending_commands(save_root: &Path, lines: &[String]) {
    for line in lines {
        append_pending_command(save_root, line);
    }
}

/// Reload generator definitions and clear chunks ([in-game commands glossary]).
pub fn worldgen_reload_clear_command() -> &'static str {
    "/worldgen reload --clear"
}

/// Live-edit viewport around the player ([HytaleModding worldgen tutorial]).
pub fn viewport_command(radius: u32) -> String {
    format!("/viewport --radius {radius}")
}

pub fn chunk_regenerate_command(chunk_x: i32, chunk_z: i32) -> String {
    format!("/chunk regenerate {chunk_x} {chunk_z}")
}

pub fn teleport_command(player_name: &str, x: f64, y: f64, z: f64) -> String {
    format!("/tp {player_name} {x:.2} {y:.2} {z:.2}")
}

/// Expand a square of chunk coordinates; returns (commands, truncated).
pub fn chunk_regen_commands(center_x: i32, center_z: i32, radius: u32) -> (Vec<String>, bool) {
    let r = radius.min(MAX_REGEN_RADIUS);
    let mut out = Vec::new();
    let mut truncated = radius > MAX_REGEN_RADIUS;
    for dz in -(r as i32)..=(r as i32) {
        for dx in -(r as i32)..=(r as i32) {
            if out.len() >= MAX_REGEN_COMMANDS {
                truncated = true;
                return (out, truncated);
            }
            let cx = center_x + dx;
            let cz = center_z + dz;
            out.push(chunk_regenerate_command(cx, cz));
        }
    }
    (out, truncated)
}

/// Pointer file so the JVM plugin finds the active save while the sidecar runs.
pub fn write_active_save_pointer(save_root: &Path) -> std::io::Result<()> {
    let appdata = std::env::var("APPDATA")
        .or_else(|_| std::env::var("HOME"))
        .map_err(|e| std::io::Error::new(std::io::ErrorKind::NotFound, e))?;
    let user_data = Path::new(&appdata).join("Hytale").join("UserData");
    std::fs::create_dir_all(&user_data)?;
    let pointer = user_data.join("bridge-active-save.txt");
    std::fs::write(pointer, save_root.display().to_string())
}

pub fn write_iteration_guide(save_root: &Path) -> std::io::Result<()> {
    let dir = save_root.join("bridge");
    std::fs::create_dir_all(&dir)?;
    let path = dir.join("ITERATION.md");
    if path.is_file() {
        return Ok(());
    }
    let text = r"# TerraNova Bridge iteration (sidecar)

The HTTP sidecar (`pnpm bridge:run`) reads your save for **World preview** and **player position**.
Install the JVM plugin (`pnpm bridge:plugin:build`) to run queued commands automatically.

## After TerraNova **Sync & Reload**

1. Open the Hytale **server console** for this save (singleplayer embedded server).
2. Run (or paste lines from `pending-commands.log`):

```
/worldgen reload --clear
/viewport --radius 5
```

3. For a small area, regen individual chunks (also queued by TerraNova **Regen**):

```
/chunk regenerate <chunkX> <chunkZ>
```

Chunk coords are block position ÷ 32 (floor).

## Mod packs on this save

- **Content mods** (e.g. McCal.*): enable in world settings; point TerraNova **Server mod path** at that folder.
- **TerraNova.Bridge**: optional empty sync slot; enable if you sync test files here.

## References

- [HytaleModding — edit biomes / viewport](https://github.com/HytaleModding/site/blob/main/content/docs/en/official-documentation/worldgen/worldgen-tutorial/README.mdx)
- [Hytale command system (plugin roadmap)](https://hytale-docs.pages.dev/modding/plugins/commands/)
- TerraNova: `src/docs/reference/bridge.md`
";
    std::fs::write(path, text)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    #[test]
    fn regen_grid_respects_cap() {
        let (cmds, truncated) = chunk_regen_commands(0, -86, 3);
        assert_eq!(cmds.len(), 49);
        assert!(!truncated);
        assert!(cmds[0].starts_with("/chunk regenerate"));
    }

    #[test]
    fn regen_truncates_large_radius() {
        let (cmds, truncated) = chunk_regen_commands(0, 0, 99);
        assert!(truncated);
        assert!(cmds.len() <= MAX_REGEN_COMMANDS);
    }

    #[test]
    fn append_writes_log() {
        let base = temp_dir().join(format!("tn-pending-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&base);
        append_pending_command(&base, "/worldgen reload --clear");
        let log = base.join("bridge").join("pending-commands.log");
        assert!(log.is_file());
        let raw = std::fs::read_to_string(&log).unwrap();
        assert!(raw.contains("worldgen reload"));
        let _ = std::fs::remove_dir_all(&base);
    }
}
