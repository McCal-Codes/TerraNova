use std::path::{Path, PathBuf};

use super::mod_packs::SaveModPackEntry;

/// `McCal:Autmn Forest` → folder `McCal.Autmn Forest`
pub fn mod_id_to_folder(mod_id: &str) -> String {
    mod_id.replace(':', ".")
}

#[derive(Debug, Clone)]
pub struct WorldConfigSummary {
    pub display_name: Option<String>,
    pub world_structure: Option<String>,
}

pub fn read_enabled_mod_ids(save_root: &Path) -> Vec<String> {
    let config_path = save_root.join("config.json");
    let raw = match std::fs::read_to_string(&config_path) {
        Ok(s) => s,
        Err(_) => return Vec::new(),
    };
    let json: serde_json::Value = match serde_json::from_str(&raw) {
        Ok(v) => v,
        Err(_) => return Vec::new(),
    };
    let mods = match json.get("Mods").and_then(|m| m.as_object()) {
        Some(m) => m,
        None => return Vec::new(),
    };
    let mut enabled: Vec<String> = mods
        .iter()
        .filter_map(|(id, entry)| {
            entry
                .get("Enabled")
                .and_then(|e| e.as_bool())
                .filter(|&on| on)
                .map(|_| id.clone())
        })
        .collect();
    enabled.sort();
    enabled
}

pub fn read_world_config(save_root: &Path, world_id: &str) -> WorldConfigSummary {
    let config_path = save_root
        .join("universe")
        .join("worlds")
        .join(world_id)
        .join("config.json");
    let mut summary = WorldConfigSummary {
        display_name: None,
        world_structure: None,
    };
    let Ok(raw) = std::fs::read_to_string(&config_path) else {
        return summary;
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&raw) else {
        return summary;
    };
    summary.display_name = json
        .get("DisplayName")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    summary.world_structure = json
        .get("WorldGen")
        .and_then(|w| w.get("WorldStructure"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    summary
}

pub fn chunk_region_path(save_root: &Path, world_id: &str, chunk_x: i32, chunk_z: i32) -> PathBuf {
    let region_x = chunk_x.div_euclid(32);
    let region_z = chunk_z.div_euclid(32);
    save_root
        .join("universe")
        .join("worlds")
        .join(world_id)
        .join("chunks")
        .join(format!("{region_x}.{region_z}.region.bin"))
}

/// True when the region file for this chunk column exists (live world or same instance slug).
pub fn chunk_region_on_disk(save_root: &Path, world_id: &str, chunk_x: i32, chunk_z: i32) -> bool {
    if chunk_region_path(save_root, world_id, chunk_x, chunk_z).is_file() {
        return true;
    }
    let Some(slug) = instance_slug_from_world_id(world_id) else {
        return false;
    };
    let prefix = format!("instance-{slug}-");
    let worlds_dir = save_root.join("universe").join("worlds");
    let Ok(entries) = std::fs::read_dir(&worlds_dir) else {
        return false;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        let Some(name) = path.file_name().and_then(|n| n.to_str()) else {
            continue;
        };
        if !name.starts_with(prefix.as_str()) {
            continue;
        }
        if chunk_region_path(save_root, name, chunk_x, chunk_z).is_file() {
            return true;
        }
    }
    false
}

pub fn instance_slug_from_world_id(world_id: &str) -> Option<String> {
    if world_id == "default" {
        return Some("default".into());
    }
    let rest = world_id.strip_prefix("instance-")?;
    if rest.len() <= 37 {
        return None;
    }
    let (slug, uuid_part) = rest.split_at(rest.len() - 36);
    if uuid_part.chars().filter(|c| *c == '-').count() != 4 {
        return None;
    }
    if !uuid_part.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        return None;
    }
    let slug = slug.trim_end_matches('-');
    if slug.is_empty() {
        None
    } else {
        Some(slug.to_string())
    }
}

pub fn suggest_mod_pack_path(
    save_root: &Path,
    packs: &[SaveModPackEntry],
    enabled_mod_ids: &[String],
    player_world: Option<&str>,
) -> Option<String> {
    if let Some(world) = player_world {
        let cfg = read_world_config(save_root, world);
        if let Some(ws) = cfg.world_structure.as_deref() {
            if ws.contains("Autmn") || ws.contains("Autumn") {
                if let Some(p) = packs.iter().find(|p| p.folder_name.contains("Autmn")) {
                    return Some(p.path.clone());
                }
            }
            if ws.contains("Volume Lab") {
                if let Some(p) = packs.iter().find(|p| p.folder_name.contains("Volume Lab")) {
                    return Some(p.path.clone());
                }
            }
        }
        if let Some(slug) = instance_slug_from_world_id(world) {
            for pack in packs {
                if pack.folder_name.contains(&slug) || slug.contains(pack.folder_name.as_str()) {
                    return Some(pack.path.clone());
                }
            }
            if slug.contains("Autmn") || slug.contains("Autumn") {
                if let Some(p) = packs.iter().find(|p| p.folder_name.contains("Autmn")) {
                    return Some(p.path.clone());
                }
            }
            if slug.contains("Volume Lab") {
                if let Some(p) = packs.iter().find(|p| p.folder_name.contains("Volume Lab")) {
                    return Some(p.path.clone());
                }
            }
        }
    }

    for id in enabled_mod_ids {
        let folder = mod_id_to_folder(id);
        if folder == super::mod_packs::TERRANOVA_BRIDGE_MOD_FOLDER {
            continue;
        }
        if let Some(p) = packs
            .iter()
            .find(|p| p.folder_name == folder && p.has_worldgen)
        {
            return Some(p.path.clone());
        }
    }

    packs
        .iter()
        .find(|p| p.has_worldgen && !p.is_bridge_pack)
        .map(|p| p.path.clone())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_region_path_uses_region_coords() {
        let save = PathBuf::from("/save");
        let path = chunk_region_path(&save, "default", -31, 17);
        assert_eq!(
            path.file_name().and_then(|n| n.to_str()),
            Some("-1.0.region.bin")
        );
    }

    #[test]
    fn parses_instance_slug() {
        assert_eq!(
            instance_slug_from_world_id(
                "instance-Unknown_Worlds-484eb8a8-c59e-4111-a438-6182ce3f9d36"
            )
            .as_deref(),
            Some("Unknown_Worlds")
        );
        assert_eq!(
            instance_slug_from_world_id(
                "instance-Autmn Forest-38004916-f6a2-46ab-8af4-0a02434d62f6"
            )
            .as_deref(),
            Some("Autmn Forest")
        );
    }

    #[test]
    fn mod_id_to_folder_replaces_colon() {
        assert_eq!(mod_id_to_folder("McCal:Autmn Forest"), "McCal.Autmn Forest");
    }
}
