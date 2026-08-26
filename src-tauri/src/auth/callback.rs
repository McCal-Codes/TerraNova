//! Loopback HTTP listener that receives the OAuth redirect.
//!
//! Deliberately not built on axum/hyper: those live in the Bridge *sidecar*, a
//! separate binary. The desktop app has never bound a port, and parsing one
//! request line to write one fixed response does not justify pulling a server
//! framework into it.

use std::net::{Ipv4Addr, SocketAddr};

use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::oneshot;

use super::config::{CALLBACK_PATH, CALLBACK_TIMEOUT_SECS, REDIRECT_PORTS};
use super::AuthError;

pub struct Callback {
    pub code: String,
}

/// Hand-written rather than derived so an authorization code can never reach a
/// log line or panic message through a stray `{:?}`.
impl std::fmt::Debug for Callback {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        f.debug_struct("Callback")
            .field("code", &"<redacted>")
            .finish()
    }
}

/// What a single inbound request turned out to be.
#[derive(Debug, PartialEq, Eq)]
pub enum Outcome {
    /// A callback carrying an authorization code.
    Code { code: String, state: String },
    /// The provider reported a failure (`access_denied`, `invalid_scope`, …).
    ProviderError {
        error: String,
        description: Option<String>,
    },
    /// Anything else — favicon probes, speculative connections. Answer 404 and
    /// keep waiting.
    Ignored,
}

/// Bind the first free loopback port, returning the listener and the exact
/// `redirect_uri` that must be sent in the authorize request and again in the
/// token exchange.
pub async fn bind_first_free() -> Result<(TcpListener, String), AuthError> {
    for port in REDIRECT_PORTS {
        // Bind 127.0.0.1 explicitly, never 0.0.0.0: correct posture, and it
        // avoids the macOS "accept incoming network connections?" prompt.
        let addr = SocketAddr::from((Ipv4Addr::LOCALHOST, *port));
        if let Ok(listener) = TcpListener::bind(addr).await {
            return Ok((
                listener,
                format!("http://127.0.0.1:{}{}", port, CALLBACK_PATH),
            ));
        }
    }
    Err(AuthError::new(
        "no_port_available",
        format!(
            "All loopback callback ports are in use ({}). Close whatever is using them and try again.",
            REDIRECT_PORTS
                .iter()
                .map(u16::to_string)
                .collect::<Vec<_>>()
                .join(", ")
        ),
    ))
}

/// Classify a raw HTTP request line (`GET /path?query HTTP/1.1`).
///
/// Pure and self-contained so the parsing is unit-testable without sockets.
pub fn classify_request_line(line: &str) -> Outcome {
    let Some(target) = line.split_whitespace().nth(1) else {
        return Outcome::Ignored;
    };
    let (path, query) = match target.split_once('?') {
        Some((p, q)) => (p, q),
        None => (target, ""),
    };
    if path != CALLBACK_PATH {
        return Outcome::Ignored;
    }

    let mut code = None;
    let mut state = None;
    let mut error = None;
    let mut description = None;
    for (k, v) in url::form_urlencoded::parse(query.as_bytes()) {
        match k.as_ref() {
            "code" => code = Some(v.into_owned()),
            "state" => state = Some(v.into_owned()),
            "error" => error = Some(v.into_owned()),
            "error_description" => description = Some(v.into_owned()),
            _ => {}
        }
    }

    // The guide is explicit: always check `error` before reading `code`.
    if let Some(error) = error {
        return Outcome::ProviderError { error, description };
    }
    match (code, state) {
        (Some(code), Some(state)) => Outcome::Code { code, state },
        _ => Outcome::Ignored,
    }
}

fn page(title: &str, body: &str) -> String {
    // Fully self-contained: the browser has no guaranteed route to our assets,
    // and referencing a CDN would leak the fact of this visit.
    format!(
        "<!doctype html><html><head><meta charset=\"utf-8\">\
<title>{title}</title><style>\
body{{font-family:system-ui,-apple-system,Segoe UI,sans-serif;background:#14161a;color:#e6e8eb;\
display:flex;align-items:center;justify-content:center;height:100vh;margin:0}}\
main{{text-align:center;max-width:32rem;padding:2rem}}\
h1{{font-size:1.25rem;font-weight:600;margin:0 0 .5rem}}\
p{{color:#9aa4b2;margin:0;line-height:1.5}}\
</style></head><body><main><h1>{title}</h1><p>{body}</p></main>\
<script>setTimeout(function(){{window.close()}},1500)</script></body></html>"
    )
}

async fn respond(stream: &mut TcpStream, status: &str, html: &str) {
    let response = format!(
        "HTTP/1.1 {status}\r\nContent-Type: text/html; charset=utf-8\r\n\
Content-Length: {len}\r\nConnection: close\r\n\r\n{html}",
        len = html.len()
    );
    let _ = stream.write_all(response.as_bytes()).await;
    let _ = stream.flush().await;
}

