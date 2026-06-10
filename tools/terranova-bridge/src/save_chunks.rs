//! Load real chunk columns from `universe/worlds/<world>/chunks/*.region.bin`.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use crate::block_section::section_index;
use crate::chunk_column::parse_chunk_column_bson;
use crate::player;
use crate::region_storage::{region_path, RegionFile};
use crate::types::ChunkDataResponse;

const CHUNK_SIZE: i32 = 32;

pub struct PaletteInterner {
    next_id: i32,
    name_to_id: HashMap<String, i32>,
    pub palette: HashMap<String, String>,
}

impl PaletteInterner {
    pub fn new() -> Self {
        let mut interner = Self {
            next_id: 100,
            name_to_id: HashMap::new(),
            palette: crate::palette::default_palette(),
        };
        for (id_str, name) in &interner.palette.clone() {
            if let Ok(id) = id_str.parse::<i32>() {
                interner.name_to_id.insert(name.clone(), id);
            }
        }
        interner
    }

    pub fn id_for_block(&mut self, name: &str) -> i32 {
        if name.is_empty() || name == "Empty" {
            return 0;
        }
        if let Some(&id) = self.name_to_id.get(name) {
            return id;
        }
        let id = self.next_id;
        self.next_id += 1;
        self.name_to_id.insert(name.to_string(), id);
        self.palette.insert(id.to_string(), name.to_string());
        id
    }
}

fn world_has_region(world_dir: &Path, chunk_x: i32, chunk_z: i32) -> bool {
    let region_x = chunk_x.div_euclid(32);
    let region_z = chunk_z.div_euclid(32);
    region_path(world_dir, region_x, region_z).is_file()
}

fn worlds_with_slug<'a>(worlds_dir: &'a Path, slug: &str) -> impl Iterator<Item = PathBuf> + 'a {
    let prefix = format!("instance-{slug}-");
    std::fs::read_dir(worlds_dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(move |p| {
            p.file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.starts_with(prefix.as_str()))
        })
}

pub fn resolve_world_dir(
    save_root: &Path,
    preferred_world: Option<&str>,
    chunk_x: i32,
    chunk_z: i32,
) -> Option<PathBuf> {
    let worlds_dir = save_root.join("universe").join("worlds");

    let try_world = |world_id: &str| -> Option<PathBuf> {
        let dir = worlds_dir.join(world_id);
        if world_has_region(&dir, chunk_x, chunk_z) {
            return Some(dir);
        }
        if let Some(slug) = bridge_save::instance_slug_from_world_id(world_id) {
            for candidate in worlds_with_slug(&worlds_dir, &slug) {
                if world_has_region(&candidate, chunk_x, chunk_z) {
                    return Some(candidate);
                }
            }
        }
        None
    };

    if let Some(world_id) = preferred_world {
        if let Some(dir) = try_world(world_id) {
            return Some(dir);
        }
    }

    if let Some(info) = player::read_player_info(save_root) {
        if let Some(world) = info.world.as_deref() {
            if let Some(dir) = try_world(world) {
                return Some(dir);
            }
        }
    }

    // Last resort: any world that actually has this region file on disk.
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    let Ok(entries) = std::fs::read_dir(&worlds_dir) else {
        return None;
    };
    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !world_has_region(&path, chunk_x, chunk_z) {
            continue;
        }
        let chunks = path.join("chunks");
        let mtime = std::fs::read_dir(&chunks)
            .ok()
            .into_iter()
            .flatten()
            .filter_map(|e| e.ok())
            .filter_map(|e| e.metadata().ok())
            .filter_map(|m| m.modified().ok())
            .max()
            .unwrap_or(std::time::SystemTime::UNIX_EPOCH);
        match &best {
            Some((prev, _)) if mtime <= *prev => {}
            _ => best = Some((mtime, path)),
        }
    }
    best.map(|(_, p)| p)
}

