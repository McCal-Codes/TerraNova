use std::net::{SocketAddr, TcpStream};
use std::path::PathBuf;
use std::time::Duration;

use serde::Serialize;

use super::client::BridgeClient;
use super::live_player;
use super::mod_packs::{self, SaveModPackEntry};
use super::save_world;
use super::types::{PlayerInfo, ServerStatus};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeDiscovery {
    pub port_open: bool,
    pub save_name: String,
    pub save_root: Option<String>,
    pub mod_pack_path: Option<String>,
    pub mod_pack_folder: Option<String>,
    pub config_path: Option<String>,
    pub auth_token_from_config: Option<String>,
    pub bridge_version: Option<String>,
    pub bridge_mode: Option<String>,
    pub player_name: Option<String>,
    pub player_world: Option<String>,
    pub player_x: Option<f64>,
    pub player_y: Option<f64>,
    pub player_z: Option<f64>,
    pub chunk_x: Option<i32>,
    pub chunk_z: Option<i32>,
    pub singleplayer: Option<bool>,
    #[serde(default)]
    pub save_mod_packs: Vec<SaveModPackEntry>,
    pub bridge_mod_pack_path: Option<String>,
    pub suggested_mod_pack_path: Option<String>,
    pub enabled_mod_ids: Vec<String>,
    pub player_world_label: Option<String>,
    pub player_world_source: Option<String>,
    pub player_save_world_id: Option<String>,
    pub hytale_session_active: Option<bool>,
    pub player_world_live: Option<bool>,
    /// True when position is missing because the save Transform lags behind the active instance.
    pub player_position_stale: Option<bool>,
    /// per_world | server_log | player_save — how block coords were resolved.
    pub player_position_source: Option<String>,
    /// Whether the player's chunk column is present in a save `*.region.bin` file.
    pub player_chunk_on_disk: Option<bool>,
    #[serde(default)]
    pub instance_worlds: Vec<live_player::InstanceWorldStatus>,
    pub error: Option<String>,
}

fn hytale_save_root(save_name: &str) -> Option<PathBuf> {
    let appdata = std::env::var_os("APPDATA")?;
    Some(
        PathBuf::from(appdata)
            .join("Hytale")
            .join("UserData")
            .join("Saves")
            .join(save_name),
    )
}

/// `...\UserData\Saves\<Save>\mods\<Pack>` → save root + pack folder
fn parse_embedded_mod_pack(mod_pack_path: &str) -> Option<(PathBuf, String, String)> {
    let path = PathBuf::from(mod_pack_path);
    let mods_dir = path.parent()?;
    if mods_dir.file_name()?.to_str()? != "mods" {
        return None;
    }
    let save_root = mods_dir.parent()?.to_path_buf();
    let save_name = save_root.file_name()?.to_str()?.to_string();
    let mod_pack_folder = path.file_name()?.to_str()?.to_string();
    Some((save_root, save_name, mod_pack_folder))
}

pub fn resolve_save_root(
    save_name: &str,
    save_root_override: Option<&str>,
    mod_pack_path: Option<&str>,
) -> (PathBuf, String, Option<String>, Option<String>) {
    if let Some(pack) = mod_pack_path.and_then(parse_embedded_mod_pack) {
        return (
            pack.0,
            pack.1,
            mod_pack_path.map(|s| s.to_string()),
            Some(pack.2),
        );
    }
    if let Some(root) = save_root_override {
        let path = PathBuf::from(root);
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(save_name)
            .to_string();
        return (path, name, None, None);
    }
    let root = hytale_save_root(save_name).unwrap_or_else(|| PathBuf::from(save_name));
    (root, save_name.to_string(), None, None)
}

fn read_sidecar_token(save_root: &PathBuf) -> Option<(String, PathBuf)> {
    let config_path = save_root.join("bridge").join("config.json");
    let raw = std::fs::read_to_string(&config_path).ok()?;
    let json: serde_json::Value = serde_json::from_str(&raw).ok()?;
    let token = json.get("auth_token")?.as_str()?.to_string();
    Some((token, config_path))
}

