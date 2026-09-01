//! Static configuration for the Hytale OIDC client.

/// The Hytale account issuer. Discovery lives at
/// `{ISSUER}/.well-known/openid-configuration`.
pub const ISSUER: &str = "https://connect.accounts.hytale.com";

/// Loopback redirect ports, registered with the provider at application time.
///
/// A fixed list rather than an OS-assigned ephemeral port because the portal
/// requires exact redirect URIs. We bind the first free one, so a port conflict
/// on the user's machine degrades to the next candidate instead of making sign
/// in impossible. Deliberately clear of the Bridge sidecar default (7854) and
/// the Vite dev server (1420).
pub const REDIRECT_PORTS: &[u16] = &[7871, 7872, 7873, 7874, 7875];

pub const CALLBACK_PATH: &str = "/oauth/callback";

/// Requested scopes. The provider requires an exact match, so this list must
/// stay in sync with what was approved on the portal application.
///
/// `account:game_ownership` and `account:parental_managed` are deliberately not
/// requested — no feature needs them.
pub const SCOPES: &[&str] = &["openid", "hytale:profile", "account:shared_source"];

/// How long to wait for the user to complete consent in their browser.
///
/// Consent is required on *every* sign-in (the provider rejects
/// `prompt=none`), so the user may be typing a password and a 2FA code. A short
/// timeout here would be hostile.
pub const CALLBACK_TIMEOUT_SECS: u64 = 300;

/// The OAuth client ID, baked in at compile time from
/// `TERRANOVA_HYTALE_CLIENT_ID`.
///
/// `None` in builds without it — sign-in is then reported as unavailable and
/// the account UI hides entirely.
///
/// Note that `client_id` is **public by OAuth's design**; keeping it out of the
/// source tree is repo hygiene for a public repository, not secrecy. Do not
/// promote it to a keyring or secret store.
pub fn client_id() -> Option<&'static str> {
    match option_env!("TERRANOVA_HYTALE_CLIENT_ID") {
        Some(id) if !id.is_empty() => Some(id),
        _ => None,
    }
}

/// True when this build can perform a sign-in at all.
pub fn is_configured() -> bool {
    client_id().is_some()
}

/// Runtime-resolved config. The issuer is a field rather than a constant so
/// tests can point discovery, token exchange, and JWKS at a fixture server.
#[derive(Debug, Clone)]
pub struct AuthConfig {
    pub issuer: String,
    pub client_id: String,
}

impl AuthConfig {
    pub fn from_env() -> Option<Self> {
        Some(Self {
            issuer: ISSUER.to_string(),
            client_id: client_id()?.to_string(),
        })
    }

    pub fn discovery_url(&self) -> String {
        format!(
            "{}/.well-known/openid-configuration",
            self.issuer.trim_end_matches('/')
        )
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn scopes_and_ports_match_what_was_registered() {
        assert_eq!(
            SCOPES,
            &["openid", "hytale:profile", "account:shared_source"]
        );
        assert_eq!(
            REDIRECT_PORTS.len(),
            5,
            "the portal caps redirect URIs at 5"
        );
        assert!(
            !REDIRECT_PORTS.contains(&7854),
            "must not collide with the Bridge sidecar"
        );
    }

    #[test]
    fn discovery_url_is_well_formed() {
        let cfg = AuthConfig {
            issuer: ISSUER.into(),
            client_id: "x".into(),
        };
        assert_eq!(
            cfg.discovery_url(),
            "https://connect.accounts.hytale.com/.well-known/openid-configuration"
        );
    }

    /// Proves the compile-time client id actually reached the binary. Skips
    /// itself in builds without one so CI without the secret still passes.
    #[test]
    fn client_id_is_compiled_in_when_configured() {
        match client_id() {
            Some(id) => {
                assert!(is_configured());
                assert!(!id.is_empty());
                println!("client_id compiled in: {}...", &id[..id.len().min(8)]);
            }
            None => println!("no client_id in this build - sign-in reports unavailable"),
        }
    }
}
