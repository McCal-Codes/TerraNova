use serde::{Deserialize, Serialize};

// ── Community mod manifest types ────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommunityMod {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    /// URL to the mod's homepage or repository.
    pub url: String,
    /// Semver range of TerraNova versions this mod is compatible with.
    pub compat: String,
    /// Optional preview image URL.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail: Option<String>,
    /// Tags for filtering (e.g. "noise", "pattern", "prop").
    #[serde(default)]
    pub tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ModIndex {
    pub schema_version: u32,
    pub updated_at: String,
    pub mods: Vec<CommunityMod>,
}

// ── Tauri commands ───────────────────────────────────────────────────────────

/// Fetch the community mod index from the configured registry URL.
/// Currently a stub — returns an empty index so the frontend can wire up
/// without hitting a real endpoint yet.
#[tauri::command]
pub fn fetch_community_mod_index() -> Result<ModIndex, String> {
    // TODO: replace with a real HTTP fetch once the registry is live.
    Ok(ModIndex {
        schema_version: 1,
        updated_at: String::new(),
        mods: vec![],
    })
}

/// List community mods that have been installed locally.
/// Currently a stub — returns an empty list.
#[tauri::command]
pub fn list_installed_community_mods() -> Result<Vec<CommunityMod>, String> {
    // TODO: scan the user's mods directory once install/uninstall is implemented.
    Ok(vec![])
}
