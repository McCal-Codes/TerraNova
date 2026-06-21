//! Discover WorldStructure ContentFields for a biome JSON path.

use serde_json::Value;
use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};

pub fn world_structures_dir_from_biome_path(biome_file_path: &str) -> Option<PathBuf> {
    let normalized = biome_file_path.replace('\\', "/");
    let marker = "/HytaleGenerator/Biomes/";
    if let Some(idx) = normalized
        .to_ascii_lowercase()
        .find(&marker.to_ascii_lowercase())
    {
        let root = &normalized[..idx];
        return Some(PathBuf::from(format!(
            "{root}/HytaleGenerator/WorldStructures"
        )));
    }
    let path = Path::new(&normalized);
    let parent = path.parent()?;
    let grandparent = parent.parent()?;
    Some(grandparent.join("WorldStructures"))
}

pub fn parse_content_fields_from_world_structure(
    ws: &Value,
) -> std::collections::HashMap<String, i32> {
    let mut fields = std::collections::HashMap::new();
    let Some(cf_array) = ws.get("ContentFields").and_then(|v| v.as_array()) else {
        return fields;
    };

    for cf in cf_array {
        let Some(obj) = cf.as_object() else { continue };
        let Some(name) = obj.get("Name").and_then(|v| v.as_str()) else {
            continue;
        };
        let name = name.trim();
        if name.is_empty() {
            continue;
        }
        let y_raw = obj.get("Y").or_else(|| obj.get("Value"));
        let y = match y_raw {
            Some(Value::Number(n)) => n.as_f64().and_then(|f| {
                if f.is_finite() {
                    Some(f.round() as i32)
                } else {
                    None
                }
            }),
            _ => None,
        };
        if let Some(y) = y {
            fields.insert(name.to_string(), y);
        }
    }
    fields
}

fn world_structure_references_biome(ws: &Value, biome_name: &str) -> bool {
    if ws
        .get("DefaultBiome")
        .and_then(|v| v.as_str())
        .is_some_and(|d| d == biome_name)
    {
        return true;
    }
    let Some(biomes) = ws.get("Biomes").and_then(|v| v.as_array()) else {
        return false;
    };
    biomes.iter().any(|entry| {
        entry
            .get("Biome")
            .and_then(|v| v.as_str())
            .is_some_and(|b| b == biome_name)
    })
}

pub fn infer_biome_name_from_file(wrapper: &Value, file_path: &str) -> String {
    if let Some(name) = wrapper.get("Name").and_then(|v| v.as_str()) {
        let trimmed = name.trim();
        if !trimmed.is_empty() {
            return trimmed.to_string();
        }
    }
    let base = Path::new(file_path)
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("Biome");
    base.trim_end_matches(".json").to_string()
}

/// Load ContentFields for a biome from sibling WorldStructures JSON files.
pub fn discover_content_fields_for_biome(
    biome_file_path: &str,
    biome_name: &str,
) -> Option<std::collections::HashMap<String, i32>> {
    let ws_dir = world_structures_dir_from_biome_path(biome_file_path)?;
    let entries = fs::read_dir(&ws_dir).ok()?;

    let mut json_files: Vec<PathBuf> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("json") {
            json_files.push(path);
        }
    }

    let mut paths_to_try: Vec<PathBuf> = Vec::new();
    let mut seen = HashSet::new();

    let push_path = |paths: &mut Vec<PathBuf>, seen: &mut HashSet<PathBuf>, path: PathBuf| {
        if seen.insert(path.clone()) {
            paths.push(path);
        }
    };

    let exact = ws_dir.join(format!("{biome_name}.json"));
    if exact.is_file() {
        push_path(&mut paths_to_try, &mut seen, exact);
    }

    for path in &json_files {
        if path.file_name().and_then(|s| s.to_str()) == Some(&format!("{biome_name}.json")) {
            continue;
        }
        let Ok(content) = fs::read_to_string(path) else {
            continue;
        };
        let Ok(ws) = serde_json::from_str::<Value>(&content) else {
            continue;
        };
        if world_structure_references_biome(&ws, biome_name) {
            push_path(&mut paths_to_try, &mut seen, path.clone());
        }
    }

    let main_world = ws_dir.join("MainWorld.json");
    if main_world.is_file() {
        push_path(&mut paths_to_try, &mut seen, main_world);
    }

    for path in paths_to_try {
        let Ok(content) = fs::read_to_string(&path) else {
            continue;
        };
        let Ok(ws) = serde_json::from_str::<Value>(&content) else {
            continue;
        };
        let fields = parse_content_fields_from_world_structure(&ws);
        if !fields.is_empty() {
            return Some(fields);
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn parses_content_fields_y_and_legacy_value() {
        let ws = json!({
            "ContentFields": [
                { "Name": "Base", "Y": 100 },
                { "Name": "Bedrock", "Value": 0 },
            ]
        });
        let fields = parse_content_fields_from_world_structure(&ws);
        assert_eq!(fields.get("Base"), Some(&100));
        assert_eq!(fields.get("Bedrock"), Some(&0));
    }

    #[test]
    fn derives_world_structures_dir() {
        let dir = world_structures_dir_from_biome_path(
            "C:/mod/Server/HytaleGenerator/Biomes/MyBiome.json",
        );
        assert_eq!(
            dir.map(|p| p.to_string_lossy().replace('\\', "/")),
            Some("C:/mod/Server/HytaleGenerator/WorldStructures".to_string())
        );
    }

    #[test]
    fn skips_unreadable_world_structure_files() {
        let base = std::env::temp_dir().join(format!(
            "tn-content-fields-{}-{}",
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .map(|d| d.as_nanos())
                .unwrap_or(0),
        ));
        let _ = std::fs::remove_dir_all(&base);
        let ws_dir = base.join("Server/HytaleGenerator/WorldStructures");
        std::fs::create_dir_all(&ws_dir).expect("mkdir");
        std::fs::write(ws_dir.join("corrupt.json"), "{ not json").expect("write corrupt");
        let good = json!({
            "ContentFields": [{ "Name": "Base", "Y": 42 }]
        });
        std::fs::write(
            ws_dir.join("MainWorld.json"),
            serde_json::to_string(&good).unwrap(),
        )
        .expect("write good");

        let biome_path = base.join("Server/HytaleGenerator/Biomes/TestBiome.json");
        std::fs::create_dir_all(biome_path.parent().unwrap()).expect("mkdir biome");
        std::fs::write(&biome_path, "{}").expect("write biome");

        let fields = discover_content_fields_for_biome(biome_path.to_str().unwrap(), "TestBiome");
        assert_eq!(fields.and_then(|f| f.get("Base").copied()), Some(42));
        let _ = std::fs::remove_dir_all(&base);
    }
}
