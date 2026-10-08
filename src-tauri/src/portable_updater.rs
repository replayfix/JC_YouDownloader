//! Signed ZIP updates for Windows portables. User data is never part of the package.
use crate::modules::types::AppError;
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::Cursor;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use tauri::{AppHandle, Emitter, Manager};
use tauri_plugin_updater::UpdaterExt;

static BUSY: AtomicBool = AtomicBool::new(false);
struct UpdateGuard;
struct StagingGuard {
    path: PathBuf,
    preserve: bool,
}
impl Drop for StagingGuard {
    fn drop(&mut self) {
        if !self.preserve {
            let _ = fs::remove_dir_all(&self.path);
        }
    }
}
impl Drop for UpdateGuard {
    fn drop(&mut self) {
        BUSY.store(false, Ordering::SeqCst);
    }
}

#[tauri::command]
#[specta::specta]
pub fn get_update_mode() -> String {
    if cfg!(debug_assertions) {
        "development"
    } else if cfg!(target_os = "windows") && crate::portable::root().is_some() {
        "portable"
    } else {
        "unsupported"
    }
    .to_string()
}

#[derive(Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct Progress {
    downloaded: u64,
    total: Option<u64>,
    ready: bool,
}

#[derive(Serialize, Deserialize)]
struct Handoff {
    executable: String,
    version: String,
}

fn allowed_path(path: &Path) -> bool {
    if path
        .components()
        .any(|c| !matches!(c, Component::Normal(_)))
    {
        return false;
    }
    if path.to_string_lossy().contains([':', '\\']) {
        return false;
    }
    match path
        .components()
        .next()
        .and_then(|c| c.as_os_str().to_str())
    {
        Some("binaries") => true,
        Some(name) => {
            path.components().count() == 1
                && matches!(
                    name,
                    "JC_YouDownloader.exe"
                        | "portable.flag"
                        | ".portable-version.json"
                        | "LEEME.txt"
                )
        }
        None => false,
    }
}

fn extract_package(bytes: &[u8], destination: &Path, version: &str) -> Result<(), String> {
    let mut archive = zip::ZipArchive::new(Cursor::new(bytes)).map_err(|e| e.to_string())?;
    let mut names = std::collections::HashSet::new();
    let mut expanded_size: u64 = 0;
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|e| e.to_string())?;
        let relative = file.enclosed_name().ok_or("Unsafe archive path")?;
        if !allowed_path(&relative) || file.unix_mode().is_some_and(|m| m & 0o170000 == 0o120000) {
            return Err("The update includes unsupported files".into());
        }
        let normalized = relative.to_string_lossy().to_lowercase();
        if !names.insert(normalized) {
            return Err("Duplicate archive entry".into());
        }
        expanded_size = expanded_size
            .checked_add(file.size())
            .ok_or("Invalid archive size")?;
        if expanded_size > 3 * 1024 * 1024 * 1024 {
            return Err("Update package is too large".into());
        }
        let target = destination.join(&relative);
        if file.is_dir() {
            fs::create_dir_all(&target).map_err(|e| e.to_string())?;
        } else {
            fs::create_dir_all(target.parent().ok_or("Invalid archive path")?)
                .map_err(|e| e.to_string())?;
            let mut output = fs::File::create(&target).map_err(|e| e.to_string())?;
            std::io::copy(&mut file, &mut output).map_err(|e| e.to_string())?;
        }
    }
    for required in [
        "JC_YouDownloader.exe",
        "portable.flag",
        "binaries/ffmpeg.exe",
        "binaries/deno.exe",
        "binaries/ytdlp/yt-dlp.exe",
    ] {
        if !destination.join(required).is_file() {
            return Err(format!("Missing update file: {required}"));
        }
    }
    let metadata: serde_json::Value = serde_json::from_slice(
        &fs::read(destination.join(".portable-version.json")).map_err(|e| e.to_string())?,
    )
    .map_err(|e| e.to_string())?;
    if metadata["version"].as_str() != Some(version) {
        return Err("Signed package version does not match the manifest".into());
    }
    Ok(())
}

