import {useState} from 'react'
import type {AiContextValue} from '../contexts/AiControllerTypes'
import DockableSidePanel, {type DockableSidePanelMode} from './layout/DockableSidePanel'
import AIChatContent from './AIChatContent'
import './AI.css'

const MIN_PANEL_WIDTH = 500

interface AIChatProps {
    mode: DockableSidePanelMode
    controller: AiContextValue
}

export default function AIChat({mode, controller}: AIChatProps) {
    const [panelWidth, setPanelWidth] = useState(MIN_PANEL_WIDTH)

    return (
        <DockableSidePanel
            mode={mode}
            width={panelWidth}
            minWidth={MIN_PANEL_WIDTH}
            maxWidthRatio={0.5}
            onWidthChange={setPanelWidth}
            className="ai-shell"
            handleTitle="拖拽调整宽度"
        >
            <div className={`ai-chat-layout ${controller.sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
                <AIChatContent controller={controller}/>
            </div>
        </DockableSidePanel>
    )
}
