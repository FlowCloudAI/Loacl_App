import {invoke} from "@tauri-apps/api/core";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const log_message = (level:LogLevel, message:string) =>
    invoke<void>('log_message', {level, message});

export const showWindow = () => invoke<void>("show_main_window");