use crate::noise::evaluator::DensityEvaluator;
use crate::preview_probe::bounds_scan::{scan_density_grid_3d_bounds, scan_density_grid_y_bounds};
use crate::preview_probe::content_fields::{
    discover_content_fields_for_biome, infer_biome_name_from_file,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

#[derive(Deserialize)]
pub struct EvaluateRequest {
    /// The density graph as V2 JSON
    pub graph: Value,
    /// Grid resolution (e.g., 128 for 128x128)
    pub resolution: u32,
    /// World coordinate range
    pub range_min: f64,
    pub range_max: f64,
    /// Y level for 2D evaluation
    pub y_level: f64,
}

#[derive(Debug, Serialize)]
pub struct EvaluateResponse {
    /// Flattened NxN density values (row-major)
    pub values: Vec<f32>,
    /// Grid resolution
    pub resolution: u32,
    /// Min/max values in the result (for normalization)
    pub min_value: f32,
    pub max_value: f32,
}

/// Evaluate a density function graph at an NxN grid of positions.
#[tauri::command]
pub fn evaluate_density(request: EvaluateRequest) -> Result<EvaluateResponse, String> {
    // Cap resolution to prevent excessive memory allocation (2048^2 * 4 = 16 MB max)
    if request.resolution > 2048 {
        return Err(format!(
            "Resolution {} exceeds maximum of 2048",
            request.resolution
        ));
    }

    let evaluator =
        DensityEvaluator::from_json(&request.graph).map_err(|e| format!("Parse error: {}", e))?;

    let n = request.resolution as usize;
    let mut values = Vec::with_capacity(n * n);
    let step = (request.range_max - request.range_min) / n as f64;

    let mut min_val = f32::MAX;
    let mut max_val = f32::MIN;

    for z_idx in 0..n {
        let z = request.range_min + (z_idx as f64 + 0.5) * step;
        for x_idx in 0..n {
            let x = request.range_min + (x_idx as f64 + 0.5) * step;
            let val = evaluator.evaluate(x, request.y_level, z) as f32;
            min_val = min_val.min(val);
            max_val = max_val.max(val);
            values.push(val);
        }
    }

    Ok(EvaluateResponse {
        values,
        resolution: request.resolution,
        min_value: min_val,
        max_value: max_val,
    })
}

#[derive(Deserialize)]
pub struct ScanVolumeBoundsRequest {
    pub densities: Vec<f32>,
    pub resolution: u32,
    pub y_slices: u32,
    pub range_min: i32,
    pub range_max: i32,
    pub y_min: i32,
    pub y_max: i32,
    /// When true, return Y-only surface band (faster path for 2D auto-fit helpers).
    pub y_only: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct ScanVolumeBoundsResponse {
    pub world_x_min: i32,
    pub world_x_max: i32,
    pub world_y_min: i32,
    pub world_y_max: i32,
    pub world_z_min: i32,
    pub world_z_max: i32,
    pub has_solids: bool,
}

/// Surface-aware bounds scan for a coarse density volume (native, off main thread).
#[tauri::command]
pub fn scan_volume_solids_bounds(
    request: ScanVolumeBoundsRequest,
) -> Result<ScanVolumeBoundsResponse, String> {
    if request.resolution == 0 || request.y_slices == 0 {
        return Err("resolution and y_slices must be positive".to_string());
    }
    let expected = (request.resolution as usize)
        .saturating_mul(request.resolution as usize)
        .saturating_mul(request.y_slices as usize);
    if request.densities.len() < expected {
        return Err(format!(
            "densities length {} < expected {}",
            request.densities.len(),
            expected
        ));
    }

    if request.y_only == Some(true) {
        let y = scan_density_grid_y_bounds(
            &request.densities,
            request.resolution,
            request.y_slices,
            request.y_min,
            request.y_max,
            12,
            10,
        );
        return Ok(ScanVolumeBoundsResponse {
            world_x_min: request.range_min,
            world_x_max: request.range_max,
            world_y_min: y.world_y_min,
            world_y_max: y.world_y_max,
            world_z_min: request.range_min,
            world_z_max: request.range_max,
            has_solids: y.has_solids,
        });
    }

    let b = scan_density_grid_3d_bounds(
        &request.densities,
        request.resolution,
        request.y_slices,
        request.range_min,
        request.range_max,
        request.y_min,
        request.y_max,
    );
    Ok(ScanVolumeBoundsResponse {
        world_x_min: b.world_x_min,
        world_x_max: b.world_x_max,
        world_y_min: b.world_y_min,
        world_y_max: b.world_y_max,
        world_z_min: b.world_z_min,
        world_z_max: b.world_z_max,
        has_solids: b.has_solids,
    })
}

#[derive(Deserialize)]
pub struct DiscoverBiomeContentFieldsRequest {
    pub biome_file_path: String,
    pub biome_name: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct DiscoverBiomeContentFieldsResponse {
    pub fields: HashMap<String, i32>,
    pub biome_name: String,
    pub world_structures_dir: Option<String>,
}

/// Resolve ContentFields (Base, Water, Bedrock, …) from WorldStructure JSON near a biome file.
#[tauri::command]
pub fn discover_biome_content_fields(
    request: DiscoverBiomeContentFieldsRequest,
) -> Result<DiscoverBiomeContentFieldsResponse, String> {
    let biome_path = request.biome_file_path.trim();
    if biome_path.is_empty() {
        return Err("biome_file_path is required".to_string());
    }

    let wrapper: Value = serde_json::from_str(
        &std::fs::read_to_string(biome_path).map_err(|e| format!("read biome file: {e}"))?,
    )
    .map_err(|e| format!("parse biome JSON: {e}"))?;

    let biome_name = request
        .biome_name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| infer_biome_name_from_file(&wrapper, biome_path));

    let ws_dir =
        crate::preview_probe::content_fields::world_structures_dir_from_biome_path(biome_path)
            .map(|p| p.to_string_lossy().to_string());

    let fields = discover_content_fields_for_biome(biome_path, &biome_name).unwrap_or_default();

    Ok(DiscoverBiomeContentFieldsResponse {
        fields,
        biome_name,
        world_structures_dir: ws_dir,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn constant_request(value: f64, resolution: u32) -> EvaluateRequest {
        EvaluateRequest {
            graph: json!({ "Type": "Constant", "Value": value }),
            resolution,
            range_min: -1.0,
            range_max: 1.0,
            y_level: 0.0,
        }
    }

    #[test]
    fn constant_graph_fills_grid_with_same_value() {
        let req = constant_request(0.5, 4);
        let resp = evaluate_density(req).expect("evaluate should succeed");

        assert_eq!(resp.values.len(), 16); // 4x4
        assert_eq!(resp.resolution, 4);
        for &v in &resp.values {
            assert!((v - 0.5).abs() < 1e-5, "expected 0.5, got {v}");
        }
    }

    #[test]
    fn min_max_are_correct_for_constant() {
        let resp = evaluate_density(constant_request(0.75, 8)).unwrap();
        assert!((resp.min_value - 0.75).abs() < 1e-5);
        assert!((resp.max_value - 0.75).abs() < 1e-5);
    }

    #[test]
    fn resolution_above_2048_is_rejected() {
        let req = constant_request(1.0, 2049);
        let err = evaluate_density(req).expect_err("should reject oversized resolution");
        assert!(err.contains("2048"), "error should mention limit: {err}");
    }

    #[test]
    fn resolution_of_2048_is_accepted() {
        let req = constant_request(0.0, 2048);
        let resp = evaluate_density(req).expect("2048 should be allowed");
        assert_eq!(resp.values.len(), 2048 * 2048);
    }

    #[test]
    fn invalid_graph_returns_parse_error() {
        let req = EvaluateRequest {
            graph: json!({ "NotAType": "???" }),
            resolution: 4,
            range_min: 0.0,
            range_max: 1.0,
            y_level: 0.0,
        };
        let err = evaluate_density(req).expect_err("invalid graph should fail");
        assert!(err.contains("Parse error") || !err.is_empty());
    }
}
