use crate::AppState;
use crate::ai_services::context_builders::build_entry_markdown;
use crate::tools;
use serde::{Deserialize, Serialize};
use std::collections::HashSet;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ContradictionLoadRequest {
    pub project_id: String,
    pub entry_ids: Option<Vec<String>>,
    pub category_id: Option<String>,
    pub query: Option<String>,
    pub max_entries: Option<usize>,
    pub max_chars_per_entry: Option<usize>,
    pub max_total_chars: Option<usize>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ContradictionCorpus {
    pub project_id: String,
    pub project_name: String,
    pub scope_summary: String,
    pub source_entry_ids: Vec<String>,
    pub entry_blocks: Vec<String>,
    pub truncated: bool,
}

pub async fn load_contradiction_corpus(
    app_state: &AppState,
    request: &ContradictionLoadRequest,
) -> Result<ContradictionCorpus, String> {
    let max_entries = request.max_entries.unwrap_or(12).clamp(1, 30);
    let max_chars_per_entry = request.max_chars_per_entry.unwrap_or(2200).clamp(400, 6000);
    let max_total_chars = request
        .max_total_chars
        .unwrap_or(18_000)
        .clamp(2_000, 40_000);

    let (project, _) = tools::get_project_summary(app_state, &request.project_id).await?;

    let candidate_ids = if let Some(entry_ids) = &request.entry_ids {
        entry_ids.clone()
    } else if let Some(query) = request.query.as_deref() {
        tools::search_entries(
            app_state,
            &request.project_id,
            query,
            None,
            request.category_id.as_deref(),
            max_entries,
        )
        .await?
        .into_iter()
        .map(|brief| brief.id.to_string())
        .collect()
    } else {
        tools::list_all_entries(
            app_state,
            &request.project_id,
            request.category_id.as_deref(),
            max_entries,
            0,
        )
        .await?
        .into_iter()
        .map(|brief| brief.id.to_string())
        .collect()
    };

    let mut dedup = HashSet::new();
    let selected_ids = candidate_ids
        .into_iter()
        .filter(|entry_id| dedup.insert(entry_id.clone()))
        .take(max_entries)
        .collect::<Vec<_>>();

    if selected_ids.is_empty() {
        return Err("矛盾检测范围内没有可用词条".to_string());
    }

    let mut entry_blocks = Vec::new();
    let mut used_entry_ids = Vec::new();
    let mut remaining_chars = max_total_chars;
    let mut truncated = false;

    for entry_id in &selected_ids {
        if remaining_chars < 200 {
            truncated = true;
            break;
        }

        let entry = tools::get_entry(app_state, entry_id).await?;
        let block = build_entry_markdown(&entry, max_chars_per_entry.min(remaining_chars));
        let char_count = block.chars().count();

        if char_count > remaining_chars {
            truncated = true;
            break;
        }

        remaining_chars = remaining_chars.saturating_sub(char_count);
        used_entry_ids.push(entry_id.clone());
        entry_blocks.push(block);
    }

    let mut scope_parts = vec![format!("项目「{}」", project.name)];
    if let Some(query) = request.query.as_deref() {
        scope_parts.push(format!("搜索词“{}”", query));
    }
    if let Some(category_id) = request.category_id.as_deref() {
        scope_parts.push(format!("分类 {}", category_id));
    }
    if request.entry_ids.is_some() {
        scope_parts.push("显式指定词条集合".to_string());
    }
    scope_parts.push(format!("共载入 {} 个词条", used_entry_ids.len()));

    Ok(ContradictionCorpus {
        project_id: request.project_id.clone(),
        project_name: project.name,
        scope_summary: scope_parts.join("，"),
        source_entry_ids: used_entry_ids,
        entry_blocks,
        truncated,
    })
}
