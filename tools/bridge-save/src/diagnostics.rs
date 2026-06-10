use std::path::Path;

use serde::Serialize;

use crate::player::{
    self, current_world_from_log_stack, hytale_server_session_active, newest_server_log_path,
    prefer_live_world_signals, resolve_player,
};
use crate::world_config;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeDebugSnapshot {
    pub save_root: String,
    pub save_exists: bool,
    pub bridge_config_exists: bool,
    pub prefer_live_signals: bool,
    pub session_active: bool,
    pub server_log_path: Option<String>,
    pub server_log_age_secs: Option<u64>,
    pub log_world_stack: Option<String>,
    pub active_player_file: Option<String>,
    pub player_file_age_secs: Option<u64>,
    pub resolved_world_id: Option<String>,
    pub resolved_world_label: Option<String>,
    pub resolved_world_source: Option<String>,
    pub resolved_position_source: Option<String>,
    pub resolved_x: Option<f64>,
    pub resolved_y: Option<f64>,
    pub resolved_z: Option<f64>,
    pub player_chunk_on_disk: Option<bool>,
    pub sidecar_save_root: Option<String>,
    pub save_root_mismatch: bool,
    pub pending_command_lines: Vec<String>,
    pub warnings: Vec<String>,
}

fn age_secs(path: &Path) -> Option<u64> {
    let modified = std::fs::metadata(path).ok()?.modified().ok()?;
    modified.elapsed().ok().map(|e| e.as_secs())
}

fn read_pending_commands_tail(save_root: &Path, max_lines: usize) -> Vec<String> {
    let path = save_root.join("bridge").join("pending-commands.log");
    let Ok(raw) = std::fs::read_to_string(&path) else {
        return Vec::new();
    };
    raw.lines()
        .rev()
        .take(max_lines)
        .map(|s| s.to_string())
        .collect::<Vec<_>>()
        .into_iter()
        .rev()
        .collect()
}

pub fn collect_snapshot(
    save_root: &Path,
    bridge_port_open: bool,
    sidecar_save_root: Option<&Path>,
) -> BridgeDebugSnapshot {
    let save_root_str = save_root.display().to_string();
    let save_exists = save_root.is_dir();
    let config_path = save_root.join("bridge").join("config.json");
    let bridge_config_exists = config_path.is_file();
    let prefer_live = prefer_live_world_signals(save_root, bridge_port_open);
    let session_active = hytale_server_session_active(save_root);

    let log_path = newest_server_log_path(save_root);
    let server_log_age_secs = log_path.as_ref().and_then(|p| age_secs(p));
    let log_world_stack = current_world_from_log_stack(save_root);

    let players_dir = save_root.join("universe").join("players");
    let active_player = player::active_player_file(&players_dir);
    let player_file_age_secs = active_player.as_ref().and_then(|p| age_secs(p));

    let mut warnings = Vec::new();
    if !save_exists {
        warnings.push("Save folder not found on disk.".into());
    }
    if bridge_port_open && !bridge_config_exists {
        warnings.push("Bridge port is open but bridge/config.json is missing in this save.".into());
    }
    if prefer_live && log_world_stack.is_none() {
        warnings.push(
            "Live signals enabled but no world on server log membership stack (player may be offline or log rotated)."
                .into(),
        );
    }

    let sidecar_str = sidecar_save_root.map(|p| p.display().to_string());
    let save_root_mismatch = match sidecar_save_root {
        Some(sidecar) => {
            let mismatch = sidecar != save_root;
            if mismatch {
                warnings.push(format!(
                    "TerraNova discovery save ({}) differs from sidecar --save ({}).",
                    save_root.display(),
                    sidecar.display()
                ));
            }
            mismatch
        }
        None => false,
    };

    let resolved = resolve_player(save_root, bridge_port_open);
    let (chunk_on_disk, pos_src, world_src) = if let Some(ref r) = resolved {
        let cx = r.x.map(|x| (x / 32.0).floor() as i32);
        let cz = r.z.map(|z| (z / 32.0).floor() as i32);
        let on_disk = match (cx, cz) {
            (Some(cx), Some(cz)) => Some(world_config::chunk_region_on_disk(
                save_root,
                &r.world_id,
                cx,
                cz,
            )),
            _ => None,
        };
        (
            on_disk,
            r.position_source.map(|s| s.to_string()),
            Some(r.source.to_string()),
        )
    } else {
        (None, None, None)
    };

    if resolved.is_none() {
        warnings.push("Could not resolve player from universe/players/*.json.".into());
    } else if resolved.as_ref().and_then(|r| r.x).is_none() {
        warnings.push(
            "World resolved but block position missing — wait for save flush or re-enter instance (see server log)."
                .into(),
        );
    }

    BridgeDebugSnapshot {
        save_root: save_root_str,
        save_exists,
        bridge_config_exists,
        prefer_live_signals: prefer_live,
        session_active,
        server_log_path: log_path.map(|p| p.display().to_string()),
        server_log_age_secs,
        log_world_stack,
        active_player_file: active_player.map(|p| p.display().to_string()),
        player_file_age_secs,
        resolved_world_id: resolved.as_ref().map(|r| r.world_id.clone()),
        resolved_world_label: resolved.as_ref().map(|r| r.label.clone()),
        resolved_world_source: world_src,
        resolved_position_source: pos_src,
        resolved_x: resolved.as_ref().and_then(|r| r.x),
        resolved_y: resolved.as_ref().and_then(|r| r.y),
        resolved_z: resolved.as_ref().and_then(|r| r.z),
        player_chunk_on_disk: chunk_on_disk,
        sidecar_save_root: sidecar_str,
        save_root_mismatch,
        pending_command_lines: read_pending_commands_tail(save_root, 8),
        warnings,
    }
}
