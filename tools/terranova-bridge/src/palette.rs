use std::collections::HashMap;

/// Minimal block palette (numeric id → block id string) for World preview coloring.
/// v0.2.0+ requires a non-empty palette endpoint; expand via palette.json later.
pub fn default_palette() -> HashMap<String, String> {
    let blocks = [
        (0, "Empty"),
        (1, "Rock_Stone"),
        (2, "Rock_Granite"),
        (3, "Rock_Basalt"),
        (4, "Soil_Dirt"),
        (5, "Soil_Grass"),
        (6, "Soil_Grass_Deep"),
        (7, "Sand"),
        (8, "Water"),
        (9, "Lava"),
        (10, "Wood_Oak"),
        (11, "Wood_Birch"),
        (12, "Snow"),
        (13, "Ice"),
    ];
    blocks
        .iter()
        .map(|(id, name)| (id.to_string(), (*name).to_string()))
        .collect()
}
