//! OIDC discovery document.
//!
//! The guide is explicit that the discovery document describes the whole
//! server, and that grant types and scopes advertised there beyond what the
//! third-party guide documents do not apply to our client. So we read endpoint
//! URLs from it and nothing else — never capability negotiation.

use serde::Deserialize;

use super::config::AuthConfig;
use super::AuthError;

#[derive(Debug, Clone, Deserialize)]
pub struct ProviderMetadata {
    pub issuer: String,
    pub authorization_endpoint: String,
    pub token_endpoint: String,
    pub jwks_uri: String,
    /// Unused today: every claim we need already rides in the `id_token`.
    /// Captured because `/userinfo` is the documented fallback if the token's
    /// claim set ever changes.
    #[serde(default)]
    #[allow(dead_code)]
    pub userinfo_endpoint: Option<String>,
}

pub async fn fetch(
    http: &reqwest::Client,
    config: &AuthConfig,
) -> Result<ProviderMetadata, AuthError> {
    let url = config.discovery_url();
    let response = http
        .get(&url)
        .send()
        .await
        .map_err(|e| AuthError::network("Could not reach the Hytale account service", e))?;

    if !response.status().is_success() {
        return Err(AuthError::new(
            "network",
            format!(
                "Hytale account discovery failed (HTTP {}).",
                response.status().as_u16()
            ),
        ));
    }

    let metadata: ProviderMetadata = response
        .json()
        .await
        .map_err(|e| AuthError::network("Malformed discovery document", e))?;

    // Guard against a redirected or substituted discovery document.
    if metadata.issuer.trim_end_matches('/') != config.issuer.trim_end_matches('/') {
        return Err(AuthError::new(
            "id_token_invalid",
            format!(
                "Discovery issuer '{}' does not match '{}'.",
                metadata.issuer, config.issuer
            ),
        ));
    }

    Ok(metadata)
}
