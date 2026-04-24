; ── 流云AI NSIS 自定义卸载钩子 ────────────────────────────────────────────────
;
; 个人数据目录：%APPDATA%\cn.flowcloudai.www
;   包含：settings.json（用户配置）、app.log（运行日志）
;
; 在卸载过程完成后询问用户是否删除该目录。
; 程序数据（数据库、插件）位于安装目录，由 NSIS 主卸载流程自动清理。
; ─────────────────────────────────────────────────────────────────────────────

!macro customUnInstall
  ; 询问是否清除个人数据
  MessageBox MB_YESNO|MB_ICONQUESTION \
    "是否同时清除流云AI的个人数据？$\n$\n将删除以下内容：$\n  · 应用程序设置（settings.json）$\n  · 运行日志（app.log）$\n$\n目录：$APPDATA\cn.flowcloudai.www$\n$\n此操作不可撤销，您的项目数据库不受影响。" \
    IDNO +2
  RMDir /r "$APPDATA\cn.flowcloudai.www"
!macroend