#[tauri::command]
#[specta::specta]
pub async fn install_portable_update(app: AppHandle) -> Result<(), AppError> {
    if get_update_mode() != "portable" {
        return Err(AppError::Custom("update.portableOnly".into()));
    }
    if BUSY
        .compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst)
        .is_err()
    {
        return Err(AppError::Custom("update.busy".into()));
    }
    let _guard = UpdateGuard;
    let manager = app.state::<crate::DownloadManagerState>();
    if manager.active_count() > 0 {
        return Err(AppError::Custom("update.activeDownloads".into()));
    }
    let update = app
        .updater()
        .map_err(|e| AppError::Custom(e.to_string()))?
        .check()
        .await
        .map_err(|e| AppError::Custom(e.to_string()))?
        .ok_or_else(|| AppError::Custom("update.upToDate".into()))?;
    let mut downloaded = 0;
    // Tauri verifies the complete ZIP with the configured public key before returning bytes.
    let bytes = update
        .download(
            |chunk, total| {
                downloaded += chunk as u64;
                let _ = app.emit(
                    "portable-update-progress",
                    Progress {
                        downloaded,
                        total,
                        ready: false,
                    },
                );
            },
            || {},
        )
        .await
        .map_err(|e| AppError::Custom(e.to_string()))?;
    if manager.active_count() > 0 {
        return Err(AppError::Custom("update.activeDownloads".into()));
    }
    let root =
        crate::portable::root().ok_or_else(|| AppError::Custom("update.portableOnly".into()))?;
    let updates = root.join(".updates");
    fs::create_dir_all(&updates).map_err(|e| AppError::FileError(e.to_string()))?;
    if fs::symlink_metadata(&updates)
        .map_err(|e| AppError::FileError(e.to_string()))?
        .file_type()
        .is_symlink()
        || !updates
            .canonicalize()
            .map_err(|e| AppError::FileError(e.to_string()))?
            .starts_with(
                root.canonicalize()
                    .map_err(|e| AppError::FileError(e.to_string()))?,
            )
    {
        return Err(AppError::FileError(
            "Invalid update staging directory".into(),
        ));
    }
    let task_dir = updates.join(format!(
        "{}-{}",
        chrono::Utc::now().timestamp_millis(),
        std::process::id()
    ));
    fs::create_dir(&task_dir).map_err(|e| AppError::FileError(e.to_string()))?;
    let mut staging_guard = StagingGuard {
        path: task_dir.clone(),
        preserve: false,
    };
    let stage = task_dir.join("stage");
    extract_package(&bytes, &stage, &update.version).map_err(AppError::FileError)?;
    let exe = std::env::current_exe().map_err(|e| AppError::FileError(e.to_string()))?;
    let executable = exe
        .file_name()
        .and_then(|v| v.to_str())
        .ok_or_else(|| AppError::FileError("Invalid executable name".into()))?
        .to_string();
    let handoff = Handoff {
        executable,
        version: update.version.clone(),
    };
    fs::write(
        task_dir.join("handoff.json"),
        serde_json::to_vec(&handoff).map_err(|e| AppError::Custom(e.to_string()))?,
    )
    .map_err(|e| AppError::FileError(e.to_string()))?;
    let helper = task_dir.join("JC_YouDownloader-update.exe");
    fs::copy(&exe, &helper).map_err(|e| AppError::FileError(e.to_string()))?;
    let mut command = std::process::Command::new(helper);
    command
        .arg("--apply-portable-update")
        .arg(std::process::id().to_string());
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        command.creation_flags(0x08000000);
    }
    command
        .spawn()
        .map_err(|e| AppError::Custom(e.to_string()))?;
    staging_guard.preserve = true;
    manager.shutdown();
    let _ = app.emit(
        "portable-update-progress",
        Progress {
            downloaded,
            total: Some(downloaded),
            ready: true,
        },
    );
    app.exit(0);
    Ok(())
}

#[cfg(any(target_os = "windows", test))]
fn apply_files(root: &Path, task_dir: &Path, executable: &str) -> Result<(), String> {
    let name = Path::new(executable);
    if name.components().count() != 1
        || !matches!(name.components().next(), Some(Component::Normal(_)))
        || !executable.to_lowercase().ends_with(".exe")
        || executable.contains([':', '/', '\\'])
    {
        return Err("Invalid executable name".into());
    }
    let stage = task_dir.join("stage");
    let backup = task_dir.join("backup");
    fs::create_dir(&backup).map_err(|e| e.to_string())?;
    let mut completed: Vec<(&str, &str, bool)> = Vec::new();
    for (source, target) in [
        ("JC_YouDownloader.exe", executable),
        ("binaries", "binaries"),
        ("portable.flag", "portable.flag"),
        (".portable-version.json", ".portable-version.json"),
    ] {
        let destination = root.join(target);
        let had_original = destination.exists();
        if had_original {
            if let Err(error) = fs::rename(&destination, backup.join(target)) {
                rollback(root, &stage, &backup, &completed);
                return Err(error.to_string());
            }
        }
        if let Err(error) = fs::rename(stage.join(source), &destination) {
            if had_original {
                let _ = fs::rename(backup.join(target), &destination);
            }
            rollback(root, &stage, &backup, &completed);
            return Err(error.to_string());
        }
        completed.push((source, target, had_original));
    }
    Ok(())
}

