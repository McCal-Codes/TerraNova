//! Tauri-facing wrapper around shared `bridge-save` player resolution.

pub use bridge_save::player::{
    list_instance_worlds, resolve_player_preferring, InstanceWorldStatus, ResolvedPlayer,
};

/// Alias kept for existing Tauri call sites.
pub type LivePlayerState = ResolvedPlayer;

/// Resolve the player, preferring the signed-in Hytale profile's UUID when one
/// is supplied.
///
/// `preferred_uuid` is `None` whenever the user is signed out, has the
/// preference disabled, or this build has no Hytale client ID — in which case
/// resolution falls back to the newest-player-file heuristic exactly as before.
pub fn resolve_live_player_from_save(
    save_root: &std::path::Path,
    bridge_port_open: bool,
    preferred_uuid: Option<&str>,
) -> Option<LivePlayerState> {
    resolve_player_preferring(save_root, bridge_port_open, preferred_uuid)
}
