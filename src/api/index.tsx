import {invoke} from "@tauri-apps/api/core";

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export const log_message = (level:LogLevel, message:string) =>
    invoke<void>('log_message', {level, message});

export const showWindow = () => invoke<void>("show_main_window");

// ── 插件相关 ──────────────────────────────────────────────────────────────────

export interface PluginInfo {
  id: string
  name: string
  models: string[]
}

export const ai_list_plugins = (kind: 'llm' | 'image' | 'tts') =>
  invoke<PluginInfo[]>('ai_list_plugins', { kind })

// ── 插件市场相关 ──────────────────────────────────────────────────────────────

export interface LocalPluginInfo {
  id: string
  name: string
  version: string
  description: string
  author: string
  kind: string
  path: string
  ref_count: number
  icon_url?: string   // 本地文件路径，用 convertFileSrc() 转换后显示
}

export interface RemotePluginInfo {
  id: string
  name: string
  kind: string
  version: string
  author: string
  abi_version: number
  url: string
  uploaded_at: string
  updated_at: string
  extra: unknown
  icon_url?: string   // https://www.flowcloudai.cn/api/plugins/{id}/icon
}

export const plugin_list_local = () =>
  invoke<LocalPluginInfo[]>('plugin_list_local')

export const plugin_uninstall = (pluginId: string) =>
  invoke<void>('plugin_uninstall', { pluginId })

export const plugin_market_list = () =>
  invoke<unknown>('plugin_market_list').then(v => v as RemotePluginInfo[])

export const plugin_market_install = (pluginId: string) =>
  invoke<LocalPluginInfo>('plugin_market_install', { pluginId })

// ── 设置相关 ──────────────────────────────────────────────────────────────────

export interface LlmDefaults {
  plugin_id: string | null
  default_model: string | null
  temperature: number
  max_tokens: number
  stream: boolean
  show_reasoning: boolean
}

export interface ImageDefaults {
  plugin_id: string | null
  default_model: string | null
}

export interface TtsDefaults {
  plugin_id: string | null
  default_model: string | null
  voice_id: string | null
  auto_play: boolean
}

export interface AppSettings {
  media_dir: string | null
  db_path: string | null
  plugins_path: string | null
  theme: string
  language: string
  editor_font_size: number
  auto_save_secs: number
  default_entry_type: string | null
  llm: LlmDefaults
  image: ImageDefaults
  tts: TtsDefaults
}

export const setting_get_settings = () => invoke<AppSettings>('setting_get_settings')
export const setting_update_settings = (newSettings: AppSettings) => 
  invoke<void>('setting_update_settings', { newSettings })
export const setting_get_media_dir = () => invoke<string>('setting_get_media_dir')
export const setting_get_default_paths = () => invoke<{ db_path: string; plugins_path: string }>('setting_get_default_paths')

// ── API Key 管理 ──────────────────────────────────────────────────────────────

export const setting_set_api_key = (pluginId: string, apiKey: string) =>
  invoke<void>('setting_set_api_key', { pluginId, apiKey })

export const setting_has_api_key = (pluginId: string) =>
  invoke<boolean>('setting_has_api_key', { pluginId })

export const setting_delete_api_key = (pluginId: string) =>
  invoke<void>('setting_delete_api_key', { pluginId })