//! Local backup commands
//!
//! Handles SQLite database backup and restore operations.
//! Cloud backup is handled on the TypeScript/JavaScript side using AWS SDK v3.

use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::io::Read;
use tauri::Manager;

#[derive(Debug, Serialize)]
pub struct BackupInfo {
    pub file_name: String,
    pub file_path: String,
    pub file_size: u64,
    pub created_at: String,
    pub checksum: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateBackupOptions {
    pub database_path: Option<String>,
    pub backup_name: Option<String>,
    pub destination_path: Option<String>,
}

/// Create a local backup of the SQLite database
#[tauri::command]
pub async fn create_local_backup(
    app: tauri::AppHandle,
    options: CreateBackupOptions,
) -> Result<BackupInfo, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let db_path = match options.database_path {
        Some(ref p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
        _ => app_data_dir.join("orion.db"),
    };

    let backup_path = match options.destination_path {
        Some(ref dest) if !dest.trim().is_empty() => std::path::PathBuf::from(dest),
        _ => {
            let backup_dir = app_data_dir.join("backups");
            std::fs::create_dir_all(&backup_dir).map_err(|e| e.to_string())?;
            let timestamp = chrono::Utc::now().format("%Y%m%d_%H%M%S");
            let backup_file_name = options
                .backup_name
                .unwrap_or_else(|| format!("orion_backup_{}.db", timestamp));
            backup_dir.join(&backup_file_name)
        }
    };

    let backup_file_name = backup_path
        .file_name()
        .map(|f| f.to_string_lossy().to_string())
        .unwrap_or_else(|| "orion_backup.db".to_string());

    // Copy the database file
    std::fs::copy(&db_path, &backup_path).map_err(|e| {
        format!(
            "Failed to copy database: {}. Source: {:?}, Destination: {:?}",
            e, db_path, backup_path
        )
    })?;

    // Calculate checksum
    let checksum = compute_file_checksum(&backup_path.to_string_lossy())?;
    let metadata = std::fs::metadata(&backup_path).map_err(|e| e.to_string())?;

    Ok(BackupInfo {
        file_name: backup_file_name,
        file_path: backup_path.to_string_lossy().to_string(),
        file_size: metadata.len(),
        created_at: chrono::Utc::now().to_rfc3339(),
        checksum,
    })
}

/// Restore the database from a local backup
/// IMPORTANT: This replaces the live database. Caller must ensure the app
/// closes the database connection before calling this command.
#[tauri::command]
pub async fn restore_local_backup(
    app: tauri::AppHandle,
    backup_path: String,
    database_path: Option<String>,
) -> Result<bool, String> {
    // Verify backup file exists
    if !std::path::Path::new(&backup_path).exists() {
        return Err(format!("Backup file not found: {}", backup_path));
    }

    // Verify checksum / SQLite magic header
    let mut file = std::fs::File::open(&backup_path).map_err(|e| e.to_string())?;
    let mut header = [0u8; 16];
    file.read_exact(&mut header).map_err(|e| e.to_string())?;

    // SQLite files start with "SQLite format 3"
    let sqlite_magic = b"SQLite format 3";
    if &header[..15] != sqlite_magic {
        return Err("The specified file is not a valid SQLite database backup.".to_string());
    }

    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let db_path = match database_path {
        Some(ref p) if !p.trim().is_empty() => std::path::PathBuf::from(p),
        _ => app_data_dir.join("orion.db"),
    };

    // Create a temporary backup of the current database before overwriting
    let temp_backup = app_data_dir
        .join("backups")
        .join(format!("pre_restore_{}.db", chrono::Utc::now().format("%Y%m%d_%H%M%S")));

    if db_path.exists() {
        std::fs::copy(&db_path, &temp_backup).map_err(|e| {
            format!("Failed to create safety backup before restore: {}", e)
        })?;
    }

    // Perform the restore
    std::fs::copy(&backup_path, &db_path).map_err(|e| {
        format!("Restore failed: {}. Original database preserved at {:?}", e, temp_backup)
    })?;

    Ok(true)
}

/// List all local backup files
#[tauri::command]
pub async fn list_local_backups(app: tauri::AppHandle) -> Result<Vec<BackupInfo>, String> {
    let app_data_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?;

    let backup_dir = app_data_dir.join("backups");
    if !backup_dir.exists() {
        return Ok(vec![]);
    }

    let mut backups = Vec::new();
    let entries = std::fs::read_dir(&backup_dir).map_err(|e| e.to_string())?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().map(|e| e == "db").unwrap_or(false) {
            if let Ok(metadata) = std::fs::metadata(&path) {
                let file_name = path
                    .file_name()
                    .unwrap_or_default()
                    .to_string_lossy()
                    .to_string();
                let created_at = metadata
                    .created()
                    .ok()
                    .and_then(|t| {
                        t.duration_since(std::time::UNIX_EPOCH).ok().map(|d| {
                            chrono::DateTime::from_timestamp(d.as_secs() as i64, 0)
                                .unwrap_or_default()
                                .to_rfc3339()
                        })
                    })
                    .unwrap_or_else(|| "unknown".to_string());

                let checksum = compute_file_checksum(&path.to_string_lossy()).unwrap_or_default();

                backups.push(BackupInfo {
                    file_name,
                    file_path: path.to_string_lossy().to_string(),
                    file_size: metadata.len(),
                    created_at,
                    checksum,
                });
            }
        }
    }

    // Sort by creation time, newest first
    backups.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    Ok(backups)
}

/// Verify the SHA-256 checksum of a backup file
#[tauri::command]
pub async fn verify_backup_checksum(
    file_path: String,
    expected_checksum: String,
) -> Result<bool, String> {
    let actual = compute_file_checksum(&file_path)?;
    Ok(actual == expected_checksum)
}

fn compute_file_checksum(path: &str) -> Result<String, String> {
    let mut file = std::fs::File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    Ok(hex::encode(hasher.finalize()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;

    #[test]
    fn test_compute_file_checksum() {
        let temp_dir = std::env::temp_dir();
        let test_file = temp_dir.join("orion_test_checksum.txt");
        let mut f = std::fs::File::create(&test_file).unwrap();
        f.write_all(b"ORION accounting software").unwrap();
        drop(f);

        let checksum = compute_file_checksum(&test_file.to_string_lossy()).unwrap();
        assert_eq!(checksum.len(), 64);
        let _ = std::fs::remove_file(test_file);
    }
}
