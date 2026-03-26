mod apis;

use apis::{
    log_message,
    show_main_window
};

use std::default::Default;
use tauri_plugin_log;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .setup(|app| {
            // 单实例运行检测
            #[cfg(debug_assertions)]
            app.handle()
                .plugin(tauri_plugin_single_instance::init(|_app, _args, _cwd| {
                    log::info!("Single instance detected, quitting.");
                    std::process::exit(0);
                }))
                .expect("TODO: panic message");

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
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        // 注册api接口
        .invoke_handler(tauri::generate_handler![
            show_main_window,
            log_message
        ])
        // 运行
        .run(tauri::generate_context!())
        .expect("error while running tauri application");

    log::info!("Tauri App Started");
}
