use std::env;
use futures::TryStreamExt;
use serde_json::Value;
use tauri::{Emitter, Window};
use reqwest::Client;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio_util::io::StreamReader;
use serde::{Deserialize, Serialize};
use crate::store::get_store;

#[tauri::command]
pub fn test_command() -> Result<String, String> {
    // 模拟业务逻辑
    Ok("Hello from Rust backend!".to_string())
}

#[tauri::command]
pub fn log_message(level: String, message: String) {
    match level.as_str() {
        "info" => log::info!("{}", message),
        "error" => log::error!("{}", message),
        _ => log::debug!("{}", message),
    }
}

#[tauri::command]
pub fn show_main_window(window: Window) -> Result<String, tauri::Error> {
    window.show()?;
    env::set_var("TAURI_DEBUG", "1");
    Ok("open the window".to_string())
}

#[tauri::command]
pub async fn get_ai_response(window: Window, body: String) -> Result<String, String> {
    let client = Client::new();

    let body_json: Value = serde_json::from_str(&body)
        .map_err(|e| format!("JSON解析失败: {}", e))?;

    let is_stream = body_json["body"]["stream"]
        .as_bool()
        .unwrap_or(false);

    let request = client
        .post("https://api.flowcloudai.cn/chat")
        .header(
            "Authorization",
            format!("Bearer {}", get_jwt_from_store().await.unwrap_or_default())
        )
        .json(&body_json)
        .send()
        .await
        .map_err(|e| e.to_string())?;

    if is_stream {
        let stream = request
            .bytes_stream()
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e));
        let reader = StreamReader::new(stream);
        let mut lines = BufReader::new(reader).lines();

        // 3. 逐行读取
        while let Some(line) = lines.next_line().await.map_err(|e| e.to_string())? {
            // 跳过空行
            if line.trim().is_empty() || !line.starts_with("data: ") {
                continue;
            }

            let json_str = &line[6..]; // 去掉 "data: " 前缀

            // 4. 检测结束
            if json_str == "[DONE]" {
                break;
            }

            // 解析并提取 content
            match serde_json::from_str::<Value>(json_str) {
                Ok(json) => {
                    // ✅ 提取 id 和 content
                    let id = json["id"].as_str().unwrap_or("").to_string();
                    let content = json["choices"][0]["delta"]["content"].as_str().unwrap_or("").to_string();

                    // ✅ 只发送有内容的数据（过滤空 content）
                    if !content.is_empty() {
                        // ✅ 发送对象：{ id, content }
                        window.emit("ai-chunk", (id, content))
                            .map_err(|e| format!("发送事件失败: {}", e))?;
                    }
                },
                Err(e) => {
                    eprintln!("JSON解析错误: {}, 原始行: {}", e, json_str);
                    continue; // 忽略错误行，不中断流
                }
            }
        }
        // 6. 发送结束信号
        window.emit("ai-done", "流式响应完成".to_string())
            .map_err(|e| e.to_string())?;
    }
    else {
        let json_response: Value = request.json().await
            .map_err(|e| format!("非流式响应解析失败: {}", e))?;

        let id = json_response["id"].as_str().unwrap_or("").to_string();
        let content = json_response["choices"][0]["message"]["content"].as_str().unwrap_or("").to_string();
        // emit 完整响应供前端一次性处理
        window.emit("ai-chunk", (id, content))
            .map_err(|e| e.to_string())?;
        window.emit("ai-done", "流式响应完成".to_string())
            .map_err(|e| e.to_string())?;
    }
    Ok("成功".to_string())
}

#[derive(Serialize, Deserialize, Clone)]
struct JwtData {
    token: String,
    expires_at: i64, // 时间戳
    // 其他字段...
}

// 高频读取：直接内存访问
#[tauri::command]
async fn get_jwt_from_store() -> Result<String, String> {
    let store = get_store();

    // 使用 try_read() 避免阻塞，配合重试机制
    for _ in 0..3 {
        if let Some(jwt_value) = store.get("jwt") {
            // 直接解析为结构体
            let jwt_data: JwtData = serde_json::from_value(jwt_value)
                .map_err(|e| format!("JWT parse error: {}", e))?;

            // 检查过期
            return if jwt_data.expires_at > chrono::Utc::now().timestamp() {
                Ok(jwt_data.token)
            } else {
                Err("JWT expired".into())
            }
        }
        // 短暂退让，让其他线程释放锁
        tokio::time::sleep(std::time::Duration::from_micros(10)).await;
    }

    Err("JWT not found or store busy".into())
}