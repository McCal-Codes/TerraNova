//! Surface-aware bounds scanning for coarse voxel preview probes.

const DEFAULT_WORLD_HEIGHT: i32 = 320;
const UNDERGROUND_FRACTION: f64 = 0.92;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct YBoundsResult {
    pub world_y_min: i32,
    pub world_y_max: i32,
    pub has_solids: bool,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Bounds3DResult {
    pub world_x_min: i32,
    pub world_x_max: i32,
    pub world_y_min: i32,
    pub world_y_max: i32,
    pub world_z_min: i32,
    pub world_z_max: i32,
    pub has_solids: bool,
}

/// Scan a Y-major density grid for a surface band (not raw solid bbox).
pub fn scan_density_grid_y_bounds(
    densities: &[f32],
    resolution: u32,
    y_slices: u32,
    y_min: i32,
    y_max: i32,
    below_pad: i32,
    above_min_pad: i32,
) -> YBoundsResult {
    let n = resolution as usize;
    let ys = y_slices as usize;
    let total_per_slice = n * n;

    if ys == 0 || n == 0 || densities.len() < total_per_slice * ys {
        return YBoundsResult {
            world_y_min: y_min,
            world_y_max: y_max,
            has_solids: false,
        };
    }

    let mut solid_counts = vec![0u32; ys];
    for yi in 0..ys {
        let base = yi * total_per_slice;
        let mut count = 0u32;
        for zi in 0..n {
            let row_base = base + zi * n;
            for xi in 0..n {
                if densities[row_base + xi] >= 0.0 {
                    count += 1;
                }
            }
        }
        solid_counts[yi] = count;
    }

    let mut first_solid = -1i32;
    let mut last_solid = -1i32;
    for (yi, &count) in solid_counts.iter().enumerate() {
        if count > 0 {
            if first_solid < 0 {
                first_solid = yi as i32;
            }
            last_solid = yi as i32;
        }
    }

    if first_solid < 0 {
        return YBoundsResult {
            world_y_min: y_min,
            world_y_max: y_max,
            has_solids: false,
        };
    }

    let mut surface_bottom = first_solid;
    for yi in first_solid..=last_solid {
        let fraction = solid_counts[yi as usize] as f64 / total_per_slice as f64;
        if fraction < UNDERGROUND_FRACTION {
            surface_bottom = first_solid.max(yi - 1);
            break;
        }
        surface_bottom = yi;
    }

    let surface_top = last_solid;
    let y_range = (y_max - y_min).max(1) as f64;
    let slice_to_world =
        |slice: i32| -> f64 { y_min as f64 + (slice as f64 / ys as f64) * y_range };

    let raw_min = slice_to_world(surface_bottom);
    let raw_max = slice_to_world(surface_top + 1);
    let surface_span = raw_max - raw_min;
    let above_pad = (surface_span * 0.20).max(above_min_pad as f64);

    YBoundsResult {
        world_y_min: (raw_min - below_pad as f64).floor().max(0.0) as i32,
        world_y_max: (raw_max + above_pad)
            .ceil()
            .min(DEFAULT_WORLD_HEIGHT as f64) as i32,
        has_solids: true,
    }
}

/// Scan XZ extent + surface-aware Y from a volume grid.
pub fn scan_density_grid_3d_bounds(
    densities: &[f32],
    resolution: u32,
    y_slices: u32,
    range_min: i32,
    range_max: i32,
    y_min: i32,
    y_max: i32,
) -> Bounds3DResult {
    let n = resolution as usize;
    let ys = y_slices as usize;
    let total_per_slice = n * n;

    if ys == 0 || n == 0 || densities.len() < total_per_slice * ys {
        return Bounds3DResult {
            world_x_min: range_min,
            world_x_max: range_max,
            world_y_min: y_min,
            world_y_max: y_max,
            world_z_min: range_min,
            world_z_max: range_max,
            has_solids: false,
        };
    }

    let mut min_xi = n as i32;
    let mut max_xi = -1i32;
    let mut min_zi = n as i32;
    let mut max_zi = -1i32;
    let mut solid_counts = vec![0u32; ys];

    for yi in 0..ys {
        let y_base = yi * total_per_slice;
        let mut count = 0u32;
        for zi in 0..n {
            let row_base = y_base + zi * n;
            for xi in 0..n {
                if densities[row_base + xi] >= 0.0 {
                    count += 1;
                    min_xi = min_xi.min(xi as i32);
                    max_xi = max_xi.max(xi as i32);
                    min_zi = min_zi.min(zi as i32);
                    max_zi = max_zi.max(zi as i32);
                }
            }
        }
        solid_counts[yi] = count;
    }

    if max_xi < 0 {
        return Bounds3DResult {
            world_x_min: range_min,
            world_x_max: range_max,
            world_y_min: y_min,
            world_y_max: y_max,
            world_z_min: range_min,
            world_z_max: range_max,
            has_solids: false,
        };
    }

    let y_bounds =
        scan_density_grid_y_bounds(densities, resolution, y_slices, y_min, y_max, 12, 10);

    let xz_range = (range_max - range_min).max(1) as f64;
    let to_world_xz = |idx: i32| -> f64 { range_min as f64 + (idx as f64 / n as f64) * xz_range };

    let xz_pad = 8;

    Bounds3DResult {
        world_x_min: to_world_xz(min_xi).floor().max(-256.0) as i32 - xz_pad,
        world_x_max: to_world_xz(max_xi + 1).ceil().min(256.0) as i32 + xz_pad,
        world_y_min: y_bounds.world_y_min,
        world_y_max: y_bounds.world_y_max,
        world_z_min: to_world_xz(min_zi).floor().max(-256.0) as i32 - xz_pad,
        world_z_max: to_world_xz(max_zi + 1).ceil().min(256.0) as i32 + xz_pad,
        has_solids: true,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn solid_volume(n: usize, ys: usize, solid_y_from: usize, solid_y_to: usize) -> Vec<f32> {
        let mut d = vec![-1.0f32; n * n * ys];
        for y in solid_y_from..=solid_y_to {
            for i in 0..(n * n) {
                d[y * n * n + i] = 1.0;
            }
        }
        d
    }

    #[test]
    fn y_scan_finds_surface_band_not_bedrock_column() {
        let n = 8usize;
        let ys = 32usize;
        // Solid underground column + thin surface cap
        let mut d = vec![-1.0f32; n * n * ys];
        for y in 0..20 {
            for i in 0..(n * n) {
                d[y * n * n + i] = 1.0;
            }
        }
        for y in 20..24 {
            for i in 0..(n * n) {
                d[y * n * n + i] = if i % 3 == 0 { 1.0 } else { -0.5 };
            }
        }

        let bounds = scan_density_grid_y_bounds(&d, n as u32, ys as u32, 0, 128, 12, 10);
        assert!(bounds.has_solids);
        assert!(bounds.world_y_min > 0, "should not pin Y min to bedrock");
        assert!(bounds.world_y_max > bounds.world_y_min);
    }

    #[test]
    fn empty_volume_reports_no_solids() {
        let d = vec![-1.0f32; 4 * 4 * 4];
        let bounds = scan_density_grid_3d_bounds(&d, 4, 4, -16, 16, 0, 64);
        assert!(!bounds.has_solids);
    }

    #[test]
    fn compact_solid_block_has_bounds() {
        let d = solid_volume(4, 8, 3, 5);
        let bounds = scan_density_grid_3d_bounds(&d, 4, 8, -8, 8, 0, 64);
        assert!(bounds.has_solids);
        assert!(bounds.world_y_max > bounds.world_y_min);
    }
}
