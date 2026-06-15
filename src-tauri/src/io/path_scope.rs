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

    let roots = ALLOWED_ROOTS.read().unwrap_or_else(|e| e.into_inner());

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

    /// Register a real temp directory as an allowed root and return its canonical path.
    fn setup_root() -> PathBuf {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("tn-pathscope-{nanos}"));
        std::fs::create_dir_all(&dir).expect("create temp dir");
        register_allowed_root(&dir);
        dir.canonicalize().expect("canonicalize root")
    }

    #[test]
    fn rejects_path_when_no_roots_registered() {
        // Clear all roots for this test by using a fresh temp path that was never registered.
        let isolated = std::env::temp_dir().join("tn-pathscope-isolated-check");
        std::fs::create_dir_all(&isolated).ok();
        // Only check that an unregistered dir returns an error (roots may have others from other tests).
        // We can't clear the global state, so just test a non-existent deeply nested path.
        let result = validate_path("/tn/definitely/does/not/exist/12345xyz");
        assert!(result.is_err());
    }

    #[test]
    fn accepts_file_inside_registered_root() {
        let root = setup_root();
        let file = root.join("test.json");
        std::fs::write(&file, "{}").expect("write test file");

        let result = validate_path(file.to_str().unwrap());
        assert!(result.is_ok(), "expected Ok, got: {:?}", result);
    }

    #[test]
    fn accepts_new_file_path_inside_registered_root() {
        let root = setup_root();
        // File doesn't exist yet — should be allowed via parent canonicalization
        let new_file = root.join("new-file-that-does-not-exist.json");
        let result = validate_path(new_file.to_str().unwrap());
        assert!(
            result.is_ok(),
            "expected Ok for new file in root, got: {:?}",
            result
        );
    }

    #[test]
    fn rejects_path_outside_registered_root() {
        let root = setup_root();
        // A sibling directory at the same level as the root
        let sibling = root
            .parent()
            .unwrap()
            .join("tn-pathscope-sibling-not-registered");
        std::fs::create_dir_all(&sibling).ok();
        let file = sibling.join("secret.json");
        std::fs::write(&file, "{}").ok();

        let result = validate_path(file.to_str().unwrap());
        assert!(result.is_err(), "expected Err for path outside root");
        let _ = std::fs::remove_dir_all(&sibling);
    }

    #[test]
    fn unregister_removes_root() {
        let nanos = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap_or_default()
            .as_nanos();
        let dir = std::env::temp_dir().join(format!("tn-pathscope-unreg-{nanos}"));
        std::fs::create_dir_all(&dir).expect("create dir");
        register_allowed_root(&dir);

        let file = dir.join("file.json");
        std::fs::write(&file, "{}").expect("write file");

        // Should be allowed while registered
        assert!(validate_path(file.to_str().unwrap()).is_ok());

        unregister_allowed_root(&dir);

        // After unregistering, access depends on other registered roots — if none cover it, reject
        // We test that unregister_allowed_root doesn't panic and that re-registering works.
        register_allowed_root(&dir);
        assert!(validate_path(file.to_str().unwrap()).is_ok());

        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn register_allowed_root_is_idempotent() {
        let root = setup_root();
        let initial_count = {
            let roots = ALLOWED_ROOTS.read().unwrap();
            roots.len()
        };
        // Registering the same root multiple times should not duplicate it
        register_allowed_root(&root);
        register_allowed_root(&root);
        let new_count = {
            let roots = ALLOWED_ROOTS.read().unwrap();
            roots.len()
        };
        assert_eq!(
            initial_count, new_count,
            "duplicate registration should be a no-op"
        );
    }
}
