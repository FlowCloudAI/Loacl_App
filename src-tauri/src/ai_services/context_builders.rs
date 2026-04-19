use crate::ai_services::contradiction_loader::ContradictionCorpus;
use flowcloudai_client::TaskContext;
use std::collections::HashMap;
use worldflow_core::models::Entry;

pub fn build_task_context(
    project_id: Option<String>,
    task_type: &str,
    attributes: HashMap<String, String>,
    flags: HashMap<String, bool>,
) -> TaskContext {
    TaskContext {
        project_id,
        task_type: task_type.to_string(),
        attributes,
        flags,
        ..Default::default()
    }
}

pub fn build_entry_markdown(entry: &Entry, max_content_chars: usize) -> String {
    let mut output = String::new();
    output.push_str(&format!("### {} ({})\n", entry.title, entry.id));
    if let Some(entry_type) = &entry.r#type {
        output.push_str(&format!("- 类型：{}\n", entry_type));
    }
    if let Some(summary) = &entry.summary {
        output.push_str(&format!("- 摘要：{}\n", summary));
    }
    if !entry.tags.0.is_empty() {
        let tag_text = entry
            .tags
            .0
            .iter()
            .map(|tag| format!("{}={}", tag.schema_id, tag.value))
            .collect::<Vec<_>>()
            .join("；");
        output.push_str(&format!("- 标签：{}\n", tag_text));
    }

    let content: String = if entry.content.chars().count() > max_content_chars {
        let clipped = entry.content.chars().take(max_content_chars).collect::<String>();
        format!("{}\n……（正文过长，已截断）", clipped)
    } else {
        entry.content.clone()
    };
    output.push_str("\n正文：\n");
    output.push_str(&content);
    output.push('\n');
    output
}

pub fn build_summary_prompt(
    project_name: &str,
    focus: Option<&str>,
    entry_blocks: &[String],
) -> String {
    let mut prompt = format!(
        "请基于以下项目资料生成一份中文总结。项目名：{}。\n",
        project_name
    );
    if let Some(focus) = focus {
        prompt.push_str(&format!("总结重点：{}。\n", focus));
    }
    prompt.push_str("输出要求：\n");
    prompt.push_str("1. 使用 Markdown。\n");
    prompt.push_str("2. 先给一个总览，再给 3-6 条关键信息。\n");
    prompt.push_str("3. 不要编造资料中不存在的设定。\n\n");
    prompt.push_str("资料如下：\n\n");
    prompt.push_str(&entry_blocks.join("\n\n"));
    prompt
}

pub fn build_contradiction_prompt(corpus: &ContradictionCorpus) -> String {
    let mut prompt = format!(
        "请检测以下项目资料中的设定矛盾，并按约定 JSON schema 输出。\n项目：{}。\n",
        corpus.project_name
    );
    prompt.push_str(&format!("检测范围：{}。\n", corpus.scope_summary));
    if corpus.truncated {
        prompt.push_str("注意：本轮资料经过裁剪；若证据不足，请放入 unresolvedQuestions，不要硬判定。\n");
    }
    prompt.push_str("判断标准：\n");
    prompt.push_str("1. 只有在两条或多条证据明确互相冲突时，才放入 issues。\n");
    prompt.push_str("2. 同一条资料中的模糊描述、未定设定、开放问题，不要误判为矛盾。\n");
    prompt.push_str("3. evidence.quote 必须直接引用资料原文片段。\n\n");
    prompt.push_str("资料如下：\n\n");
    prompt.push_str(&corpus.entry_blocks.join("\n\n"));
    prompt
}
