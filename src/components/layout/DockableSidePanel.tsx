import {type MouseEvent as ReactMouseEvent, useCallback, useEffect, useRef, useState} from 'react'
import './DockableSidePanel.css'

export type DockableSidePanelMode = 'fullscreen' | 'floating'

interface DockableSidePanelProps {
    mode: DockableSidePanelMode
    width: number
    minWidth: number
    maxWidthRatio?: number
    onWidthChange: (width: number) => void
    className?: string
    handleTitle?: string
    children: React.ReactNode
}

export default function DockableSidePanel({
                                              mode,
                                              width,
                                              minWidth,
                                              maxWidthRatio = 0.5,
                                              onWidthChange,
                                              className = '',
                                              handleTitle = '拖拽调整宽度',
                                              children,
                                          }: DockableSidePanelProps) {
    const [isDragging, setIsDragging] = useState(false)
    const isDraggingRef = useRef(false)
    const dragStartXRef = useRef(0)
    const dragStartWidthRef = useRef(0)

    const handleResizeStart = useCallback((event: ReactMouseEvent) => {
        if (mode !== 'floating') return
        event.preventDefault()
        isDraggingRef.current = true
        setIsDragging(true)
        dragStartXRef.current = event.clientX
        dragStartWidthRef.current = width
        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
    }, [mode, width])

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            if (!isDraggingRef.current) return
            const delta = dragStartXRef.current - event.clientX
            const nextWidth = Math.max(
                minWidth,
                Math.min(window.innerWidth * maxWidthRatio, dragStartWidthRef.current + delta),
            )
            onWidthChange(nextWidth)
        }

        const handleMouseUp = () => {
            if (!isDraggingRef.current) return
            isDraggingRef.current = false
            setIsDragging(false)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)
        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [maxWidthRatio, minWidth, onWidthChange])

    const rootClassName = [
        'dockable-side-panel',
        `dockable-side-panel--${mode}`,
        className,
    ].filter(Boolean).join(' ')

    return (
        <section
            className={rootClassName}
            style={mode === 'floating' ? {width} : undefined}
        >
            {mode === 'floating' && (
                <div
                    className={`dockable-side-panel__resize-handle${isDragging ? ' is-dragging' : ''}`}
                    onMouseDown={handleResizeStart}
                    title={handleTitle}
                >
                    <div className="dockable-side-panel__resize-grip" aria-hidden="true">
                        <span className="dockable-side-panel__resize-dot"/>
                        <span className="dockable-side-panel__resize-dot"/>
                        <span className="dockable-side-panel__resize-dot"/>
                    </div>
                </div>
            )}
            <div className="dockable-side-panel__body">
                {children}
            </div>
        </section>
    )
}
