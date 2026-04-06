use crate::AiState;
use flowcloudai_client::plugin::types::PluginMeta;
use serde::{Deserialize, Serialize};
use tauri::State;

// ============ 数据结构 ============

#[derive(Serialize, Clone)]
pub struct LocalPluginInfo {
    pub id: String,
    pub name: String,
    pub version: String,
    pub description: String,
    pub author: String,
    pub kind: String,
    pub path: String,
    pub ref_count: usize,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct RemotePluginInfo {
    pub id: String,
    pub name: String,
    pub latest_version: String,
    pub description: String,
    pub author: String,
    pub kind: String,
    pub download_url: String,
}

#[derive(Serialize, Clone)]
pub struct PluginUpdateInfo {
    pub plugin_id: String,
    pub current_version: String,
    pub latest_version: String,
    pub has_update: bool,
}

// ============ 辅助函数 ============

fn plugin_meta_to_local_info(meta: &PluginMeta, ref_count: usize) -> LocalPluginInfo {
    let kind_str = match meta.kind {
        flowcloudai_client::PluginKind::LLM => "llm",
        flowcloudai_client::PluginKind::Image => "image",
        flowcloudai_client::PluginKind::TTS => "tts",
    };

    LocalPluginInfo {
        id: meta.id.clone(),
        name: meta.name.clone(),
        version: meta.version.clone(),
        description: meta.description.clone(),
        author: meta.author.clone(),
        kind: kind_str.to_string(),
        path: meta.fcplug_path.to_string_lossy().to_string(),
        ref_count,
    }
}

// ============ Tauri Commands ============

/// 扫描本地已安装的插件
#[tauri::command]
pub async fn plugin_list_local(ai_state: State<'_, AiState>) -> Result<Vec<LocalPluginInfo>, String> {
    let client = ai_state.client.lock().await;
    
    let plugins = client.list_all_plugins();
    let mut result = Vec::new();
    
    for meta in plugins {
        let ref_count = client.get_plugin_ref_count(&meta.id);
        result.push(plugin_meta_to_local_info(&meta, ref_count));
    }
    
    Ok(result)
}

/// 从远程市场获取插件列表
#[tauri::command]
pub async fn plugin_fetch_remote(registry_url: String) -> Result<Vec<RemotePluginInfo>, String> {
    let client = reqwest::Client::new();
    
    let response = client
        .get(&registry_url)
        .send()
        .await
        .map_err(|e| format!("Failed to fetch remote plugins: {}", e))?;
    
    if !response.status().is_success() {
        return Err(format!("HTTP error: {}", response.status()));
    }
    
    let remote_plugins: Vec<RemotePluginInfo> = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse response: {}", e))?;
    
    Ok(remote_plugins)
}

/// 检查插件更新
#[tauri::command]
pub async fn plugin_check_updates(
    ai_state: State<'_, AiState>,
    registry_url: String,
) -> Result<Vec<PluginUpdateInfo>, String> {
    // 获取远程插件
    let remote_plugins = plugin_fetch_remote(registry_url).await?;
    
    // 构建远程版本映射
    let remote_versions: std::collections::HashMap<String, String> = remote_plugins
        .into_iter()
        .map(|p| (p.id, p.latest_version))
        .collect();
    
    // 获取本地插件进行对比
    let client = ai_state.client.lock().await;
    let local_plugins = client.list_all_plugins();
    
    let mut updates = Vec::new();
    
    for meta in local_plugins {
        if let Some(latest_version) = remote_versions.get(&meta.id) {
            let has_update = latest_version != &meta.version;
            
            updates.push(PluginUpdateInfo {
                plugin_id: meta.id,
                current_version: meta.version,
                latest_version: latest_version.clone(),
                has_update,
            });
        }
    }
    
    Ok(updates)
}

/// 安装插件（从本地文件）
#[tauri::command]
pub async fn plugin_install_from_file(
    _ai_state: State<'_, AiState>,
    _file_path: String,
) -> Result<LocalPluginInfo, String> {
    // 此实现需要核心库支持内部可变性
    // 当前版本暂不支持动态安装
    Err("Dynamic plugin installation not yet supported. Please restart the application after adding plugins to the directory.".to_string())
}

/// 卸载插件
#[tauri::command]
pub async fn plugin_uninstall(
    ai_state: State<'_, AiState>,
    plugin_id: String,
) -> Result<(), String> {
    let client = ai_state.client.lock().await;
    
    // 检查引用计数
    let ref_count = client.get_plugin_ref_count(&plugin_id);
    if ref_count > 0 {
        return Err(format!(
            "Plugin '{}' is still in use by {} session(s). Close all sessions first.",
            plugin_id, ref_count
        ));
    }
    
    // 执行卸载（需要可变引用）
    // 当前架构下，Arc<Mutex<FlowCloudAIClient>> 无法提供 &mut self
    // 需要核心库改为内部可变性或重新设计
    Err("Plugin uninstallation requires exclusive access. This feature will be available in future versions.".to_string())
}
