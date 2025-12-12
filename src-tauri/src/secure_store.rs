use anyhow::{anyhow, Result};
use keyring::Entry;

/// 服务名（建议改成你的 App 名）
const SERVICE: &str = "flowcloudai_desktop_app";

/// 两个键名
const KEY_ACCESS: &str = "jwt_access";
const KEY_REFRESH: &str = "jwt_refresh";

/// ------------------------------
/// 基础方法（内部使用）
/// ------------------------------
fn set(key: &str, value: &str) -> Result<()> {
    Entry::new(SERVICE, key)
        .unwrap()
        .set_password(value)
        .map_err(|e| anyhow!("Failed to save {}: {}", key, e))?;

    Ok(())
}

fn get(key: &str) -> Result<String> {
    let v = Entry::new(SERVICE, key)
        .unwrap()
        .get_password()
        .map_err(|e| anyhow!("Failed to load {}: {}", key, e))?;

    Ok(v)
}

fn delete(key: &str) -> Result<()> {
    Entry::new(SERVICE, key)
        .unwrap()
        .delete_credential()
        .map_err(|e| anyhow!("Failed to delete {}: {}", key, e))?;

    Ok(())
}

/// 检查存在性（不返回错误）
fn exists(key: &str) -> bool {
    Entry::new(SERVICE, key)
        .unwrap()
        .get_password().is_ok()
}

/// ------------------------------
/// 对外 API
/// ------------------------------

pub fn save_access(token: &str) -> Result<()> {
    set(KEY_ACCESS, token)
}

pub fn save_refresh(token: &str) -> Result<()> {
    set(KEY_REFRESH, token)
}

pub fn load_access() -> Result<String> {
    get(KEY_ACCESS)
}

pub fn load_refresh() -> Result<String> {
    get(KEY_REFRESH)
}

pub fn delete_access() -> Result<()> {
    delete(KEY_ACCESS)
}

pub fn delete_refresh() -> Result<()> {
    delete(KEY_REFRESH)
}

/// 统一删除（退出登录）
pub fn clear_all() -> Result<()> {
    delete(KEY_ACCESS).ok();
    delete(KEY_REFRESH).ok();
    Ok(())
}

/// 用于判断登录状态
pub fn has_tokens() -> bool {
    exists(KEY_ACCESS) && exists(KEY_REFRESH)
}
