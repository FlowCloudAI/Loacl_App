import {useCallback, useEffect, useRef, useState} from 'react'
import {listen} from '@tauri-apps/api/event'
import {type MessageBoxBlock, type ToolCallInfo} from 'flowcloudai-ui'
import {
    ai_cancel_session,
    ai_checkout,
    ai_close_session,
    ai_create_character_session,
    ai_create_llm_session,
    ai_get_conversation_tree,
    ai_send_message,
    ai_switch_plugin,
    ai_update_session,
    type AiEventBranchChanged,
    type AiEventDelta,
    type AiEventError,
    type AiEventReady,
    type AiEventReasoning,
    type AiEventToolCall,
    type AiEventToolResult,
    type AiEventTurnBegin,
    type AiEventTurnEnd,
    type CharacterChatProjectSnapshot,
    type ConversationNode,
} from '../../../api'

// ── 导出类型 ──────────────────────────────────────────────────

export interface SessionMessage {
    id: string
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    reasoning?: string
    blocks?: MessageBoxBlock[]
    /** 产生此消息的 session ID，用于跨对话路由 */
    sessionId: string
    /** 产生此消息的运行实例 ID，用于隔离同 session 的新旧轮次 */
    runId: string
    /** TurnEnd 事件携带的助手消息节点 ID，用于 checkout / 重说 */
    nodeId?: number
}

export interface SessionIdentity {
    sessionId: string
    conversationId: string
    runId: string
}

// ── 钩子 ─────────────────────────────────────────────────────

interface UseAiSessionOptions {
    /** 一轮对话完成时调用（助手消息已完整） */
    onMessage: (msg: SessionMessage) => void
    /** 会话级错误时调用 */
    onError: (msg: string) => void
}

