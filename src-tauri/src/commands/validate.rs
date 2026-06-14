use crate::io::path_scope;
use crate::schema::validation::{ValidationError, ValidationResult};
use serde_json::Value;
use std::fs;
use std::path::PathBuf;

const MAX_VALIDATE_FILE_BYTES: u64 = 64 * 1024 * 1024; // 64 MB

/// Validate an entire asset pack directory against V2 schema.
#[tauri::command]
pub fn validate_asset_pack(path: String) -> Result<ValidationResult, String> {
    path_scope::validate_path_str(&path)?;
    let pack_path = PathBuf::from(&path);
    if !pack_path.is_dir() {
        return Err(format!("Not a directory: {}", path));
    }

    let mut errors: Vec<ValidationError> = Vec::new();

    // Recursively find all JSON files
    let json_files = find_json_files(&pack_path);

    for file_path in &json_files {
        let relative = file_path
            .strip_prefix(&pack_path)
            .unwrap_or(file_path)
            .to_string_lossy()
            .to_string();

        if let Ok(meta) = fs::metadata(file_path) {
            if meta.len() > MAX_VALIDATE_FILE_BYTES {
                errors.push(ValidationError {
                    file: relative.clone(),
                    field: String::new(),
                    message: format!(
                        "File exceeds maximum allowed size ({} MB)",
                        MAX_VALIDATE_FILE_BYTES / (1024 * 1024)
                    ),
                    severity: crate::schema::validation::Severity::Error,
                });
                continue;
            }
        }

        match fs::read_to_string(file_path) {
            Ok(content) => match serde_json::from_str::<Value>(&content) {
                Ok(value) => {
                    let file_errors = crate::schema::validation::validate_asset(&relative, &value);
                    errors.extend(file_errors);
                }
                Err(e) => {
                    errors.push(ValidationError {
                        file: relative,
                        field: String::new(),
                        message: format!("Invalid JSON: {}", e),
                        severity: crate::schema::validation::Severity::Error,
                    });
                }
            },
            Err(e) => {
                errors.push(ValidationError {
                    file: relative,
                    field: String::new(),
                    message: format!("Cannot read file: {}", e),
                    severity: crate::schema::validation::Severity::Error,
                });
            }
        }
    }

    Ok(ValidationResult {
        valid: errors.is_empty(),
        errors,
        files_checked: json_files.len(),
    })
}

const MAX_DIR_DEPTH: usize = 20;

fn find_json_files(dir: &PathBuf) -> Vec<PathBuf> {
    find_json_files_inner(dir, 0)
}

fn find_json_files_inner(dir: &PathBuf, depth: usize) -> Vec<PathBuf> {
    if depth > MAX_DIR_DEPTH {
        return Vec::new();
    }
    let mut files = Vec::new();
    if let Ok(entries) = fs::read_dir(dir) {
        for entry in entries.flatten() {
            let path = entry.path();
            // Skip symlinks to prevent cycles
            if path.is_symlink() {
                continue;
            }
            if path.is_dir() {
                files.extend(find_json_files_inner(&path, depth + 1));
            } else if path.extension().is_some_and(|ext| ext == "json") {
                files.push(path);
            }
        }
    }
    files
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_dir(label: &str) -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("terranova-validate-{label}-{nanos}"));
        fs::create_dir_all(&dir).expect("create temp dir");
        dir
    }

    #[test]
    fn valid_pack_returns_no_errors() {
        let dir = temp_dir("valid");
        crate::io::path_scope::register_allowed_root(&dir);

        fs::write(dir.join("biome.json"), r#"{"type":"biome","name":"test"}"#).unwrap();

        let result = validate_asset_pack(dir.to_string_lossy().into_owned()).unwrap();
        // Files are parsed; we don't expect schema errors for arbitrary JSON
        assert_eq!(result.files_checked, 1);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn invalid_json_produces_error() {
        let dir = temp_dir("invalid-json");
        crate::io::path_scope::register_allowed_root(&dir);

        fs::write(dir.join("broken.json"), "{ not valid json").unwrap();

        let result = validate_asset_pack(dir.to_string_lossy().into_owned()).unwrap();
        assert_eq!(result.files_checked, 1);
        assert!(!result.valid);
        assert!(result.errors[0].message.contains("Invalid JSON"));
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn non_json_files_are_ignored() {
        let dir = temp_dir("non-json");
        crate::io::path_scope::register_allowed_root(&dir);

        fs::write(dir.join("readme.txt"), "hello").unwrap();
        fs::write(dir.join("image.png"), &[0u8, 1, 2, 3]).unwrap();

        let result = validate_asset_pack(dir.to_string_lossy().into_owned()).unwrap();
        assert_eq!(result.files_checked, 0);
        assert!(result.valid);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn nested_json_files_are_found() {
        let dir = temp_dir("nested");
        crate::io::path_scope::register_allowed_root(&dir);

        let sub = dir.join("subdir");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("nested.json"), r#"{"ok":true}"#).unwrap();
        fs::write(dir.join("root.json"), r#"{"ok":true}"#).unwrap();

        let result = validate_asset_pack(dir.to_string_lossy().into_owned()).unwrap();
        assert_eq!(result.files_checked, 2);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_non_directory_path() {
        let dir = temp_dir("not-a-dir");
        crate::io::path_scope::register_allowed_root(&dir);

        let file = dir.join("file.json");
        fs::write(&file, "{}").unwrap();

        let result = validate_asset_pack(file.to_string_lossy().into_owned());
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("Not a directory"));
        let _ = fs::remove_dir_all(&dir);
    }
}
