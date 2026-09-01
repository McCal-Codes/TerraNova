//! Recovers a dead WKWebView.
//!
//! On macOS the WKWebView web content process can terminate independently of
//! the app. The window goes blank, the app process stays alive, and *no
//! JavaScript runs* — so no error event fires, no promise rejects, and no React
//! error boundary sees anything. Nothing on the frontend can detect or recover
//! from it, and macOS writes no crash report because the app itself did not
//! crash.
//!
//! Apple's prescribed hook is `webViewWebContentProcessDidTerminate`, but wry
//! owns the `WKWebView` navigation delegate; replacing or swizzling it risks
//! breaking IPC and would silently rot on wry updates. Instead the frontend
//! sends a heartbeat and this watchdog reloads the webview when it stops. That
//! uses only public Tauri API and catches every way the view can die — content
//! process termination and a wedged main thread alike.

use std::{
    sync::{
        atomic::{AtomicU32, Ordering},
        Arc, Mutex,
    },
    time::{Duration, Instant},
};
use tauri::{AppHandle, Manager, Runtime, State};

/// How often the watchdog looks at the last heartbeat.
const CHECK_INTERVAL: Duration = Duration::from_secs(5);

/// How long silence must last before the webview is presumed dead.
///
/// Generous on purpose: a blocked main thread stops the heartbeat exactly as a
/// dead webview does, and reloading during legitimate work would destroy
/// unsaved state. Preview evaluation runs in workers, so the main thread should
/// never stall this long.
const SILENCE_BEFORE_RELOAD: Duration = Duration::from_secs(20);

/// A genuinely broken app must not sit in a reload loop — that would also
/// destroy the evidence needed to diagnose it.
const MAX_RELOADS_PER_SESSION: u32 = 2;

pub struct HeartbeatState {
    last: Mutex<Instant>,
    reloads: AtomicU32,
    /// Mirrors the `developer.autoRecoverWebview` setting.
    enabled: Mutex<bool>,
}

impl Default for HeartbeatState {
    fn default() -> Self {
        Self {
            last: Mutex::new(Instant::now()),
            reloads: AtomicU32::new(0),
            enabled: Mutex::new(true),
        }
    }
}

/// Managed as an `Arc` so the watchdog thread can hold its own handle rather
/// than borrowing from `AppHandle` on every tick.
pub type SharedHeartbeat = Arc<HeartbeatState>;

/// Called by the frontend every few seconds while the UI is alive.
#[tauri::command]
pub fn ui_heartbeat(state: State<'_, SharedHeartbeat>) {
    if let Ok(mut last) = state.last.lock() {
        *last = Instant::now();
    }
}

/// Lets the user disable automatic recovery (`developer.autoRecoverWebview`).
#[tauri::command]
pub fn set_webview_auto_recover(state: State<'_, SharedHeartbeat>, enabled: bool) {
    if let Ok(mut flag) = state.enabled.lock() {
        *flag = enabled;
    }
}

/// Whether a reload is warranted, separated from performing one so the policy
/// is testable without a running window.
///
/// Deliberately conservative: a blocked main thread is indistinguishable from a
/// dead webview here, so everything below the threshold is left alone.
fn should_reload(silent_for: Duration, reloads_so_far: u32, enabled: bool) -> bool {
    enabled && reloads_so_far < MAX_RELOADS_PER_SESSION && silent_for >= SILENCE_BEFORE_RELOAD
}

/// Spawns the watchdog thread. Call once from `setup`.
pub fn spawn<R: Runtime>(app: &AppHandle<R>) {
    let app = app.clone();
    let Some(state) = app
        .try_state::<SharedHeartbeat>()
        .map(|s| s.inner().clone())
    else {
        eprintln!("webview watchdog: heartbeat state not managed; not starting");
        return;
    };

    std::thread::spawn(move || loop {
        std::thread::sleep(CHECK_INTERVAL);

        let enabled = state.enabled.lock().map(|f| *f).unwrap_or(true);
        let silent_for = match state.last.lock() {
            Ok(last) => last.elapsed(),
            Err(_) => continue,
        };
        if !should_reload(silent_for, state.reloads.load(Ordering::Relaxed), enabled) {
            continue;
        }

        let Some(window) = app.get_webview_window("main") else {
            continue;
        };
        let count = state.reloads.fetch_add(1, Ordering::Relaxed) + 1;
        eprintln!(
            "webview watchdog: no heartbeat for {}s — reloading (attempt {count}/{MAX_RELOADS_PER_SESSION})",
            silent_for.as_secs(),
        );
        if let Err(err) = window.reload() {
            eprintln!("webview watchdog: reload failed: {err}");
            continue;
        }
        // Give the reloaded page room to boot before judging it silent again.
        if let Ok(mut last) = state.last.lock() {
            *last = Instant::now();
        }
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    const SILENT: Duration = SILENCE_BEFORE_RELOAD;

    #[test]
    fn leaves_a_responsive_webview_alone() {
        assert!(!should_reload(Duration::from_secs(0), 0, true));
        assert!(!should_reload(SILENT - Duration::from_secs(1), 0, true));
    }

    #[test]
    fn reloads_once_silence_reaches_the_threshold() {
        assert!(should_reload(SILENT, 0, true));
        assert!(should_reload(SILENT + Duration::from_secs(60), 0, true));
    }

    #[test]
    fn stops_after_the_session_cap() {
        // A broken app must not sit in a reload loop; looping would also
        // destroy the evidence needed to diagnose it.
        assert!(should_reload(SILENT, MAX_RELOADS_PER_SESSION - 1, true));
        assert!(!should_reload(SILENT, MAX_RELOADS_PER_SESSION, true));
        assert!(!should_reload(SILENT, MAX_RELOADS_PER_SESSION + 5, true));
    }

    #[test]
    fn never_reloads_when_the_user_has_turned_recovery_off() {
        assert!(!should_reload(SILENT + Duration::from_secs(600), 0, false));
    }

    #[test]
    fn threshold_leaves_room_for_a_missed_heartbeat() {
        // The frontend pings every 3s; the threshold must tolerate several
        // dropped pings so a slow tick never triggers a reload.
        assert!(SILENCE_BEFORE_RELOAD.as_secs() >= 15);
    }
}