#[cfg(any(target_os = "windows", test))]
fn rollback(root: &Path, stage: &Path, backup: &Path, completed: &[(&str, &str, bool)]) {
    for (source, target, had_original) in completed.iter().rev() {
        let _ = fs::rename(root.join(target), stage.join(source));
        if *had_original {
            let _ = fs::rename(backup.join(target), root.join(target));
        }
    }
}

#[cfg(target_os = "windows")]
fn wait_for_parent(pid: u32) -> Result<(), String> {
    #[link(name = "kernel32")]
    extern "system" {
        fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
        fn WaitForSingleObject(handle: *mut std::ffi::c_void, milliseconds: u32) -> u32;
        fn CloseHandle(handle: *mut std::ffi::c_void) -> i32;
    }
    // SAFETY: the process handle is checked for null, used only for waiting, and closed once.
    unsafe {
        let handle = OpenProcess(0x00100000, 0, pid);
        if handle.is_null() {
            if std::io::Error::last_os_error().raw_os_error() == Some(87) {
                return Ok(());
            }
            return Err(std::io::Error::last_os_error().to_string());
        }
        let result = WaitForSingleObject(handle, 120_000);
        CloseHandle(handle);
        if result == 0 {
            Ok(())
        } else {
            Err("The application did not close in time".into())
        }
    }
}

