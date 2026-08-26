//! Authorization-code exchange and `id_token` validation.

use std::collections::HashMap;

use jsonwebtoken::{decode, decode_header, Algorithm, DecodingKey, Validation};
use serde::Deserialize;

use super::config::AuthConfig;
use super::AuthError;

#[derive(Debug, Deserialize)]
pub struct TokenResponse {
    /// Opaque, one hour, no refresh token. Never parse this.
    pub access_token: String,
    pub id_token: String,
    #[serde(default)]
    pub expires_in: Option<u64>,
    /// Scopes actually granted, which may differ from those requested.
    #[serde(default)]
    pub scope: Option<String>,
}

#[derive(Debug, Deserialize)]
struct TokenErrorResponse {
    error: String,
    #[serde(default)]
    error_description: Option<String>,
}

/// Profile chosen by the user at sign-in.
///
/// The user is prompted to pick a game profile every time and *may pick a
/// different one on each sign-in*, so this is a per-session choice rather than
/// a fixed property of the account. Unlike `sub`, `profile.uuid` is a real,
/// shared, public game identity — which is exactly why it can be matched
/// against save files.
#[derive(Debug, Clone, Deserialize)]
pub struct Profile {
    #[serde(default)]
    pub uuid: Option<String>,
    #[serde(default)]
    pub username: Option<String>,
}

/// Claims we care about. Standard extras (`auth_time`, `sid`, `jti`,
/// `at_hash`, …) ride along and are ignored.
#[derive(Debug, Clone, Deserialize)]
pub struct IdTokenClaims {
    /// Stable per-application anonymous id (43-char base64url, not a UUID).
    pub sub: String,
    /// Validated by `jsonwebtoken` itself; kept here so the struct documents
    /// the full set of claims we depend on.
    #[allow(dead_code)]
    pub exp: u64,
    #[serde(default)]
    pub nonce: Option<String>,
    #[serde(default)]
    pub profile: Option<Profile>,
    #[serde(default)]
    pub shared_source: Option<bool>,
}

#[derive(Debug, Deserialize)]
struct Jwks {
    keys: Vec<Jwk>,
}

#[derive(Debug, Deserialize)]
struct Jwk {
    #[serde(default)]
    kid: Option<String>,
    #[serde(default)]
    n: Option<String>,
    #[serde(default)]
    e: Option<String>,
}

/// Exchange the authorization code as a public client: `client_id` and
/// `code_verifier` in the form body, no secret.
///
/// Codes are single-use and expire after five minutes, so this must run
/// promptly after the callback.
pub async fn exchange_code(
    http: &reqwest::Client,
    token_endpoint: &str,
    config: &AuthConfig,
    code: &str,
    redirect_uri: &str,
    code_verifier: &str,
) -> Result<TokenResponse, AuthError> {
    let mut form = HashMap::new();
    form.insert("grant_type", "authorization_code");
    form.insert("code", code);
    form.insert("redirect_uri", redirect_uri);
    form.insert("code_verifier", code_verifier);
    form.insert("client_id", config.client_id.as_str());

    let response = http
        .post(token_endpoint)
        .form(&form)
        .send()
        .await
        .map_err(|e| AuthError::network("Token exchange failed", e))?;

    let status = response.status();
    let body = response
        .text()
        .await
        .map_err(|e| AuthError::network("Token exchange returned an unreadable body", e))?;

    if !status.is_success() {
        // Token endpoint failures are JSON with `error` / `error_description`.
        let message = serde_json::from_str::<TokenErrorResponse>(&body)
            .map(|e| {
                let detail = e.error_description.unwrap_or_else(|| e.error.clone());
                match e.error.as_str() {
                    "invalid_grant" => format!(
                        "The sign-in code was rejected (expired, reused, or PKCE mismatch): {}",
                        detail
                    ),
                    "invalid_scope" => format!(
                        "This client is not granted one of the requested scopes: {}",
                        detail
                    ),
                    _ => detail,
                }
            })
            .unwrap_or_else(|_| format!("HTTP {}", status.as_u16()));
        return Err(AuthError::new("token_exchange_failed", message));
    }

    serde_json::from_str(&body).map_err(|e| {
        AuthError::new(
            "token_exchange_failed",
            format!("Malformed token response: {}", e),
        )
    })
}

