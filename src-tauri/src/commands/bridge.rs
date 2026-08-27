use std::path::PathBuf;

use crate::bridge::client::{BridgeClient, BridgeState};
use crate::bridge::discover::{self, BridgeDiscovery};
use crate::bridge::live_player;
use crate::bridge::plugin_deploy::{self, PluginStatus};
use crate::bridge::types::*;
use crate::io::path_scope;
use bridge_save::{self, BridgeDebugSnapshot};
use serde::Serialize;
use std::path::Path;
use std::process::{Command, Stdio};
use std::time::{Duration, Instant};

#[tauri::command]
pub async fn bridge_debug_snapshot(
    save_name: Option<String>,
    save_root: Option<String>,
    mod_pack_path: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    state: tauri::State<'_, BridgeState>,
) -> Result<BridgeDebugSnapshot, String> {
    let save = save_name.unwrap_or_default();
    let host = host.unwrap_or_else(|| "127.0.0.1".to_string());
    let port = port.unwrap_or(7854);
    let (save_root_path, _, _, _) =
        bridge_save::resolve_save_root(&save, save_root.as_deref(), mod_pack_path.as_deref());
    let port_open = discover::is_port_open(&host, port);
    let sidecar_root = if let Ok(client) = state.get_client().await {
        client
            .status()
            .await
            .ok()
            .and_then(|s| s.save_root)
            .map(PathBuf::from)
    } else {
        None
    };
    Ok(bridge_save::collect_snapshot(
        &save_root_path,
        port_open,
        sidecar_root.as_deref(),
    ))
}

/// Sidecar executable name for the host platform.
#[cfg(windows)]
const BRIDGE_BIN: &str = "terranova-bridge.exe";
#[cfg(not(windows))]
const BRIDGE_BIN: &str = "terranova-bridge";

#[tauri::command]
pub async fn bridge_start_sidecar(
    force_restart_if_listening: Option<bool>,
    save_root: Option<String>,
    save_name: Option<String>,
) -> Result<BridgeStartSidecarResult, String> {
    let force_restart = force_restart_if_listening.unwrap_or(true);

    if discover::is_port_open("127.0.0.1", 7854) {
        // Only Windows can reliably reclaim the port, because only there do we
        // have a targeted way to stop the previous sidecar. Elsewhere we report
        // rather than guess at which process to kill: matching by name would
        // risk taking down something the user did not ask us to touch.
        let can_restart = cfg!(windows) && force_restart;
        if !can_restart {
            return Ok(BridgeStartSidecarResult {
                started: false,
                already_running: true,
                message: if force_restart {
                    "Bridge sidecar is already running on 127.0.0.1:7854. Stop it first if it is serving a different save."
                        .into()
                } else {
                    "Bridge sidecar is already running on 127.0.0.1:7854.".into()
                },
            });
        }
        stop_existing_bridge_processes();
    }

    let resolved_save = resolve_sidecar_save_root(save_root.as_deref(), save_name.as_deref())?;
    let save_label = resolved_save
        .file_name()
        .and_then(|s| s.to_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| resolved_save.display().to_string());
    let save_arg = resolved_save
        .to_str()
        .ok_or_else(|| "Invalid save path.".to_string())?;

    let mut child = match find_bridge_binary() {
        // Spawn the binary directly rather than through a shell: no quoting to
        // get wrong, and no shell process left in the tree.
        Some(bridge_exe) => Command::new(&bridge_exe)
            .args(["--save", save_arg])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("Failed to start Bridge sidecar binary: {e}"))?,
        None => spawn_bridge_fallback(save_arg)?,
    };

    let startup_deadline = Instant::now() + Duration::from_secs(8);
    loop {
        if discover::is_port_open("127.0.0.1", 7854) {
            break;
        }
        if let Some(status) = child
            .try_wait()
            .map_err(|e| format!("Failed to monitor Bridge sidecar startup: {e}"))?
        {
            let code = status
                .code()
                .map(|c| c.to_string())
                .unwrap_or_else(|| "terminated by signal".to_string());
            return Err(format!(
                "Bridge sidecar exited before opening 127.0.0.1:7854 (exit code: {code}). Run `pnpm bridge:build` once to verify local tooling."
            ));
        }
        if Instant::now() >= startup_deadline {
            return Err(
                "Bridge sidecar did not open 127.0.0.1:7854 within 8s. Run `pnpm bridge:build`, then retry Start sidecar."
                    .into(),
            );
        }
        std::thread::sleep(Duration::from_millis(100));
    }

    Ok(BridgeStartSidecarResult {
        started: true,
        already_running: false,
        message: format!("Starting Bridge sidecar for {save_label}\u{2026}"),
    })
}

