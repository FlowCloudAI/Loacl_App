import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import {
    ai_close_session,
    ai_delete_conversation,
    ai_rename_conversation,
    ai_disable_tool,
    ai_enable_tool,
    ai_get_conversation,
    ai_list_conversations,
    ai_list_plugins,
    ai_list_tools,
    ai_update_session,
    type PluginInfo,
    type StoredMessage,
    type ToolStatus,
} from '../api'
import {type SessionMessage, useAiSession} from './useAiSession'
import type {AiContextValue, Conversation, Message, SessionParams} from '../contexts/AiControllerTypes'

const generateTitleFromMessage = (content: string): string => {
    const cleaned = content.trim().replace(/\s+/g, ' ')
    if (cleaned.length <= 20) return cleaned
    return `${cleaned.slice(0, 20)}...`
}

const runtimeConversationKey = (sessionId: string, runId: string) => `${sessionId}::${runId}`

const storedToMessages = (messages: StoredMessage[]): Message[] => {
    const result: Message[] = []
    let pendingAssistant: Message | null = null

    const flushPendingAssistant = () => {
        if (!pendingAssistant) return
        if (pendingAssistant.blocks && pendingAssistant.blocks.length > 0) {
            result.push(pendingAssistant)
        }
        pendingAssistant = null
    }

    const ensureAssistant = (message: StoredMessage, index: number) => {
        if (!pendingAssistant) {
            pendingAssistant = {
                id: message.message_id ?? `loaded_assistant_${index}_${Date.now()}`,
                role: 'assistant',
                content: '',
                timestamp: new Date(message.timestamp).getTime(),
                nodeId: message.node_id ?? undefined,
                blocks: [],
            }
        }
        return pendingAssistant
    }

    messages.forEach((message, index) => {
        if (message.role === 'user') {
            flushPendingAssistant()
        }

        if (message.role === 'tool') {
            const assistant = pendingAssistant
            if (!assistant?.blocks) return
            const toolBlockIndex = assistant.blocks.findIndex((block) => {
                if (block.type !== 'tool') return false
                return block.tool.result == null
            })
            if (toolBlockIndex === -1) return

            const nextBlocks = [...assistant.blocks]
            const block = nextBlocks[toolBlockIndex]
            if (block.type === 'tool') {
                nextBlocks[toolBlockIndex] = {
                    ...block,
                    tool: {
                        ...block.tool,
                        result: message.content ?? '',
                        isError: false,
                    },
                }
                pendingAssistant = {...assistant, blocks: nextBlocks}
            }
            return
        }

        if (message.role === 'assistant') {
            const assistant = ensureAssistant(message, index)
            const nextBlocks = [...(assistant.blocks ?? [])]

            if (message.reasoning) {
                nextBlocks.push({type: 'reasoning', content: message.reasoning})
            }
            if (message.tool_calls && message.tool_calls.length > 0) {
                message.tool_calls.forEach((toolCall) => {
                    nextBlocks.push({
                        type: 'tool',
                        tool: {
                            index: toolCall.index,
                            name: toolCall.function?.name ?? toolCall.name ?? '',
                            args: toolCall.function?.arguments ?? toolCall.arguments ?? '',
                        },
                        detail: 'verbose',
                    })
                })
            }
            if (message.content) {
                nextBlocks.push({type: 'content', content: message.content, markdown: true})
            }

            pendingAssistant = {
                ...assistant,
                content: assistant.content + (message.content ?? ''),
                reasoning: assistant.reasoning
                    ? `${assistant.reasoning}${message.reasoning ?? ''}`
                    : (message.reasoning || undefined),
                timestamp: new Date(message.timestamp).getTime(),
                nodeId: message.node_id ?? assistant.nodeId,
                blocks: nextBlocks,
            }
            return
        }

        const base: Message = {
            id: message.message_id ?? `loaded_${index}_${Date.now()}`,
            role: message.role as 'user' | 'assistant',
            content: message.content ?? '',
            reasoning: message.reasoning || undefined,
            timestamp: new Date(message.timestamp).getTime(),
            nodeId: message.node_id ?? undefined,
        }

        if (message.content) {
            base.blocks = [{type: 'content', content: message.content}]
        }

        result.push(base)
    })

    flushPendingAssistant()
    return result
}