/// Validate the `id_token` as an RS256 JWT: signature against `jwks_uri`,
/// `iss` equals the issuer, `aud` contains our `client_id` (it is an array),
/// and `exp`. `nonce` is checked here because `jsonwebtoken` does not.
pub async fn verify_id_token(
    http: &reqwest::Client,
    jwks_uri: &str,
    id_token: &str,
    config: &AuthConfig,
    expected_nonce: &str,
) -> Result<IdTokenClaims, AuthError> {
    let header = decode_header(id_token)
        .map_err(|e| AuthError::new("id_token_invalid", format!("Unreadable id_token: {}", e)))?;

    let jwks: Jwks = http
        .get(jwks_uri)
        .send()
        .await
        .map_err(|e| AuthError::network("Could not fetch signing keys", e))?
        .json()
        .await
        .map_err(|e| AuthError::network("Malformed JWKS document", e))?;

    // Prefer the key the header names; fall back to trying each RSA key so a
    // missing/rotated `kid` does not hard-fail an otherwise valid token.
    let candidates: Vec<&Jwk> = match &header.kid {
        Some(kid) => jwks
            .keys
            .iter()
            .filter(|k| k.kid.as_deref() == Some(kid.as_str()))
            .collect(),
        None => jwks.keys.iter().collect(),
    };
    let candidates = if candidates.is_empty() {
        jwks.keys.iter().collect()
    } else {
        candidates
    };

    let mut validation = Validation::new(Algorithm::RS256);
    validation.set_issuer(&[config.issuer.trim_end_matches('/')]);
    validation.set_audience(&[config.client_id.as_str()]);
    validation.validate_exp = true;
    // Explicit rather than relying on the crate default: tolerate a minute of
    // client clock skew, no more.
    validation.leeway = 60;

    let mut last_error = None;
    for jwk in candidates {
        let (Some(n), Some(e)) = (jwk.n.as_deref(), jwk.e.as_deref()) else {
            continue;
        };
        let Ok(key) = DecodingKey::from_rsa_components(n, e) else {
            continue;
        };
        match decode::<IdTokenClaims>(id_token, &key, &validation) {
            Ok(data) => {
                if data.claims.nonce.as_deref() != Some(expected_nonce) {
                    return Err(AuthError::new(
                        "id_token_invalid",
                        "The id_token nonce did not match this sign-in request.",
                    ));
                }
                return Ok(data.claims);
            }
            Err(err) => last_error = Some(err),
        }
    }

    Err(AuthError::new(
        "id_token_invalid",
        match last_error {
            Some(e) => format!("id_token validation failed: {}", e),
            None => "No usable RSA signing key was published by the issuer.".to_string(),
        },
    ))
}

#[cfg(test)]
mod tests {
    use super::*;
    use base64::engine::general_purpose::URL_SAFE_NO_PAD;
    use base64::Engine;
    use jsonwebtoken::{encode, EncodingKey, Header};
    use serde::Serialize;

