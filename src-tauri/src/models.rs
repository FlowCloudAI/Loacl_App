use serde::{Deserialize, Serialize};

// ========== 请求部分 ==========

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ChatRequest {
    /// 模型名称，如 "deepseek-chat" 或 "deepseek-reasoner"
    pub model: String,

    /// 对话消息列表
    pub messages: Vec<Message>,

    /// 控制随机性，0-2 之间，越高越随机 (DeepSeek 默认 1.0)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub temperature: Option<f32>,

    /// 最大生成 token 数 (DeepSeek 建议 4096)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub max_tokens: Option<i32>,

    /// 核采样参数，0-1 之间
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_p: Option<f32>,

    /// 频率惩罚，-2.0 到 2.0
    #[serde(skip_serializing_if = "Option::is_none")]
    pub frequency_penalty: Option<f32>,

    /// 存在惩罚，-2.0 到 2.0
    #[serde(skip_serializing_if = "Option::is_none")]
    pub presence_penalty: Option<f32>,

    /// 响应格式（关键修复：是对象不是字符串）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub response_format: Option<ResponseFormat>,

    /// 停止词列表
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stop: Option<Vec<String>>,

    /// 生成回复数量（不建议修改）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub n: Option<i32>,

    /// 是否流式传输
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream: Option<bool>,

    /// 流式选项（当 stream=true 时有效）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub stream_options: Option<StreamOptions>,

    /// 思考模式配置（DeepSeek 特色功能）
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thinking: Option<ThinkingConfig>,

    /// 工具调用配置
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tools: Option<Vec<Tool>>,

    /// 工具选择策略
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tool_choice: Option<ToolChoice>,

    /// 是否返回 logprobs
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logprobs: Option<bool>,

    /// 返回最可能的 top_logprobs 数量
    #[serde(skip_serializing_if = "Option::is_none")]
    pub top_logprobs: Option<i32>,
}

impl Default for ChatRequest {
    fn default() -> Self {
        Self {
            model: "deepseek-chat".to_string(),
            messages: Vec::new(),
            temperature: Some(1.0),  // DeepSeek 推荐值
            max_tokens: Some(4096),  // DeepSeek 上限
            top_p: Some(1.0),
            frequency_penalty: Some(0.0),
            presence_penalty: Some(0.0),
            response_format: None,
            stop: None,
            n: Some(1),
            stream: Some(false),
            stream_options: None,
            thinking: Some(ThinkingConfig::disabled()),  // 默认关闭思考模式
            tools: None,
            tool_choice: Some(ToolChoice::none()),
            logprobs: Some(false),
            top_logprobs: None,
        }
    }
}

impl ChatRequest {
    pub fn new(model: impl Into<String>) -> Self {
        Self {
            model: model.into(),
            ..Default::default()
        }
    }

    pub fn with_message(mut self, role: impl Into<String>, content: impl Into<String>) -> Self {
        self.messages.push(Message {
            role: role.into(),
            content: content.into(),
        });
        self
    }

    pub fn with_system_prompt(mut self, content: impl Into<String>) -> Self {
        self.messages.insert(0, Message {
            role: "system".to_string(),
            content: content.into(),
        });
        self
    }

    /// 启用 JSON 输出模式
    pub fn with_json_format(mut self) -> Self {
        self.response_format = Some(ResponseFormat::json_object());
        self
    }
}

// ========== 消息部分 ==========

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Message {
    pub role: String,  // "system", "user", "assistant", "tool"
    pub content: String,
}

// ========== 响应格式配置 ==========

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ResponseFormat {
    #[serde(rename = "type")]
    pub format_type: String,  // "text" 或 "json_object"
}

impl ResponseFormat {
    pub fn text() -> Self {
        Self { format_type: "text".to_string() }
    }

    pub fn json_object() -> Self {
        Self { format_type: "json_object".to_string() }
    }
}

// ========== 思考模式配置（DeepSeek 特色） ==========

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct ThinkingConfig {
    #[serde(rename = "type")]
    pub thinking_type: String,  // "enabled" 或 "disabled"
}

impl ThinkingConfig {
    pub fn enabled() -> Self {
        Self { thinking_type: "enabled".to_string() }
    }

    pub fn disabled() -> Self {
        Self { thinking_type: "disabled".to_string() }
    }
}

// ========== 流式选项 ==========

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct StreamOptions {
    pub include_usage: bool,
}

// ========== 工具调用配置（函数调用） ==========

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Tool {
    #[serde(rename = "type")]
    pub tool_type: String,  // "function"
    pub function: Function,
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct Function {
    pub name: String,
    pub description: String,
    pub parameters: serde_json::Value,  // JSON Schema
}

#[derive(Serialize, Deserialize, Debug, Clone)]
#[serde(untagged)]  // 允许不同形式的 tool_choice
pub enum ToolChoice {
    String(String),  // "none", "auto"
    Object {
        #[serde(rename = "type")]
        choice_type: String,  // "function"
        function: FunctionChoice,
    },
}

impl ToolChoice {
    pub fn none() -> Self {
        Self::String("none".to_string())
    }

    pub fn auto() -> Self {
        Self::String("auto".to_string())
    }
}

#[derive(Serialize, Deserialize, Debug, Clone)]
pub struct FunctionChoice {
    pub name: String,
}

// ========== 响应部分 ==========

#[derive(Deserialize, Debug)]
pub struct ChatResponse {
    pub id: String,
    pub object: String,
    pub created: i64,
    pub model: String,
    pub choices: Vec<Choice>,
    pub usage: Usage,
    pub system_fingerprint: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct Choice {
    pub index: i32,
    pub message: ResponseMessage,
    pub finish_reason: Option<String>,
    pub logprobs: Option<serde_json::Value>,
}

#[derive(Deserialize, Debug)]
pub struct ResponseMessage {
    pub role: String,
    pub content: String,
}

#[derive(Deserialize, Debug)]
pub struct Usage {
    pub prompt_tokens: i32,
    pub completion_tokens: i32,
    pub total_tokens: i32,
}