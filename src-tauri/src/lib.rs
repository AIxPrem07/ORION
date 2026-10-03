//! ORION Tauri Application Library
//!
//! This is the Rust entry point for the ORION desktop application.
//! Business logic lives in TypeScript. Rust handles:
//! - Native filesystem operations
//! - System information
//! - PDF file operations
//! - Backup file management

mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // Initialize logger in debug mode
    #[cfg(debug_assertions)]
    env_logger::init();

    tauri::Builder::default()
        // Core plugins
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        // Custom Tauri commands
        .invoke_handler(tauri::generate_handler![
            commands::system::get_system_info,
            commands::system::get_app_data_dir,
            commands::backup::create_local_backup,
            commands::backup::restore_local_backup,
            commands::backup::list_local_backups,
            commands::backup::verify_backup_checksum,
            commands::pdf::open_pdf,
            commands::pdf::print_pdf,
        ])
        .setup(|app| {
            // Set up application data directory
            let app_data_dir = app
                .path()
                .app_data_dir()
                .expect("Failed to resolve app data directory");

            // Ensure app data directory exists
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");

            // Ensure backups directory exists
            let backup_dir = app_data_dir.join("backups");
            std::fs::create_dir_all(&backup_dir)
                .expect("Failed to create backups directory");

            log::info!("ORION starting up. App data dir: {:?}", app_data_dir);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running ORION application");
}