/// No prebuilt binary. On Windows the repo ships a PowerShell runner; anywhere
/// else there is nothing safe to shell out to, so say exactly what to run.
#[cfg(windows)]
fn spawn_bridge_fallback(save_arg: &str) -> Result<std::process::Child, String> {
    let script = find_bridge_run_script().ok_or_else(|| {
        "Could not locate the Bridge sidecar binary or scripts/bridge-run.ps1. Run `pnpm bridge:build` from the TerraNova repo."
            .to_string()
    })?;
    let repo_root = script
        .parent()
        .and_then(|p| p.parent())
        .ok_or_else(|| "Could not resolve TerraNova repo root for sidecar startup.".to_string())?;
    Command::new("powershell")
        .args([
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            script
                .to_str()
                .ok_or_else(|| "Invalid bridge script path.".to_string())?,
            "-Save",
            save_arg,
        ])
        .current_dir(repo_root)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Failed to start Bridge sidecar script: {e}"))
}

#[cfg(not(windows))]
fn spawn_bridge_fallback(_save_arg: &str) -> Result<std::process::Child, String> {
    Err(
        "Bridge sidecar has not been built yet. Run `pnpm bridge:build` from the TerraNova repo, then retry Start sidecar."
            .to_string(),
    )
}

fn resolve_sidecar_save_root(
    save_root: Option<&str>,
    save_name: Option<&str>,
) -> Result<PathBuf, String> {
    let name = save_name.unwrap_or_default();
    let has_hint = save_root.is_some_and(|s| !s.trim().is_empty()) || !name.trim().is_empty();
    if has_hint {
        let (path, _, _, _) = bridge_save::resolve_save_root(name, save_root, None);
        if path.is_dir() {
            return Ok(path);
        }
    }
    bridge_save::pick_default_save()
        .map(|(path, _)| path)
        .filter(|path| path.is_dir())
        .ok_or_else(|| {
            "Could not resolve a Hytale save for Bridge startup. Open a world once, then retry."
                .to_string()
        })
}

#[cfg(windows)]
fn stop_existing_bridge_processes() {
    // Best-effort cleanup: ignore failures when no process exists.
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", BRIDGE_BIN])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[cfg(not(windows))]
fn stop_existing_bridge_processes() {
    // Unreachable: the caller only reaches this on Windows. Deliberately does
    // nothing rather than pattern-matching process names.
}

#[derive(Serialize)]
pub struct BridgeStartSidecarResult {
    pub started: bool,
    pub already_running: bool,
    pub message: String,
}

#[cfg(windows)]
fn find_bridge_run_script() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(cwd.join("scripts").join("bridge-run.ps1"));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("scripts").join("bridge-run.ps1"));
            for ancestor in exe_dir.ancestors() {
                candidates.push(ancestor.join("scripts").join("bridge-run.ps1"));
            }
        }
    }
    candidates.push(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
            .join("scripts")
            .join("bridge-run.ps1"),
    );
    candidates.into_iter().find(|p| p.exists())
}

/// Where a built sidecar might live, most-specific first. Release is preferred
/// over debug so a stale debug build never shadows a fresh release one.
fn bridge_binary_candidates_in(root: &Path) -> Vec<PathBuf> {
    let target = root.join("tools").join("terranova-bridge").join("target");
    vec![
        target.join("release").join(BRIDGE_BIN),
        target.join("debug").join(BRIDGE_BIN),
    ]
}

