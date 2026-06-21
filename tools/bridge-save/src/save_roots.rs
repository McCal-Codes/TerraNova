//! Cross-platform Hytale UserData/Saves resolution (matches JVM ActiveSaveResolver).

use std::path::{Path, PathBuf};

/// Hytale launcher patchline — release and pre-release data are isolated (Update 6+).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum HytalePatchline {
    #[default]
    Release,
    PreRelease,
}

impl HytalePatchline {
    pub fn from_channel(channel: &str) -> Self {
        if channel.eq_ignore_ascii_case("pre-release") {
            Self::PreRelease
        } else {
            Self::Release
        }
    }

    pub fn as_channel(self) -> &'static str {
        match self {
            Self::Release => "release",
            Self::PreRelease => "pre-release",
        }
    }
}

/// `%APPDATA%/Hytale`, `~/Library/Application Support/Hytale`, or `~/.local/share/Hytale`.
pub fn hytale_config_root() -> Option<PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let appdata = std::env::var_os("APPDATA")?;
        return Some(PathBuf::from(appdata).join("Hytale"));
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")?;
        return Some(
            PathBuf::from(home)
                .join("Library")
                .join("Application Support")
                .join("Hytale"),
        );
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        let home = std::env::var_os("HOME")?;
        return Some(
            PathBuf::from(home)
                .join(".local")
                .join("share")
                .join("Hytale"),
        );
    }
}

/// UserData root for a patchline (`UserData` or `data/pre-release/UserData`).
pub fn hytale_user_data_root_for(patchline: HytalePatchline) -> Option<PathBuf> {
    let base = hytale_config_root()?;
    Some(match patchline {
        HytalePatchline::Release => base.join("UserData"),
        HytalePatchline::PreRelease => base.join("data").join("pre-release").join("UserData"),
    })
}

/// `%APPDATA%/Hytale/UserData`, `~/Library/Application Support/Hytale/UserData`, or `~/.local/share/Hytale/UserData`.
pub fn hytale_user_data_root() -> Option<PathBuf> {
    hytale_user_data_root_for(HytalePatchline::Release)
}

pub fn hytale_saves_root_for(patchline: HytalePatchline) -> Option<PathBuf> {
    hytale_user_data_root_for(patchline).map(|p| p.join("Saves"))
}

pub fn hytale_saves_root() -> Option<PathBuf> {
    hytale_saves_root_for(HytalePatchline::Release)
}

pub fn hytale_global_mods_dir_for(patchline: HytalePatchline) -> Option<PathBuf> {
    hytale_user_data_root_for(patchline).map(|p| p.join("Mods"))
}

pub fn active_save_pointer_path_for(patchline: HytalePatchline) -> Option<PathBuf> {
    hytale_user_data_root_for(patchline).map(|p| p.join("bridge-active-save.txt"))
}

pub fn active_save_pointer_path() -> Option<PathBuf> {
    active_save_pointer_path_for(HytalePatchline::Release)
}

pub fn read_active_save_pointer() -> Option<PathBuf> {
    let pointer = active_save_pointer_path()?;
    let raw = std::fs::read_to_string(pointer).ok()?.trim().to_string();
    if raw.is_empty() {
        return None;
    }
    let path = PathBuf::from(raw);
    path.is_dir().then_some(path)
}

pub fn save_root_for_name(save_name: &str) -> Option<PathBuf> {
    if save_name.is_empty() {
        return None;
    }
    hytale_saves_root().map(|s| s.join(save_name))
}

fn looks_active(save_root: &Path) -> bool {
    if !save_root.join("bridge").is_dir() {
        return false;
    }
    let logs = save_root.join("logs");
    if !logs.is_dir() {
        return false;
    }
    std::fs::read_dir(logs).ok().is_some_and(|entries| {
        entries.filter_map(|e| e.ok()).any(|e| {
            e.path()
                .file_name()
                .and_then(|n| n.to_str())
                .is_some_and(|n| n.ends_with("_server.log"))
        })
    })
}