export function useAiSession({onMessage, onError}: UseAiSessionOptions) {
    const [sessionId, setSessionId] = useState<string | null>(null)
    const [runId, setRunId] = useState<string | null>(null)
    const [isStreaming, setIsStreaming] = useState(false)
    const [blocks, setBlocks] = useState<MessageBoxBlock[]>([])
    const [lastUserNodeId, setLastUserNodeId] = useState<number | null>(null)

    // 内部缓冲
    const messageQueueRef = useRef<SessionMessage[]>([])

    // 每个用户轮次（非工具续轮）的起始节点 ID
    // 用于 regenerate：checkout 到此节点后后端免等直接重跑
    const lastUserNodeIdRef = useRef<number | null>(null)
    const blocksByRunRef = useRef<Record<string, MessageBoxBlock[]>>({})
    const processingNodeIdByRunRef = useRef<Record<string, number | null>>({})
    const sessionIdRef = useRef<string | null>(null)
    const runIdRef = useRef<string | null>(null)
    // 标记下一个 TurnBegin 是用户发起的（非工具续轮）
    const expectUserTurnRef = useRef(false)

    // 分支导航
    const [treeNodes, setTreeNodes] = useState<ConversationNode[]>([])
    const [treeRefreshCounter, setTreeRefreshCounter] = useState(0)
    const [branchSwitchVersion, setBranchSwitchVersion] = useState(0)
    const branchInfoRef = useRef<Map<number, {branchIndex: number; branchTotal: number; siblings: number[]}>>(new Map())

    // 通过 ref 访问回调，避免 event listener 内部 stale closure
    const onMessageRef = useRef(onMessage)
    const onErrorRef = useRef(onError)
    useEffect(() => {
        onMessageRef.current = onMessage
    }, [onMessage])
    useEffect(() => {
        onErrorRef.current = onError
    }, [onError])
    useEffect(() => {
        sessionIdRef.current = sessionId
    }, [sessionId])
    useEffect(() => {
        runIdRef.current = runId
    }, [runId])

    useEffect(() => {
        queueMicrotask(() => {
            setBlocks(runId ? (blocksByRunRef.current[runId] ?? []) : [])
            if (!runId) {
                setLastUserNodeId(null)
            }
        })
    }, [runId])

    // ── 事件监听（仅注册一次） ────────────────────────────────
    useEffect(() => {
        const unlistenReady = listen<AiEventReady>('ai:ready', event => {
            console.log('[useAiSession][ready]', {
                sessionId: event.payload.session_id,
                runId: event.payload.run_id,
            })
        })

        // 只记录用户发起轮次的起始节点（工具续轮不更新）
        const unlistenTurnBegin = listen<AiEventTurnBegin>('ai:turn_begin', event => {
            console.log('[useAiSession][turn_begin]', {
                sessionId: event.payload.session_id,
                runId: event.payload.run_id,
                turnId: event.payload.turn_id,
                nodeId: event.payload.node_id,
                currentSessionId: sessionIdRef.current,
                currentRunId: runIdRef.current,
                expectUserTurn: expectUserTurnRef.current,
            })
            if (expectUserTurnRef.current && event.payload.run_id === runIdRef.current) {
                lastUserNodeIdRef.current = event.payload.node_id
                setLastUserNodeId(event.payload.node_id)
                expectUserTurnRef.current = false
            }
            processingNodeIdByRunRef.current[event.payload.run_id] = event.payload.node_id
        })

        const unlistenDelta = listen<AiEventDelta>('ai:delta', event => {
            console.log('[useAiSession][delta]', {
                runId: event.payload.run_id,
                textLen: event.payload.text.length,
                text: event.payload.text,
            })
            const runKey = event.payload.run_id
            const prev = blocksByRunRef.current[runKey] ?? []
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.type === 'content') {
                next[next.length - 1] = {...last, content: last.content + event.payload.text}
            } else {
                next.push({type: 'content', content: event.payload.text, markdown: true, streaming: true})
            }
            blocksByRunRef.current[runKey] = next
            if (runIdRef.current === runKey) {
                setBlocks(next)
            }
        })

        const unlistenReasoning = listen<AiEventReasoning>('ai:reasoning', event => {
            console.log('[useAiSession][reasoning]', {
                runId: event.payload.run_id,
                textLen: event.payload.text.length,
                text: event.payload.text,
            })
            const runKey = event.payload.run_id
            const prev = blocksByRunRef.current[runKey] ?? []
            const next = [...prev]
            const last = next[next.length - 1]
            if (last && last.type === 'reasoning') {
                next[next.length - 1] = {...last, content: last.content + event.payload.text}
            } else {
                next.push({type: 'reasoning', content: event.payload.text, streaming: true})
            }
            blocksByRunRef.current[runKey] = next
            if (runIdRef.current === runKey) {
                setBlocks(next)
            }
        })

        const unlistenToolCall = listen<AiEventToolCall>('ai:tool_call', event => {
            console.log('[useAiSession][tool_call]', {
                runId: event.payload.run_id,
                index: event.payload.index,
                name: event.payload.name,
                args: event.payload.arguments,
            })
            const runKey = event.payload.run_id
            const prev = blocksByRunRef.current[runKey] ?? []

            // 按 index 去重：相同 tool_call 事件到达已有块
            const existingToolIdx = prev.findIndex(
                block => block.type === 'tool'
                    && block.tool.index === event.payload.index
                    && block.tool.result == null,
            )
            if (existingToolIdx !== -1) {
                const next = prev.map((block, index) => {
                    if (index !== existingToolIdx || block.type !== 'tool') return block
                    return {
                        ...block,
                        tool: {
                            ...block.tool,
                            name: event.payload.name,
                            args: event.payload.arguments || block.tool.args,
                        },
                    }
                })
                blocksByRunRef.current[runKey] = next
                if (runIdRef.current === runKey) setBlocks(next)
                return
            }

            // 在 tool_use 组内按 index 去重
            const existingToolUseIdx = prev.findIndex(
                block => block.type === 'tool_use'
                    && block.tools.some(t => t.index === event.payload.index && t.result == null),
            )
            if (existingToolUseIdx !== -1) {
                const next = prev.map((block, index) => {
                    if (index !== existingToolUseIdx || block.type !== 'tool_use') return block
                    return {
                        ...block,
                        tools: block.tools.map(t => {
                            if (t.index !== event.payload.index || t.result != null) return t
                            return {...t, name: event.payload.name, args: event.payload.arguments || t.args}
                        }),
                    }
                })
                blocksByRunRef.current[runKey] = next
                if (runIdRef.current === runKey) setBlocks(next)
                return
            }

            // 分组：合并连续的同名 tool 调用
            const newTool: ToolCallInfo = {
                index: event.payload.index,
                name: event.payload.name,
                args: event.payload.arguments,
            }
            const last = prev[prev.length - 1]
            let next: MessageBoxBlock[]

            if (last && last.type === 'tool_use'
                && last.tools.length > 0
                && last.tools[0].name === event.payload.name
                && last.tools.some(t => t.result == null)) {
                // 追加到已有 tool_use 组
                next = [...prev.slice(0, -1), {...last, tools: [...last.tools, newTool]}]
            } else if (last && last.type === 'tool'
                && last.tool.name === event.payload.name
                && last.tool.result == null) {
                // 将最后一个独立 tool 与新 tool 合并为 tool_use 组
                next = [...prev.slice(0, -1), {
                    type: 'tool_use' as const,
                    tools: [last.tool, newTool],
                    detail: 'verbose' as const,
                }]
            } else {
                next = [...prev, {type: 'tool', tool: newTool, detail: 'verbose'}]
            }

            blocksByRunRef.current[runKey] = next
            if (runIdRef.current === runKey) setBlocks(next)
        })

        const unlistenToolResult = listen<AiEventToolResult>('ai:tool_result', event => {
            console.log('[useAiSession][tool_result]', {
                runId: event.payload.run_id,
                index: event.payload.index,
                isError: event.payload.is_error,
                resultLen: (event.payload.result ?? event.payload.output)?.length ?? 0,
                result: event.payload.result ?? event.payload.output,
            })
            const runKey = event.payload.run_id
            const prev = blocksByRunRef.current[runKey] ?? []
            const next = prev.map(b => {
                // 独立 tool 块
                if (b.type === 'tool' && b.tool.index === event.payload.index && b.tool.result == null) {
                    return {
                        ...b,
                        tool: {
                            ...b.tool,
                            result: event.payload.result ?? event.payload.output,
                            isError: event.payload.is_error,
                        },
                    }
                }
                // tool_use 组内的 tool
                if (b.type === 'tool_use') {
                    const updated = b.tools.map(t => {
                        if (t.index === event.payload.index && t.result == null) {
                            return {
                                ...t,
                                result: event.payload.result ?? event.payload.output,
                                isError: event.payload.is_error,
                            }
                        }
                        return t
                    })
                    if (updated !== b.tools) return {...b, tools: updated}
                }
                return b
            })
            blocksByRunRef.current[runKey] = next
            if (runIdRef.current === runKey) {
                setBlocks(next)
            }
        })

        const unlistenTurnEnd = listen<AiEventTurnEnd>('ai:turn_end', event => {
            const {session_id: sid, run_id: rid, status, node_id} = event.payload
            console.log('[useAiSession][turn_end]', {
                sessionId: sid,
                runId: rid,
                status,
                nodeId: node_id,
                currentSessionId: sessionIdRef.current,
                currentRunId: runIdRef.current,
                processingNodeId: processingNodeIdByRunRef.current[rid] ?? null,
            })
            if (status === 'ok') {
                processingNodeIdByRunRef.current[rid] = null

                const prev = blocksByRunRef.current[rid] ?? []
                const finalBlocks = prev.map(b => {
                    if (b.type === 'reasoning' || b.type === 'content') {
                        return {...b, streaming: false}
                    }
                    return b
                })
                blocksByRunRef.current[rid] = finalBlocks
                const contentText = finalBlocks
                    .filter(b => b.type === 'content')
                    .map(b => (b as { content: string }).content)
                    .join('')
                const reasoningText = finalBlocks
                    .filter(b => b.type === 'reasoning')
                    .map(b => (b as { content: string }).content)
                    .join('')
                if (contentText || reasoningText || finalBlocks.length > 0) {
                    console.log('[useAiSession][queueAssistant]', {
                        sessionId: sid,
                        runId: rid,
                        contentLength: contentText.length,
                        reasoningLength: reasoningText.length,
                        blockCount: finalBlocks.length,
                    })
                    messageQueueRef.current.push({
                        id: `a_${Date.now()}`,
                        role: 'assistant',
                        content: contentText,
                        timestamp: Date.now(),
                        reasoning: reasoningText || undefined,
                        blocks: finalBlocks,
                        sessionId: sid,
                        runId: rid,
                        nodeId: node_id,
                    })
                }

                queueMicrotask(() => {
                    const queued = [...messageQueueRef.current]
                    console.log('[useAiSession][flushQueue]', {
                        currentRunId: runIdRef.current,
                        queued: queued.map(item => ({
                            sessionId: item.sessionId,
                            runId: item.runId,
                            nodeId: item.nodeId ?? null,
                            contentLength: item.content.length,
                        })),
                    })
                    messageQueueRef.current = []
                    queued.forEach(m => onMessageRef.current(m))
                    delete blocksByRunRef.current[rid]
                    if (runIdRef.current === rid) {
                        setBlocks([])
                        setIsStreaming(false)
                        setTreeRefreshCounter(c => c + 1)
                    }
                })
            } else if (status.startsWith('error:')) {
                processingNodeIdByRunRef.current[rid] = null
                onErrorRef.current(`对话失败: ${status.slice(6)}`)
                queueMicrotask(() => {
                    delete blocksByRunRef.current[rid]
                    if (runIdRef.current === rid) {
                        setBlocks([])
                        setIsStreaming(false)
                    }
                })
            } else if (status === 'cancelled' || status === 'interrupted') {
                processingNodeIdByRunRef.current[rid] = null
                const prev = blocksByRunRef.current[rid] ?? []
                if (prev.length > 0) {
                    // 保留已生成的部分内容，标记为非流式并提交给上层
                    const finalBlocks = prev.map(b => {
                        if (b.type === 'reasoning' || b.type === 'content') {
                            return {...b, streaming: false}
                        }
                        return b
                    })
                    blocksByRunRef.current[rid] = finalBlocks
                    const contentText = finalBlocks
                        .filter(b => b.type === 'content')
                        .map(b => (b as { content: string }).content)
                        .join('')
                    const reasoningText = finalBlocks
                        .filter(b => b.type === 'reasoning')
                        .map(b => (b as { content: string }).content)
                        .join('')
                    messageQueueRef.current.push({
                        id: `a_${Date.now()}`,
                        role: 'assistant',
                        content: contentText,
                        timestamp: Date.now(),
                        reasoning: reasoningText || undefined,
                        blocks: finalBlocks,
                        sessionId: sid,
                        runId: rid,
                        // 取消的轮次没有有效的 checkpoint 节点，不设 nodeId
                    })
                }
                queueMicrotask(() => {
                    const queued = [...messageQueueRef.current]
                    messageQueueRef.current = []
                    queued.forEach(m => onMessageRef.current(m))
                    delete blocksByRunRef.current[rid]
                    if (runIdRef.current === rid) {
                        setBlocks([])
                        setIsStreaming(false)
                    }
                })
            }
        })

        const unlistenError = listen<AiEventError>('ai:error', event => {
            console.error('[useAiSession] ai:error event', {
                payload: event.payload,
                currentSessionId: sessionIdRef.current,
                currentRunId: runIdRef.current,
            })
            onErrorRef.current(`AI 错误: ${event.payload.error}`)
            queueMicrotask(() => {
                delete blocksByRunRef.current[event.payload.run_id]
                if (runIdRef.current === event.payload.run_id) {
                    setIsStreaming(false)
                    setBlocks([])
                }
            })
        })

        const unlistenBranchChanged = listen<AiEventBranchChanged>('ai:branch_changed', event => {
            if (event.payload.run_id === runIdRef.current) {
                setTreeRefreshCounter(c => c + 1)
            }
        })

        return () => {
            unlistenReady.then(fn => fn())
            unlistenTurnBegin.then(fn => fn())
            unlistenDelta.then(fn => fn())
            unlistenReasoning.then(fn => fn())
            unlistenToolCall.then(fn => fn())
            unlistenToolResult.then(fn => fn())
            unlistenTurnEnd.then(fn => fn())
            unlistenError.then(fn => fn())
            unlistenBranchChanged.then(fn => fn())
        }
    }, []) // 空依赖——回调通过 ref 访问

    // 分支树刷新
    const refreshTree = useCallback(async () => {
        const sid = sessionIdRef.current
        if (!sid) return
        try {
            const nodes = await ai_get_conversation_tree(sid)
            setTreeNodes(nodes)
        } catch {
            // 树数据不可用时静默降级（不显示分支 UI）
        }
    }, [])

    useEffect(() => {
        if (treeRefreshCounter > 0) {
            refreshTree()
        }
    }, [treeRefreshCounter, refreshTree])

    // ── 操作 ─────────────────────────────────────────────────

    const createSession = useCallback(async (
        pluginId: string,
        model: string,
        /** 复用已有对话时传入其 id，避免后端创建重复记录；不传则生成新 id */
        conversationId?: string,
        maxToolRounds?: number | null,
    ): Promise<SessionIdentity | null> => {
        const newId = `session_${Date.now()}`
        try {
            const created = await ai_create_llm_session({
                sessionId: newId,
                pluginId,
                model,
                maxToolRounds: maxToolRounds ?? null,
                // 续聊时告知后端回放历史，新对话不传
                conversationId: conversationId ?? null,
            })
            console.log('[useAiSession][createSession]', created)
            sessionIdRef.current = created.session_id
            runIdRef.current = created.run_id
            setSessionId(created.session_id)
            setRunId(created.run_id)
            lastUserNodeIdRef.current = null
            return {
                sessionId: created.session_id,
                conversationId: created.conversation_id,
                runId: created.run_id,
            }
        } catch (e) {
            onErrorRef.current(`创建会话失败: ${e}`)
            return null
        }
    }, [])

    const createCharacterSession = useCallback(async (
        pluginId: string,
        model: string,
        params: {
            characterName: string
            projectSnapshot: CharacterChatProjectSnapshot
            maxToolRounds?: number | null
        },
    ): Promise<SessionIdentity | null> => {
        const newId = `session_${Date.now()}`
        try {
            const created = await ai_create_character_session({
                sessionId: newId,
                pluginId,
                characterName: params.characterName,
                projectSnapshot: params.projectSnapshot,
                model,
                maxToolRounds: params.maxToolRounds ?? null,
            })
            sessionIdRef.current = created.session_id
            runIdRef.current = created.run_id
            setSessionId(created.session_id)
            setRunId(created.run_id)
            lastUserNodeIdRef.current = null
            return {
                sessionId: created.session_id,
                conversationId: created.conversation_id,
                runId: created.run_id,
            }
        } catch (e) {
            onErrorRef.current(`创建角色会话失败: ${e}`)
            return null
        }
    }, [])

    /** 关闭会话并重置流式状态。传入 sid 可关闭非当前会话（用于删除对话）。 */
    const closeSession = useCallback(async (overrideSid?: string | null) => {
        const target = overrideSid !== undefined ? overrideSid : sessionId
        if (target) {
            await ai_close_session(target).catch(console.error)
        }
        setSessionId(null)
        setRunId(null)
        lastUserNodeIdRef.current = null
        setBlocks([])
        setIsStreaming(false)
    }, [sessionId])

    const cancelSession = useCallback(async (overrideSid?: string | null) => {
        const target = overrideSid !== undefined ? overrideSid : sessionIdRef.current
        if (!target) return
        await ai_cancel_session(target).catch(console.error)
    }, [])

    const sendMessage = useCallback(async (content: string, sid: string) => {
        expectUserTurnRef.current = true
        setIsStreaming(true)
        setBlocks([])
        try {
            await ai_send_message(sid, content)
        } catch (e) {
            onErrorRef.current(`发送失败: ${e}`)
            setIsStreaming(false)
        }
    }, [])

    /**
     * Checkout 到指定节点（重说 / 分支 / 历史回退）。
     * - 目标节点 role 为 user → drive loop 立即继续，无需再发消息
     * - 目标节点 role 为 assistant → drive loop 继续等待用户输入
     * 返回 true 表示指令已发送。
     */
    const checkout = useCallback(async (nodeId: number): Promise<boolean> => {
        const sid = sessionIdRef.current
        if (!sid) return false
        try {
            await ai_checkout(sid, nodeId)
            expectUserTurnRef.current = true
            setIsStreaming(true)
            setBlocks([])
            return true
        } catch {
            return false
        }
    }, [])

    /**
     * 编辑模式专用 checkout：checkout 到 assistant 节点，让 session 等待新输入。
     * 不设 isStreaming=true，避免 UI 提前进入流式状态。
     */
    const checkoutForEdit = useCallback(async (nodeId: number): Promise<boolean> => {
        const sid = sessionIdRef.current
        if (!sid) return false
        try {
            await ai_checkout(sid, nodeId)
            expectUserTurnRef.current = true
            setBlocks([])
            return true
        } catch {
            return false
        }
    }, [])

    /** 切换插件（下一轮对话生效） */
    const switchPlugin = useCallback(async (pluginId: string) => {
        if (!sessionId) return
        await ai_switch_plugin(sessionId, pluginId).catch(console.error)
    }, [sessionId])

    /** 运行时更新模型（立即生效） */
    const updateModel = useCallback(async (model: string) => {
        if (!sessionId) return
        await ai_update_session(sessionId, {model}).catch(console.error)
    }, [sessionId])

    // ── 分支导航 ─────────────────────────────────────────────

    // 从 treeNodes 计算每个节点的 branchIndex/branchTotal
    useEffect(() => {
        if (treeNodes.length === 0) {
            branchInfoRef.current = new Map()
            return
        }
        const children = new Map<number, number[]>()
        for (const n of treeNodes) {
            if (n.parent !== null) {
                const list = children.get(n.parent) ?? []
                list.push(n.id)
                children.set(n.parent, list)
            }
        }
        const info = new Map<number, {branchIndex: number; branchTotal: number; siblings: number[]}>()
        for (const [, siblingList] of children) {
            if (siblingList.length > 1) {
                siblingList.forEach((nodeId, index) => {
                    info.set(nodeId, {
                        branchIndex: index + 1,
                        branchTotal: siblingList.length,
                        siblings: siblingList,
                    })
                })
            }
        }
        branchInfoRef.current = info
    }, [treeNodes])

    const getBranchInfo = useCallback((nodeId: number) => {
        const info = branchInfoRef.current.get(nodeId)
        return info ? {branchIndex: info.branchIndex, branchTotal: info.branchTotal} : null
    }, [])

    const switchBranch = useCallback(async (nodeId: number, direction: 'prev' | 'next'): Promise<boolean> => {
        const info = branchInfoRef.current.get(nodeId)
        if (!info) return false
        const currentIdx = info.branchIndex - 1
        const targetIdx = direction === 'prev' ? currentIdx - 1 : currentIdx + 1
        if (targetIdx < 0 || targetIdx >= info.siblings.length) return false
        const targetNodeId = info.siblings[targetIdx]
        const sid = sessionIdRef.current
        if (!sid) return false
        try {
            // 纯导航 checkout：只移动 head，不触发流式生成
            await ai_checkout(sid, targetNodeId)
            setBranchSwitchVersion(v => v + 1)
            return true
        } catch {
            return false
        }
    }, [])

    return {
        sessionId,
        runId,
        isStreaming,
        blocks,
        /** 当前用户轮次的起始节点 ID（用于 checkout / 重说），state 版本供 effect 依赖 */
        lastUserNodeId,
        lastUserNodeIdRef,
        createSession,
        createCharacterSession,
        closeSession,
        cancelSession,
        sendMessage,
        checkout,
        checkoutForEdit,
        switchPlugin,
        updateModel,
        getBranchInfo,
        switchBranch,
        treeNodes,
        branchSwitchVersion,
    }
}
