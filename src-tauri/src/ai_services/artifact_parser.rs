use serde::de::DeserializeOwned;

pub fn extract_json_block(raw: &str) -> &str {
    let trimmed = raw.trim();
    if let Some(stripped) = trimmed.strip_prefix("```json") {
        return stripped
            .trim()
            .strip_suffix("```")
            .map(str::trim)
            .unwrap_or(stripped.trim());
    }
    if let Some(stripped) = trimmed.strip_prefix("```") {
        return stripped
            .trim()
            .strip_suffix("```")
            .map(str::trim)
            .unwrap_or(stripped.trim());
    }
    trimmed
}

pub fn parse_json_artifact<T>(raw: &str) -> Result<T, String>
where
    T: DeserializeOwned,
{
    let candidate = extract_json_block(raw);
    serde_json::from_str(candidate).map_err(|err| {
        format!(
            "AI 结果不是合法 JSON：{}。原始片段前 200 字符：{}",
            err,
            candidate.chars().take(200).collect::<String>()
        )
    })
}
