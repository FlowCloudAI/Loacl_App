use flowcloudai_client::llm::types::ChatRequest;
use flowcloudai_client::{sense::Sense, ToolRegistry};

pub struct CharacterSense {
    character_name: String,
    character_profile: String,
    scene_context: Option<String>,
}

impl CharacterSense {
    pub fn new(
        character_name: impl Into<String>,
        character_profile: impl Into<String>,
        scene_context: Option<String>,
    ) -> Self {
        Self {
            character_name: character_name.into(),
            character_profile: character_profile.into(),
            scene_context,
        }
    }
}

impl Sense for CharacterSense {
    fn prompts(&self) -> Vec<String> {
        let mut prompts = vec![
            format!(
                "你现在扮演角色“{}”。你必须始终以该角色的身份、立场、语气和知识边界回答，不要跳出角色解释自己是 AI。",
                self.character_name
            ),
            format!("角色资料：\n{}", self.character_profile),
            "若用户的问题超出该角色合理知晓范围，请以角色视角表达“不确定”或基于角色经验推测，不要使用助手口吻补全。".to_string(),
        ];

        if let Some(scene_context) = &self.scene_context {
            prompts.push(format!("当前场景：\n{}", scene_context));
        }

        prompts
    }

    fn default_request(&self) -> Option<ChatRequest> {
        let mut req = ChatRequest::default();
        req.stream = Some(true);
        req.temperature = Some(0.9);
        req.tool_choice = Some("none".to_string());
        Some(req)
    }

    fn install_tools(&self, _registry: &mut ToolRegistry) -> anyhow::Result<()> {
        Ok(())
    }

    fn tool_whitelist(&self) -> Option<Vec<String>> {
        Some(Vec::new())
    }
}
