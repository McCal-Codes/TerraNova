use std::time::Duration;
use tokio::sync::Mutex;

use reqwest::Client;
use reqwest::StatusCode;

use super::types::*;

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BridgeHttpError {
    pub code: String,
    pub message: String,
    pub http_status: Option<u16>,
    pub endpoint: Option<String>,
}

impl BridgeHttpError {
    pub fn to_user_string(&self) -> String {
        if let Some(status) = self.http_status {
            format!("{} (HTTP {}): {}", self.code, status, self.message)
        } else {
            format!("{}: {}", self.code, self.message)
        }
    }
}

fn map_reqwest_error(endpoint: &str, err: reqwest::Error) -> BridgeHttpError {
    if err.is_timeout() {
        BridgeHttpError {
            code: "timeout".into(),
            message: err.to_string(),
            http_status: None,
            endpoint: Some(endpoint.into()),
        }
    } else if err.is_connect() {
        BridgeHttpError {
            code: "connection_refused".into(),
            message: err.to_string(),
            http_status: None,
            endpoint: Some(endpoint.into()),
        }
    } else {
        BridgeHttpError {
            code: "network".into(),
            message: err.to_string(),
            http_status: None,
            endpoint: Some(endpoint.into()),
        }
    }
}

async fn map_http_response(
    endpoint: &str,
    response: reqwest::Response,
) -> Result<reqwest::Response, BridgeHttpError> {
    if response.status().is_success() {
        return Ok(response);
    }
    let status = response.status();
    let body = response.text().await.unwrap_or_default();
    let code = match status {
        StatusCode::UNAUTHORIZED => "unauthorized",
        StatusCode::NOT_FOUND => "not_found",
        StatusCode::BAD_REQUEST => "bad_request",
        _ => "http_error",
    };
    Err(BridgeHttpError {
        code: code.into(),
        message: if body.is_empty() {
            status.canonical_reason().unwrap_or("error").to_string()
        } else {
            body
        },
        http_status: Some(status.as_u16()),
        endpoint: Some(endpoint.into()),
    })
}

#[derive(Clone)]
pub struct BridgeClient {
    http: Client,
    pub(crate) base_url: String,
    pub(crate) auth_token: String,
}

pub struct BridgeState(pub Mutex<Option<BridgeClient>>);

impl Default for BridgeState {
    fn default() -> Self {
        BridgeState(Mutex::new(None))
    }
}

impl BridgeState {
    /// Clone the client out of the mutex so callers can drop the lock before HTTP calls.
    pub async fn get_client(&self) -> Result<BridgeClient, String> {
        let lock = self.0.lock().await;
        lock.as_ref()
            .cloned()
            .ok_or_else(|| "Not connected to bridge".to_string())
    }
}

/// Hosts allowed for bridge connections (loopback only).
const ALLOWED_HOSTS: &[&str] = &["127.0.0.1", "::1", "localhost"];

impl BridgeClient {
    pub fn new(host: &str, port: u16, auth_token: &str) -> Result<Self, String> {
        if !ALLOWED_HOSTS.iter().any(|h| h.eq_ignore_ascii_case(host)) {
            return Err(format!(
                "Bridge host must be loopback (127.0.0.1, ::1, or localhost), got '{}'",
                host
            ));
        }
        let http = Client::builder()
            .connect_timeout(Duration::from_secs(3))
            .timeout(Duration::from_secs(8))
            .build()
            .map_err(|e| format!("Failed to build HTTP client: {}", e))?;
        Ok(Self {
            http,
            base_url: format!("http://{}:{}", host, port),
            auth_token: auth_token.to_string(),
        })
    }

