mod block_section;
mod chunk_column;
mod chunks;
mod palette;
mod player;
mod region_storage;
mod save_chunks;
mod types;

use axum::{
    extract::{Request, State},
    http::{header::AUTHORIZATION, StatusCode},
    middleware::{self, Next},
    response::Response,
    routing::{get, post},
    Json, Router,
};
use clap::Parser;
use save_chunks::SharedPalette;
use std::{
    net::SocketAddr,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
};
use tracing::info;
use types::*;

const BRIDGE_VERSION: &str = "0.2.0-sidecar";

#[derive(Parser, Debug)]
#[command(
    name = "terranova-bridge",
    about = "TerraNova ↔ Hytale loopback HTTP bridge (sidecar MVP)"
)]
struct Cli {
    /// TCP port (TerraNova default: 7854)
    #[arg(long, default_value = "7854")]
    port: u16,

    /// Hytale save folder (e.g. .../UserData/Saves/Worldgen V1)
    #[arg(long)]
    save: Option<PathBuf>,

    /// Bearer token TerraNova uses in Bridge dialog
    #[arg(long)]
    token: Option<String>,

    /// Write/read config under <save>/bridge/config.json
    #[arg(long, default_value_t = true)]
    persist_config: bool,
}

#[derive(Clone)]
struct AppState {
    auth_token: String,
    save_root: PathBuf,
    port: u16,
    palette: Arc<SharedPalette>,
}

#[derive(serde::Serialize, serde::Deserialize)]
struct PersistedConfig {
    auth_token: String,
    port: u16,
}

fn default_save_root() -> PathBuf {
    bridge_save::pick_default_save()
        .map(|(p, _)| p)
        .unwrap_or_else(|| PathBuf::from("."))
}

fn bridge_config_path(save_root: &Path) -> PathBuf {
    save_root.join("bridge").join("config.json")
}

fn load_or_create_config(save_root: &Path, port: u16, token: Option<String>) -> PersistedConfig {
    let path = bridge_config_path(save_root);
    if let Some(t) = token {
        return PersistedConfig {
            auth_token: t,
            port,
        };
    }
    if path.exists() {
        if let Ok(raw) = std::fs::read_to_string(&path) {
            if let Ok(cfg) = serde_json::from_str::<PersistedConfig>(&raw) {
                return PersistedConfig { port, ..cfg };
            }
        }
    }
    let cfg = PersistedConfig {
        auth_token: uuid::Uuid::new_v4().to_string(),
        port,
    };
    let _ = std::fs::create_dir_all(path.parent().unwrap());
    let _ = std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap());
    cfg
}

const SIDECAR_CAPABILITIES: &[&str] = &[
    "save_player",
    "save_chunks",
    "synthetic_chunk_fallback",
    "queue_console_commands",
    "debug_snapshot",
];

fn sidecar_capabilities() -> Vec<String> {
    SIDECAR_CAPABILITIES
        .iter()
        .map(|s| (*s).to_string())
        .collect()
}

async fn auth_middleware(
    State(state): State<Arc<AppState>>,
    request: Request,
    next: Next,
) -> Result<Response, StatusCode> {
    let auth = request
        .headers()
        .get(AUTHORIZATION)
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    let expected = format!("Bearer {}", state.auth_token);
    if auth != expected {
        return Err(StatusCode::UNAUTHORIZED);
    }
    Ok(next.run(request).await)
}

async fn status(State(state): State<Arc<AppState>>) -> Json<ServerStatus> {
    let player_count = if player::read_player_info(&state.save_root).is_some() {
        1
    } else {
        0
    };
    Json(ServerStatus {
        status: "ok".into(),
        bridge_version: BRIDGE_VERSION.into(),
        player_count,
        port: state.port,
        singleplayer: true,
        save_root: Some(state.save_root.display().to_string()),
        bridge_mode: Some("sidecar".into()),
        capabilities: sidecar_capabilities(),
    })
}

async fn reload_worldgen(State(state): State<Arc<AppState>>) -> Json<BridgeResponse> {
    let reload = bridge_save::worldgen_reload_clear_command();
    let viewport = bridge_save::viewport_command(5);
    bridge_save::append_pending_command(&state.save_root, reload);
    bridge_save::append_pending_command(&state.save_root, &viewport);
    Json(BridgeResponse {
        success: true,
        message: format!(
            "Queued {reload} and {viewport}. JVM plugin runs these automatically when installed; otherwise paste from bridge/pending-commands.log."
        ),
    })
}

async fn regenerate_chunks(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ChunkRegenRequest>,
) -> Json<BridgeResponse> {
    let (cmds, truncated) = bridge_save::chunk_regen_commands(body.x, body.z, body.radius);
    let count = cmds.len();
    bridge_save::append_pending_commands(&state.save_root, &cmds);
    let radius_note = if truncated {
        format!(
            " (radius capped to {} — {} lines max)",
            bridge_save::MAX_REGEN_RADIUS,
            bridge_save::MAX_REGEN_COMMANDS
        )
    } else {
        String::new()
    };
    Json(BridgeResponse {
        success: true,
        message: format!(
            "Queued {count} /chunk regenerate commands around ({}, {}) r={}{radius_note}. Run from bridge/pending-commands.log in the Hytale console.",
            body.x, body.z, body.radius
        ),
    })
}

