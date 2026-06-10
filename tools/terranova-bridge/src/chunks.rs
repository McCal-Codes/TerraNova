use crate::types::ChunkDataResponse;

const CHUNK_SIZE: i32 = 32;

/// Sidecar MVP: synthetic terrain until an in-process server plugin reads live chunks.
/// Layout matches TerraNova `worldMeshBuilder` indexing:
/// `idx = (lz * sizeX + lx) * yRange + (y - yMin)`
pub fn build_synthetic_chunk(
    chunk_x: i32,
    chunk_z: i32,
    y_min: i32,
    y_max: i32,
) -> ChunkDataResponse {
    let size_x = CHUNK_SIZE;
    let size_z = CHUNK_SIZE;
    let y_range = (y_max - y_min).max(1);
    let volume = (size_x * size_z * y_range) as usize;
    let mut blocks = vec![0i32; volume];
    let mut heightmap = vec![0i16; (size_x * size_z) as usize];

    for lz in 0..size_z {
        for lx in 0..size_x {
            let wx = chunk_x * size_x + lx;
            let wz = chunk_z * size_z + lz;
            let surface = synthetic_surface_y(wx, wz).clamp(y_min, y_max - 1);
            heightmap[(lz * size_x + lx) as usize] = surface as i16;

            for y in y_min..surface {
                let idx = ((lz * size_x + lx) * y_range + (y - y_min)) as usize;
                if idx < blocks.len() {
                    blocks[idx] = if y + 3 >= surface {
                        5 // grass
                    } else if y + 8 >= surface {
                        4 // dirt
                    } else {
                        1 // stone
                    };
                }
            }
        }
    }

    ChunkDataResponse {
        chunk_x,
        chunk_z,
        y_min,
        y_max,
        size_x,
        size_z,
        blocks,
        heightmap,
        data_source: Some("synthetic".into()),
    }
}

fn synthetic_surface_y(wx: i32, wz: i32) -> i32 {
    let h = (wx.wrapping_mul(374_761) ^ wz.wrapping_mul(668_265)) as u32;
    58 + (h % 24) as i32
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn chunk_has_expected_dimensions() {
        let c = build_synthetic_chunk(0, 0, 0, 128);
        assert_eq!(c.size_x, 32);
        assert_eq!(c.heightmap.len(), 32 * 32);
        assert_eq!(c.blocks.len(), 32 * 32 * 128);
    }
}
