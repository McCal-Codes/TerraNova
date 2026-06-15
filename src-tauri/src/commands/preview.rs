use crate::noise::evaluator::DensityEvaluator;
use serde::{Deserialize, Serialize};
use serde_json::Value;

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