async fn teleport(
    State(state): State<Arc<AppState>>,
    Json(body): Json<TeleportRequest>,
) -> Json<BridgeResponse> {
    let cmd = bridge_save::teleport_command(&body.player_name, body.x, body.y, body.z);
    bridge_save::append_pending_command(&state.save_root, &cmd);
    Json(BridgeResponse {
        success: true,
        message: format!(
            "Queued {cmd} — run in the Hytale console (syntax may vary by server build)."
        ),
    })
}

async fn blocks_palette(State(state): State<Arc<AppState>>) -> Json<BlockPaletteResponse> {
    let palette = state
        .palette
        .lock()
        .map(|p| p.palette.clone())
        .unwrap_or_else(|_| palette::default_palette());
    Json(BlockPaletteResponse { palette })
}

async fn player_info(State(state): State<Arc<AppState>>) -> Result<Json<PlayerInfo>, StatusCode> {
    player::read_player_info(&state.save_root)
        .map(Json)
        .ok_or(StatusCode::NOT_FOUND)
}

async fn debug_snapshot(
    State(state): State<Arc<AppState>>,
) -> Json<bridge_save::BridgeDebugSnapshot> {
    Json(bridge_save::collect_snapshot(
        &state.save_root,
        true,
        Some(state.save_root.as_path()),
    ))
}

async fn chunks_data(
    State(state): State<Arc<AppState>>,
    Json(body): Json<ChunkDataRequest>,
) -> Json<ChunkDataResponse> {
    if body.force_load {
        tracing::debug!(
            chunk_x = body.chunk_x,
            chunk_z = body.chunk_z,
            "force_load: still reads save disk (no live server plugin)"
        );
    }
    let preferred = player::read_player_info(&state.save_root).and_then(|p| p.world);
    if let Ok(mut interner) = state.palette.lock() {
        if let Some(chunk) = save_chunks::load_chunk_from_save(
            &state.save_root,
            preferred.as_deref(),
            &mut interner,
            body.chunk_x,
            body.chunk_z,
            body.y_min,
            body.y_max,
        ) {
            tracing::debug!(
                chunk_x = body.chunk_x,
                chunk_z = body.chunk_z,
                "loaded chunk from save"
            );
            return Json(chunk);
        }
    }
    tracing::debug!(
        chunk_x = body.chunk_x,
        chunk_z = body.chunk_z,
        "no save chunk — synthetic fallback"
    );
    Json(chunks::build_synthetic_chunk(
        body.chunk_x,
        body.chunk_z,
        body.y_min,
        body.y_max,
    ))
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,terranova_bridge=debug".into()),
        )
        .init();

    let cli = Cli::parse();
    let save_root = cli.save.unwrap_or_else(default_save_root);
    if !save_root.exists() {
        eprintln!("Save folder not found: {}", save_root.display());
        eprintln!("Use --save \"...\\UserData\\Saves\\YourWorldName\"");
        std::process::exit(1);
    }

    let cfg = load_or_create_config(&save_root, cli.port, cli.token);
    let _ = bridge_save::write_iteration_guide(&save_root);
    let _ = bridge_save::write_active_save_pointer(&save_root);
    if cli.persist_config {
        let path = bridge_config_path(&save_root);
        let _ = std::fs::create_dir_all(path.parent().unwrap());
        let _ = std::fs::write(&path, serde_json::to_string_pretty(&cfg).unwrap());
    }

    let state = Arc::new(AppState {
        auth_token: cfg.auth_token.clone(),
        save_root: save_root.clone(),
        port: cli.port,
        palette: Arc::new(Mutex::new(save_chunks::PaletteInterner::new())),
    });

    let app = Router::new()
        .route("/api/status", get(status))
        .route("/api/worldgen/reload", post(reload_worldgen))
        .route("/api/chunks/regenerate", post(regenerate_chunks))
        .route("/api/player/teleport", post(teleport))
        .route("/api/blocks/palette", get(blocks_palette))
        .route("/api/player/info", get(player_info))
        .route("/api/debug/snapshot", get(debug_snapshot))
        .route("/api/chunks/data", post(chunks_data))
        .layer(middleware::from_fn_with_state(
            state.clone(),
            auth_middleware,
        ))
        .with_state(state);

    let addr = SocketAddr::from(([127, 0, 0, 1], cli.port));
    info!("TerraNova Bridge sidecar v{BRIDGE_VERSION}");
    info!("Listening on http://{addr}");
    info!("Save root: {}", save_root.display());
    info!(
        "Auth token (paste into TerraNova Bridge): {}",
        cfg.auth_token
    );
    info!("Chunk preview reads universe/worlds/<world>/chunks/*.region.bin when present; synthetic fallback otherwise.");
    info!(
        "Iteration guide: {}",
        save_root.join("bridge").join("ITERATION.md").display()
    );

    let listener = tokio::net::TcpListener::bind(addr).await.expect("bind");
    axum::serve(listener, app)
        .with_graceful_shutdown(async {
            tokio::signal::ctrl_c().await.ok();
            info!("Shutting down");
        })
        .await
        .expect("serve");
}
