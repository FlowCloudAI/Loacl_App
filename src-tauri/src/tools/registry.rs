use crate::AppState;
use crate::tools;
use crate::tools::format;
use anyhow::Result;
use flowcloudai_client::llm::types::ToolFunctionArg;
use flowcloudai_client::sense::SenseState;
use flowcloudai_client::sense::sense_state_new;
use flowcloudai_client::tool::{ToolRegistry, arg_str};
use scraper::{Html, Selector};

/// Worldflow 工具的状态结构
#[derive(Clone)]
pub struct WorldflowToolState {
    pub app_state: Option<std::sync::Arc<tokio::sync::Mutex<AppState>>>,
    pub http_client: reqwest::Client,
    pub search_engine: std::sync::Arc<tokio::sync::Mutex<String>>,
}

impl Default for WorldflowToolState {
    fn default() -> Self {
        Self {
            app_state: None,
            http_client: reqwest::Client::new(),
            search_engine: std::sync::Arc::new(tokio::sync::Mutex::new("bing".to_string())),
        }
    }
}

/// 注册所有 Worldflow 工具到 ToolRegistry
pub fn register_worldflow_tools(
    registry: &mut ToolRegistry,
    app_state: std::sync::Arc<tokio::sync::Mutex<AppState>>,
    search_engine: std::sync::Arc<tokio::sync::Mutex<String>>,
) -> Result<()> {
    // 创建并注入状态
    let state = WorldflowToolState {
        app_state: Some(app_state.clone()),
        http_client: reqwest::Client::builder()
            .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36")
            .build()
            .unwrap_or_default(),
        search_engine,
    };

    // 使用 tokio runtime 初始化 SenseState
    let rt = tokio::runtime::Runtime::new()?;
    let sense_state: SenseState<WorldflowToolState> = sense_state_new();
    {
        let mut locked = rt.block_on(sense_state.lock());
        *locked = state;
    }

    registry.put_state::<SenseState<WorldflowToolState>>(sense_state);

    // 由于我们的工具需要访问 AppState，而 AppState 已经在 Arc<Mutex<>> 中，
    // 我们需要调整策略：直接在 handler 中克隆 Arc

    // ① search_entries - FTS 搜索词条
    registry.register_async::<WorldflowToolState, _>(
        "search_entries",
        "在项目中全文搜索词条，返回匹配的词条简报列表",
        vec![
            ToolFunctionArg::new("project_id", "string")
                .required(true)
                .desc("项目ID"),
            ToolFunctionArg::new("query", "string")
                .required(true)
                .desc("搜索关键词"),
            ToolFunctionArg::new("entry_type", "string")
                .desc("可选：词条类型过滤（如 character, item, location）"),
            ToolFunctionArg::new("limit", "integer")
                .desc("返回数量限制，默认10")
                .min(1)
                .max(100)
                .default(10),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let project_id = arg_str(args, "project_id")?;
                let query = arg_str(args, "query")?;
                let entry_type = args.get("entry_type").and_then(|v| v.as_str());
                let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(10) as usize;

                let app_state_guard = app_state.lock().await;
                let result =
                    tools::search_entries(&*app_state_guard, project_id, query, entry_type, limit)
                        .await
                        .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry_briefs(&result))
            })
        },
    );

    // ② get_entry - 获取完整词条
    registry.register_async::<WorldflowToolState, _>(
        "get_entry",
        "根据词条ID获取完整的词条内容，包括正文、标签和图像信息",
        vec![
            ToolFunctionArg::new("entry_id", "string")
                .required(true)
                .desc("词条ID"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let entry_id = arg_str(args, "entry_id")?;

                let app_state_guard = app_state.lock().await;
                let entry = tools::get_entry(&*app_state_guard, entry_id)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry(&entry))
            })
        },
    );

    // ③ list_entries_by_type - 按类型列出词条
    registry.register_async::<WorldflowToolState, _>(
        "list_entries_by_type",
        "列出项目中指定类型的词条简报，用于了解同类词条的整体情况",
        vec![
            ToolFunctionArg::new("project_id", "string")
                .required(true)
                .desc("项目ID"),
            ToolFunctionArg::new("entry_type", "string")
                .required(true)
                .desc("词条类型（如 character, item, location, event, faction）"),
            ToolFunctionArg::new("limit", "integer")
                .desc("返回数量限制，默认50")
                .min(1)
                .max(100)
                .default(50),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let project_id = arg_str(args, "project_id")?;
                let entry_type = arg_str(args, "entry_type")?;
                let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(50) as usize;

                let app_state_guard = app_state.lock().await;
                let result =
                    tools::list_entries_by_type(&*app_state_guard, project_id, entry_type, limit)
                        .await
                        .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry_briefs(&result))
            })
        },
    );

    // ④ list_tag_schemas - 获取标签定义
    registry.register_async::<WorldflowToolState, _>(
        "list_tag_schemas",
        "获取项目的标签定义列表，了解可用的标签名称、类型和目标",
        vec![
            ToolFunctionArg::new("project_id", "string")
                .required(true)
                .desc("项目ID"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let project_id = arg_str(args, "project_id")?;

                let app_state_guard = app_state.lock().await;
                let schemas = tools::list_tag_schemas(&*app_state_guard, project_id)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_tag_schemas(&schemas))
            })
        },
    );

    // ⑤ get_entry_relations - 获取词条关系网络
    registry.register_async::<WorldflowToolState, _>(
        "get_entry_relations",
        "获取指定词条的所有关联关系（单向/双向），用于检测关系链中的矛盾",
        vec![
            ToolFunctionArg::new("entry_id", "string")
                .required(true)
                .desc("词条ID"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let entry_id = arg_str(args, "entry_id")?;

                let app_state_guard = app_state.lock().await;
                let relations = tools::get_entry_relations(&*app_state_guard, entry_id)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_relations(&relations, entry_id))
            })
        },
    );

    // ⑥ get_project_summary - 获取项目统计
    registry.register_async::<WorldflowToolState, _>(
        "get_project_summary",
        "获取项目的基本信息和各类型词条的统计数据",
        vec![
            ToolFunctionArg::new("project_id", "string")
                .required(true)
                .desc("项目ID"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let project_id = arg_str(args, "project_id")?;

                let app_state_guard = app_state.lock().await;
                let (project, counts) = tools::get_project_summary(&*app_state_guard, project_id)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_project_summary(&project, &counts))
            })
        },
    );

    // ⑦ update_entry_title - 更新词条标题
    registry.register_async::<WorldflowToolState, _>(
        "update_entry_title",
        "更新指定词条的标题",
        vec![
            ToolFunctionArg::new("entry_id", "string")
                .required(true)
                .desc("词条ID"),
            ToolFunctionArg::new("title", "string")
                .required(true)
                .desc("新标题"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let entry_id = arg_str(args, "entry_id")?;
                let title = arg_str(args, "title")?;

                let app_state_guard = app_state.lock().await;
                let entry =
                    tools::update_entry_title(&*app_state_guard, entry_id, title.to_string())
                        .await
                        .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry(&entry))
            })
        },
    );

    // ⑧ update_entry_summary - 更新词条摘要
    registry.register_async::<WorldflowToolState, _>(
        "update_entry_summary",
        "更新指定词条的摘要；传入空字符串可清空摘要",
        vec![
            ToolFunctionArg::new("entry_id", "string")
                .required(true)
                .desc("词条ID"),
            ToolFunctionArg::new("summary", "string")
                .required(true)
                .desc("新摘要内容"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let entry_id = arg_str(args, "entry_id")?;
                let summary = arg_str(args, "summary")?;
                let summary = if summary.is_empty() {
                    None
                } else {
                    Some(summary.to_string())
                };

                let app_state_guard = app_state.lock().await;
                let entry = tools::update_entry_summary(&*app_state_guard, entry_id, summary)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry(&entry))
            })
        },
    );

    // ⑨ update_entry_content - 更新词条正文
    registry.register_async::<WorldflowToolState, _>(
        "update_entry_content",
        "更新指定词条的正文内容；传入空字符串可清空正文",
        vec![
            ToolFunctionArg::new("entry_id", "string")
                .required(true)
                .desc("词条ID"),
            ToolFunctionArg::new("content", "string")
                .required(true)
                .desc("新正文内容，支持 Markdown"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let entry_id = arg_str(args, "entry_id")?;
                let content = arg_str(args, "content")?;
                let content = if content.is_empty() {
                    None
                } else {
                    Some(content.to_string())
                };

                let app_state_guard = app_state.lock().await;
                let entry = tools::update_entry_content(&*app_state_guard, entry_id, content)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry(&entry))
            })
        },
    );

    // ⑩ update_entry_type - 更新词条类型
    registry.register_async::<WorldflowToolState, _>(
        "update_entry_type",
        "更新指定词条的类型",
        vec![
            ToolFunctionArg::new("entry_id", "string")
                .required(true)
                .desc("词条ID"),
            ToolFunctionArg::new("entry_type", "string")
                .required(true)
                .desc("词条类型（如 character, item, location, event, faction）"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let entry_id = arg_str(args, "entry_id")?;
                let entry_type = arg_str(args, "entry_type")?;

                let app_state_guard = app_state.lock().await;
                let entry = tools::update_entry_type(
                    &*app_state_guard,
                    entry_id,
                    Some(entry_type.to_string()),
                )
                .await
                .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry(&entry))
            })
        },
    );

    // ⑪ update_entry_tags - 更新词条标签（全量替换）
    registry.register_async::<WorldflowToolState, _>(
        "update_entry_tags",
        "全量替换指定词条的标签列表；调用前建议先用 list_tag_schemas 确认可用标签",
        vec![
            ToolFunctionArg::new("entry_id", "string")
                .required(true)
                .desc("词条ID"),
            ToolFunctionArg::new("tags", "array")
                .required(true)
                .desc("标签对象数组，每个对象包含 schema_id（或 name）和 value"),
        ],
        |_state, args| {
            let app_state = _state.app_state.clone().unwrap();
            Box::pin(async move {
                let entry_id = arg_str(args, "entry_id")?;
                let tags_json = args
                    .get("tags")
                    .ok_or_else(|| anyhow::anyhow!("缺少 tags 参数"))?;

                let tags: Vec<worldflow_core::models::EntryTag> =
                    serde_json::from_value(tags_json.clone())
                        .map_err(|e| anyhow::anyhow!("tags 格式错误: {}", e))?;

                let app_state_guard = app_state.lock().await;
                let entry = tools::update_entry_tags(&*app_state_guard, entry_id, tags)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                Ok(format::format_entry(&entry))
            })
        },
    );

    // ⑫ web_search - 搜索引擎搜索
    registry.register_async::<WorldflowToolState, _>(
        "web_search",
        "使用搜索引擎搜索网络信息，返回结果列表（标题、URL、摘要）供选择后续访问",
        vec![
            ToolFunctionArg::new("query", "string")
                .required(true)
                .desc("搜索关键词"),
            ToolFunctionArg::new("limit", "integer")
                .desc("返回结果数量，默认8")
                .min(1)
                .max(20)
                .default(8),
        ],
        |_state, args| {
            let http_client = _state.http_client.clone();
            let search_engine = _state.search_engine.clone();
            Box::pin(async move {
                let query = arg_str(args, "query")?;
                let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(8) as usize;
                let engine = search_engine.lock().await.clone();

                let results = do_web_search(&http_client, &engine, query, limit)
                    .await
                    .map_err(|e| anyhow::anyhow!("{}", e))?;

                if results.is_empty() {
                    return Ok("未找到相关结果".to_string());
                }

                let output = results
                    .iter()
                    .enumerate()
                    .map(|(i, r)| {
                        format!(
                            "{}. {}\n   URL: {}\n   {}",
                            i + 1,
                            r.title,
                            r.url,
                            r.snippet
                        )
                    })
                    .collect::<Vec<_>>()
                    .join("\n\n");

                Ok(output)
            })
        },
    );

    // ⑬ open_url - 获取网页内容
    registry.register_async::<WorldflowToolState, _>(
        "open_url",
        "获取指定URL的网页原始内容",
        vec![
            ToolFunctionArg::new("url", "string")
                .required(true)
                .desc("要访问的URL"),
        ],
        |_state, args| {
            let http_client = _state.http_client.clone();
            Box::pin(async move {
                let url = arg_str(args, "url")?;

                let response = http_client
                    .get(url)
                    .send()
                    .await
                    .map_err(|e| anyhow::anyhow!("请求失败: {}", e))?;

                let status = response.status();
                let text = response
                    .text()
                    .await
                    .map_err(|e| anyhow::anyhow!("读取响应失败: {}", e))?;

                const MAX_LEN: usize = 20000;
                let body = if text.len() > MAX_LEN {
                    format!("{}...(内容过长已截断)", &text[..MAX_LEN])
                } else {
                    text
                };

                Ok(format!("HTTP {}\n\n{}", status, body))
            })
        },
    );

    Ok(())
}

