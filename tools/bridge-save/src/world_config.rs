use std::path::{Path, PathBuf};

#[derive(Debug, Clone)]
pub struct WorldConfigSummary {
    pub world_id: String,
    pub display_name: Option<String>,
    pub world_structure: Option<String>,
}

pub fn read_world_config(save_root: &Path, world_id: &str) -> WorldConfigSummary {
    let config_path = save_root
        .join("universe")
        .join("worlds")
        .join(world_id)
        .join("config.json");
    let mut summary = WorldConfigSummary {
        world_id: world_id.to_string(),
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

pub fn label_from_world_config(summary: &WorldConfigSummary) -> String {
    summary
        .world_structure
        .clone()
        .or(summary.display_name.clone())
        .or_else(|| instance_slug_from_world_id(&summary.world_id))
        .unwrap_or_else(|| summary.world_id.clone())
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

pub fn chunk_region_on_disk(save_root: &Path, world_id: &str, chunk_x: i32, chunk_z: i32) -> bool {
    let path = chunk_region_path(save_root, world_id, chunk_x, chunk_z);
    if path.is_file() {
        return true;
    }
    let Some(slug) = instance_slug_from_world_id(world_id) else {
        return false;
    };
    let worlds_dir = save_root.join("universe").join("worlds");
    let Ok(read_dir) = std::fs::read_dir(&worlds_dir) else {
        return false;
    };
    for entry in read_dir.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if name.starts_with("instance-") && name.contains(&slug) {
            let alt = chunk_region_path(save_root, &name, chunk_x, chunk_z);
            if alt.is_file() {
                return true;
            }
        }
    }
    false
}