pub fn is_port_open(host: &str, port: u16) -> bool {
    let addr: SocketAddr = match format!("{}:{}", host, port).parse() {
        Ok(a) => a,
        Err(_) => return false,
    };
    TcpStream::connect_timeout(&addr, Duration::from_millis(400)).is_ok()
}

pub async fn discover_bridge(
    save_name: &str,
    host: &str,
    port: u16,
    save_root_override: Option<&str>,
    mod_pack_path: Option<&str>,
) -> BridgeDiscovery {
    let (save_root_path, resolved_save_name, mod_pack_path_out, mod_pack_folder) =
        resolve_save_root(save_name, save_root_override, mod_pack_path);

    let mut result = BridgeDiscovery {
        port_open: is_port_open(host, port),
        save_name: resolved_save_name,
        save_root: None,
        mod_pack_path: mod_pack_path_out,
        mod_pack_folder,
        config_path: None,
        auth_token_from_config: None,
        bridge_version: None,
        bridge_mode: None,
        player_name: None,
        player_world: None,
        player_x: None,
        player_y: None,
        player_z: None,
        chunk_x: None,
        chunk_z: None,
        singleplayer: None,
        save_mod_packs: Vec::new(),
        bridge_mod_pack_path: None,
        suggested_mod_pack_path: None,
        enabled_mod_ids: Vec::new(),
        player_world_label: None,
        player_world_source: None,
        player_save_world_id: None,
        hytale_session_active: None,
        player_world_live: None,
        player_position_stale: None,
        player_position_source: None,
        player_chunk_on_disk: None,
        instance_worlds: Vec::new(),
        error: None,
    };

    let save_root = if save_root_path.is_dir() {
        save_root_path
    } else {
        result.error = Some(format!(
            "Save folder not found: {}",
            save_root_path.display()
        ));
        return result;
    };
    result.save_root = Some(save_root.to_string_lossy().into_owned());

    result.enabled_mod_ids = save_world::read_enabled_mod_ids(&save_root);

    match mod_packs::list_save_mod_packs(&save_root) {
        Ok(packs) => {
            result.bridge_mod_pack_path = packs
                .iter()
                .find(|p| p.is_bridge_pack)
                .map(|p| p.path.clone());
            result.save_mod_packs = packs.clone();
            result.suggested_mod_pack_path = save_world::suggest_mod_pack_path(
                &save_root,
                &packs,
                &result.enabled_mod_ids,
                None,
            );
        }
        Err(e) => {
            if result.error.is_none() {
                result.error = Some(e);
            }
        }
    }

    if let Some((token, config_path)) = read_sidecar_token(&save_root) {
        result.auth_token_from_config = Some(token.clone());
        result.config_path = Some(config_path.to_string_lossy().into_owned());

        if result.port_open {
            match probe_bridge_api(host, port, &token).await {
                Ok((status, player)) => {
                    result.bridge_version = Some(status.bridge_version);
                    result.bridge_mode = status.bridge_mode;
                    result.singleplayer = Some(status.singleplayer);
                    if let Some(live) = live_player::resolve_live_player_from_save(&save_root, true)
                    {
                        apply_live_player(&mut result, &save_root, live);
                    } else if let Some(p) = player {
                        result.player_name = Some(p.name);
                        result.player_x = p.x;
                        result.player_y = p.y;
                        result.player_z = p.z;
                        result.player_world = p.world.clone();
                        result.player_world_label = p.world_label.clone();
                    }
                }
                Err(e) => {
                    result.error = Some(format!(
                        "Port {} is open but Bridge API rejected the token: {}",
                        port, e
                    ));
                }
            }
        }
    } else if result.port_open {
        result.error = Some(format!(
            "Bridge is listening on {}:{} but no token at {}",
            host,
            port,
            save_root.join("bridge").join("config.json").display()
        ));
    }

    if result.player_name.is_none() {
        if let Some(live) = live_player::resolve_live_player_from_save(&save_root, result.port_open)
        {
            apply_live_player(&mut result, &save_root, live);
        }
    } else if result.instance_worlds.is_empty() {
        if let Some(wid) = result.player_world.as_deref() {
            result.instance_worlds = live_player::list_instance_worlds(&save_root, Some(wid));
        }
    }

    result
}

