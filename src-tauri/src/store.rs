use std::fmt::Debug;
// 在 lib.rs 或单独的 store.rs 中
use std::sync::{Arc, OnceLock};
use serde::de::DeserializeOwned;
use serde::Serialize;
use tauri::{AppHandle, Wry};
use tauri_plugin_store::{Store, StoreExt};

// 使用 OnceLock 或 LazyLock（Rust 1.80+）实现全局访问
static STORE: OnceLock<Arc<Store<Wry>>> = OnceLock::new();

pub fn init_store(app: &AppHandle<Wry>) -> Result<(), Box<dyn std::error::Error>> {
    // 只初始化一次，Arc 克隆成本极低
    let store = app
        .store_builder("storage.bin")
        .auto_save(std::time::Duration::from_millis(500))
        .build()?; // 防抖500ms

    STORE.set(store)
        .map_err(|_| "Store already initialized")?;
    Ok(())
}

// 全局获取函数
pub fn get_store() -> Arc<Store<Wry>> {
    STORE.get().expect("Store not initialized").clone()
}

/// 从 store 获取并反序列化值
///
/// # 性能
/// - Arc 克隆: ~15ns
/// - HashMap 查找: ~50ns
/// - JSON 反序列化: 取决于数据大小，JWT 解析 < 1μs
pub fn get<T: DeserializeOwned + Debug>(key: &str) -> Result<T, String> {
    let store = get_store();

    let value = store.as_ref().get(key)
        .ok_or_else(|| format!("Key '{}' not found", key))?;

    serde_json::from_value(value)
        .map_err(|e| format!("Failed to deserialize '{}': {}", key, e))
}

/// 插入或覆盖值（自动序列化）
///
/// # 性能
/// - 序列化: < 1μs (JWT 大小)
/// - 内存写入: ~100ns
/// - 磁盘写入: 防抖后批量执行
pub fn insert<T: Serialize + Debug>(key: &str, value: &T) -> Result<(), String> {
    let store = get_store();

    let json_value = serde_json::to_value(value)
        .map_err(|e| format!("Failed to serialize '{}': {}", key, e))?;

    store.as_ref().set(key.to_string(), json_value);

    Ok(())
}

/// 更新值（仅在 key 存在时覆盖）
pub fn update<T: Serialize + Debug>(key: &str, value: &T) -> Result<(), String> {
    let store = get_store();

    // 先检查是否存在
    if !store.as_ref().has(key) {
        return Err(format!("Key '{}' not found, update failed", key));
    }

    insert(key, value)
}

/// 删除键（静默成功，即使键不存在）
pub fn delete(key: &str) -> Result<(), String> {
    let store = get_store();
    store.as_ref().delete(key); // 返回 bool 表示是否删除，此处忽略
    Ok(())
}

/// 删除键（严格模式：键不存在时返回错误）
pub fn delete_strict(key: &str) -> Result<(), String> {
    let store = get_store();
    if store.as_ref().delete(key) {
        Ok(())
    } else {
        Err(format!("Key '{}' not found", key))
    }
}