    pub async fn status(&self) -> Result<ServerStatus, String> {
        let endpoint = "/api/status";
        let response = self
            .http
            .get(format!("{}{}", self.base_url, endpoint))
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .map_err(|e| map_reqwest_error(endpoint, e).to_user_string())?;
        let response = map_http_response(endpoint, response)
            .await
            .map_err(|e| e.to_user_string())?;
        response
            .json::<ServerStatus>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn reload_worldgen(&self) -> Result<BridgeResponse, String> {
        let endpoint = "/api/worldgen/reload";
        let response = self
            .http
            .post(format!("{}{}", self.base_url, endpoint))
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .map_err(|e| map_reqwest_error(endpoint, e).to_user_string())?;
        let response = map_http_response(endpoint, response)
            .await
            .map_err(|e| e.to_user_string())?;
        response
            .json::<BridgeResponse>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn regenerate_chunks(
        &self,
        x: i32,
        z: i32,
        radius: u32,
    ) -> Result<BridgeResponse, String> {
        let endpoint = "/api/chunks/regenerate";
        let body = ChunkRegenRequest { x, z, radius };
        let response = self
            .http
            .post(format!("{}{}", self.base_url, endpoint))
            .bearer_auth(&self.auth_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| map_reqwest_error(endpoint, e).to_user_string())?;
        let response = map_http_response(endpoint, response)
            .await
            .map_err(|e| e.to_user_string())?;
        response
            .json::<BridgeResponse>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn teleport(
        &self,
        player_name: &str,
        x: f64,
        y: f64,
        z: f64,
    ) -> Result<BridgeResponse, String> {
        let endpoint = "/api/player/teleport";
        let body = TeleportRequest {
            player_name: player_name.to_string(),
            x,
            y,
            z,
        };
        let response = self
            .http
            .post(format!("{}{}", self.base_url, endpoint))
            .bearer_auth(&self.auth_token)
            .json(&body)
            .send()
            .await
            .map_err(|e| map_reqwest_error(endpoint, e).to_user_string())?;
        let response = map_http_response(endpoint, response)
            .await
            .map_err(|e| e.to_user_string())?;
        response
            .json::<BridgeResponse>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn fetch_palette(&self) -> Result<BlockPaletteResponse, String> {
        let endpoint = "/api/blocks/palette";
        let response = self
            .http
            .get(format!("{}{}", self.base_url, endpoint))
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .map_err(|e| map_reqwest_error(endpoint, e).to_user_string())?;
        let response = map_http_response(endpoint, response)
            .await
            .map_err(|e| e.to_user_string())?;
        response
            .json::<BlockPaletteResponse>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn fetch_chunk(
        &self,
        chunk_x: i32,
        chunk_z: i32,
        y_min: i32,
        y_max: i32,
        force_load: bool,
    ) -> Result<ChunkDataResponse, String> {
        let endpoint = "/api/chunks/data";
        let body = ChunkDataRequest {
            chunk_x,
            chunk_z,
            y_min,
            y_max,
            force_load,
        };
        let mut req = self
            .http
            .post(format!("{}{}", self.base_url, endpoint))
            .bearer_auth(&self.auth_token)
            .json(&body);

        if force_load {
            req = req.timeout(Duration::from_secs(20));
        }

        let response = req
            .send()
            .await
            .map_err(|e| map_reqwest_error(endpoint, e).to_user_string())?;
        let response = map_http_response(endpoint, response)
            .await
            .map_err(|e| e.to_user_string())?;
        response
            .json::<ChunkDataResponse>()
            .await
            .map_err(|e| e.to_string())
    }

    pub async fn player_info(&self) -> Result<PlayerInfo, String> {
        let endpoint = "/api/player/info";
        let response = self
            .http
            .get(format!("{}{}", self.base_url, endpoint))
            .bearer_auth(&self.auth_token)
            .send()
            .await
            .map_err(|e| map_reqwest_error(endpoint, e).to_user_string())?;
        let response = map_http_response(endpoint, response)
            .await
            .map_err(|e| e.to_user_string())?;
        response
            .json::<PlayerInfo>()
            .await
            .map_err(|e| e.to_string())
    }

    pub fn sync_file(source_path: &str, dest_path: &str) -> Result<(), String> {
        let dest = std::path::Path::new(dest_path);
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create directories: {}", e))?;
        }
        std::fs::copy(source_path, dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;
        Ok(())
    }
}
