//! An adjacent portable.flag keeps application data next to the executable.
use std::path::PathBuf;

pub fn root() -> Option<PathBuf> {
    let exe = std::env::current_exe().ok()?;
    let root = exe.parent()?.to_path_buf();
    root.join("portable.flag").is_file().then_some(root)
}

pub fn data_dir(normal: PathBuf) -> PathBuf {
    root().map(|p| p.join("Data")).unwrap_or(normal)
}

pub fn store_path(name: &str) -> PathBuf {
    root()
        .map(|p| p.join("Data").join(name))
        .unwrap_or_else(|| name.into())
}

pub fn save_download_path(path: &str) -> String {
    if let Some(root) = root() {
        if let Ok(relative) = std::path::Path::new(path).strip_prefix(root) {
            return format!("@portable/{}", relative.to_string_lossy());
        }
    }
    path.to_owned()
}

pub fn load_download_path(path: String) -> String {
    if let (Some(root), Some(relative)) = (root(), path.strip_prefix("@portable/")) {
        return root.join(relative).to_string_lossy().into_owned();
    }
    path
}