/// Read the request line, classify it, and answer the browser.
async fn handle_one(stream: &mut TcpStream) -> Outcome {
    let mut buf = vec![0u8; 8192];
    let n = match stream.read(&mut buf).await {
        Ok(0) | Err(_) => return Outcome::Ignored,
        Ok(n) => n,
    };
    let text = String::from_utf8_lossy(&buf[..n]);
    let first_line = text.lines().next().unwrap_or_default();
    // NB: never log `first_line` — it carries the authorization code.
    let outcome = classify_request_line(first_line);

    match &outcome {
        Outcome::Code { .. } => {
            respond(
                stream,
                "200 OK",
                &page(
                    "Signed in",
                    "You can close this tab and return to TerraNova.",
                ),
            )
            .await
        }
        Outcome::ProviderError { error, description } => {
            let detail = description.as_deref().unwrap_or(error.as_str());
            respond(
                stream,
                "200 OK",
                &page("Sign-in failed", &html_escape(detail)),
            )
            .await
        }
        Outcome::Ignored => respond(stream, "404 Not Found", "").await,
    }
    outcome
}

fn html_escape(raw: &str) -> String {
    raw.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

/// Wait for the provider's redirect, verifying `state` before anything else.
///
/// Keeps accepting until a genuine callback arrives — browsers routinely fire
/// `/favicon.ico` and speculative connections at a freshly opened port, and
/// treating the first connection as the answer would drop the real one.
pub async fn wait_for_callback(
    listener: TcpListener,
    expected_state: &str,
    cancel: oneshot::Receiver<()>,
) -> Result<Callback, AuthError> {
    let accept_loop = async {
        loop {
            let Ok((mut stream, _)) = listener.accept().await else {
                continue;
            };
            match handle_one(&mut stream).await {
                Outcome::Code { code, state } => {
                    if state != expected_state {
                        return Err(AuthError::new(
                            "state_mismatch",
                            "The sign-in response did not match this request. Try again.",
                        ));
                    }
                    return Ok(Callback { code });
                }
                Outcome::ProviderError { error, description } => {
                    let message = match (&error[..], description) {
                        ("access_denied", _) => "You declined the sign-in request.".to_string(),
                        (_, Some(d)) => d,
                        (e, None) => e.to_string(),
                    };
                    return Err(AuthError::new("provider_error", message));
                }
                Outcome::Ignored => continue,
            }
        }
    };

    tokio::select! {
        result = accept_loop => result,
        _ = cancel => Err(AuthError::new("cancelled", "Sign-in cancelled.")),
        _ = tokio::time::sleep(std::time::Duration::from_secs(CALLBACK_TIMEOUT_SECS)) => Err(
            AuthError::new("timeout", "Timed out waiting for the browser sign-in to finish."),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_a_successful_callback() {
        let out = classify_request_line("GET /oauth/callback?code=abc123&state=xyz HTTP/1.1");
        assert_eq!(
            out,
            Outcome::Code {
                code: "abc123".into(),
                state: "xyz".into()
            }
        );
    }

    #[test]
    fn error_wins_over_code() {
        // The guide: always check `error` before reading `code`.
        let out = classify_request_line(
            "GET /oauth/callback?error=access_denied&error_description=User%20declined&code=x&state=y HTTP/1.1",
        );
        assert_eq!(
            out,
            Outcome::ProviderError {
                error: "access_denied".into(),
                description: Some("User declined".into())
            }
        );
    }

    #[test]
    fn percent_encoded_values_are_decoded() {
        let out = classify_request_line("GET /oauth/callback?code=a%2Fb%2Bc&state=s%3D1 HTTP/1.1");
        assert_eq!(
            out,
            Outcome::Code {
                code: "a/b+c".into(),
                state: "s=1".into()
            }
        );
    }

    #[test]
    fn ignores_favicon_and_other_paths() {
        assert_eq!(
            classify_request_line("GET /favicon.ico HTTP/1.1"),
            Outcome::Ignored
        );
        assert_eq!(classify_request_line("GET / HTTP/1.1"), Outcome::Ignored);
        assert_eq!(classify_request_line(""), Outcome::Ignored);
    }

    #[test]
    fn callback_without_code_or_error_is_ignored() {
        assert_eq!(
            classify_request_line("GET /oauth/callback HTTP/1.1"),
            Outcome::Ignored
        );
        assert_eq!(
            classify_request_line("GET /oauth/callback?state=only HTTP/1.1"),
            Outcome::Ignored
        );
    }

    #[tokio::test]
    async fn binds_first_free_port_and_skips_occupied_ones() {
        let first = SocketAddr::from((Ipv4Addr::LOCALHOST, REDIRECT_PORTS[0]));
        let Ok(_blocker) = TcpListener::bind(first).await else {
            // Something else already holds the port; the assertion below would
            // be testing the environment rather than the code.
            return;
        };
        let (listener, redirect) = bind_first_free().await.unwrap();
        assert_ne!(listener.local_addr().unwrap().port(), REDIRECT_PORTS[0]);
        assert!(REDIRECT_PORTS.contains(&listener.local_addr().unwrap().port()));
        assert!(redirect.starts_with("http://127.0.0.1:"));
        assert!(redirect.ends_with(CALLBACK_PATH));
    }

    #[tokio::test]
    async fn cancel_aborts_the_wait() {
        let (listener, _) = bind_first_free().await.unwrap();
        let (tx, rx) = oneshot::channel();
        tx.send(()).unwrap();
        let err = wait_for_callback(listener, "state", rx).await.unwrap_err();
        assert_eq!(err.code, "cancelled");
    }
}
