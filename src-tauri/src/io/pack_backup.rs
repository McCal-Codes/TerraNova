use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};

use super::path_scope;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PackBackupResult {
    pub backup_path: String,
    pub files_copied: u64,
    pub bytes_copied: u64,
}

/// Copy a pack directory to a backup folder (recursive, skips symlinks).
pub fn backup_pack_directory(
    pack_path: &Path,
    destination: Option<&Path>,
) -> Result<PackBackupResult, String> {
    if !pack_path.is_dir() {
        return Err(format!("Not a directory: {}", pack_path.display()));
    }

    path_scope::register_allowed_root(pack_path);
    path_scope::validate_path(pack_path.to_string_lossy().as_ref())?;

    let backup_path = match destination {
        Some(dest) => dest.to_path_buf(),
        None => default_backup_path(pack_path)?,
    };

    if let Some(parent) = backup_path.parent() {
        path_scope::register_allowed_root(parent);
    }
    path_scope::validate_path(backup_path.to_string_lossy().as_ref())?;

    if backup_path.exists() {
        return Err(format!(
            "Backup folder already exists: {}",
            backup_path.display()
        ));
    }

    let (files_copied, bytes_copied) = copy_dir_recursive(pack_path, &backup_path)?;

    Ok(PackBackupResult {
        backup_path: backup_path.to_string_lossy().to_string(),
        files_copied,
        bytes_copied,
    })
}

fn default_backup_path(pack_path: &Path) -> Result<PathBuf, String> {
    let pack_name = pack_path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "Invalid pack folder name".to_string())?;

    let parent = pack_path
        .parent()
        .ok_or_else(|| "Pack path has no parent directory".to_string())?;

    let stamp = format_system_timestamp();
    let backup_root = parent.join(".terranova-backups");
    Ok(backup_root.join(format!("{pack_name}-{stamp}")))
}

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(u64, u64), String> {
    fs::create_dir_all(dst).map_err(|e| format!("Failed to create backup folder: {e}"))?;

    let mut files_copied = 0u64;
    let mut bytes_copied = 0u64;

    for entry in fs::read_dir(src).map_err(|e| format!("Failed to read pack folder: {e}"))? {
        let entry = entry.map_err(|e| format!("Failed to read directory entry: {e}"))?;
        let entry_path = entry.path();
        let dest_path = dst.join(entry.file_name());

        if entry_path.is_symlink() {
            continue;
        }

        if entry_path.is_dir() {
            let (f, b) = copy_dir_recursive(&entry_path, &dest_path)?;
            files_copied += f;
            bytes_copied += b;
        } else {
            fs::copy(&entry_path, &dest_path)
                .map_err(|e| format!("Failed to copy {}: {e}", entry_path.display()))?;
            files_copied += 1;
            bytes_copied += entry.metadata().map(|m| m.len()).unwrap_or(0);
        }
    }

    Ok((files_copied, bytes_copied))
}

fn format_system_timestamp() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let millis = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis())
        .unwrap_or(0);
    format!("{millis}")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env::temp_dir;
    use std::fs;

    #[test]
    fn default_backup_path_uses_terranova_backups_folder() {
        let root = temp_dir().join(format!("tn-pack-backup-{}", std::process::id()));
        let pack = root.join("MyMod");
        fs::create_dir_all(&pack).unwrap();

        let backup = default_backup_path(&pack).unwrap();
        assert!(backup.to_string_lossy().contains(".terranova-backups"));
        assert!(backup
            .file_name()
            .unwrap()
            .to_string_lossy()
            .starts_with("MyMod-"));

        let _ = fs::remove_dir_all(&root);
    }

    #[test]
    fn backup_copies_pack_tree() {
        let root = temp_dir().join(format!("tn-pack-backup-copy-{}", std::process::id()));
        let pack = root.join("Pack");
        fs::create_dir_all(pack.join("Server/HytaleGenerator")).unwrap();
        fs::write(pack.join("manifest.json"), r#"{"Name":"Test"}"#).unwrap();

        path_scope::register_allowed_root(&root);

        let dest = root.join("backup-copy");
        let result = backup_pack_directory(&pack, Some(&dest)).unwrap();
        assert_eq!(result.backup_path, dest.to_string_lossy());
        assert!(dest.join("manifest.json").is_file());
        assert!(dest.join("Server/HytaleGenerator").is_dir());
        assert!(result.files_copied >= 1);

        let _ = fs::remove_dir_all(&root);
    }
}