fn apply_live_player(
    result: &mut BridgeDiscovery,
    save_root: &std::path::Path,
    live: live_player::LivePlayerState,
) {
    result.player_name = Some(live.name);
    result.player_world = Some(live.world_id.clone());
    result.player_world_label = Some(live.label);
    result.player_world_source = Some(live.source.to_string());
    result.player_save_world_id = live.save_world_id;
    result.hytale_session_active = Some(live.hytale_session_active);
    result.player_world_live = Some(live.player_world_live);
    result.player_position_stale =
        Some(live.player_world_live && live.x.is_none() && live.z.is_none());
    result.player_position_source = live.position_source.map(|s| s.to_string());
    let live_id = if live.player_world_live {
        Some(live.world_id.as_str())
    } else {
        None
    };
    result.instance_worlds = live_player::list_instance_worlds(save_root, live_id);
    result.suggested_mod_pack_path = save_world::suggest_mod_pack_path(
        save_root,
        &result.save_mod_packs,
        &result.enabled_mod_ids,
        result.player_world.as_deref(),
    );
    if let (Some(x), Some(z)) = (live.x, live.z) {
        result.player_x = Some(x);
        result.player_z = Some(z);
        result.chunk_x = Some((x / 32.0).floor() as i32);
        result.chunk_z = Some((z / 32.0).floor() as i32);
    }
    if let (Some(cx), Some(cz), Some(wid)) = (
        result.chunk_x,
        result.chunk_z,
        result.player_world.as_deref(),
    ) {
        result.player_chunk_on_disk =
            Some(save_world::chunk_region_on_disk(save_root, wid, cx, cz));
    }
    result.player_y = live.y;
}

#[cfg(test)]
mod integration_tests {
    use super::*;
    use bridge_save::player::current_world_from_log_stack;
    use std::path::PathBuf;

    fn worldgen_v1_save() -> Option<PathBuf> {
        let appdata = std::env::var_os("APPDATA")?;
        let save = PathBuf::from(appdata)
            .join("Hytale")
            .join("UserData")
            .join("Saves")
            .join("Worldgen V1");
        save.is_dir().then_some(save)
    }

    #[test]
    fn discover_worldgen_v1_when_bridge_listening() {
        let Some(save_root) = worldgen_v1_save() else {
            return;
        };
        if !is_port_open("127.0.0.1", 7854) {
            return;
        }
        let mod_pack = save_root.join("mods").join("McCal.Autmn Forest");
        let mod_path = mod_pack
            .is_dir()
            .then(|| mod_pack.to_string_lossy().into_owned());
        let d = tokio::runtime::Builder::new_current_thread()
            .enable_all()
            .build()
            .expect("runtime")
            .block_on(discover_bridge(
                "Worldgen V1",
                "127.0.0.1",
                7854,
                Some(save_root.to_str().unwrap()),
                mod_path.as_deref(),
            ));
        assert!(d.port_open, "expected bridge on 7854: {:?}", d.error);
        assert_eq!(d.player_name.as_deref(), Some("McCal"));
        if let Some(log_world) = current_world_from_log_stack(&save_root) {
            assert_eq!(d.player_world.as_deref(), Some(log_world.as_str()));
            assert_eq!(
                d.player_world_source.as_deref(),
                Some("server_log_membership")
            );
            assert_eq!(
                d.player_world_label.as_deref(),
                Some(log_world.as_str()),
                "world label should match server log membership",
            );
            assert!(
                d.instance_worlds
                    .iter()
                    .any(|w| w.is_live && w.label == log_world),
                "instance list should mark {log_world} live: {:?}",
                d.instance_worlds
            );
        } else {
            assert!(
                matches!(
                    d.player_world_source.as_deref(),
                    Some("recent_world_activity")
                        | Some("player_per_world_position")
                        | Some("player_save")
                ),
                "without a visible log membership stack, discovery should use another grounded save signal: {:?}",
                d.player_world_source
            );
        }
    }
}

async fn probe_bridge_api(
    host: &str,
    port: u16,
    token: &str,
) -> Result<(ServerStatus, Option<PlayerInfo>), String> {
    let client = BridgeClient::new(host, port, token)?;
    let status = client.status().await?;
    let player = client.player_info().await.ok();
    Ok((status, player))
}
