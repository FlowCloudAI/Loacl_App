import React, {useCallback, useEffect, useLayoutEffect, useRef, useState} from 'react'
import {MessageBox, RollingBox, Select, useAlert} from 'flowcloudai-ui'
import {useAiContext} from '../contexts/useAiContext'
import './AI.css'

// ── 常量 ─────────────────────────────────────────────────────

const MAX_CHARS = 4000
const SHOW_HINT_THRESHOLD = 3500

// ── 组件 ─────────────────────────────────────────────────────

interface AIChatProps {
    viewMode?: 'fullscreen' | 'sidebar'
}

export default function AIChat({viewMode = 'fullscreen'}: AIChatProps) {
    const ctx = useAiContext()
    const isSidebarMode = viewMode === 'sidebar'

    // ── 侧边栏模式：宽度与拖拽 ─────────────────────────────────
    const [panelWidth, setPanelWidth] = useState(380)
    const isDraggingRef = useRef(false)
    const dragStartXRef = useRef(0)
    const dragStartWidthRef = useRef(0)
    const MIN_PANEL_WIDTH = 340

    const handleResizeStart = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        isDraggingRef.current = true
        dragStartXRef.current = e.clientX
        dragStartWidthRef.current = panelWidth
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }, [panelWidth])

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDraggingRef.current) return
            const delta = dragStartXRef.current - e.clientX
            const newWidth = Math.max(
                MIN_PANEL_WIDTH,
                Math.min(window.innerWidth * 0.5, dragStartWidthRef.current + delta)
            )
            setPanelWidth(newWidth)
        }
        const handleMouseUp = () => {
            if (!isDraggingRef.current) return
            isDraggingRef.current = false
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }
        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [])

    // ── 本地 UI 状态 ──────────────────────────────────────────
    const [autoScroll, setAutoScroll] = useState(true)
    const textareaRef = useRef<HTMLTextAreaElement>(null)
    const messagesContainerRef = useRef<HTMLDivElement>(null)
    const lastScrollTopRef = useRef(0)
    const {showAlert} = useAlert()

    const charCount = ctx.inputValue.length
    const showCharHint = charCount >= SHOW_HINT_THRESHOLD
    const selectedPluginInfo = ctx.plugins.find(p => p.id === ctx.selectedPlugin)

    // ── 自动滚动到底部 ────────────────────────────────────────
    useEffect(() => {
        if (!autoScroll) return
        requestAnimationFrame(() => {
            const container = messagesContainerRef.current
            if (!container) return
            const roll = container.querySelector('.fc-roll') as HTMLElement | null
            const scrollContainer = roll || container
            scrollContainer.scrollTop = scrollContainer.scrollHeight
        })
    }, [ctx.messages.length, ctx.streamingBlocks, autoScroll])

    const handleMessagesScroll = useCallback(() => {
        const container = messagesContainerRef.current
        if (!container) return
        const roll = container.querySelector('.fc-roll') as HTMLElement | null
        const scrollContainer = roll || container
        const {scrollTop, scrollHeight, clientHeight} = scrollContainer
        if (scrollTop < lastScrollTopRef.current && scrollHeight - scrollTop - clientHeight > 50) {
            setAutoScroll(false)
        }
        lastScrollTopRef.current = scrollTop
    }, [])

    const scrollToBottom = useCallback(() => {
        setAutoScroll(true)
        requestAnimationFrame(() => {
            const container = messagesContainerRef.current
            if (!container) return
            const roll = container.querySelector('.fc-roll') as HTMLElement | null
            const scrollContainer = roll || container
            scrollContainer.scrollTop = scrollContainer.scrollHeight
        })
    }, [])

    // ── 输入框自动高度 ────────────────────────────────────────
    useLayoutEffect(() => {
        const ta = textareaRef.current
        if (!ta) return
        requestAnimationFrame(() => {
            const scrollTop = ta.scrollTop
            ta.style.height = 'auto'
            const newHeight = Math.min(Math.max(ta.scrollHeight, 60), 200)
            ta.style.height = newHeight + 'px'
            ta.scrollTop = scrollTop
        })
    }, [ctx.inputValue])

    // ── 键盘 / 输入 ───────────────────────────────────────────
    const handleKeyDown = useCallback(
        (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
                e.preventDefault()
                if (!ctx.inputValue.trim() || ctx.isStreaming || !ctx.activeConversationId) {
                    if (!ctx.activeConversationId) {
                        void showAlert('请先创建新对话', 'warning', 'toast', 2000)
                    }
                    return
                }
                void ctx.sendMessage(ctx.inputValue)
            }
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [ctx.inputValue, ctx.isStreaming, ctx.activeConversationId, ctx.sendMessage, showAlert],
    )

    const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (e.target.value.length <= MAX_CHARS) ctx.setInputValue(e.target.value)
    }

    // ── 渲染内容 ──────────────────────────────────────────────
    const sidebarContent = (
        <aside className="ai-sidebar">
            <div className="ai-sidebar-header">
                <button className="ai-new-chat-btn" onClick={() => void ctx.createNewConversation()}>
                    <span className="ai-new-chat-icon">+</span>
                    <span className="ai-new-chat-text">新对话</span>
                </button>
                <button
                    className="ai-sidebar-toggle"
                    onClick={() => ctx.setSidebarCollapsed(prev => !prev)}
                    title={ctx.sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
                >
                    <span className="ai-toggle-icon">
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
                            {ctx.sidebarCollapsed ? (
                                <path d="M6 3L11 8L6 13" />
                            ) : (
                                <path d="M10 3L5 8L10 13" />
                            )}
                        </svg>
                    </span>
                </button>
            </div>
            <div className="ai-conversations-list">
                {ctx.conversations.length === 0 && (
                    <div className="ai-empty-history"><p>暂无历史对话</p></div>
                )}
                {ctx.conversations.map(conv => (
                    <div
                        key={conv.id}
                        className={`ai-conversation-item ${conv.id === ctx.activeConversationId ? 'active' : ''}`}
                        onClick={() => void ctx.switchConversation(conv.id)}
                    >
                        <div className="ai-conversation-info">
                            <div className="ai-conversation-title" title={conv.title}>{conv.title}</div>
                        </div>
                        <button
                            className="ai-conversation-delete"
                            onClick={e => void ctx.deleteConversation(conv.id, e)}
                        >
                            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                                <path d="M2 3.5h10M4.5 3.5V2a1 1 0 011-1h3a1 1 0 011 1v1.5m-7 0v8a1.5 1.5 0 001.5 1.5h5a1.5 1.5 0 001.5-1.5v-8M5.5 6v4M8.5 6v4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                        </button>
                    </div>
                ))}
            </div>
        </aside>
    )

    const chatContent = (
        <>
            {!isSidebarMode && sidebarContent}
            <main className="ai-main">
                <div className="ai-config-panel">
                    <div className="ai-config-body">
                        <div className="ai-config-field">
                            <label className="ai-config-label">插件</label>
                            <Select
                                className="ai-config-select"
                                value={ctx.selectedPlugin}
                                onChange={v => ctx.setSelectedPlugin(String(v))}
                                placeholder="选择插件"
                                options={ctx.plugins.map(p => ({ value: p.id, label: p.name }))}
                            />
                        </div>
                        {selectedPluginInfo && (
                            <div className="ai-config-field">
                                <label className="ai-config-label">模型</label>
                                <Select
                                    className="ai-config-select"
                                    value={ctx.selectedModel}
                                    onChange={v => ctx.setSelectedModel(String(v))}
                                    placeholder="选择模型"
                                    options={selectedPluginInfo.models.map(m => ({ value: m, label: m }))}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <RollingBox
                    className="ai-messages-container"
                    ref={messagesContainerRef}
                    onScroll={handleMessagesScroll}
                    thumbSize={'thin'}
                >
                    {!ctx.activeConversationId && (
                        <div className="ai-empty-state">
                            <div className="ai-empty-icon">
                                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/>
                                </svg>
                            </div>
                            <p className="ai-empty-text">开始新的对话</p>
                            <p className="ai-empty-hint">点击左侧「新对话」按钮开始聊天</p>
                        </div>
                    )}
                    {ctx.activeConversationId && ctx.messages.length > 0 && (
                        <div className="ai-messages-list">
                            {ctx.messages.map((message) => (
                                <MessageBox
                                    key={message.id}
                                    role={message.role}
                                    blocks={message.blocks}
                                    content={message.content}
                                    toolCallDetail={'verbose'}
                                    markdown={message.role === 'assistant'}
                                    reasoning={message.reasoning || undefined}
                                    onCopy={() => navigator.clipboard.writeText(message.content)}
                                    onEdit={message.role === 'user'
                                        ? () => ctx.editMessage(message.id)
                                        : undefined}
                                    onRegenerate={message.role === 'assistant'
                                        ? () => void ctx.regenerateMessage(message.id)
                                        : undefined}
                                />
                            ))}
                            {ctx.streamingBlocks.length > 0 && ctx.isStreaming && (
                                <MessageBox
                                    role="assistant"
                                    blocks={ctx.streamingBlocks}
                                    streaming
                                    markdown
                                    toolCallDetail={'verbose'}
                                />
                            )}
                        </div>
                    )}
                    {ctx.activeConversationId && ctx.messages.length > 0 && !autoScroll && (
                        <div className="ai-scroll-to-bottom-sticky">
                            <button className="ai-scroll-to-bottom-btn" onClick={scrollToBottom} title="滚动到底部">
                                <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8">
                                    <path d="M3 6l5 5 5-5"/>
                                </svg>
                            </button>
                        </div>
                    )}
                </RollingBox>

                {/* 编辑模式指示条 */}
                {ctx.editingMessageId && (
                    <div className="ai-edit-indicator ai-edit-indicator--full">
                        <span>编辑模式</span>
                        <button onClick={() => {
                            ctx.setEditingMessageId(null)
                            ctx.setInputValue('')
                        }}>取消</button>
                    </div>
                )}

                {/* 悬浮输入框 */}
                <div className="ai-floating-input-wrapper ai-floating-input-wrapper--full">
                    <div className="ai-floating-input-inner">
                        <textarea
                            ref={textareaRef}
                            className="ai-floating-textarea"
                            value={ctx.inputValue}
                            onChange={handleInputChange}
                            onKeyDown={handleKeyDown}
                            placeholder={ctx.activeConversationId ? '请输入消息...' : '请先创建新对话'}
                            disabled={ctx.isStreaming || !ctx.activeConversationId}
                        />
                        <div className="ai-floating-footer">
                            <div className="ai-floating-toolbar">
                                <button
                                    className={`ai-toolbar-btn ${ctx.sessionParams.thinking ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); ctx.setSessionParams(prev => ({...prev, thinking: !prev.thinking})); }}
                                    title="深度思考"
                                >
                                    深度思考
                                </button>
                                <button
                                    className={`ai-toolbar-btn ${ctx.webSearchEnabled ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); void ctx.toggleWebSearch(); }}
                                    title="联网搜索"
                                >
                                    联网搜索
                                </button>
                                <button
                                    className={`ai-toolbar-btn ${ctx.editModeEnabled ? 'active' : ''}`}
                                    onClick={(e) => { e.stopPropagation(); void ctx.toggleEditMode(); }}
                                    title={ctx.editModeEnabled ? '编辑模式' : '阅读模式'}
                                >
                                    {ctx.editModeEnabled ? '编辑模式' : '阅读模式'}
                                </button>
                            </div>
                            <div className="ai-floating-actions">
                                {showCharHint && (
                                    <span className="ai-floating-char-count">{charCount}/{MAX_CHARS}</span>
                                )}
                                {ctx.isStreaming ? (
                                    <button
                                        className="ai-floating-stop-btn"
                                        onClick={(e) => { e.stopPropagation(); ctx.stopStreaming(); }}
                                        title="停止生成"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                                            <rect x="6" y="6" width="12" height="12" />
                                        </svg>
                                    </button>
                                ) : (
                                    <button
                                        className="ai-floating-send-btn"
                                        onClick={(e) => {
                                            e.stopPropagation()
                                            if (!ctx.inputValue.trim() || !ctx.activeConversationId) return
                                            void ctx.sendMessage(ctx.inputValue)
                                        }}
                                        disabled={!ctx.inputValue.trim() || !ctx.activeConversationId}
                                        title="发送"
                                    >
                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/>
                                        </svg>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </>
    )

    // 全屏模式
    if (!isSidebarMode) {
        return (
            <div className={`ai-chat-layout ${ctx.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                {chatContent}
            </div>
        )
    }

    // 侧边栏模式
    return (
        <div className="ai-sidebar-panel" style={{width: panelWidth}}>
            <div
                className="ai-sidebar-resize-handle"
                onMouseDown={handleResizeStart}
                title="拖拽调整宽度"
            />
            <div className="ai-sidebar-panel-inner">
                {chatContent}
            </div>
        </div>
    )
}