export function useAiController(): AiContextValue {
    const [plugins, setPlugins] = useState<PluginInfo[]>([])
    const [selectedPlugin, setSelectedPlugin] = useState('')
    const [selectedModel, setSelectedModel] = useState('')

    const [conversations, setConversations] = useState<Conversation[]>([])
    const [activeConversationId, setActiveConversationId] = useState<string | null>(null)
    const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
    const [autoScroll, setAutoScroll] = useState(true)

    const [inputValue, setInputValue] = useState('')
    const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
    const [sessionParams, setSessionParams] = useState<SessionParams>({thinking: true})
    const [tools, setTools] = useState<ToolStatus[]>([])
    const [webSearchEnabled, setWebSearchEnabled] = useState(true)
    const [editModeEnabled, setEditModeEnabled] = useState(true)

    const activeConversation = useMemo(
        () => conversations.find((conversation) => conversation.id === activeConversationId),
        [conversations, activeConversationId],
    )

    const messages = useMemo(() => activeConversation?.messages ?? [], [activeConversation])

    const activeConversationRef = useRef(activeConversation)
    useEffect(() => {
        activeConversationRef.current = activeConversation
    }, [activeConversation])

    const activeConversationIdRef = useRef(activeConversationId)
    useEffect(() => {
        activeConversationIdRef.current = activeConversationId
    }, [activeConversationId])

    const runtimeConversationRef = useRef<Record<string, string>>({})
    const abortControllerRef = useRef<AbortController | null>(null)

    const onMessage = useCallback((message: SessionMessage) => {
        const targetConversationId =
            runtimeConversationRef.current[runtimeConversationKey(message.sessionId, message.runId)]

        setConversations((prev) => prev.map((conversation) => {
            const matchedByRuntime =
                conversation.sessionId === message.sessionId && conversation.runId === message.runId
            const matchedByMap = targetConversationId != null && conversation.id === targetConversationId
            if (!matchedByRuntime && !matchedByMap) return conversation
            return {
                ...conversation,
                messages: [...conversation.messages, {
                    id: message.id,
                    role: message.role,
                    content: message.content,
                    timestamp: message.timestamp,
                    reasoning: message.reasoning,
                    blocks: message.blocks,
                    nodeId: message.nodeId,
                }],
            }
        }))
    }, [])

    const onError = useCallback((message: string) => {
        console.error('[useAiController]', message)
    }, [])

    const session = useAiSession({onMessage, onError})

    useEffect(() => {
        ai_list_plugins('llm').then(setPlugins).catch(console.error)
        ai_list_tools().then((fetched) => {
            const enableOps = fetched.map((tool) => ai_enable_tool(tool.name))
            void Promise.all(enableOps)
            setTools(fetched.map((tool) => ({...tool, enabled: true})))
            setWebSearchEnabled(true)
            setEditModeEnabled(true)
        }).catch(console.error)
    }, [])

    useEffect(() => {
        let mounted = true
        const init = async () => {
            const metas = await ai_list_conversations().catch(
                () => [] as Awaited<ReturnType<typeof ai_list_conversations>>,
            )
            if (!mounted) return

            if (metas.length > 0) {
                const convs: Conversation[] = metas.map((meta) => ({
                    id: meta.id,
                    title: meta.title,
                    messages: [],
                    pluginId: meta.plugin_id,
                    model: meta.model,
                    sessionId: null,
                    runId: null,
                    timestamp: new Date(meta.updated_at).getTime(),
                }))

                const stored = await ai_get_conversation(convs[0].id).catch(() => null)
                if (!mounted) return

                if (stored) {
                    convs[0] = {...convs[0], messages: storedToMessages(stored.messages)}
                }

                setConversations(convs)
                setActiveConversationId(convs[0].id)
                setSelectedPlugin(convs[0].pluginId)
                setSelectedModel(convs[0].model)
            } else {
                const newId = `conv_${Date.now()}`
                setConversations([{
                    id: newId,
                    title: '新对话',
                    messages: [],
                    pluginId: '',
                    model: '',
                    sessionId: null,
                    runId: null,
                    timestamp: Date.now(),
                }])
                setActiveConversationId(newId)
            }
        }

        void init()
        return () => {
            mounted = false
        }
    }, [])

    useEffect(() => {
        if (selectedPlugin && plugins.length > 0 && !selectedModel) {
            const plugin = plugins.find((item) => item.id === selectedPlugin)
            if (plugin) {
                const defaultModel = plugin.default_model ?? plugin.models[0] ?? ''
                if (defaultModel) {
                    const timer = setTimeout(() => setSelectedModel(defaultModel), 0)
                    return () => clearTimeout(timer)
                }
            }
        }
    }, [selectedPlugin, plugins, selectedModel])

    useEffect(() => {
        if (!session.sessionId) return
        void ai_update_session(session.sessionId, {thinking: sessionParams.thinking}).catch(console.error)
    }, [sessionParams, session.sessionId])

    const createNewConversation = useCallback(async () => {
        if (session.isStreaming) {
            abortControllerRef.current?.abort()
        }
        await session.closeSession()

        const newId = `conv_${Date.now()}`
        const newConversation: Conversation = {
            id: newId,
            title: '新对话',
            messages: [],
            pluginId: selectedPlugin,
            model: selectedModel,
            sessionId: null,
            runId: null,
            timestamp: Date.now(),
        }

        setConversations((prev) => [newConversation, ...prev])
        setActiveConversationId(newId)
        setInputValue('')
        setEditingMessageId(null)
        setAutoScroll(true)
        if (sidebarCollapsed) setSidebarCollapsed(false)
    }, [selectedModel, selectedPlugin, session, sidebarCollapsed])

    const switchConversation = useCallback(async (convId: string) => {
        if (convId === activeConversationIdRef.current) return
        setActiveConversationId(convId)
        setInputValue('')
        setEditingMessageId(null)
        setAutoScroll(true)

        const targetConv = conversations.find((conversation) => conversation.id === convId)
        if (targetConv) {
            setSelectedPlugin(targetConv.pluginId)
            setSelectedModel(targetConv.model)

            if (targetConv.messages.length === 0 && !targetConv.id.startsWith('conv_')) {
                const stored = await ai_get_conversation(targetConv.id).catch(() => null)
                if (stored) {
                    setConversations((prev) => prev.map((conversation) =>
                        conversation.id === convId
                            ? {...conversation, messages: storedToMessages(stored.messages)}
                            : conversation,
                    ))
                }
            }
        }
    }, [conversations])

    const deleteConversation = useCallback(async (convId: string, event?: React.MouseEvent) => {
        event?.stopPropagation()
        const conv = conversations.find((conversation) => conversation.id === convId)

        if (activeConversationIdRef.current === convId && session.isStreaming) {
            await session.cancelSession(conv?.sessionId)
        }

        if (conv?.sessionId) {
            await ai_close_session(conv.sessionId).catch(console.error)
        }
        if (conv && !conv.id.startsWith('conv_')) {
            await ai_delete_conversation(conv.id).catch(console.error)
        }

        setConversations((prev) => prev.filter((conversation) => conversation.id !== convId))

        if (activeConversationIdRef.current === convId) {
            await session.closeSession()
            setActiveConversationId(null)
            setAutoScroll(true)
        }
    }, [conversations, session])

    const renameConversation = useCallback(async (convId: string, title: string) => {
        const trimmed = title.trim()
        if (!trimmed) return
        setConversations((prev) => prev.map((conversation) =>
            conversation.id === convId ? {...conversation, title: trimmed} : conversation,
        ))
        await ai_rename_conversation(convId, trimmed).catch(console.error)
    }, [])

    const sendMessage = useCallback(async (content: string) => {
        const trimmed = content.trim()
        if (!trimmed || session.isStreaming) return

        const currentConvId = activeConversationRef.current?.id
        if (!currentConvId) return

        abortControllerRef.current = new AbortController()

        if (editingMessageId) {
            const conv = activeConversationRef.current
            if (conv) {
                const editIdx = conv.messages.findIndex((message) => message.id === editingMessageId)
                if (editIdx !== -1) {
                    setConversations((prev) => prev.map((conversation) =>
                        conversation.id === currentConvId
                            ? {...conversation, messages: conversation.messages.slice(0, editIdx)}
                            : conversation,
                    ))
                    const precedingMsg = editIdx > 0 ? conv.messages[editIdx - 1] : null
                    if (precedingMsg?.nodeId && conv.sessionId === session.sessionId) {
                        await session.checkoutForEdit(precedingMsg.nodeId)
                    } else if (session.sessionId) {
                        await session.closeSession()
                    }
                }
            }
            setEditingMessageId(null)
        }

        const sessionBelongsHere = session.sessionId != null
            && session.sessionId === activeConversationRef.current?.sessionId
            && session.runId != null
            && session.runId === activeConversationRef.current?.runId

        if (session.sessionId && !sessionBelongsHere) {
            await session.closeSession()
        }

        let currentSid = sessionBelongsHere ? session.sessionId : null
        let effectiveConvId = currentConvId

        if (!currentSid) {
            await new Promise<void>((resolve) => {
                setTools((latest) => {
                    Promise.all(
                        latest.map((tool) => tool.enabled ? ai_enable_tool(tool.name) : ai_disable_tool(tool.name)),
                    ).catch(console.error).finally(resolve)
                    return latest
                })
            })

            const isPending = currentConvId.startsWith('conv_')
            const desiredSessionId = isPending ? undefined : currentConvId
            const created = await session.createSession(selectedPlugin, selectedModel, desiredSessionId)
            if (!created) return

            currentSid = created.sessionId
            if (isPending) {
                effectiveConvId = created.conversationId
                runtimeConversationRef.current[
                    runtimeConversationKey(created.sessionId, created.runId)
                    ] = created.conversationId
                setConversations((prev) => prev.map((conversation) =>
                    conversation.id === currentConvId
                        ? {...conversation, id: created.conversationId, sessionId: currentSid!, runId: created.runId}
                        : conversation,
                ))
                setActiveConversationId(created.conversationId)
            } else {
                runtimeConversationRef.current[
                    runtimeConversationKey(created.sessionId, created.runId)
                    ] = currentConvId
                setConversations((prev) => prev.map((conversation) =>
                    conversation.id === currentConvId
                        ? {...conversation, sessionId: currentSid!, runId: created.runId}
                        : conversation,
                ))
            }
        }

        const userMessage: Message = {
            id: `u_${Date.now()}`,
            role: 'user',
            content: trimmed,
            timestamp: Date.now(),
        }

        setConversations((prev) => prev.map((conversation) => {
            if (conversation.id !== effectiveConvId) return conversation
            const isFirstMessage = conversation.messages.length === 0
            return {
                ...conversation,
                title: isFirstMessage ? generateTitleFromMessage(trimmed) : conversation.title,
                messages: [...conversation.messages, userMessage],
            }
        }))

        setInputValue('')
        await session.sendMessage(trimmed, currentSid!)
    }, [editingMessageId, selectedModel, selectedPlugin, session])

    const stopStreaming = useCallback(() => {
        abortControllerRef.current?.abort()
        void session.cancelSession()
    }, [session])

    const regenerateMessage = useCallback(async (messageId: string) => {
        if (session.isStreaming) return
        const conv = conversations.find((conversation) => conversation.id === activeConversationIdRef.current)
        if (!conv || conv.sessionId !== session.sessionId) return

        const messageIndex = conv.messages.findIndex((message) => message.id === messageId)
        if (messageIndex === -1) return

        const precedingUserMsg = conv.messages
            .slice(0, messageIndex)
            .reverse()
            .find((message) => message.role === 'user')
        if (!precedingUserMsg?.nodeId) return

        setConversations((prev) => prev.map((conversation) =>
            conversation.id === activeConversationIdRef.current
                ? {...conversation, messages: conversation.messages.slice(0, messageIndex)}
                : conversation,
        ))
        setAutoScroll(true)
        await session.checkout(precedingUserMsg.nodeId)
    }, [conversations, session])

    const editMessage = useCallback((messageId: string) => {
        const conv = conversations.find((conversation) => conversation.id === activeConversationIdRef.current)
        const message = conv?.messages.find((item) => item.id === messageId)
        if (!message || message.role !== 'user') return
        setInputValue(message.content)
        setEditingMessageId(messageId)
    }, [conversations])

    const toggleWebSearch = useCallback(async () => {
        const next = !webSearchEnabled
        const webNames = ['web_search', 'open_url']
        setTools((prev) => prev.map((tool) => webNames.includes(tool.name) ? {...tool, enabled: next} : tool))
        setWebSearchEnabled(next)
        if (!session.sessionId) {
            const ops = tools
                .filter((tool) => webNames.includes(tool.name))
                .map((tool) => next ? ai_enable_tool(tool.name) : ai_disable_tool(tool.name))
            await Promise.all(ops).catch(console.error)
        }
    }, [session.sessionId, tools, webSearchEnabled])

    const toggleEditMode = useCallback(async () => {
        const next = !editModeEnabled
        const webNames = ['web_search', 'open_url']
        setTools((prev) => prev.map((tool) => (!webNames.includes(tool.name)) ? {...tool, enabled: next} : tool))
        setEditModeEnabled(next)
        if (!session.sessionId) {
            const ops = tools
                .filter((tool) => !webNames.includes(tool.name))
                .map((tool) => next ? ai_enable_tool(tool.name) : ai_disable_tool(tool.name))
            await Promise.all(ops).catch(console.error)
        }
    }, [editModeEnabled, session.sessionId, tools])

    return useMemo(() => ({
        plugins,
        selectedPlugin,
        selectedModel,
        setSelectedPlugin,
        setSelectedModel,
        conversations,
        activeConversationId,
        setActiveConversationId,
        messages,
        sendMessage,
        stopStreaming,
        regenerateMessage,
        editMessage,
        inputValue,
        setInputValue,
        editingMessageId,
        setEditingMessageId,
        tools,
        webSearchEnabled,
        editModeEnabled,
        toggleWebSearch,
        toggleEditMode,
        sessionParams,
        setSessionParams,
        isStreaming: session.isStreaming,
        streamingBlocks: session.blocks,
        sidebarCollapsed,
        setSidebarCollapsed,
        autoScroll,
        setAutoScroll,
        createNewConversation,
        switchConversation,
        deleteConversation,
        renameConversation,
        activeConversation,
    }), [
        plugins, selectedPlugin, selectedModel, conversations, activeConversationId,
        messages, inputValue, editingMessageId, tools, webSearchEnabled, editModeEnabled,
        sessionParams, session.isStreaming, session.blocks, sidebarCollapsed, autoScroll,
        activeConversation, sendMessage, stopStreaming, regenerateMessage, editMessage,
        toggleWebSearch, toggleEditMode, createNewConversation, switchConversation, deleteConversation,
        renameConversation,
    ])
}
