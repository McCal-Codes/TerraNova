use bridge_save::player::{prefer_live_world_signals, resolve_player};
use std::path::Path;

use crate::types::PlayerInfo;

/// Read player position/world from the Hytale save (shared `bridge-save` logic).
pub fn read_player_info(save_root: &Path) -> Option<PlayerInfo> {
    let use_live = prefer_live_world_signals(save_root, true);
    let live = resolve_player(save_root, use_live)?;
    Some(PlayerInfo {
        name: live.name,
        uuid: live.uuid,
        x: live.x,
        y: live.y,
        z: live.z,
        world: Some(live.world_id),
        world_label: Some(live.label),
        position_source: live.position_source.map(|s| s.to_string()),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::Value;

    #[test]
    fn resolves_minimal_player_json_via_bridge_save() {
        let dir = std::env::temp_dir().join(format!("tn-bridge-player-{}", uuid::Uuid::new_v4()));
        let players = dir.join("universe").join("players");
        std::fs::create_dir_all(&players).unwrap();
        let json: Value = serde_json::json!({
            "Components": {
                "Nameplate": { "Text": "TestPlayer" },
                "Transform": {
                    "Position": { "X": 10.5, "Y": 64.0, "Z": -20.0 }
                },
                "Player": {
                    "PlayerData": { "World": "default" }
                }
            }
        });
        let path = players.join("abc.json");
        std::fs::write(&path, serde_json::to_string(&json).unwrap()).unwrap();
        let info = read_player_info(&dir).unwrap();
        assert_eq!(info.name, "TestPlayer");
        assert_eq!(info.x, Some(10.5));
        assert_eq!(info.world.as_deref(), Some("default"));
        let _ = std::fs::remove_dir_all(&dir);
    }
}