fn find_bridge_binary() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        candidates.extend(bridge_binary_candidates_in(&cwd));
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            // Bundled next to the app binary.
            candidates.push(exe_dir.join(BRIDGE_BIN));
            for ancestor in exe_dir.ancestors() {
                candidates.extend(bridge_binary_candidates_in(ancestor));
            }
        }
    }

    candidates.extend(bridge_binary_candidates_in(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR"))),
    ));

    candidates.into_iter().find(|p| p.is_file())
}

#[tauri::command]
pub async fn bridge_discover(
    save_name: Option<String>,
    save_root: Option<String>,
    mod_pack_path: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    // `preferred_player_uuid` is the signed-in Hytale profile UUID, when the
    // user has opted to target their own player. `None` keeps the
    // newest-player-file heuristic.
    preferred_player_uuid: Option<String>,
) -> Result<BridgeDiscovery, String> {
    let save = save_name.unwrap_or_default();
    let host = host.unwrap_or_else(|| "127.0.0.1".to_string());
    let port = port.unwrap_or(7854);
    Ok(discover::discover_bridge(
        &save,
        &host,
        port,
        save_root.as_deref(),
        mod_pack_path.as_deref(),
        preferred_player_uuid.as_deref(),
    )
    .await)
}

#[tauri::command]
pub async fn bridge_connect(
    host: String,
    port: u16,
    auth_token: String,
    state: tauri::State<'_, BridgeState>,
) -> Result<ServerStatus, String> {
    let client = BridgeClient::new(&host, port, &auth_token)?;
    let status = client.status().await?;
    let mut lock = state.0.lock().await;
    *lock = Some(client);
    Ok(status)
}

#[tauri::command]
pub async fn bridge_disconnect(state: tauri::State<'_, BridgeState>) -> Result<(), String> {
    let mut lock = state.0.lock().await;
    *lock = None;
    Ok(())
}

#[tauri::command]
pub async fn bridge_status(state: tauri::State<'_, BridgeState>) -> Result<ServerStatus, String> {
    let client = state.get_client().await?;
    client.status().await
}

#[tauri::command]
pub async fn bridge_reload_worldgen(
    state: tauri::State<'_, BridgeState>,
) -> Result<BridgeResponse, String> {
    let client = state.get_client().await?;
    client.reload_worldgen().await
}

#[tauri::command]
pub async fn bridge_regenerate_chunks(
    x: i32,
    z: i32,
    radius: u32,
    state: tauri::State<'_, BridgeState>,
) -> Result<BridgeResponse, String> {
    let client = state.get_client().await?;
    client.regenerate_chunks(x, z, radius).await
}

#[tauri::command]
pub async fn bridge_teleport(
    player_name: String,
    x: f64,
    y: f64,
    z: f64,
    state: tauri::State<'_, BridgeState>,
) -> Result<BridgeResponse, String> {
    let client = state.get_client().await?;
    client.teleport(&player_name, x, y, z).await
}

#[tauri::command]
pub async fn bridge_player_info(
    state: tauri::State<'_, BridgeState>,
    // Kept in step with `bridge_discover` so both agree on which player is
    // being targeted.
    preferred_player_uuid: Option<String>,
) -> Result<PlayerInfo, String> {
    let client = state.get_client().await?;
    if let Ok(status) = client.status().await {
        if let Some(root) = status.save_root {
            let path = PathBuf::from(root);
            if let Some(live) = live_player::resolve_live_player_from_save(
                &path,
                true,
                preferred_player_uuid.as_deref(),
            ) {
                return Ok(PlayerInfo {
                    name: live.name,
                    uuid: live.uuid,
                    x: live.x,
                    y: live.y,
                    z: live.z,
                    world: Some(live.world_id),
                    world_label: Some(live.label),
                    position_source: live.position_source.map(|s| s.to_string()),
                });
            }
        }
    }
    client.player_info().await
}

