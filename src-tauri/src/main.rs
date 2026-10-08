// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    if lib::portable_updater::run_helper_if_requested() {
        return;
    }
    // Set the browser data location before Tauri starts worker threads.
    if let Some(root) = lib::portable::root() {
        std::env::set_var(
            "WEBVIEW2_USER_DATA_FOLDER",
            root.join("Data").join("WebView"),
        );
    }
    lib::run();
}
