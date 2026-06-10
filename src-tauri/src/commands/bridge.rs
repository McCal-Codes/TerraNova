use std::path::PathBuf;

use crate::bridge::client::{BridgeClient, BridgeState};
use crate::bridge::discover::{self, BridgeDiscovery};
use crate::bridge::live_player;
use crate::bridge::types::*;
use crate::io::path_scope;
use bridge_save::BridgeDebugSnapshot;

#[tauri::command]
pub async fn bridge_debug_snapshot(
    save_name: Option<String>,
    save_root: Option<String>,
    mod_pack_path: Option<String>,
    host: Option<String>,
    port: Option<u16>,
    state: tauri::State<'_, BridgeState>,
) -> Result<BridgeDebugSnapshot, String> {
    let save = save_name.unwrap_or_else(|| "Worldgen V1".to_string());
    let host = host.unwrap_or_else(|| "127.0.0.1".to_string());
    let port = port.unwrap_or(7854);
    let (save_root_path, _, _, _) =
        discover::resolve_save_root(&save, save_root.as_deref(), mod_pack_path.as_deref());
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
pub async fn bridge_discover(
    save_name: Option<String>,
    save_root: Option<String>,
    mod_pack_path: Option<String>,
    host: Option<String>,
    port: Option<u16>,
) -> Result<BridgeDiscovery, String> {
    let save = save_name.unwrap_or_else(|| "Worldgen V1".to_string());
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
