use std::path::PathBuf;

use crate::bridge::client::{BridgeClient, BridgeState};
use crate::bridge::discover::{self, BridgeDiscovery};
use crate::bridge::live_player;
use crate::bridge::plugin_deploy::{self, PluginStatus};
use crate::bridge::types::*;
use crate::io::path_scope;
use bridge_save::{self, BridgeDebugSnapshot};
use serde::Serialize;
#[cfg(target_os = "windows")]
use std::path::Path;
#[cfg(target_os = "windows")]
use std::process::{Command, Stdio};
#[cfg(target_os = "windows")]
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

#[tauri::command]
pub async fn bridge_start_sidecar(
    _force_restart_if_listening: Option<bool>,
    _save_root: Option<String>,
    _save_name: Option<String>,
) -> Result<BridgeStartSidecarResult, String> {
    #[cfg(target_os = "windows")]
    {
        let force_restart = _force_restart_if_listening.unwrap_or(true);
        if tokio::task::spawn_blocking(|| discover::is_port_open("127.0.0.1", 7854))
            .await
            .unwrap_or(false)
        {
            if !force_restart {
                return Ok(BridgeStartSidecarResult {
                    started: false,
                    already_running: true,
                    message: "Bridge sidecar is already running on 127.0.0.1:7854.".into(),
                });
            }
            stop_existing_bridge_processes();
        }

        let resolved_save =
            resolve_sidecar_save_root(_save_root.as_deref(), _save_name.as_deref())?;
        let save_label = resolved_save
            .file_name()
            .and_then(|s| s.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| resolved_save.display().to_string());

        let mut child = if let Some(bridge_exe) = find_bridge_binary() {
            Command::new(&bridge_exe)
                .args([
                    "--save",
                    resolved_save
                        .to_str()
                        .ok_or_else(|| "Invalid save path.".to_string())?,
                ])
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to start Bridge sidecar binary: {e}"))?
        } else {
            let script = find_bridge_run_script().ok_or_else(|| {
                "Could not locate Bridge sidecar binary or scripts/bridge-run.ps1. Start it manually with `pnpm bridge:run` from the TerraNova repo.".to_string()
            })?;
            let repo_root = script.parent().and_then(|p| p.parent()).ok_or_else(|| {
                "Could not resolve TerraNova repo root for sidecar startup.".to_string()
            })?;
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
                    resolved_save
                        .to_str()
                        .ok_or_else(|| "Invalid save path.".to_string())?,
                ])
                .current_dir(repo_root)
                .stdin(Stdio::null())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .map_err(|e| format!("Failed to start Bridge sidecar script: {e}"))?
        };
        let startup_deadline = Instant::now() + Duration::from_secs(8);
        loop {
            let port_open = tokio::task::spawn_blocking(|| discover::is_port_open("127.0.0.1", 7854))
                .await
                .unwrap_or(false);
            if port_open {
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
                    "Bridge sidecar exited before opening 127.0.0.1:7854 (exit code: {code}). Try `pnpm bridge:run` once to verify local tooling."
                ));
            }
            if Instant::now() >= startup_deadline {
                return Err(
                    "Bridge sidecar did not open 127.0.0.1:7854 within 8s. Try `pnpm bridge:run` once, then retry Start sidecar."
                        .into(),
                );
            }
            tokio::time::sleep(Duration::from_millis(100)).await;
        }

        Ok(BridgeStartSidecarResult {
            started: true,
            already_running: false,
            message: if force_restart {
                format!(
                    "Starting Bridge sidecar for {save_label} (forcing a clean restart if needed)…"
                )
            } else {
                format!("Starting Bridge sidecar for {save_label}…")
            },
        })
    }

    #[cfg(not(target_os = "windows"))]
    {
        Err("Bridge auto-start is only implemented on Windows; start the sidecar manually.".into())
    }
}

#[cfg(target_os = "windows")]
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

#[cfg(target_os = "windows")]
fn stop_existing_bridge_processes() {
    // Best-effort cleanup: ignore failures when no process exists.
    let _ = Command::new("taskkill")
        .args(["/F", "/IM", "terranova-bridge.exe"])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status();
}

#[derive(Serialize)]
pub struct BridgeStartSidecarResult {
    pub started: bool,
    pub already_running: bool,
    pub message: String,
}

#[cfg(target_os = "windows")]
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

#[cfg(target_os = "windows")]
fn find_bridge_binary() -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();

    if let Ok(cwd) = std::env::current_dir() {
        candidates.push(
            cwd.join("tools")
                .join("terranova-bridge")
                .join("target")
                .join("release")
                .join("terranova-bridge.exe"),
        );
    }

    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            candidates.push(exe_dir.join("terranova-bridge.exe"));
            for ancestor in exe_dir.ancestors() {
                candidates.push(
                    ancestor
                        .join("tools")
                        .join("terranova-bridge")
                        .join("target")
                        .join("release")
                        .join("terranova-bridge.exe"),
                );
            }
        }
    }

    candidates.push(
        Path::new(env!("CARGO_MANIFEST_DIR"))
            .parent()
            .unwrap_or_else(|| Path::new(env!("CARGO_MANIFEST_DIR")))
            .join("tools")
            .join("terranova-bridge")
            .join("target")
            .join("release")
            .join("terranova-bridge.exe"),
    );

    candidates.into_iter().find(|p| p.exists())
}

#[tauri::command]
pub async fn bridge_discover(
    save_name: Option<String>,
    save_root: Option<String>,
    mod_pack_path: Option<String>,
    host: Option<String>,
    port: Option<u16>,
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
) -> Result<PlayerInfo, String> {
    let client = state.get_client().await?;
    if let Ok(status) = client.status().await {
        if let Some(root) = status.save_root {
            let path = PathBuf::from(root);
            if let Some(live) = live_player::resolve_live_player_from_save(&path, true) {
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