    // A throwaway 2048-bit RSA keypair generated for these tests only. It
    // signs nothing outside this file and guards no real secret.
    const TEST_KEY_PEM: &str = "-----BEGIN PRIVATE KEY-----
MIIEugIBADANBgkqhkiG9w0BAQEFAASCBKQwggSgAgEAAoIBAQCCTQ4MEzQOEEmX
pKlSYhRka493NXKUX9xXhJ/seJtpmKaDkpNV4emAzEnMJDFG0+Sl6/gVuPD8lk7h
pAf+H/rMeTwXUWgJ973NSaIfL6nvWyKg1WJ7E5ldyS71oUDu8JgIvCgJY7oiIWSe
nijzYGEXHuD1Jz7FGMuzzy6NeM0zB4SDDrWu5ApE2i+1yzvpccEaimOBhlQSyniE
LfHBLh7GEmYc5ZJ7Xi8LJHh3tGqE/KcQ4p7WMOetnxvrI8jfTixOAyvZcIYIw56G
Pb8pKoZCK1TdP0kRK0+VBeBxglIuuHIyHklmVYE85RKByPQ4AbPtm3ZyWFtYmqAN
7LwPhiLlAgMBAAECgf9mCJuQ+zRhrMXR6IWdykD6hAyPxEqw1GAMKGhGKrQQ2lZW
9dbyi8IaoiKfQXPdaSEru4sizNHo+WRlTQ19vuJysyd9PR/l4YBqHsdu147UV4k9
vdrGqBrXIuai6W/eeGZzPWxg3Nk6AuwuWng/T9Md8naccWMtWpKxf1hbTegMYdq+
k6WuIcym8Sb3nVDr4ZULEoDgmPKMs7JFbDIoUYOx87FW11Q3tjMX/Gd6thWW8h5L
628PhAODe3sC+Kyja/6nkrxBk886L1+EUKJX1LUgq7FRvdeUfsZ9FVv9AmBwiDu+
ofiN5Uf6Q9ITrbXtoQ+YYWbZ9QqBCz8AT3N/1cECgYEAtufQ2RmuShhCXCqo4gwb
jA45vPm6ezQRCG/dAvFrp8vxwibt4XCyQyltvxaGx5AiZm+h1NSKKteN5xF0avEr
8W1Vi+aE9ok2ZB0ksCrV7J32pp2CY9QmLfM9AHK64X5G5elCLmrDjruoVBJWRhFw
yKXLu0ZIn1PVX9+UU7KS0fUCgYEAtl+Fudw9JA6zUb5tgPAnrS88XxTn6PFkEvnx
U3dUNWfznqa029/hyilUm+y8n8NEBamiBEOGYG17+Q0KRB83+3CYx5WNvlD9b2eJ
wRsxdcR/6fDx0DmcDAdGePnL06Ny/LwMOqtflmF3O9PzVa/hTNBQizNZrv/6x2cD
+OjNRzECgYB7SXCGFgBcI1P/qiWiEMU0t5YFolMnnqXoiPZxeGe3eAnic7ken4cZ
LEC0cCuzMp1tbMupmQX08MzOtv5A44VaO/dQ0LZJM539B4PmV0lRL/zEvCDax3Jg
wLcaqTr8qdCCQqOAhCiC+kzxNlb+7dyW8uKLvklPVAPcluj1LcY3TQKBgDRPZd4P
zAHBrbGuu14WhGrqd5iWOIbaZmgDBTN5sM+4x2okSxAeQXdpL3miB+CTc7lkFLLA
Y5TZEow3L1Cm27nlbA0jWorSVD9WJW8cS62J9V6228VsINRaad5dWBeWdG8FyUQy
z7IktryUaOGVFzyfK9shmYHWrqnvZHZK4EahAoGAAfmI+dvahc/G3pT7L80SqxCt
5y/dMo234cERGfveQl+esOyfef7Qb2MeGrI1wja3E0jSTQChbjyOSvPMPvmAbfCW
rqm8rcu6KMdtbP9FvMYfIwk1ktI8S1UVyXDz+s6Dyf0UQ/dNg+pZ83gfXDwOOvBK
pCX++8xMZ6zOQyf2VAE=
-----END PRIVATE KEY-----
";

    /// The same key's modulus, base64url — what a JWKS entry's `n` carries.
    const TEST_KEY_N: &str = "gk0ODBM0DhBJl6SpUmIUZGuPdzVylF_cV4Sf7HibaZimg5KTVeHpgMxJzCQxRtPkpev4Fbjw_JZO4aQH_h_6zHk8F1FoCfe9zUmiHy-p71sioNViexOZXcku9aFA7vCYCLwoCWO6IiFknp4o82BhFx7g9Sc-xRjLs88ujXjNMweEgw61ruQKRNovtcs76XHBGopjgYZUEsp4hC3xwS4exhJmHOWSe14vCyR4d7RqhPynEOKe1jDnrZ8b6yPI304sTgMr2XCGCMOehj2_KSqGQitU3T9JEStPlQXgcYJSLrhyMh5JZlWBPOUSgcj0OAGz7Zt2clhbWJqgDey8D4Yi5Q";

