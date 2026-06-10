use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServerStatus {
    pub status: String,
    pub bridge_version: String,
    pub player_count: u32,
    pub port: u16,
    #[serde(default)]
    pub singleplayer: bool,
    #[serde(default)]
    pub save_root: Option<String>,
    #[serde(default)]
    pub bridge_mode: Option<String>,
    /// Feature flags for the editor (e.g. `save_chunks`, `queue_console_commands`).
    #[serde(default)]
    pub capabilities: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BridgeResponse {
    pub success: bool,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlayerInfo {
    pub name: String,
    pub uuid: String,
    pub x: Option<f64>,
    pub y: Option<f64>,
    pub z: Option<f64>,
    pub world: Option<String>,
    /// Human label from universe/worlds/.../InstanceData.json when present.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub world_label: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub position_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChunkRegenRequest {
    pub x: i32,
    pub z: i32,
    pub radius: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TeleportRequest {
    pub player_name: String,
    pub x: f64,
    pub y: f64,
    pub z: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkDataRequest {
    pub chunk_x: i32,
    pub chunk_z: i32,
    pub y_min: i32,
    pub y_max: i32,
    #[serde(default)]
    pub force_load: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChunkDataResponse {
    pub chunk_x: i32,
    pub chunk_z: i32,
    pub y_min: i32,
    pub y_max: i32,
    pub size_x: i32,
    pub size_z: i32,
    pub blocks: Vec<i32>,
    pub heightmap: Vec<i16>,
    #[serde(default)]
    pub data_source: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BlockPaletteResponse {
    pub palette: HashMap<String, String>,
}
