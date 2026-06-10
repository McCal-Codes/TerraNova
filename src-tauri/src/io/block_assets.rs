use serde::Serialize;
use std::collections::HashMap;
use std::fs;
use std::path::{Component, Path, PathBuf};

use crate::io::hytale_assets;

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelIndexEntry {
    pub rel_path: String,
    pub abs_path: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BlockAssetIndex {
    pub texture_index: HashMap<String, String>,
    pub model_index: HashMap<String, Vec<ModelIndexEntry>>,
    pub model_tex_index: HashMap<String, String>,
    pub deco_themes: HashMap<String, String>,
}

fn rel_dir(rel_path: &str) -> String {
    rel_path
        .rsplit_once('/')
        .map(|(dir, _)| dir.to_string())
        .unwrap_or_default()
}

fn scan_textures(
    block_textures_dir: &Path,
    out: &mut HashMap<String, String>,
) -> Result<(), String> {
    if !block_textures_dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(block_textures_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.extension().and_then(|s| s.to_str()) != Some("png") {
            continue;
        }
        if let Some(stem) = path.file_stem().and_then(|s| s.to_str()) {
            out.insert(
                stem.to_lowercase(),
                path.file_name().unwrap().to_string_lossy().to_string(),
            );
        }
    }
    Ok(())
}

fn scan_models_recursive(
    dir: &Path,
    rel_base: &str,
    model_index: &mut HashMap<String, Vec<ModelIndexEntry>>,
    model_tex_index: &mut HashMap<String, String>,
) -> Result<(), String> {
    for entry in fs::read_dir(dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        let rel_name = entry.file_name().to_string_lossy().to_string();
        let rel_p = if rel_base.is_empty() {
            rel_name.clone()
        } else {
            format!("{}/{}", rel_base, rel_name)
        };

        if path.is_dir() {
            scan_models_recursive(&path, &rel_p, model_index, model_tex_index)?;
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();
        if file_name.ends_with(".blockymodel") {
            let base_name = file_name.trim_end_matches(".blockymodel");
            let key = base_name.to_lowercase();
            model_index.entry(key).or_default().push(ModelIndexEntry {
                rel_path: rel_p.clone(),
                abs_path: path.to_string_lossy().to_string(),
            });
        } else if file_name.contains("_Texture") || file_name.contains("_Textures") {
            let tex_base = file_name
                .trim_end_matches(".png")
                .trim_end_matches("_Texture")
                .trim_end_matches("_Textures")
                .trim_end_matches("_Texture2");
            let model_key = format!("{}/{}", rel_dir(&rel_p), tex_base)
                .trim_start_matches('/')
                .to_lowercase();
            model_tex_index.insert(model_key, rel_p);
        }
    }
    Ok(())
}

fn scan_deco_themes(blocks_dir: &Path, out: &mut HashMap<String, String>) -> Result<(), String> {
    let deco_dir = blocks_dir.join("Decorative_Sets");
    if !deco_dir.is_dir() {
        return Ok(());
    }
    for entry in fs::read_dir(&deco_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        if entry.file_type().map_err(|e| e.to_string())?.is_dir() {
            let name = entry.file_name().to_string_lossy().to_string();
            out.insert(name.to_lowercase(), name);
        }
    }
    Ok(())
}

/// Build in-memory indexes for block models/textures under the managed hytale-assets cache.
pub fn scan_hytale_block_asset_index() -> Result<BlockAssetIndex, String> {
    let root = hytale_assets::get_hytale_assets_root().map_err(|e| e.to_string())?;
    let blocks_dir = root.join("Common").join("Blocks");
    let textures_dir = root.join("Common").join("BlockTextures");

    if !blocks_dir.is_dir() && !textures_dir.is_dir() {
        return Err(
            "Hytale block assets not found — run Sync Hytale Assets in Settings".to_string(),
        );
    }

    let mut texture_index = HashMap::new();
    let mut model_index = HashMap::new();
    let mut model_tex_index = HashMap::new();
    let mut deco_themes = HashMap::new();

    scan_textures(&textures_dir, &mut texture_index)?;
    if blocks_dir.is_dir() {
        scan_models_recursive(&blocks_dir, "", &mut model_index, &mut model_tex_index)?;
        scan_deco_themes(&blocks_dir, &mut deco_themes)?;
    }

    Ok(BlockAssetIndex {
        texture_index,
        model_index,
        model_tex_index,
        deco_themes,
    })
}

/// Resolve a prefab path under allowed roots (project Server/Prefabs or cache Server/Prefabs).
pub fn resolve_prefab_path(
    relative_path: &str,
    project_root: Option<&str>,
) -> Result<PathBuf, String> {
    let normalized = relative_path.replace('\\', "/");
    let mut sanitized = PathBuf::new();
    for component in Path::new(&normalized).components() {
        match component {
            Component::Normal(part) => sanitized.push(part),
            Component::CurDir => {}
            _ => return Err("Invalid prefab path".to_string()),
        }
    }

    let mut stem = sanitized.to_string_lossy().to_string();
    if !stem.ends_with(".prefab.json") && !stem.ends_with(".json") {
        stem = format!("{}.prefab.json", stem);
    }

    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(project) = project_root {
        let project_path = PathBuf::from(project);
        candidates.push(project_path.join("Server").join("Prefabs").join(&stem));
        if stem.ends_with(".prefab.json") {
            let alt = stem.trim_end_matches(".prefab.json");
            candidates.push(
                project_path
                    .join("Server")
                    .join("Prefabs")
                    .join(format!("{}.json", alt)),
            );
        }
    }

    let cache_root = hytale_assets::get_hytale_assets_root().map_err(|e| e.to_string())?;
    candidates.push(cache_root.join("Server").join("Prefabs").join(&stem));

    for candidate in candidates {
        if candidate.is_file() {
            return Ok(candidate);
        }
    }

    Err(format!("Prefab not found: {}", relative_path))
}