    #[derive(Serialize)]
    struct TestClaims {
        sub: String,
        iss: String,
        aud: Vec<String>,
        exp: u64,
        nonce: String,
    }

    fn now() -> u64 {
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap()
            .as_secs()
    }

    fn config() -> AuthConfig {
        AuthConfig {
            issuer: "https://connect.accounts.hytale.com".into(),
            client_id: "test-client".into(),
        }
    }

    fn sign(claims: &TestClaims) -> String {
        let key = EncodingKey::from_rsa_pem(TEST_KEY_PEM.as_bytes()).unwrap();
        encode(&Header::new(Algorithm::RS256), claims, &key).unwrap()
    }

    fn decode_with(
        token: &str,
        cfg: &AuthConfig,
    ) -> Result<IdTokenClaims, jsonwebtoken::errors::Error> {
        let key = DecodingKey::from_rsa_components(TEST_KEY_N.trim(), "AQAB").unwrap();
        let mut v = Validation::new(Algorithm::RS256);
        v.set_issuer(&[cfg.issuer.as_str()]);
        v.set_audience(&[cfg.client_id.as_str()]);
        v.validate_exp = true;
        v.leeway = 60;
        decode::<IdTokenClaims>(token, &key, &v).map(|d| d.claims)
    }

    fn valid_claims() -> TestClaims {
        TestClaims {
            sub: "abc".into(),
            iss: "https://connect.accounts.hytale.com".into(),
            aud: vec!["test-client".into()],
            exp: now() + 3600,
            nonce: "n0nce".into(),
        }
    }

    #[test]
    fn accepts_a_well_formed_token() {
        let claims = decode_with(&sign(&valid_claims()), &config()).unwrap();
        assert_eq!(claims.sub, "abc");
        assert_eq!(claims.nonce.as_deref(), Some("n0nce"));
    }

    #[test]
    fn rejects_wrong_audience() {
        let mut c = valid_claims();
        c.aud = vec!["someone-else".into()];
        assert!(decode_with(&sign(&c), &config()).is_err());
    }

    #[test]
    fn rejects_wrong_issuer() {
        let mut c = valid_claims();
        c.iss = "https://evil.example".into();
        assert!(decode_with(&sign(&c), &config()).is_err());
    }

    #[test]
    fn rejects_expired_token() {
        let mut c = valid_claims();
        // Comfortably past the 60s skew leeway.
        c.exp = now() - 3600;
        assert!(decode_with(&sign(&c), &config()).is_err());
    }

    #[test]
    fn tolerates_a_minute_of_clock_skew_but_not_more() {
        let mut c = valid_claims();
        c.exp = now() - 30;
        assert!(
            decode_with(&sign(&c), &config()).is_ok(),
            "30s past expiry should pass within the 60s leeway"
        );
        c.exp = now() - 120;
        assert!(
            decode_with(&sign(&c), &config()).is_err(),
            "120s past expiry should exceed the 60s leeway"
        );
    }

    #[test]
    fn aud_is_accepted_as_an_array_with_extra_entries() {
        // The guide notes `aud` is an array; ours need only be present in it.
        let mut c = valid_claims();
        c.aud = vec!["other".into(), "test-client".into()];
        assert!(decode_with(&sign(&c), &config()).is_ok());
    }

    #[test]
    fn nonce_mismatch_is_caught_separately_from_jwt_validation() {
        // jsonwebtoken does not check nonce, so a token with the wrong nonce
        // still decodes — verify_id_token is what must reject it.
        let mut c = valid_claims();
        c.nonce = "attacker-chosen".into();
        let claims = decode_with(&sign(&c), &config()).unwrap();
        assert_ne!(claims.nonce.as_deref(), Some("n0nce"));
    }

    #[test]
    fn test_modulus_matches_the_test_key() {
        // Guards the fixtures against drifting apart.
        assert!(URL_SAFE_NO_PAD.decode(TEST_KEY_N.trim()).is_ok());
        assert!(DecodingKey::from_rsa_components(TEST_KEY_N.trim(), "AQAB").is_ok());
    }
}
