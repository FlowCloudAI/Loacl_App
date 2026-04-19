use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SummaryResult {
    pub summary_markdown: String,
    pub highlights: Vec<String>,
    pub source_entry_ids: Vec<String>,
    pub warnings: Vec<String>,
}

impl SummaryResult {
    pub fn from_text(
        summary_markdown: String,
        source_entry_ids: Vec<String>,
        warnings: Vec<String>,
    ) -> Self {
        let highlights = summary_markdown
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .filter(|line| !line.starts_with('#'))
            .map(|line| line.trim_start_matches("- ").trim().to_string())
            .take(3)
            .collect();

        Self {
            summary_markdown,
            highlights,
            source_entry_ids,
            warnings,
        }
    }
}
