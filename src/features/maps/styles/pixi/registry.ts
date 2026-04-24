import {log_message} from '../../../../api'
import {flatPixiMapStyle} from './presets/flat'
import {inkPixiMapStyle} from './presets/ink'
import {tolkienPixiMapStyle} from './presets/tolkien'
import type {PixiMapStyle} from './types'

const BUILTIN_PIXI_MAP_STYLES: PixiMapStyle[] = [
    flatPixiMapStyle,
    tolkienPixiMapStyle,
    inkPixiMapStyle,
]

function pixiRegistryLog(msg: string) {
    void log_message('info', `[PixiRegistry] ${msg}`)
}

export function listPixiMapStyles(): PixiMapStyle[] {
    return BUILTIN_PIXI_MAP_STYLES
}

export function getPixiMapStyle(styleId: string): PixiMapStyle {
    const result = BUILTIN_PIXI_MAP_STYLES.find(style => style.id === styleId) ?? flatPixiMapStyle
    pixiRegistryLog(`getPixiMapStyle: requested=${styleId} resolved=${result.id} totalPresets=${BUILTIN_PIXI_MAP_STYLES.length}`)
    return result
}
