import {useContext} from 'react'
import {AiContext} from './AiContext'

export function useAiContext() {
    const ctx = useContext(AiContext)
    if (!ctx) {
        throw new Error('useAiContext must be used within AiProvider')
    }
    return ctx
}
