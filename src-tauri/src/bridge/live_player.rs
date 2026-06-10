//! Tauri-facing wrapper around shared `bridge-save` player resolution.

pub use bridge_save::player::{
    list_instance_worlds, resolve_player, InstanceWorldStatus, ResolvedPlayer,
};

/// Alias kept for existing Tauri call sites.
pub type LivePlayerState = ResolvedPlayer;

pub fn resolve_live_player_from_save(
    save_root: &std::path::Path,
    bridge_port_open: bool,
) -> Option<LivePlayerState> {
    resolve_player(save_root, bridge_port_open)
}