/// Runs before Tauri initializes, from a copy of the old executable in .updates.
pub fn run_helper_if_requested() -> bool {
    let args: Vec<_> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("--apply-portable-update") {
        return false;
    }
    #[cfg(target_os = "windows")]
    {
        let result = (|| -> Result<(), String> {
            let exe = std::env::current_exe().map_err(|e| e.to_string())?;
            let task_dir = exe.parent().ok_or("Invalid helper location")?;
            let updates = task_dir.parent().ok_or("Invalid helper location")?;
            let root = updates.parent().ok_or("Invalid helper location")?;
            if exe.file_name().and_then(|v| v.to_str()) != Some("JC_YouDownloader-update.exe")
                || updates.file_name().and_then(|v| v.to_str()) != Some(".updates")
                || !root.join("portable.flag").is_file()
            {
                return Err("Invalid portable update location".into());
            }
            let handoff: Handoff = serde_json::from_slice(
                &fs::read(task_dir.join("handoff.json")).map_err(|e| e.to_string())?,
            )
            .map_err(|e| e.to_string())?;
            let pid = args
                .get(2)
                .ok_or("Missing parent PID")?
                .parse::<u32>()
                .map_err(|e| e.to_string())?;
            wait_for_parent(pid)?;
            let result = apply_files(root, task_dir, &handoff.executable);
            // The old app is restored on a replacement failure; restart whichever version is present.
            let mut restart = std::process::Command::new(root.join(&handoff.executable));
            use std::os::windows::process::CommandExt;
            let launched = restart.current_dir(root).creation_flags(0x08000000).spawn();
            let result = if let Err(error) = launched {
                if result.is_ok() {
                    let files = [
                        ("JC_YouDownloader.exe", handoff.executable.as_str()),
                        ("binaries", "binaries"),
                        ("portable.flag", "portable.flag"),
                        (".portable-version.json", ".portable-version.json"),
                    ];
                    let completed: Vec<_> = files
                        .into_iter()
                        .map(|(source, target)| {
                            (
                                source,
                                target,
                                task_dir.join("backup").join(target).exists(),
                            )
                        })
                        .collect();
                    rollback(
                        root,
                        &task_dir.join("stage"),
                        &task_dir.join("backup"),
                        &completed,
                    );
                    let _ = restart.spawn();
                }
                Err(error.to_string())
            } else {
                result
            };
            fs::write(
                task_dir.join("result.txt"),
                match &result {
                    Ok(()) => "Updated successfully".into(),
                    Err(e) => format!("Update failed: {e}"),
                },
            )
            .map_err(|e| e.to_string())?;
            result
        })();
        if let Err(error) = result {
            eprintln!("Portable update failed: {error}");
        }
    }
    true
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::path::PathBuf;
    use zip::write::SimpleFileOptions;

    fn temp(name: &str) -> PathBuf {
        let root = std::env::temp_dir().join(format!(
            "jc-updater-{name}-{}-{}",
            std::process::id(),
            chrono::Utc::now().timestamp_nanos_opt().unwrap()
        ));
        fs::create_dir_all(&root).unwrap();
        root
    }

    fn zip_fixture(version: &str, extra: Option<&str>) -> Vec<u8> {
        let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
        for file in [
            "JC_YouDownloader.exe",
            "portable.flag",
            "binaries/ffmpeg.exe",
            "binaries/deno.exe",
            "binaries/ytdlp/yt-dlp.exe",
        ] {
            writer
                .start_file(file, SimpleFileOptions::default())
                .unwrap();
            writer
                .write_all(b"test fixture, not an executable")
                .unwrap();
        }
        writer
            .start_file(".portable-version.json", SimpleFileOptions::default())
            .unwrap();
        writer
            .write_all(
                serde_json::json!({ "version": version })
                    .to_string()
                    .as_bytes(),
            )
            .unwrap();
        if let Some(file) = extra {
            writer
                .start_file(file, SimpleFileOptions::default())
                .unwrap();
            writer.write_all(b"forbidden").unwrap();
        }
        writer.finish().unwrap().into_inner()
    }

    #[test]
    fn real_signature_accepts_original_bytes_and_rejects_tampering() {
        use base64::Engine;
        let fixture: serde_json::Value =
            serde_json::from_str(include_str!("../../tests/fixtures/portable-signature.json"))
                .unwrap();
        let config: serde_json::Value =
            serde_json::from_str(include_str!("../tauri.conf.json")).unwrap();
        assert_eq!(fixture["publicKey"], config["plugins"]["updater"]["pubkey"]);
        let decode = |name: &str| {
            String::from_utf8(
                base64::engine::general_purpose::STANDARD
                    .decode(fixture[name].as_str().unwrap())
                    .unwrap(),
            )
            .unwrap()
        };
        let key = minisign_verify::PublicKey::decode(&decode("publicKey")).unwrap();
        let signature = minisign_verify::Signature::decode(&decode("signature")).unwrap();
        assert!(key
            .verify(
                fixture["payload"].as_str().unwrap().as_bytes(),
                &signature,
                true
            )
            .is_ok());
        assert!(key.verify(b"tampered download", &signature, true).is_err());
    }

    #[test]
    fn archive_accepts_portable_files_and_binds_the_signed_version() {
        let root = temp("archive");
        assert!(extract_package(&zip_fixture("0.1.1", None), &root.join("stage"), "0.1.1").is_ok());
        assert!(extract_package(&zip_fixture("0.1.0", None), &root.join("old"), "0.1.1").is_err());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn archive_rejects_user_data_and_traversal() {
        let root = temp("paths");
        for (index, path) in [
            "Data/settings.json",
            "Descargas/video.mp4",
            "../outside.txt",
            "binaries/../outside.txt",
            "C:/outside.txt",
            "binaries/test:stream",
        ]
        .iter()
        .enumerate()
        {
            assert!(
                extract_package(
                    &zip_fixture("0.1.1", Some(path)),
                    &root.join(index.to_string()),
                    "0.1.1"
                )
                .is_err(),
                "{path}"
            );
        }
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn replacement_preserves_data_downloads_and_renamed_executable() {
        let root = temp("replace");
        fs::create_dir_all(root.join("Data")).unwrap();
        fs::create_dir_all(root.join("Descargas")).unwrap();
        fs::create_dir_all(root.join("binaries")).unwrap();
        fs::write(root.join("My Downloader.exe"), b"old").unwrap();
        fs::write(root.join("portable.flag"), b"").unwrap();
        fs::write(root.join("Data/settings.json"), b"user settings").unwrap();
        fs::write(root.join("Descargas/video.mp4"), b"user video").unwrap();
        let task = root.join(".updates/task");
        extract_package(&zip_fixture("0.1.1", None), &task.join("stage"), "0.1.1").unwrap();
        apply_files(&root, &task, "My Downloader.exe").unwrap();
        assert_eq!(
            fs::read(root.join("Data/settings.json")).unwrap(),
            b"user settings"
        );
        assert_eq!(
            fs::read(root.join("Descargas/video.mp4")).unwrap(),
            b"user video"
        );
        assert_eq!(
            fs::read(task.join("backup/My Downloader.exe")).unwrap(),
            b"old"
        );
        assert!(root.join("My Downloader.exe").is_file());
        assert!(!root.join("JC_YouDownloader.exe").exists());
        fs::remove_dir_all(root).unwrap();
    }

    #[test]
    fn failed_replacement_restores_previous_program_and_resources() {
        let root = temp("rollback");
        fs::create_dir_all(root.join("binaries")).unwrap();
        fs::write(root.join("JC_YouDownloader.exe"), b"old").unwrap();
        fs::write(root.join("binaries/ffmpeg.exe"), b"old tool").unwrap();
        let task = root.join(".updates/task");
        fs::create_dir_all(task.join("stage")).unwrap();
        fs::write(task.join("stage/JC_YouDownloader.exe"), b"new").unwrap();
        assert!(apply_files(&root, &task, "JC_YouDownloader.exe").is_err());
        assert_eq!(fs::read(root.join("JC_YouDownloader.exe")).unwrap(), b"old");
        assert_eq!(
            fs::read(root.join("binaries/ffmpeg.exe")).unwrap(),
            b"old tool"
        );
        fs::remove_dir_all(root).unwrap();
    }
}
