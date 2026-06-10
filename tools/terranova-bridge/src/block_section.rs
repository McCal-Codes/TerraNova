//! `Components.Block.Data` binary codec (palette + voxel indices).

use byteorder::{BigEndian, ReadBytesExt};
use std::collections::HashMap;
use std::io::{Cursor, Read};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum PaletteType {
    Empty = 0,
    HalfByte = 1,
    Byte = 2,
    Short = 3,
}

pub struct BlockSection {
    pub palette: HashMap<u16, String>,
    pub indices: Vec<u16>,
}

fn read_utf8_string(cursor: &mut Cursor<&[u8]>) -> Option<String> {
    let len = cursor.read_u16::<BigEndian>().ok()? as usize;
    let mut buf = vec![0u8; len];
    cursor.read_exact(&mut buf).ok()?;
    String::from_utf8(buf).ok()
}

pub fn parse_block_data(raw: &[u8]) -> Option<BlockSection> {
    let mut cursor = Cursor::new(raw);
    let _migration = cursor.read_u32::<BigEndian>().ok()?;
    let palette_type = cursor.read_u8().ok()?;
    let pt = match palette_type {
        0 => PaletteType::Empty,
        1 => PaletteType::HalfByte,
        2 => PaletteType::Byte,
        3 => PaletteType::Short,
        _ => return None,
    };
    if pt == PaletteType::Empty {
        return Some(BlockSection {
            palette: HashMap::new(),
            indices: vec![0; 32 * 32 * 32],
        });
    }

    let palette_len = cursor.read_u16::<BigEndian>().ok()? as usize;
    let mut palette = HashMap::new();
    for _ in 0..palette_len {
        let key = match pt {
            PaletteType::HalfByte | PaletteType::Byte => cursor.read_u8().ok()? as u16,
            PaletteType::Short => cursor.read_u16::<BigEndian>().ok()?,
            PaletteType::Empty => unreachable!(),
        };
        let name = read_utf8_string(&mut cursor)?;
        let _count = cursor.read_i16::<BigEndian>().ok()?;
        palette.insert(key, name);
    }

    let data_len = match pt {
        PaletteType::HalfByte => 32 * 32 * 32 / 2,
        PaletteType::Byte => 32 * 32 * 32,
        PaletteType::Short => 32 * 32 * 32 * 2,
        PaletteType::Empty => 0,
    };
    let mut data_bytes = vec![0u8; data_len];
    cursor.read_exact(&mut data_bytes).ok()?;

    let volume = 32 * 32 * 32;
    let mut indices = Vec::with_capacity(volume);
    match pt {
        PaletteType::HalfByte => {
            for idx in 0..volume {
                let field = idx >> 1;
                let mut val = data_bytes[field];
                let i = idx & 1;
                val = (val >> ((i ^ 1) << 2)) as u8;
                indices.push((val & 15) as u16);
            }
        }
        PaletteType::Byte => {
            for b in data_bytes {
                indices.push(b as u16);
            }
        }
        PaletteType::Short => {
            let mut c = Cursor::new(data_bytes.as_slice());
            for _ in 0..volume {
                indices.push(c.read_u16::<BigEndian>().ok()?);
            }
        }
        PaletteType::Empty => {}
    }

    Some(BlockSection { palette, indices })
}

pub fn section_index(x: i32, y: i32, z: i32) -> usize {
    ((y & 31) << 10 | (z & 31) << 5 | (x & 31)) as usize
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn section_index_matches_java() {
        assert_eq!(section_index(0, 0, 0), 0);
        assert_eq!(section_index(31, 31, 31), 32 * 32 * 32 - 1);
    }
}
