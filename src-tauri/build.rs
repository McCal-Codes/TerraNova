fn main() {
    // `auth::config::client_id()` reads this with `option_env!`, which is
    // evaluated at compile time. Without this directive Cargo has no idea the
    // build depends on it, so setting or changing the value would silently
    // reuse a stale artifact and sign-in would keep reporting "not configured".
    println!("cargo:rerun-if-env-changed=TERRANOVA_HYTALE_CLIENT_ID");
    tauri_build::build()
}
