import {useCallback, useRef, useState} from 'react'

const MAX_HISTORY = 100

export interface UndoRedoHandle<T> {
    push: (state: T) => void
    pushDebounced: (state: T, delayMs?: number) => void
    flushDebounced: () => void
    undo: () => T | null
    redo: () => T | null
    reset: (state: T) => void
    canUndo: boolean
    canRedo: boolean
}

export function useUndoRedo<T>(initialState: T): UndoRedoHandle<T> {
    const historyRef = useRef<T[]>([initialState])
    const cursorRef = useRef(0)
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const [canUndo, setCanUndo] = useState(false)
    const [canRedo, setCanRedo] = useState(false)

    const updateFlags = useCallback(() => {
        setCanUndo(cursorRef.current > 0)
        setCanRedo(cursorRef.current < historyRef.current.length - 1)
    }, [])

    const push = useCallback((state: T) => {
        // 截断所有前进历史
        historyRef.current = historyRef.current.slice(0, cursorRef.current + 1)
        historyRef.current.push(state)
        if (historyRef.current.length > MAX_HISTORY) {
            historyRef.current.shift()
        } else {
            cursorRef.current++
        }
        updateFlags()
    }, [updateFlags])

    const pushDebounced = useCallback((state: T, delayMs = 600) => {
        if (debounceTimerRef.current !== null) {
            clearTimeout(debounceTimerRef.current)
        }
        debounceTimerRef.current = setTimeout(() => {
            debounceTimerRef.current = null
            push(state)
        }, delayMs)
    }, [push])

    const flushDebounced = useCallback(() => {
        // 无待处理防抖时不做任何操作 — 调用方无需额外检查
        if (debounceTimerRef.current === null) return
        clearTimeout(debounceTimerRef.current)
        debounceTimerRef.current = null
        // 这里不知道要提交什么状态；调用方必须在 flush 后显式 push
    }, [])

    const undo = useCallback((): T | null => {
        if (debounceTimerRef.current !== null) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        if (cursorRef.current <= 0) return null
        cursorRef.current--
        updateFlags()
        return historyRef.current[cursorRef.current]
    }, [updateFlags])

    const redo = useCallback((): T | null => {
        if (cursorRef.current >= historyRef.current.length - 1) return null
        cursorRef.current++
        updateFlags()
        return historyRef.current[cursorRef.current]
    }, [updateFlags])

    const reset = useCallback((state: T) => {
        if (debounceTimerRef.current !== null) {
            clearTimeout(debounceTimerRef.current)
            debounceTimerRef.current = null
        }
        historyRef.current = [state]
        cursorRef.current = 0
        updateFlags()
    }, [updateFlags])

    return {push, pushDebounced, flushDebounced, undo, redo, reset, canUndo, canRedo}
}
