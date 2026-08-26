//! Sign in with Hytale — OpenID Connect public client (Authorization Code + PKCE S256).
//!
//! This is an *identity overlay*. It does not authorize Bridge sidecar HTTP —
//! that keeps its per-save loopback Bearer token — and it never gates the
//! editor, pack authoring, or Bridge connection. See
//! `docs/planning/adr-001-sign-in-with-hytale.md`.
//!
//! The whole flow lives here in the native layer rather than the webview, so
//! that the access token and PKCE verifier structurally cannot reach
//! JavaScript, and so issuer traffic bypasses the webview CSP `connect-src`
//! allowlist in `tauri.conf.json`.

pub mod callback;
pub mod config;
pub mod discovery;
pub mod pkce;
pub mod session;
pub mod token;

use tokio::sync::{oneshot, Mutex};

pub use config::AuthConfig;
pub use session::HytaleAccount;

/// Structured error crossing the IPC boundary. Mirrors `BridgeHttpError`.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthError {
    pub code: String,
    pub message: String,
}

impl AuthError {
    pub fn new(code: &str, message: impl Into<String>) -> Self {
        Self {
            code: code.into(),
            message: message.into(),
        }
    }

    pub fn not_configured() -> Self {
        Self::new(
            "not_configured",
            "This build has no Hytale client ID. Sign in is unavailable.",
        )
    }

    pub fn network(context: &str, err: impl std::fmt::Display) -> Self {
        Self::new("network", format!("{}: {}", context, err))
    }
}

impl std::fmt::Display for AuthError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{}: {}", self.code, self.message)
    }
}

/// Live session. Everything secret stays private to this module.
#[derive(Default)]
pub(crate) struct AuthSession {
    pub account: Option<HytaleAccount>,
    /// In-memory only. Never persisted, never serialized, never sent to the
    /// frontend. There are no refresh tokens, so nothing is lost by dropping
    /// this on exit — re-auth requires full interactive consent regardless.
    pub access_token: Option<String>,
}

pub struct AuthState {
    pub(crate) session: Mutex<AuthSession>,
    pub(crate) http: reqwest::Client,
    /// `Some(_)` while a sign-in is in flight; firing it aborts the listener.
    pub(crate) cancel: Mutex<Option<oneshot::Sender<()>>>,
}

impl Default for AuthState {
    fn default() -> Self {
        Self {
            session: Mutex::new(AuthSession::default()),
            http: reqwest::Client::builder()
                .connect_timeout(std::time::Duration::from_secs(10))
                .timeout(std::time::Duration::from_secs(20))
                .build()
                .expect("failed to build auth HTTP client"),
            cancel: Mutex::new(None),
        }
    }
}
