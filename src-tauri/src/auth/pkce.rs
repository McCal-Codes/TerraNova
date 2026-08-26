//! PKCE (RFC 7636) S256 challenge generation, plus `state` / `nonce`.
//!
//! The provider requires PKCE for every client. Notably a request with no
//! `code_challenge` is rejected only *after* the user has already signed in, so
//! a mistake here surfaces late and confusingly.

use base64::engine::general_purpose::URL_SAFE_NO_PAD;
use base64::Engine;
use sha2::{Digest, Sha256};

use super::AuthError;

/// A PKCE verifier/challenge pair. The verifier never leaves the native layer.
#[derive(Debug, Clone)]
pub struct Pkce {
    pub verifier: String,
    pub challenge: String,
}

/// 32 CSPRNG bytes, base64url-no-pad → a 43-char verifier, matching the
/// provider's own `openssl rand -base64 32 | tr '+/' '-_' | tr -d '='` example.
pub fn random_token() -> Result<String, AuthError> {
    let mut buf = [0u8; 32];
    getrandom::getrandom(&mut buf)
        .map_err(|e| AuthError::new("network", format!("CSPRNG unavailable: {}", e)))?;
    Ok(URL_SAFE_NO_PAD.encode(buf))
}

pub fn challenge_for(verifier: &str) -> String {
    let digest = Sha256::digest(verifier.as_bytes());
    URL_SAFE_NO_PAD.encode(digest)
}

pub fn generate() -> Result<Pkce, AuthError> {
    let verifier = random_token()?;
    let challenge = challenge_for(&verifier);
    Ok(Pkce {
        verifier,
        challenge,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    /// RFC 7636 Appendix B. A published vector rather than a round-trip,
    /// because a round-trip would still pass with standard-vs-urlsafe base64
    /// swapped — the exact mistake that breaks against a real provider.
    #[test]
    fn matches_rfc7636_appendix_b_vector() {
        let verifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
        assert_eq!(
            challenge_for(verifier),
            "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM"
        );
    }

    #[test]
    fn verifier_is_43_chars_of_unreserved_charset() {
        let pkce = generate().unwrap();
        // RFC 7636 §4.1 allows 43-128; 32 bytes base64url-no-pad is exactly 43.
        assert_eq!(pkce.verifier.len(), 43);
        assert!(pkce
            .verifier
            .chars()
            .all(|c| c.is_ascii_alphanumeric() || matches!(c, '-' | '.' | '_' | '~')));
        assert_ne!(pkce.verifier, pkce.challenge);
    }

    #[test]
    fn generated_tokens_are_distinct() {
        let a = random_token().unwrap();
        let b = random_token().unwrap();
        assert_ne!(a, b);
    }
}
