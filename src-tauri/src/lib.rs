mod apis;
mod store;
mod secure_store;

use apis::{
    get_ai_response, log_message,
    show_main_window, test_command,
};
use std::default::Default;
use std::env;
use tauri_plugin_log;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {

    tauri::Builder::default()
        .setup(|app| {
            // 单实例运行检测
            #[cfg(debug_assertions)]
            app.handle()
                .plugin(tauri_plugin_single_instance::init(|app, args, cwd| {}))
                .expect("TODO: panic message");

            // 初始化全局 Store
            let handle = app.handle().clone();
            store::init_store(&handle)?; // ✅

            // 日志
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        // 注册api接口
        .invoke_handler(tauri::generate_handler![
            test_command, // 把你的函数名放这里
            show_main_window,
            get_ai_response,
            log_message
        ])
        // 运行
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    log::info!("Tauri App Started");
}
