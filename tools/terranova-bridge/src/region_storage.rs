//! Hytale `*.region.bin` (IndexedStorageFile) reader.
//! See: https://gist.github.com/nickt128/bbf223d849fced931c9ecbc3a988a83c

use byteorder::{BigEndian, ReadBytesExt};
use std::io::Cursor;
use std::path::Path;

const MAGIC: &[u8; 20] = b"HytaleIndexedStorage";
const HEADER_SIZE: usize = 32;

pub struct RegionFile {
    blob_count: u32,
    segment_size: u32,
    blob_indexes: Vec<u32>,
    data: Vec<u8>,
}

impl RegionFile {
    pub fn open(path: &Path) -> Result<Self, String> {
        let data = std::fs::read(path).map_err(|e| e.to_string())?;
        if data.len() < HEADER_SIZE {
            return Err("region file too small".into());
        }
        if &data[0..20] != MAGIC {
            return Err("invalid region magic".into());
        }
        let mut cursor = Cursor::new(&data[20..]);
        let _version = cursor.read_u32::<BigEndian>().map_err(|e| e.to_string())?;
        let blob_count = cursor.read_u32::<BigEndian>().map_err(|e| e.to_string())?;
        let segment_size = cursor.read_u32::<BigEndian>().map_err(|e| e.to_string())?;
        let mut blob_indexes = Vec::with_capacity(blob_count as usize);
        for _ in 0..blob_count {
            blob_indexes.push(cursor.read_u32::<BigEndian>().map_err(|e| e.to_string())?);
        }
        Ok(Self {
            blob_count,
            segment_size,
            blob_indexes,
            data,
        })
    }

    /// Local chunk coordinates within this region file (0..31).
    pub fn chunk_blob(&self, local_x: i32, local_z: i32) -> Option<Vec<u8>> {
        let index = ((local_z & 31) << 5 | (local_x & 31)) as usize;
        if index >= self.blob_indexes.len() {
            return None;
        }
        let first_segment = self.blob_indexes[index];
        if first_segment == 0 {
            return None;
        }
        let header_and_index = HEADER_SIZE + (self.blob_count as usize) * 4;
        let offset = (first_segment as usize - 1) * self.segment_size as usize + header_and_index;
        if offset + 8 > self.data.len() {
            return None;
        }
        let mut cursor = Cursor::new(&self.data[offset..]);
        let _src_len = cursor.read_u32::<BigEndian>().ok()?;
        let compressed_len = cursor.read_u32::<BigEndian>().ok()? as usize;
        let start = offset + 8;
        let end = start.saturating_add(compressed_len);
        if end > self.data.len() {
            return None;
        }
        let compressed = &self.data[start..end];
        zstd::decode_all(compressed).ok()
    }
}

pub fn region_path(world_dir: &Path, region_x: i32, region_z: i32) -> std::path::PathBuf {
    world_dir
        .join("chunks")
        .join(format!("{region_x}.{region_z}.region.bin"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn opens_worldgen_region_if_present() {
        let path = std::path::PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
            .join("Hytale")
            .join("UserData")
            .join("Saves")
            .join("Worldgen V1")
            .join("universe")
            .join("worlds")
            .join("instance-Autmn Forest-7e82e61b-cc45-4c42-9823-337cb42b7937")
            .join("chunks")
            .join("0.0.region.bin");
        if !path.exists() {
            return;
        }
        let region = RegionFile::open(&path).expect("open");
        let blob = region.chunk_blob(12, 2);
        assert!(blob.is_some(), "chunk 12,2 should exist in 0.0.region.bin");
    }
}