pub fn load_chunk_from_save(
    save_root: &Path,
    preferred_world: Option<&str>,
    interner: &mut PaletteInterner,
    chunk_x: i32,
    chunk_z: i32,
    y_min: i32,
    y_max: i32,
) -> Option<ChunkDataResponse> {
    let world_dir = resolve_world_dir(save_root, preferred_world, chunk_x, chunk_z)?;
    let region_x = chunk_x.div_euclid(32);
    let region_z = chunk_z.div_euclid(32);
    let local_x = chunk_x.rem_euclid(32);
    let local_z = chunk_z.rem_euclid(32);

    let path = region_path(&world_dir, region_x, region_z);
    let region = RegionFile::open(&path).ok()?;
    let blob = region.chunk_blob(local_x, local_z)?;
    let sections = parse_chunk_column_bson(&blob)?;

    let size_x = CHUNK_SIZE;
    let size_z = CHUNK_SIZE;
    let y_range = (y_max - y_min).max(1);
    let volume = (size_x * size_z * y_range) as usize;
    let mut blocks = vec![0i32; volume];
    let mut heightmap = vec![0i16; (size_x * size_z) as usize];

    for lz in 0..size_z {
        for lx in 0..size_x {
            let mut surface = y_min;
            for y in (y_min..y_max).rev() {
                let section_idx = (y.div_euclid(32)) as usize;
                let local_y = y.rem_euclid(32);
                if section_idx >= sections.len() {
                    continue;
                }
                let section = &sections[section_idx];
                let idx = section_index(lx, local_y, lz);
                let key = section.indices.get(idx).copied().unwrap_or(0);
                let name = section
                    .palette
                    .get(&key)
                    .map(|s| s.as_str())
                    .unwrap_or("Empty");
                if name != "Empty" && !name.is_empty() {
                    surface = y;
                    break;
                }
            }
            heightmap[(lz * size_x + lx) as usize] = surface as i16;

            for y in y_min..=surface {
                if y >= y_max {
                    break;
                }
                let section_idx = (y.div_euclid(32)) as usize;
                let local_y = y.rem_euclid(32);
                if section_idx >= sections.len() {
                    continue;
                }
                let section = &sections[section_idx];
                let idx = section_index(lx, local_y, lz);
                let key = section.indices.get(idx).copied().unwrap_or(0);
                let name = section
                    .palette
                    .get(&key)
                    .map(|s| s.as_str())
                    .unwrap_or("Empty");
                let block_id = interner.id_for_block(name);
                let arr_idx = ((lz * size_x + lx) * y_range + (y - y_min)) as usize;
                if arr_idx < blocks.len() {
                    blocks[arr_idx] = block_id;
                }
            }
        }
    }

    Some(ChunkDataResponse {
        chunk_x,
        chunk_z,
        y_min,
        y_max,
        size_x,
        size_z,
        blocks,
        heightmap,
        data_source: Some("save".into()),
    })
}

pub type SharedPalette = Mutex<PaletteInterner>;

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::PathBuf;

    #[test]
    fn loads_real_chunk_from_worldgen_save() {
        let save = PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
            .join("Hytale/UserData/Saves/Worldgen V1");
        if !save.is_dir() {
            return;
        }
        let world_dir = PathBuf::from(&save)
            .join("universe/worlds")
            .join("instance-Autmn Forest-7e82e61b-cc45-4c42-9823-337cb42b7937");
        if !world_dir.join("chunks/0.0.region.bin").exists() {
            return;
        }
        let mut interner = PaletteInterner::new();
        let chunk = load_chunk_from_save(
            &save,
            Some("instance-Autmn Forest-7e82e61b-cc45-4c42-9823-337cb42b7937"),
            &mut interner,
            12,
            2,
            0,
            128,
        )
        .expect("chunk");
        let max_surface = chunk.heightmap.iter().copied().max().unwrap_or(0);
        assert!(
            max_surface > 40,
            "expected real terrain surface, got max heightmap {max_surface}"
        );
        assert!(
            chunk.blocks.iter().any(|&b| b > 10),
            "expected interned block ids beyond default palette"
        );
    }
}
