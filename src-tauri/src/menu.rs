//! Native application menu.
//!
//! Without a real menu bar the app reads as unfinished on macOS, and the Edit
//! menu is functionally required: macOS routes Cmd+C/V/Z through menu items, so
//! text fields misbehave when it is absent. Those entries are
//! `PredefinedMenuItem`s so the OS handles them natively rather than us
//! reimplementing clipboard semantics.
//!
//! Every custom item carries a stable id and simply emits `menu://action` with
//! that id. The frontend owns what an action *does* — see `src/utils/appMenu.ts`
//! — which keeps this file free of application logic and means adding a menu
//! entry never requires touching command wiring.

use tauri::{
    menu::{AboutMetadata, Menu, MenuItemBuilder, PredefinedMenuItem, SubmenuBuilder},
    AppHandle, Emitter, Runtime,
};

/// Event carrying the id of the activated menu item.
pub const MENU_EVENT: &str = "menu://action";

/// Ids are duplicated in `src/utils/appMenu.ts`, where a test asserts every one
/// of them has a handler. Keep the two lists in step.
pub mod ids {
    pub const SETTINGS: &str = "app.settings";

    pub const NEW_PROJECT: &str = "file.new-project";
    pub const CREATE_PACK: &str = "file.create-pack";
    pub const OPEN: &str = "file.open";
    pub const SAVE: &str = "file.save";
    pub const SAVE_AS: &str = "file.save-as";
    pub const EXPORT_SVG: &str = "file.export-svg";
    pub const CLOSE_PROJECT: &str = "file.close-project";

    pub const TOGGLE_LEFT_PANEL: &str = "view.toggle-left-panel";
    pub const TOGGLE_RIGHT_PANEL: &str = "view.toggle-right-panel";
    pub const TOGGLE_GRID: &str = "view.toggle-grid";
    pub const TOGGLE_MINIMAP: &str = "view.toggle-minimap";

    pub const DOCUMENTATION: &str = "help.documentation";
    pub const GETTING_STARTED: &str = "help.getting-started";
    pub const REPORT_BUG: &str = "help.report-bug";
    pub const CHANGELOG: &str = "help.changelog";
}

/// Builds the application menu. Passed to `tauri::Builder::menu`.
pub fn build<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<Menu<R>> {
    let settings = MenuItemBuilder::with_id(ids::SETTINGS, "Settings…")
        .accelerator("CmdOrCtrl+,")
        .build(app)?;

    // The first submenu becomes the application menu on macOS.
    let app_menu = SubmenuBuilder::new(app, "TerraNova")
        .item(&PredefinedMenuItem::about(
            app,
            Some("About TerraNova"),
            Some(AboutMetadata {
                name: Some("TerraNova".into()),
                version: Some(env!("CARGO_PKG_VERSION").into()),
                ..Default::default()
            }),
        )?)
        .separator()
        .item(&settings)
        .separator()
        .services()
        .separator()
        .hide()
        .hide_others()
        .show_all()
        .separator()
        .quit()
        .build()?;

    let file_menu = SubmenuBuilder::new(app, "File")
        .item(
            &MenuItemBuilder::with_id(ids::NEW_PROJECT, "New Project")
                .accelerator("CmdOrCtrl+N")
                .build(app)?,
        )
        .item(&MenuItemBuilder::with_id(ids::CREATE_PACK, "Create Pack…").build(app)?)
        .item(
            &MenuItemBuilder::with_id(ids::OPEN, "Open…")
                .accelerator("CmdOrCtrl+O")
                .build(app)?,
        )
        .separator()
        .item(
            &MenuItemBuilder::with_id(ids::SAVE, "Save")
                .accelerator("CmdOrCtrl+S")
                .build(app)?,
        )
        .item(
            &MenuItemBuilder::with_id(ids::SAVE_AS, "Save As…")
                .accelerator("CmdOrCtrl+Shift+S")
                .build(app)?,
        )
        .separator()
        .item(&MenuItemBuilder::with_id(ids::EXPORT_SVG, "Export SVG…").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id(ids::CLOSE_PROJECT, "Close Project").build(app)?)
        .build()?;

    // All predefined: macOS expects the system to own these, and routing
    // Cmd+C/V/Z through them is what makes text fields behave correctly.
    let edit_menu = SubmenuBuilder::new(app, "Edit")
        .undo()
        .redo()
        .separator()
        .cut()
        .copy()
        .paste()
        .select_all()
        .build()?;

    let view_menu = SubmenuBuilder::new(app, "View")
        .item(
            &MenuItemBuilder::with_id(ids::TOGGLE_LEFT_PANEL, "Toggle Left Panel")
                .accelerator("CmdOrCtrl+B")
                .build(app)?,
        )
        .item(&MenuItemBuilder::with_id(ids::TOGGLE_RIGHT_PANEL, "Toggle Right Panel").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id(ids::TOGGLE_GRID, "Show Grid").build(app)?)
        .item(&MenuItemBuilder::with_id(ids::TOGGLE_MINIMAP, "Show Minimap").build(app)?)
        .separator()
        .fullscreen()
        .build()?;

    let window_menu = SubmenuBuilder::new(app, "Window")
        .minimize()
        .maximize()
        .separator()
        .close_window()
        .build()?;

    let help_menu = SubmenuBuilder::new(app, "Help")
        .item(&MenuItemBuilder::with_id(ids::DOCUMENTATION, "Documentation").build(app)?)
        .item(&MenuItemBuilder::with_id(ids::GETTING_STARTED, "Getting Started").build(app)?)
        .separator()
        .item(&MenuItemBuilder::with_id(ids::REPORT_BUG, "Report a Bug…").build(app)?)
        .item(&MenuItemBuilder::with_id(ids::CHANGELOG, "Changelog").build(app)?)
        .build()?;

    Menu::with_items(
        app,
        &[
            &app_menu,
            &file_menu,
            &edit_menu,
            &view_menu,
            &window_menu,
            &help_menu,
        ],
    )
}

/// Forwards the activated item's id to the frontend.
///
/// Predefined items never reach here — the OS handles them — so anything that
/// arrives is one of our own ids.
pub fn handle<R: Runtime>(app: &AppHandle<R>, event: tauri::menu::MenuEvent) {
    let id = event.id().0.as_str();
    if let Err(err) = app.emit(MENU_EVENT, id) {
        // A menu click that goes nowhere is confusing; make it visible in the
        // dev server output rather than failing silently.
        eprintln!("menu: failed to emit {id}: {err}");
    }
}

/// Enables or disables the items that need an open project.
///
/// Invoked by the frontend when a project opens or closes, so File → Save /
/// Close are greyed out rather than emitting actions nothing can service.
#[tauri::command]
pub fn set_menu_project_open<R: Runtime>(app: AppHandle<R>, open: bool) {
    set_project_open(&app, open);
}

fn set_project_open<R: Runtime>(app: &AppHandle<R>, open: bool) {
    let Some(menu) = app.menu() else { return };
    for id in [ids::SAVE, ids::SAVE_AS, ids::EXPORT_SVG, ids::CLOSE_PROJECT] {
        if let Some(item) = menu.get(id).and_then(|i| i.as_menuitem().cloned()) {
            let _ = item.set_enabled(open);
        }
    }
}
