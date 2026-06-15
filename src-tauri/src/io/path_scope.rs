//! Path scope validation for filesystem commands.
//!
//! All filesystem commands that accept user-supplied paths should validate them
//! against registered allowed roots before performing any I/O. This prevents a
//! compromised webview from reading/writing arbitrary filesystem locations.

use std::path::{Path, PathBuf};
use std::sync::RwLock;

/// Global set of allowed root directories. Paths passed to filesystem commands
/// must fall under one of these roots (after canonicalization).
static ALLOWED_ROOTS: RwLock<Vec<PathBuf>> = RwLock::new(Vec::new());

/// Register an allowed root directory. Called when the user opens a project or
/// when the hytale-assets cache is initialised.
pub fn register_allowed_root(root: &Path) {
    if let Ok(canonical) = std::fs::canonicalize(root) {
        let mut roots = ALLOWED_ROOTS.write().unwrap_or_else(|e| e.into_inner());
        if !roots.iter().any(|r| r == &canonical) {
            roots.push(canonical);
        }
    }
}

/// Remove a previously registered root (e.g. when a project is closed).
pub fn unregister_allowed_root(root: &Path) {
    if let Ok(canonical) = std::fs::canonicalize(root) {
        let mut roots = ALLOWED_ROOTS.write().unwrap_or_else(|e| e.into_inner());
        roots.retain(|r| r != &canonical);
    }
}

/// Validate that `path` falls under at least one registered allowed root.
///
/// For files that don't exist yet (writes/creates), we canonicalize the nearest
/// existing ancestor and check that.
pub fn validate_path(path: &str) -> Result<PathBuf, String> {
    let roots = ALLOWED_ROOTS.read().unwrap_or_else(|e| e.into_inner());
    validate_path_against(path, &roots)
}

/// Pure inner implementation — takes an explicit roots slice so tests can pass
/// an isolated set without touching the process-wide ALLOWED_ROOTS global.
fn validate_path_against(path: &str, roots: &[PathBuf]) -> Result<PathBuf, String> {
    let target = PathBuf::from(path);

    // Try to canonicalize the path directly (works if it exists)
    let canonical = if target.exists() {
        target
            .canonicalize()
            .map_err(|e| format!("Invalid path: {}", e))?
    } else {
        // For new files: canonicalize the nearest existing ancestor
        let mut ancestor = target.clone();
        loop {
            if let Some(parent) = ancestor.parent() {
                if parent.exists() {
                    let canon_parent = parent
                        .canonicalize()
                        .map_err(|e| format!("Invalid path: {}", e))?;
                    // Re-append the remaining segments
                    let suffix = target
                        .strip_prefix(parent)
                        .unwrap_or(target.file_name().map(Path::new).unwrap_or(Path::new("")));
                    break canon_parent.join(suffix);
                }
                ancestor = parent.to_path_buf();
            } else {
                return Err("Path has no valid ancestor directory".into());
            }
        }
    };

    // Deny-by-default: if no roots are registered yet, reject the path.
    // Commands that need to work pre-project (path_exists, get_hytale_asset_cache_root)
    // either bypass scope explicitly or register their own roots first.
    if roots.is_empty() {
        return Err(format!(
            "No project roots registered — path not allowed: {}",
            target.display()
        ));
    }

    for root in roots.iter() {
        if canonical.starts_with(root) {
            return Ok(canonical);
        }
    }

    Err(format!(
        "Path is outside allowed project scope: {}",
        target.display()
    ))
}

/// Convenience: validate and return the original string (for commands that
/// pass strings through to std::fs).
pub fn validate_path_str(path: &str) -> Result<String, String> {
    validate_path(path)?;
    Ok(path.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::time::{SystemTime, UNIX_EPOCH};

    fn nanos() -> u128 {
        SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos()
    }

    /// Build an isolated roots list containing only the given directory.
    /// Tests that use this never touch ALLOWED_ROOTS, so they're parallel-safe.
    fn isolated_roots(dir: &Path) -> Vec<PathBuf> {
        vec![dir.canonicalize().expect("canonicalize root")]
    }

    #[test]
    fn rejects_path_when_no_roots_registered() {
        let result = validate_path_against("/tn/definitely/does/not/exist/12345xyz", &[]);
        assert!(result.is_err());
    }

    #[test]
    fn accepts_file_inside_registered_root() {
        let dir = std::env::temp_dir().join(format!("tn-ps-inside-{}", nanos()));
        std::fs::create_dir_all(&dir).expect("create dir");
        let file = dir.join("test.json");
        std::fs::write(&file, "{}").expect("write file");

        let roots = isolated_roots(&dir);
        let result = validate_path_against(file.to_str().unwrap(), &roots);
        assert!(result.is_ok(), "expected Ok, got: {:?}", result);
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn accepts_new_file_path_inside_registered_root() {
        let dir = std::env::temp_dir().join(format!("tn-ps-newfile-{}", nanos()));
        std::fs::create_dir_all(&dir).expect("create dir");
        let new_file = dir.join("new-file-that-does-not-exist.json");

        let roots = isolated_roots(&dir);
        let result = validate_path_against(new_file.to_str().unwrap(), &roots);
        assert!(
            result.is_ok(),
            "expected Ok for new file in root, got: {:?}",
            result
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn rejects_path_outside_registered_root() {
        let root = std::env::temp_dir().join(format!("tn-ps-root-{}", nanos()));
        let sibling = std::env::temp_dir().join(format!("tn-ps-sibling-{}", nanos()));
        std::fs::create_dir_all(&root).expect("create root");
        std::fs::create_dir_all(&sibling).expect("create sibling");
        let file = sibling.join("secret.json");
        std::fs::write(&file, "{}").expect("write file");

        let roots = isolated_roots(&root);
        let result = validate_path_against(file.to_str().unwrap(), &roots);
        assert!(result.is_err(), "expected Err for path outside root");

        let _ = std::fs::remove_dir_all(&root);
        let _ = std::fs::remove_dir_all(&sibling);
    }

    #[test]
    fn unregister_removes_root() {
        let dir = std::env::temp_dir().join(format!("tn-ps-unreg-{}", nanos()));
        std::fs::create_dir_all(&dir).expect("create dir");
        register_allowed_root(&dir);

        let file = dir.join("file.json");
        std::fs::write(&file, "{}").expect("write file");

        assert!(validate_path(file.to_str().unwrap()).is_ok());

        unregister_allowed_root(&dir);

        // Re-registering should restore access
        register_allowed_root(&dir);
        assert!(validate_path(file.to_str().unwrap()).is_ok());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn register_allowed_root_is_idempotent() {
        let dir = std::env::temp_dir().join(format!("tn-ps-idem-{}", nanos()));
        std::fs::create_dir_all(&dir).expect("create dir");

        register_allowed_root(&dir);
        register_allowed_root(&dir);
        register_allowed_root(&dir);

        // Count how many times this specific root appears — must be exactly 1.
        let canonical = dir.canonicalize().expect("canonicalize");
        let count = {
            let roots = ALLOWED_ROOTS.read().unwrap();
            roots.iter().filter(|r| **r == canonical).count()
        };
        assert_eq!(count, 1, "duplicate registration should be a no-op");

        let _ = std::fs::remove_dir_all(&dir);
    }
}
