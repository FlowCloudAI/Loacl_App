mod models;

use std::default::Default;
use tauri_plugin_http::reqwest;
use serde_json::json;
use serde;
use models::{ChatRequest, ChatResponse, Message};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            test_command, // 把你的函数名放这里
            show_main_window,
            get_ai_response,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[tauri::command]
fn test_command() -> Result<String, String> {
    // 模拟业务逻辑
    Ok("Hello from Rust backend!".to_string())
}

#[tauri::command]
fn show_main_window(window: tauri::Window) -> Result<String, tauri::Error> {
    window.show()?;
    Ok("open the window".to_string())
}

#[tauri::command]
async fn get_ai_response(prompt: String) -> Result<String, String> {
    let client = reqwest::Client::new();
    let request_body: ChatRequest = serde_json::from_str(&prompt)
        .map_err(|e| format!("请求解析失败: {}", e))?;;

    let res = client
        .post("https://api.openai.com/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", "api_key"))
        .json(&request_body)
        .send()
        .await
        .map_err(|e| format!("请求发送失败: {}", e))?;

    if !res.status().is_success() {
        let status = res.status();
        let error_text = res.text().await.unwrap_or_default();
        return Err(format!("API 错误 ({}): {}", status, error_text));
    }

    let chat_response = res
        .json::<ChatResponse>()
        .await
        .map_err(|e| format!("响应解析失败: {}", e))?;

    // 安全提取回复内容
    chat_response
        .choices
        .first()
        .map(|choice| choice.message.content.clone())
        .ok_or_else(|| "未收到有效回复".to_string())
}