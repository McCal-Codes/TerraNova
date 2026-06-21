use bridge_save::save_roots::{hytale_global_mods_dir_for, HytalePatchline};
use std::path::PathBuf;

static BRIDGE_PLUGIN_JAR: &[u8] = include_bytes!("../../assets/bridge-plugin/TerraNova.Bridge.jar");
const PLUGIN_JAR_NAME: &str = "TerraNova.Bridge.jar";

fn mods_dir_for_patchline(patchline: HytalePatchline) -> Option<PathBuf> {
    hytale_global_mods_dir_for(patchline)
}

#[derive(serde::Serialize)]
pub struct PluginStatus {
    pub installed: bool,
    pub jar_name: Option<String>,
    pub install_path: Option<String>,
    pub mods_dir_exists: bool,
    pub patchline: String,
}

pub fn plugin_status(patchline: Option<&str>) -> PluginStatus {
    let patchline = HytalePatchline::from_channel(patchline.unwrap_or("release"));
    let Some(mods_dir) = mods_dir_for_patchline(patchline) else {
        return PluginStatus {
            installed: false,
            jar_name: None,
            install_path: None,
            mods_dir_exists: false,
            patchline: patchline.as_channel().to_string(),
        };
    };
    let mods_dir_exists = mods_dir.exists();
    if !mods_dir_exists {
        return PluginStatus {
            installed: false,
            jar_name: None,
            install_path: None,
            mods_dir_exists: false,
            patchline: patchline.as_channel().to_string(),
        };
    }
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("TerraNova.Bridge") && name_str.ends_with(".jar") {
                return PluginStatus {
                    installed: true,
                    jar_name: Some(name_str.to_string()),
                    install_path: Some(entry.path().display().to_string()),
                    mods_dir_exists: true,
                    patchline: patchline.as_channel().to_string(),
                };
            }
        }
    }
    PluginStatus {
        installed: false,
        jar_name: None,
        install_path: None,
        mods_dir_exists: true,
        patchline: patchline.as_channel().to_string(),
    }
}

pub fn deploy_plugin(patchline: Option<&str>) -> Result<String, String> {
    let patchline = HytalePatchline::from_channel(patchline.unwrap_or("release"));
    let mods_dir = mods_dir_for_patchline(patchline)
        .ok_or_else(|| "Cannot resolve Hytale mods folder for this patchline".to_string())?;

    if !mods_dir.exists() {
        return Err(format!(
            "Hytale mods folder not found at {}. Launch Hytale ({}) at least once to create it.",
            mods_dir.display(),
            patchline.as_channel(),
        ));
    }

    // Remove any stale versioned JARs before writing
    if let Ok(entries) = std::fs::read_dir(&mods_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name();
            let name_str = name.to_string_lossy();
            if name_str.starts_with("TerraNova.Bridge") && name_str.ends_with(".jar") {
                let _ = std::fs::remove_file(entry.path());
            }
        }
    }

    let dest = mods_dir.join(PLUGIN_JAR_NAME);
    std::fs::write(&dest, BRIDGE_PLUGIN_JAR)
        .map_err(|e| format!("Failed to write plugin to {}: {}", dest.display(), e))?;

    Ok(format!(
        "Installed to {} ({} patchline). Enable 'TerraNova Bridge' on your save in Hytale.",
        dest.display(),
        patchline.as_channel(),
    ))
}
