use std::fs;
use std::path::{Path, PathBuf};

use serde::Serialize;

/// Always-present mod folder for Bridge iteration (enable on the save in Hytale).
pub const TERRANOVA_BRIDGE_MOD_FOLDER: &str = "TerraNova.Bridge";

/// Hytale World Mod Settings icon: `resources/icon-256.png` (same art as the TerraNova app).
static BRIDGE_MOD_ICON_PNG: &[u8] = include_bytes!("../../assets/bridge-mod/icon-256.png");

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveModPackEntry {
    pub folder_name: String,
    pub path: String,
    pub has_manifest: bool,
    pub has_worldgen: bool,
    pub is_bridge_pack: bool,
}

fn pack_has_worldgen(pack_root: &Path) -> bool {
    pack_root.join("Server").join("HytaleGenerator").is_dir()
}

fn read_pack_entry(pack_root: &Path) -> Option<SaveModPackEntry> {
    let folder_name = pack_root.file_name()?.to_str()?.to_string();
    Some(SaveModPackEntry {
        is_bridge_pack: folder_name == TERRANOVA_BRIDGE_MOD_FOLDER,
        has_manifest: pack_root.join("manifest.json").is_file(),
        has_worldgen: pack_has_worldgen(pack_root),
        path: pack_root.to_string_lossy().into_owned(),
        folder_name,
    })
}

/// Create `mods/TerraNova.Bridge` with a minimal manifest and worldgen tree if missing.
pub fn ensure_bridge_mod_pack(save_root: &Path) -> Result<PathBuf, String> {
    let mods_dir = save_root.join("mods");
    fs::create_dir_all(&mods_dir).map_err(|e| e.to_string())?;
    let pack_root = mods_dir.join(TERRANOVA_BRIDGE_MOD_FOLDER);
    if !pack_root.is_dir() {
        fs::create_dir_all(&pack_root).map_err(|e| e.to_string())?;
    }
    let manifest_path = pack_root.join("manifest.json");
    if !manifest_path.is_file() {
        let manifest = serde_json::json!({
            "Group": "TerraNova",
            "Name": "Bridge",
            "Version": "1.0.0",
            "Description": "Dedicated mod pack for TerraNova Bridge sync and worldgen iteration.",
            "Authors": [{ "Name": "TerraNova" }],
            "Website": "https://github.com/HyperSystems-Development/TerraNova",
            "ServerVersion": "*",
            "Dependencies": {},
            "OptionalDependencies": {},
            "LoadBefore": {},
            "DisabledByDefault": false,
            "IncludesAssetPack": false,
            "SubPlugins": []
        });
        fs::write(
            &manifest_path,
            serde_json::to_string_pretty(&manifest).map_err(|e| e.to_string())?,
        )
        .map_err(|e| e.to_string())?;
    }

    let icon_path = pack_root.join("resources").join("icon-256.png");
    if !icon_path.is_file() {
        let resources_dir = pack_root.join("resources");
        fs::create_dir_all(&resources_dir).map_err(|e| e.to_string())?;
        fs::write(&icon_path, BRIDGE_MOD_ICON_PNG).map_err(|e| e.to_string())?;
    }
    let worldgen_dir = pack_root.join("Server").join("HytaleGenerator");
    fs::create_dir_all(&worldgen_dir).map_err(|e| e.to_string())?;
    let readme = pack_root.join("README-TerraNova-Bridge.txt");
    if !readme.is_file() {
        let text = concat!(
            "TerraNova Bridge mod pack\r\n",
            "================================\r\n",
            "\r\n",
            "This folder is an optional sync target for TerraNova (Group: TerraNova, Name: Bridge).\r\n",
            "It is NOT the HTTP sidecar — run \"pnpm bridge:run\" from the TerraNova repo for that.\r\n",
            "\r\n",
            "Typical workflow (content mods like McCal.*):\r\n",
            "  1. Point TerraNova Server mod path at your content pack (e.g. McCal.Autmn Forest).\r\n",
            "  2. Save -> Bridge -> Sync & Reload.\r\n",
            "  3. In Hytale console: /worldgen reload --clear  and  /viewport --radius 5\r\n",
            "     (Sidecar also queues commands in ..\\bridge\\pending-commands.log)\r\n",
            "\r\n",
            "Enable \"TerraNova:Bridge\" on this save if you sync test files into this folder.\r\n",
            "See ..\\bridge\\ITERATION.md after starting the sidecar.\r\n",
            "Docs: TerraNova src/docs/reference/bridge.md\r\n",
        );
        fs::write(&readme, text).map_err(|e| e.to_string())?;
    }
    Ok(pack_root)
}

/// List every directory under `<save>/mods`, ensuring TerraNova.Bridge exists first.
pub fn list_save_mod_packs(save_root: &Path) -> Result<Vec<SaveModPackEntry>, String> {
    let _bridge_pack = ensure_bridge_mod_pack(save_root)?;
    let mods_dir = save_root.join("mods");
    if !mods_dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut entries: Vec<SaveModPackEntry> = Vec::new();
    let read_dir = fs::read_dir(&mods_dir).map_err(|e| e.to_string())?;
    for entry in read_dir.flatten() {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }
        if let Some(pack) = read_pack_entry(&path) {
            entries.push(pack);
        }
    }

    entries.sort_by(|a, b| {
        b.is_bridge_pack.cmp(&a.is_bridge_pack).then_with(|| {
            a.folder_name
                .to_lowercase()
                .cmp(&b.folder_name.to_lowercase())
        })
    });
    Ok(entries)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;

    #[test]
    fn ensure_bridge_mod_and_list() {
        let base = temp_dir().join(format!("tn-bridge-mods-{}", std::process::id()));
        let _ = fs::remove_dir_all(&base);
        fs::create_dir_all(&base).unwrap();
        let other = base.join("mods").join("McCal.Volume Lab");
        fs::create_dir_all(other.join("Server").join("HytaleGenerator")).unwrap();

        let packs = list_save_mod_packs(&base).unwrap();
        assert!(packs.iter().any(|p| p.is_bridge_pack));
        assert!(packs.iter().any(|p| p.folder_name == "McCal.Volume Lab"));
        assert!(packs[0].is_bridge_pack);
        assert!(base
            .join("mods")
            .join(TERRANOVA_BRIDGE_MOD_FOLDER)
            .join("resources")
            .join("icon-256.png")
            .is_file());

        let _ = fs::remove_dir_all(&base);
    }
}
