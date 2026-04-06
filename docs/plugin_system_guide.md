# 插件系统开发与联调指南

## 1. 架构概览

本项目的插件系统分为两层：

### 1.1 核心层 (flowcloudai_client_core)
- **职责**：WASM 插件的扫描、编译、实例化及生命周期管理。
- **位置**：`E:/Projects/flowcloudai_client_core`
- **关键组件**：
  - `PluginScanner`: 扫描 `.fcplug` 文件并解析 `manifest.json`。
  - `PluginRegistry`: 维护插件元数据与 WASM 实例池。
  - `FlowCloudAIClient`: 提供 `list_all_plugins()`, `install_plugin_from_path()`, `uninstall_plugin()` 等接口。

### 1.2 应用层 (Tauri Backend)
- **职责**：远程市场交互、版本对比、文件下载及前端 API 暴露。
- **位置**：`src-tauri/src/apis/plugins.rs`
- **关键接口**：
  - `plugin_list_local`: 获取本地已安装插件列表。
  - `plugin_fetch_remote`: 从指定 URL 获取远程插件市场信息。
  - `plugin_check_updates`: 对比本地与远程版本，返回更新建议。
  - `plugin_install_from_file`: 安装本地 `.fcplug` 文件（当前为占位实现）。
  - `plugin_uninstall`: 卸载指定插件（当前为占位实现）。

---

## 2. 插件包结构 (.fcplug)

`.fcplug` 本质是一个 ZIP 压缩包，内部结构如下：

```text
plugin.fcplug
├── manifest.json       # 插件元数据
├── plugin.wasm         # 编译后的 WASM 组件
└── icon.png           # 插件图标（可选）
```

### manifest.json 示例
```json
{
  "meta": {
    "id": "openai",
    "name": "OpenAI Plugin",
    "kind": "kind/llm",
    "abi-version": 2,
    "version": "1.0.0",
    "author": "FlowCloud",
    "url": "https://api.openai.com/v1/chat/completions"
  },
  "llm": {
    "models": ["gpt-4", "gpt-3.5-turbo"],
    "default_model": "gpt-4",
    "supports_thinking": true,
    "supports_tools": true
  }
}
```

---

## 3. 后端 API 定义

所有插件相关 API 均通过 Tauri Invoke 调用：

| 函数名 | 参数 | 返回值 | 说明 |
| :--- | :--- | :--- | :--- |
| `plugin_list_local` | 无 | `Vec<LocalPluginInfo>` | 扫描本地插件目录 |
| `plugin_fetch_remote` | `registry_url: string` | `Vec<RemotePluginInfo>` | 请求远程市场 |
| `plugin_check_updates` | `registry_url: string` | `Vec<PluginUpdateInfo>` | 检查版本差异 |
| `plugin_install_from_file` | `file_path: string` | `LocalPluginInfo` | 从本地路径安装 |
| `plugin_uninstall` | `plugin_id: string` | `void` | 卸载插件 |

---

## 4. 前端联调示例 (React/TypeScript)

### 4.1 定义类型
```typescript
interface LocalPluginInfo {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  kind: 'llm' | 'image' | 'tts';
  path: string;
  ref_count: number; // 引用计数，大于0时不可卸载
}

interface RemotePluginInfo {
  id: string;
  name: string;
  latest_version: string;
  description: string;
  download_url: string;
}

interface PluginUpdateInfo {
  plugin_id: string;
  current_version: string;
  latest_version: string;
  has_update: boolean;
}
```

### 4.2 调用示例
```typescript
import { invoke } from '@tauri-apps/api/core';

// 1. 获取本地插件列表
const localPlugins = await invoke<LocalPluginInfo[]>('plugin_list_local');

// 2. 获取远程市场列表
const remotePlugins = await invoke<RemotePluginInfo[]>('plugin_fetch_remote', {
  registryUrl: 'https://your-market-api.com/plugins'
});

// 3. 检查更新
const updates = await invoke<PluginUpdateInfo[]>('plugin_check_updates', {
  registryUrl: 'https://your-market-api.com/plugins'
});

// 4. 卸载插件
try {
  await invoke('plugin_uninstall', { pluginId: 'some-plugin-id' });
} catch (e) {
  console.error(e); // 如果 ref_count > 0 会抛出错误
}
```

---

## 5. 开发工作流

### 5.1 调试新插件
1. 将编译好的 `.fcplug` 放入 `src-tauri/plugins` 目录。
2. 重启 Tauri 应用（目前动态安装/卸载受限于 Rust 所有权模型，需重启生效）。
3. 在前端调用 `plugin_list_local` 验证插件是否被识别。

### 5.2 模拟远程市场
在本地启动一个简单的 HTTP 服务器返回 JSON：
```json
[
  {
    "id": "test-plugin",
    "name": "Test Plugin",
    "latest_version": "2.0.0",
    "description": "A test plugin",
    "download_url": "http://localhost:8080/test.fcplug"
  }
]
```
调用 `plugin_fetch_remote` 指向该地址进行测试。

---

## 6. 已知限制与后续计划

- **动态热插拔**：目前 `install` 和 `uninstall` 接口返回占位错误。原因是 `FlowCloudAIClient` 被包裹在 `Arc<Mutex>` 中，无法安全地获取 `&mut self` 执行文件系统操作。
- **解决方案**：计划在核心库中引入 `RwLock` 或内部可变性设计，以支持运行时的插件增删。
- **依赖管理**：当前暂不支持插件间的依赖声明，后续将在 `manifest.json` 中增加 `dependencies` 字段。