fn system_time_to_millis(t: std::time::SystemTime) -> u64 {
    t.duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

pub fn save_activity_score(save_root: &Path) -> u64 {
    let mut score = 0u64;
    let pending = save_root.join("bridge").join("pending-commands.log");
    if pending.is_file() {
        if let Ok(meta) = std::fs::metadata(&pending) {
            if let Ok(t) = meta.modified() {
                score = score.max(system_time_to_millis(t));
            }
        }
    }
    let logs = save_root.join("logs");
    if logs.is_dir() {
        if let Ok(entries) = std::fs::read_dir(logs) {
            for entry in entries.filter_map(|e| e.ok()) {
                let path = entry.path();
                if path
                    .file_name()
                    .and_then(|n| n.to_str())
                    .is_some_and(|n| n.ends_with("_server.log"))
                {
                    if let Ok(meta) = std::fs::metadata(&path) {
                        if let Ok(t) = meta.modified() {
                            score = score.max(system_time_to_millis(t));
                        }
                    }
                }
            }
        }
    }
    score
}

fn folder_mtime(path: &Path) -> u64 {
    std::fs::metadata(path)
        .and_then(|m| m.modified())
        .map(system_time_to_millis)
        .unwrap_or(0)
}

/// Sidecar pointer, then newest Bridge-active save, then newest save folder.
pub fn pick_default_save() -> Option<(PathBuf, String)> {
    if let Some(p) = read_active_save_pointer() {
        let name = p.file_name()?.to_str()?.to_string();
        return Some((p, name));
    }
    let saves_root = hytale_saves_root()?;
    let mut candidates: Vec<(PathBuf, u64)> = std::fs::read_dir(&saves_root)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .filter(|p| p.is_dir())
        .filter(|p| looks_active(p))
        .map(|p| (p.clone(), save_activity_score(&p)))
        .collect();
    if candidates.is_empty() {
        candidates = std::fs::read_dir(&saves_root)
            .ok()?
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| p.is_dir())
            .map(|p| (p.clone(), folder_mtime(&p)))
            .collect();
    }
    candidates.sort_by_key(|(_, score)| std::cmp::Reverse(*score));
    candidates.into_iter().next().map(|(p, _)| {
        let name = p
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_string();
        (p, name)
    })
}

/// `...\UserData\Saves\<Save>\mods\<Pack>` → save root + pack folder
fn parse_embedded_mod_pack(mod_pack_path: &str) -> Option<(PathBuf, String, String)> {
    let path = PathBuf::from(mod_pack_path);
    let mods_dir = path.parent()?;
    if mods_dir.file_name()?.to_str()? != "mods" {
        return None;
    }
    let save_root = mods_dir.parent()?.to_path_buf();
    let save_name = save_root.file_name()?.to_str()?.to_string();
    let mod_pack_folder = path.file_name()?.to_str()?.to_string();
    Some((save_root, save_name, mod_pack_folder))
}

pub fn resolve_save_root(
    save_name: &str,
    save_root_override: Option<&str>,
    mod_pack_path: Option<&str>,
) -> (PathBuf, String, Option<String>, Option<String>) {
    if let Some(pack) = mod_pack_path.and_then(parse_embedded_mod_pack) {
        return (
            pack.0,
            pack.1,
            mod_pack_path.map(|s| s.to_string()),
            Some(pack.2),
        );
    }
    if let Some(root) = save_root_override {
        let path = PathBuf::from(root);
        let name = path
            .file_name()
            .and_then(|s| s.to_str())
            .unwrap_or(save_name)
            .to_string();
        return (path, name, None, None);
    }
    if save_name.is_empty() {
        if let Some((root, name)) = pick_default_save() {
            return (root, name, None, None);
        }
        return (PathBuf::new(), String::new(), None, None);
    }
    if let Some(root) = save_root_for_name(save_name) {
        return (root, save_name.to_string(), None, None);
    }
    (PathBuf::from(save_name), save_name.to_string(), None, None)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn pre_release_user_data_root() {
        let root = hytale_user_data_root_for(HytalePatchline::PreRelease);
        assert!(root.is_some());
        let path = root.unwrap().to_string_lossy().replace('\\', "/");
        assert!(path.ends_with("/data/pre-release/UserData"));
    }

    #[test]
    fn parse_embedded_mod_pack_path() {
        let (root, name, folder) =
            parse_embedded_mod_pack("C:/Hytale/UserData/Saves/MyWorld/mods/Author.Pack")
                .expect("parse");
        assert_eq!(name, "MyWorld");
        assert_eq!(folder, "Author.Pack");
        assert!(root.ends_with("MyWorld"));
    }

    #[test]
    fn resolve_save_root_from_mod_pack_path() {
        let (root, name, _, folder) = resolve_save_root(
            "",
            None,
            Some("D:/Hytale/UserData/Saves/Alpha/mods/TerraNova.Test"),
        );
        assert_eq!(name, "Alpha");
        assert_eq!(folder.as_deref(), Some("TerraNova.Test"));
        assert!(root.ends_with("Alpha"));
    }
}
