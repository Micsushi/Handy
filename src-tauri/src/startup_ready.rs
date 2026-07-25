use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::fs::{self, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};

const STARTUP_READY_SCHEMA_VERSION: u32 = 1;
const STARTUP_READY_FILE_NAME: &str = "startup-ready.json";

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
struct StartupReadyMarker {
    schema_version: u32,
    pid: u32,
    executable_path: PathBuf,
    ready_at_utc: String,
}

fn build_marker(pid: u32, executable_path: &Path, ready_at: DateTime<Utc>) -> StartupReadyMarker {
    StartupReadyMarker {
        schema_version: STARTUP_READY_SCHEMA_VERSION,
        pid,
        executable_path: executable_path.to_path_buf(),
        ready_at_utc: ready_at.to_rfc3339(),
    }
}

fn marker_path(local_app_data_dir: &Path) -> PathBuf {
    local_app_data_dir.join(STARTUP_READY_FILE_NAME)
}

#[cfg(windows)]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;
    use windows::core::PCWSTR;
    use windows::Win32::Storage::FileSystem::{
        MoveFileExW, MOVEFILE_REPLACE_EXISTING, MOVEFILE_WRITE_THROUGH,
    };

    let source_wide: Vec<u16> = source.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();

    unsafe {
        MoveFileExW(
            PCWSTR(source_wide.as_ptr()),
            PCWSTR(destination_wide.as_ptr()),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
        .map_err(io::Error::other)
    }
}

#[cfg(not(windows))]
fn replace_file(source: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(source, destination)
}

fn write_marker_atomically(path: &Path, marker: &StartupReadyMarker) -> io::Result<()> {
    let directory = path
        .parent()
        .ok_or_else(|| io::Error::other("startup-ready marker has no parent directory"))?;
    fs::create_dir_all(directory)?;

    let temporary_path = path.with_extension("json.tmp");
    let _ = fs::remove_file(&temporary_path);
    let mut temporary_file = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&temporary_path)?;
    serde_json::to_writer(&mut temporary_file, marker).map_err(io::Error::other)?;
    temporary_file.write_all(b"\n")?;
    temporary_file.sync_all()?;
    drop(temporary_file);

    if let Err(error) = replace_file(&temporary_path, path) {
        let _ = fs::remove_file(&temporary_path);
        return Err(error);
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub fn mark_frontend_ready(app: AppHandle) -> Result<(), String> {
    let local_app_data_dir = app.path().app_local_data_dir().map_err(|error| {
        format!("Could not resolve Handy's local application-data directory: {error}")
    })?;
    let executable_path = std::env::current_exe()
        .and_then(|path| path.canonicalize().or(Ok(path)))
        .map_err(|error| format!("Could not resolve Handy's executable path: {error}"))?;
    let marker = build_marker(std::process::id(), &executable_path, Utc::now());

    write_marker_atomically(&marker_path(&local_app_data_dir), &marker)
        .map_err(|error| format!("Could not write Handy startup-ready marker: {error}"))
}

#[cfg(test)]
mod tests {
    use super::{build_marker, marker_path, write_marker_atomically};
    use chrono::{TimeZone, Utc};
    use std::path::Path;

    #[test]
    fn startup_ready_marker_contains_process_identity() {
        let executable = Path::new(r"C:\Program Files\Handy\handy.exe");
        let ready_at = Utc.with_ymd_and_hms(2026, 7, 24, 22, 0, 0).unwrap();

        let marker = build_marker(4242, executable, ready_at);

        assert_eq!(marker.schema_version, 1);
        assert_eq!(marker.pid, 4242);
        assert_eq!(marker.executable_path, executable);
        assert_eq!(marker.ready_at_utc, "2026-07-24T22:00:00+00:00");
    }

    #[test]
    fn marker_path_is_stable_inside_local_app_data() {
        let base = Path::new(r"C:\Users\sushi\AppData\Local\com.pais.handy");

        assert_eq!(marker_path(base), base.join("startup-ready.json"));
    }

    #[test]
    fn atomic_write_replaces_an_existing_marker() {
        let directory = tempfile::tempdir().unwrap();
        let path = marker_path(directory.path());
        std::fs::write(&path, r#"{"schemaVersion":0}"#).unwrap();
        let marker = build_marker(
            6262,
            Path::new(r"C:\Programs\Handy\handy.exe"),
            Utc.with_ymd_and_hms(2026, 7, 24, 23, 0, 0).unwrap(),
        );

        write_marker_atomically(&path, &marker).unwrap();

        let saved: serde_json::Value =
            serde_json::from_slice(&std::fs::read(&path).unwrap()).unwrap();
        assert_eq!(saved["schemaVersion"], 1);
        assert_eq!(saved["pid"], 6262);
        assert!(!path.with_extension("json.tmp").exists());
    }
}
