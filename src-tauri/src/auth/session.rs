//! The signed-in account, and its on-disk cache.
//!
//! **Nothing here is a credential.** Because the provider issues no refresh
//! tokens, there is no durable secret worth protecting: the access token
//! expires within the hour and cannot be renewed without full interactive
//! consent, so it stays in memory and dies with the process.
//!
//! What is cached is `sub`, the selected profile, and the shared-source flag —
//! identifiers, not credentials. That is why this is a plain JSON file rather
//! than an OS keyring: a keyring would be guarding public data at the cost of
//! three platform backends, DBus on Linux, and an unlock prompt on macOS.
//!
//! Treat the cache as a **display and binding hint, not proof of
//! authentication**. A stale `shared_source: true` must never be taken as a
//! live entitlement for anything security-relevant.

use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use tauri::Manager;

use super::token::IdTokenClaims;
use super::AuthError;

const CACHE_FILE: &str = "hytale-account.json";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HytaleAccount {
    /// Stable per-application anonymous identifier (43-char base64url, not a
    /// UUID). Different in every application; unchanged when the user switches
    /// game profiles.
    pub sub: String,
    /// `profile.uuid` — a real, shared, public game identity, and the value the
    /// Bridge matches against save files.
    ///
    /// The user picks a profile at every sign-in and may pick a different one
    /// next time, so this is a per-session choice, not a fixed account
    /// property.
    pub uuid: Option<String>,
    pub username: Option<String>,
    pub shared_source: bool,
    /// Scopes actually granted, which may differ from those requested.
    pub scopes: Vec<String>,
    pub signed_in_at: u64,
    /// Unix seconds. Drives the "session expired, sign in again" state — there
    /// is no silent renewal.
    pub session_expires_at: Option<u64>,
}

impl HytaleAccount {
    pub fn from_claims(
        claims: IdTokenClaims,
        scopes: Vec<String>,
        expires_in: Option<u64>,
    ) -> Self {
        let now = unix_now();
        let profile = claims.profile;
        Self {
            sub: claims.sub,
            uuid: profile.as_ref().and_then(|p| p.uuid.clone()),
            username: profile.as_ref().and_then(|p| p.username.clone()),
            shared_source: claims.shared_source.unwrap_or(false),
            scopes,
            signed_in_at: now,
            session_expires_at: expires_in.map(|secs| now + secs),
        }
    }

    pub fn is_expired(&self) -> bool {
        self.session_expires_at.is_some_and(|exp| unix_now() >= exp)
    }
}

pub fn unix_now() -> u64 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0)
}

fn cache_path(app: &tauri::AppHandle) -> Result<PathBuf, AuthError> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|e| AuthError::new("network", format!("No app config directory: {}", e)))?;
    Ok(dir.join(CACHE_FILE))
}

pub fn load(app: &tauri::AppHandle) -> Option<HytaleAccount> {
    let path = cache_path(app).ok()?;
    let raw = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&raw).ok()
}

pub fn save(app: &tauri::AppHandle, account: &HytaleAccount) -> Result<(), AuthError> {
    let path = cache_path(app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| {
            AuthError::new("network", format!("Could not create config dir: {}", e))
        })?;
    }
    let json = serde_json::to_string_pretty(account)
        .map_err(|e| AuthError::new("network", format!("Could not encode account: {}", e)))?;
    std::fs::write(&path, json)
        .map_err(|e| AuthError::new("network", format!("Could not write account cache: {}", e)))
}

pub fn clear(app: &tauri::AppHandle) {
    if let Ok(path) = cache_path(app) {
        let _ = std::fs::remove_file(path);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::auth::token::Profile;

    fn claims(profile: Option<Profile>, shared: Option<bool>) -> IdTokenClaims {
        IdTokenClaims {
            sub: "s".repeat(43),
            exp: unix_now() + 3600,
            nonce: Some("n".into()),
            profile,
            shared_source: shared,
        }
    }

    #[test]
    fn maps_profile_claims_onto_the_account() {
        let account = HytaleAccount::from_claims(
            claims(
                Some(Profile {
                    uuid: Some("abc-123".into()),
                    username: Some("McCal".into()),
                }),
                Some(true),
            ),
            vec!["openid".into(), "hytale:profile".into()],
            Some(3600),
        );
        assert_eq!(account.uuid.as_deref(), Some("abc-123"));
        assert_eq!(account.username.as_deref(), Some("McCal"));
        assert!(account.shared_source);
        assert!(!account.is_expired());
    }

    #[test]
    fn absent_optional_claims_degrade_quietly() {
        // Signing in without hytale:profile or account:shared_source must not
        // fail — those scopes are optional and the UI degrades.
        let account = HytaleAccount::from_claims(claims(None, None), vec!["openid".into()], None);
        assert!(account.uuid.is_none());
        assert!(account.username.is_none());
        assert!(!account.shared_source);
        assert!(!account.is_expired(), "no expiry means not expired");
    }

    #[test]
    fn expiry_is_computed_from_expires_in() {
        let account = HytaleAccount::from_claims(claims(None, None), vec![], Some(0));
        assert!(account.is_expired());
    }

    #[test]
    fn account_json_never_carries_a_token() {
        let account = HytaleAccount::from_claims(claims(None, Some(false)), vec![], Some(3600));
        let json = serde_json::to_string(&account).unwrap();
        assert!(!json.contains("access_token"));
        assert!(!json.contains("id_token"));
        assert!(!json.contains("verifier"));
    }
}
