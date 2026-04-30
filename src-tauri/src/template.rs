use anyhow::Result;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, OnceLock};
use tera::{Context as TeraContext, Tera};

static TEMPLATE_ENGINE: OnceLock<Arc<TemplateEngine>> = OnceLock::new();

pub struct TemplateEngine {
    tera: Tera,
}

impl TemplateEngine {
    pub fn new(template_dir: &Path) -> Result<Self> {
        let mut tera = Tera::default();
        tera.autoescape_on(Vec::new());

        let mut template_files = Vec::new();
        collect_template_files(template_dir, &mut template_files)?;
        template_files.sort();

        for file_path in template_files {
            let source = fs::read_to_string(&file_path)?;
            let relative = file_path
                .strip_prefix(template_dir)
                .map_err(|e| anyhow::anyhow!("模板路径解析失败: {}", e))?;
            let relative = relative.to_string_lossy().replace('\\', "/");
            let name = relative.strip_suffix(".tera").unwrap_or(&relative);
            tera.add_raw_template(name, &source)?;
        }

        Ok(Self { tera })
    }

    pub fn render(&self, name: &str, ctx: &impl Serialize) -> Result<String> {
        let tera_ctx = TeraContext::from_serialize(ctx)?;
        self.render_with_tera_ctx(name, &tera_ctx)
    }

    pub fn render_with_tera_ctx(&self, name: &str, ctx: &TeraContext) -> Result<String> {
        Ok(self.tera.render(name, ctx)?)
    }
}

pub fn install_global_template_engine(engine: Arc<TemplateEngine>) -> Result<()> {
    TEMPLATE_ENGINE
        .set(engine)
        .map_err(|_| anyhow::anyhow!("模板引擎已初始化"))?;
    Ok(())
}

pub fn global_template_engine() -> Option<&'static TemplateEngine> {
    TEMPLATE_ENGINE.get().map(|engine| engine.as_ref())
}

pub fn render_global_template(name: &str, ctx: &impl Serialize) -> Option<String> {
    let engine = global_template_engine()?;
    match engine.render(name, ctx) {
        Ok(rendered) => Some(rendered),
        Err(error) => {
            log::warn!("模板渲染失败 {}: {}", name, error);
            None
        }
    }
}

fn collect_template_files(dir: &Path, output: &mut Vec<PathBuf>) -> Result<()> {
    for entry in fs::read_dir(dir)? {
        let entry = entry?;
        let path = entry.path();
        if path.is_dir() {
            collect_template_files(&path, output)?;
            continue;
        }
        if path.extension().and_then(|ext| ext.to_str()) == Some("tera") {
            output.push(path);
        }
    }
    Ok(())
}
