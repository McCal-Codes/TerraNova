//! Tauri commands for Sign in with Hytale.
//!
//! `HytaleAccount` is the only type these return. The access token, id_token,
//! PKCE verifier, `state`, `nonce`, and authorization code never cross this
//! boundary.

use tauri::{AppHandle, State};

use crate::auth::{
    callback, config, discovery, pkce, session, token, AuthConfig, AuthError, AuthState,
    HytaleAccount,
};
use crate::commands::io as io_commands;

/// Whether this build can sign in at all (i.e. was compiled with a client ID).
/// The frontend hides the entire account surface when false.
#[tauri::command]
pub fn hytale_auth_available() -> bool {
    config::is_configured()
}

/// The cached account, if any. Loads from disk on first call so a restart still
/// shows who is signed in.
#[tauri::command]
pub async fn hytale_account(
    app: AppHandle,
    state: State<'_, AuthState>,
) -> Result<Option<HytaleAccount>, AuthError> {
    let mut session_guard = state.session.lock().await;
    if session_guard.account.is_none() {
        session_guard.account = session::load(&app);
    }
    // Once the hour is up the access token is dead and cannot be renewed
    // silently, so drop it. The account itself stays so the UI can show who
    // was signed in and offer to sign in again.
    if session_guard
        .account
        .as_ref()
        .is_some_and(|a| a.is_expired())
    {
        session_guard.access_token = None;
    }
    Ok(session_guard.account.clone())
}

#[tauri::command]
pub async fn hytale_sign_out(app: AppHandle, state: State<'_, AuthState>) -> Result<(), AuthError> {
    let mut session_guard = state.session.lock().await;
    session_guard.account = None;
    session_guard.access_token = None;
    drop(session_guard);
    session::clear(&app);
    Ok(())
}

/// Abort an in-flight sign-in. Safe to call when none is running.
#[tauri::command]
pub async fn hytale_cancel_sign_in(state: State<'_, AuthState>) -> Result<(), AuthError> {
    if let Some(tx) = state.cancel.lock().await.take() {
        let _ = tx.send(());
    }
    Ok(())
}

/// Run the full Authorization Code + PKCE flow and return the signed-in
/// account.
///
/// Consent is shown every time — the provider rejects `prompt=none` and issues
/// no refresh token, so there is no silent path and none is attempted.
#[tauri::command]
pub async fn hytale_sign_in(
    app: AppHandle,
    state: State<'_, AuthState>,
) -> Result<HytaleAccount, AuthError> {
    let config = AuthConfig::from_env().ok_or_else(AuthError::not_configured)?;

    // Reserve the in-progress slot in a single lock acquisition. Checking and
    // setting separately would let two rapid clicks both pass the check during
    // the discovery round-trip, orphaning the first listener until it times out.
    let cancel_rx = {
        let mut cancel_guard = state.cancel.lock().await;
        if cancel_guard.is_some() {
            return Err(AuthError::new(
                "already_in_progress",
                "A sign-in is already in progress. Finish or cancel it first.",
            ));
        }
        let (cancel_tx, cancel_rx) = tokio::sync::oneshot::channel();
        *cancel_guard = Some(cancel_tx);
        cancel_rx
    };

    let result = async {
        let metadata = discovery::fetch(&state.http, &config).await?;
        let (listener, redirect_uri) = callback::bind_first_free().await?;

        let pkce = pkce::generate()?;
        let csrf_state = pkce::random_token()?;
        let nonce = pkce::random_token()?;

        let authorize_url = build_authorize_url(
            &metadata.authorization_endpoint,
            &config,
            &redirect_uri,
            &pkce.challenge,
            &csrf_state,
            &nonce,
        );

        // Reuse the existing external-URL opener: it already handles the Windows
        // case where `cmd /c start` would truncate the URL at the first `&`,
        // which an authorize URL is full of.
        io_commands::open_url(authorize_url)
            .map_err(|e| AuthError::new("network", format!("Could not open your browser: {}", e)))?;

        let cb = callback::wait_for_callback(listener, &csrf_state, cancel_rx).await?;
        let tokens = token::exchange_code(
            &state.http,
            &metadata.token_endpoint,
            &config,
            &cb.code,
            &redirect_uri,
            &pkce.verifier,
        )
        .await?;
        let claims = token::verify_id_token(
            &state.http,
            &metadata.jwks_uri,
            &tokens.id_token,
            &config,
            &nonce,
        )
        .await?;
        Ok::<_, AuthError>((tokens, claims))
    }
    .await;

    // Always release the in-progress slot, success or failure.
    *state.cancel.lock().await = None;

    let (tokens, claims) = result?;
    let granted = tokens
        .scope
        .as_deref()
        .map(|s| s.split_whitespace().map(str::to_string).collect())
        .unwrap_or_default();
    let account = HytaleAccount::from_claims(claims, granted, tokens.expires_in);

    let mut session_guard = state.session.lock().await;
    session_guard.account = Some(account.clone());
    session_guard.access_token = Some(tokens.access_token);
    drop(session_guard);

    // A failed cache write should not fail an otherwise successful sign-in.
    let _ = session::save(&app, &account);
    Ok(account)
}

fn build_authorize_url(
    authorization_endpoint: &str,
    config: &AuthConfig,
    redirect_uri: &str,
    challenge: &str,
    csrf_state: &str,
    nonce: &str,
) -> String {
    let query = url::form_urlencoded::Serializer::new(String::new())
        .append_pair("response_type", "code")
        .append_pair("client_id", &config.client_id)
        .append_pair("redirect_uri", redirect_uri)
        .append_pair("scope", &config::SCOPES.join(" "))
        .append_pair("state", csrf_state)
        .append_pair("nonce", nonce)
        .append_pair("code_challenge", challenge)
        .append_pair("code_challenge_method", "S256")
        .finish();
    format!("{}?{}", authorization_endpoint, query)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_config() -> AuthConfig {
        AuthConfig {
            issuer: "https://connect.accounts.hytale.com".into(),
            client_id: "cid".into(),
        }
    }

    #[test]
    fn authorize_url_carries_every_required_parameter() {
        let url = build_authorize_url(
            "https://connect.accounts.hytale.com/oauth2/auth",
            &test_config(),
            "http://127.0.0.1:7871/oauth/callback",
            "chal",
            "st8",
            "nonce1",
        );
        assert!(url.starts_with("https://connect.accounts.hytale.com/oauth2/auth?"));
        assert!(url.contains("response_type=code"));
        assert!(url.contains("client_id=cid"));
        assert!(url.contains("code_challenge=chal"));
        assert!(url.contains("code_challenge_method=S256"));
        assert!(url.contains("state=st8"));
        assert!(url.contains("nonce=nonce1"));
        // Redirect URI and scopes must be percent-encoded.
        assert!(url.contains("redirect_uri=http%3A%2F%2F127.0.0.1%3A7871%2Foauth%2Fcallback"));
        assert!(url.contains("scope=openid+hytale%3Aprofile+account%3Ashared_source"));
    }

    #[test]
    fn authorize_url_never_leaks_the_verifier() {
        let url = build_authorize_url(
            "https://x/oauth2/auth",
            &test_config(),
            "http://127.0.0.1:7871/oauth/callback",
            &pkce::challenge_for("secret-verifier"),
            "s",
            "n",
        );
        assert!(!url.contains("secret-verifier"));
        assert!(!url.contains("code_verifier"));
    }
}
