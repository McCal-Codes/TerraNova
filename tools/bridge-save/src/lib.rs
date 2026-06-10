//! Shared Hytale save inspection for TerraNova Bridge (Tauri + sidecar).

pub mod diagnostics;
pub mod pending_commands;
pub mod player;
pub mod save_roots;
pub mod world_config;

pub use diagnostics::{collect_snapshot, BridgeDebugSnapshot};
pub use pending_commands::{
    append_pending_command, append_pending_commands, chunk_regen_commands,
    chunk_regenerate_command, teleport_command, viewport_command, worldgen_reload_clear_command,
    write_active_save_pointer, write_iteration_guide, MAX_REGEN_COMMANDS, MAX_REGEN_RADIUS,
};
pub use player::{
    current_world_from_log_stack, hytale_server_session_active, last_position_for_world_from_log,
    list_instance_worlds, newest_server_log_path, prefer_live_world_signals, resolve_player,
    InstanceWorldStatus, ResolvedPlayer,
};
pub use save_roots::{
    active_save_pointer_path, hytale_saves_root, hytale_user_data_root, pick_default_save,
    read_active_save_pointer, resolve_save_root, save_root_for_name,
};
pub use world_config::{
    chunk_region_on_disk, chunk_region_path, instance_slug_from_world_id, label_from_world_config,
    read_world_config, WorldConfigSummary,
};