// ── 搜索辅助 ──────────────────────────────────────────────────────────────────

struct SearchResult {
    title: String,
    url: String,
    snippet: String,
}

async fn do_web_search(
    client: &reqwest::Client,
    engine: &str,
    query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    let encoded = urlencoding::encode(query);
    match engine {
        "baidu" => search_baidu(client, &encoded, limit).await,
        "duckduckgo" => search_duckduckgo(client, &encoded, limit).await,
        _ => search_bing(client, &encoded, limit).await,
    }
}

async fn search_bing(
    client: &reqwest::Client,
    encoded_query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    let url = format!(
        "https://www.bing.com/search?q={}&setlang=zh-hans",
        encoded_query
    );
    let html = client.get(&url).send().await?.text().await?;

    let document = Html::parse_document(&html);
    let item_sel = Selector::parse("li.b_algo").unwrap();
    let title_sel = Selector::parse("h2 a").unwrap();
    let snippet_sel = Selector::parse(".b_caption p").unwrap();

    let mut results = Vec::new();
    for item in document.select(&item_sel).take(limit) {
        let Some(title_el) = item.select(&title_sel).next() else {
            continue;
        };
        let title = title_el.text().collect::<String>().trim().to_string();
        let url = title_el.attr("href").unwrap_or("").to_string();
        if url.is_empty() {
            continue;
        }
        let snippet = item
            .select(&snippet_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        results.push(SearchResult {
            title,
            url,
            snippet,
        });
    }
    Ok(results)
}

async fn search_baidu(
    client: &reqwest::Client,
    encoded_query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    let url = format!(
        "https://www.baidu.com/s?wd={}&ie=utf-8&oe=utf-8",
        encoded_query
    );
    let html = client.get(&url).send().await?.text().await?;

    let document = Html::parse_document(&html);
    let item_sel = Selector::parse("div.result").unwrap();
    let title_sel = Selector::parse("h3 a").unwrap();
    let snippet_sel = Selector::parse(".c-abstract").unwrap();

    let mut results = Vec::new();
    for item in document.select(&item_sel).take(limit) {
        let Some(title_el) = item.select(&title_sel).next() else {
            continue;
        };
        let title = title_el.text().collect::<String>().trim().to_string();
        // Baidu 链接是跳转链接，open_url 时 reqwest 会自动跟随重定向
        let url = title_el.attr("href").unwrap_or("").to_string();
        if url.is_empty() {
            continue;
        }
        let snippet = item
            .select(&snippet_sel)
            .next()
            .map(|e| e.text().collect::<String>().trim().to_string())
            .unwrap_or_default();
        results.push(SearchResult {
            title,
            url,
            snippet,
        });
    }
    Ok(results)
}

async fn search_duckduckgo(
    client: &reqwest::Client,
    encoded_query: &str,
    limit: usize,
) -> Result<Vec<SearchResult>> {
    let url = format!("https://html.duckduckgo.com/html/?q={}", encoded_query);
    let html = client.get(&url).send().await?.text().await?;

    let document = Html::parse_document(&html);
    let title_sel = Selector::parse("a.result__a").unwrap();
    let snippet_sel = Selector::parse(".result__snippet").unwrap();

    let titles: Vec<_> = document.select(&title_sel).take(limit).collect();
    let snippets: Vec<_> = document.select(&snippet_sel).take(limit).collect();

    let mut results = Vec::new();
    for (title_el, snippet_el) in titles.iter().zip(snippets.iter()) {
        let title = title_el.text().collect::<String>().trim().to_string();
        // DDG href 格式：//duckduckgo.com/l/?uddg=<encoded_url>&...
        let raw_href = title_el.attr("href").unwrap_or("");
        let url = extract_uddg_url(raw_href).unwrap_or_else(|| raw_href.to_string());
        let snippet = snippet_el.text().collect::<String>().trim().to_string();
        results.push(SearchResult {
            title,
            url,
            snippet,
        });
    }
    Ok(results)
}

/// 从 DDG 跳转链接中解析真实 URL
/// href 格式：//duckduckgo.com/l/?uddg=<encoded_url>&...
fn extract_uddg_url(href: &str) -> Option<String> {
    let query = href.split('?').nth(1)?;
    for pair in query.split('&') {
        if let Some(encoded) = pair.strip_prefix("uddg=") {
            return urlencoding::decode(encoded).ok().map(|s| s.into_owned());
        }
    }
    None
}
