//! Extract block sections from a decompressed chunk-column BSON blob.

use bson::{Bson, Document};
use std::io::Cursor;

use crate::block_section::{parse_block_data, BlockSection};

fn doc_from_bytes(raw: &[u8]) -> Option<Document> {
    let mut cursor = Cursor::new(raw);
    Document::from_reader(&mut cursor).ok()
}

fn get_doc<'a>(doc: &'a Document, key: &str) -> Option<&'a Document> {
    match doc.get(key)? {
        Bson::Document(d) => Some(d),
        _ => None,
    }
}

fn get_array<'a>(doc: &'a Document, key: &str) -> Option<&'a Vec<Bson>> {
    match doc.get(key)? {
        Bson::Array(a) => Some(a),
        _ => None,
    }
}

/// Walk nested `Components` trees until we find a `Block` component with binary `Data`.
fn block_data_from_section(section: &Document) -> Option<Vec<u8>> {
    fn walk(doc: &Document) -> Option<Vec<u8>> {
        if let Some(Bson::Binary(bin)) = doc.get("Data") {
            if doc.contains_key("Version") || doc.get("Version").is_some() {
                return Some(bin.bytes.clone());
            }
        }
        if let Some(Bson::Document(components)) = doc.get("Components") {
            if let Some(Bson::Document(block)) = components.get("Block") {
                if let Some(Bson::Binary(bin)) = block.get("Data") {
                    return Some(bin.bytes.clone());
                }
            }
            for (_k, v) in components {
                if let Bson::Document(inner) = v {
                    if let Some(data) = walk(inner) {
                        return Some(data);
                    }
                }
            }
        }
        for (_k, v) in doc {
            if let Bson::Document(inner) = v {
                if let Some(data) = walk(inner) {
                    return Some(data);
                }
            }
        }
        None
    }
    walk(section)
}

pub fn parse_chunk_column_bson(raw: &[u8]) -> Option<Vec<BlockSection>> {
    let root = doc_from_bytes(raw)?;
    let mut sections_out: Vec<BlockSection> = Vec::new();

    // Path 1: Components.ChunkColumn.Sections
    if let Some(components) = get_doc(&root, "Components") {
        if let Some(column) = get_doc(components, "ChunkColumn") {
            if let Some(sections) = get_array(column, "Sections") {
                for entry in sections {
                    if let Bson::Document(sec_doc) = entry {
                        if let Some(data) = block_data_from_section(sec_doc) {
                            if let Some(parsed) = parse_block_data(&data) {
                                sections_out.push(parsed);
                                continue;
                            }
                        }
                    }
                    sections_out.push(BlockSection {
                        palette: Default::default(),
                        indices: vec![0; 32 * 32 * 32],
                    });
                }
                if !sections_out.is_empty() {
                    return Some(sections_out);
                }
            }
        }
    }

    // Path 2: top-level Sections array (older / alternate layout)
    if let Some(sections) = get_array(&root, "Sections") {
        for entry in sections {
            if let Bson::Document(sec_doc) = entry {
                if let Some(data) = block_data_from_section(sec_doc) {
                    if let Some(parsed) = parse_block_data(&data) {
                        sections_out.push(parsed);
                        continue;
                    }
                }
            }
            sections_out.push(BlockSection {
                palette: Default::default(),
                indices: vec![0; 32 * 32 * 32],
            });
        }
        if !sections_out.is_empty() {
            return Some(sections_out);
        }
    }

    // Path 3: numeric section keys at root (0..9)
    for i in 0..16 {
        if let Some(Bson::Document(sec_doc)) = root.get(&i.to_string()) {
            if let Some(data) = block_data_from_section(sec_doc) {
                if let Some(parsed) = parse_block_data(&data) {
                    sections_out.push(parsed);
                }
            }
        }
    }
    if sections_out.is_empty() {
        None
    } else {
        Some(sections_out)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::region_storage::RegionFile;
    use std::path::PathBuf;

    #[test]
    fn parses_chunk_12_2_from_worldgen_save() {
        let path = PathBuf::from(std::env::var("APPDATA").unwrap_or_default())
            .join("Hytale/UserData/Saves/Worldgen V1/universe/worlds")
            .join("instance-Autmn Forest-7e82e61b-cc45-4c42-9823-337cb42b7937")
            .join("chunks/0.0.region.bin");
        if !path.exists() {
            return;
        }
        let region = RegionFile::open(&path).unwrap();
        let blob = region.chunk_blob(12, 2).expect("blob");
        let sections = parse_chunk_column_bson(&blob).expect("sections");
        assert!(!sections.is_empty(), "expected at least one section");
        let non_empty = sections.iter().any(|s| !s.palette.is_empty());
        assert!(non_empty, "expected non-empty palette in some section");
    }
}