#[tauri::command]
pub async fn bridge_fetch_palette(
    state: tauri::State<'_, BridgeState>,
) -> Result<BlockPaletteResponse, String> {
    let client = state.get_client().await?;
    client.fetch_palette().await
}

#[tauri::command]
pub async fn bridge_fetch_chunk(
    chunk_x: i32,
    chunk_z: i32,
    y_min: i32,
    y_max: i32,
    force_load: bool,
    state: tauri::State<'_, BridgeState>,
) -> Result<ChunkDataResponse, String> {
    let client = state.get_client().await?;
    client
        .fetch_chunk(chunk_x, chunk_z, y_min, y_max, force_load)
        .await
}

#[tauri::command]
pub fn bridge_plugin_status(patchline: Option<String>) -> Result<PluginStatus, String> {
    Ok(plugin_deploy::plugin_status(patchline.as_deref()))
}

#[tauri::command]
pub fn bridge_deploy_plugin(patchline: Option<String>) -> Result<String, String> {
    plugin_deploy::deploy_plugin(patchline.as_deref())
}

#[tauri::command]
pub async fn bridge_sync_file(
    source_path: String,
    server_mod_path: String,
    relative_path: String,
    state: tauri::State<'_, BridgeState>,
) -> Result<BridgeResponse, String> {
    // Validate the source path is within an allowed project scope
    path_scope::validate_path_str(&source_path)?;

    // Validate that relative_path doesn't escape server_mod_path via ".." traversal
    let base = std::path::Path::new(&server_mod_path)
        .canonicalize()
        .map_err(|e| format!("Invalid server mod path: {}", e))?;
    let dest = base.join(&relative_path);
    // Ensure parent directory exists before canonicalizing
    if let Some(parent) = dest.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let dest_canon = dest
        .canonicalize()
        .or_else(|_| {
            // File doesn't exist yet — canonicalize the parent and append the filename
            if let (Some(parent), Some(name)) = (dest.parent(), dest.file_name()) {
                let canon_parent = parent.canonicalize().map_err(|e| e.to_string())?;
                Ok(canon_parent.join(name))
            } else {
                Err(format!("Invalid destination path: {}", dest.display()))
            }
        })
        .map_err(|e: String| e)?;

    if !dest_canon.starts_with(&base) {
        return Err(format!(
            "Path traversal blocked: {} escapes {}",
            relative_path, server_mod_path
        ));
    }

    let dest_str = dest_canon.to_str().ok_or("Invalid destination path")?;
    BridgeClient::sync_file(&source_path, dest_str)?;

    let client = state.get_client().await?;
    client.reload_worldgen().await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn binary_name_matches_the_host_platform() {
        if cfg!(windows) {
            assert_eq!(BRIDGE_BIN, "terranova-bridge.exe");
        } else {
            assert_eq!(BRIDGE_BIN, "terranova-bridge");
        }
    }

    #[test]
    fn release_is_preferred_over_debug() {
        let c = bridge_binary_candidates_in(Path::new("/repo"));
        assert_eq!(c.len(), 2);
        // A stale debug build must never shadow a fresh release one.
        assert!(c[0].to_string_lossy().contains("release"));
        assert!(c[1].to_string_lossy().contains("debug"));
        for p in &c {
            assert!(p.ends_with(BRIDGE_BIN));
            assert!(p.starts_with("/repo/tools/terranova-bridge/target"));
        }
    }

    /// Whatever we hand to `Command::new` must be a real file, never a
    /// directory that merely happens to sit at a candidate path.
    #[test]
    fn found_binary_is_an_actual_file() {
        // `None` just means the sidecar is not built in this checkout; the
        // command surfaces a build hint in that case.
        if let Some(p) = find_bridge_binary() {
            assert!(p.is_file(), "{} is not a file", p.display());
            assert!(p.ends_with(BRIDGE_BIN));
        }
    }
}
