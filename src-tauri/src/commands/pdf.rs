//! PDF commands
//!
//! PDF generation happens in the TypeScript frontend using @react-pdf/renderer.
//! Rust handles: saving the PDF blob to disk, opening it, and printing.


/// Open a PDF file in the default system PDF viewer
#[tauri::command]
pub async fn open_pdf(file_path: String) -> Result<(), String> {
    // Use the opener plugin via shell open
    #[cfg(target_os = "macos")]
    {
        std::process::Command::new("open")
            .arg(&file_path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    #[cfg(target_os = "windows")]
    {
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &file_path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    Ok(())
}

/// Open system print dialog for a PDF file
#[tauri::command]
pub async fn print_pdf(file_path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        // On macOS, try lp first if a printer is configured
        let output = std::process::Command::new("lp")
            .arg(&file_path)
            .output();

        match output {
            Ok(out) if out.status.success() => Ok(()),
            _ => {
                // If lp fails (e.g. no default destination configured),
                // open in the default system PDF viewer (Preview) so the user can review and print
                std::process::Command::new("open")
                    .arg(&file_path)
                    .spawn()
                    .map_err(|e| format!("Print failed: {}", e))?;
                Ok(())
            }
        }
    }
    #[cfg(target_os = "windows")]
    {
        // On Windows, use ShellExecute "print" verb
        std::process::Command::new("cmd")
            .args(["/C", "start", "", "/print", &file_path])
            .spawn()
            .map_err(|e| format!("Print failed: {}", e))?;
        Ok(())
    }
    #[cfg(not(any(target_os = "macos", target_os = "windows")))]
    {
        std::process::Command::new("lp")
            .arg(&file_path)
            .spawn()
            .map_err(|e| format!("Print failed: {}", e))?;
        Ok(())
    }
}
