import type {
    MapDeckPreviewTooltip,
    MapDeckShaderInject,
    MapPreviewKeyLocation,
    MapPreviewKeyLocationIcon,
    MapPreviewScene,
    MapPreviewShape,
} from 'flowcloudai-ui'

/** 支持的地图风格 */
export type MapStyle = 'flat' | 'tolkien' | 'ink'

/** 单个 deck.gl 层的配置集合 */
export interface MapStyleDeckConfig {
    polygonShaderInject?: MapDeckShaderInject
    polygonLayerProps?: Record<string, unknown>
    scatterplotLayerProps?: Record<string, unknown>
    iconLayerProps?: Record<string, unknown>
    textLayerProps?: Record<string, unknown>
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    deckEffects?: any[]
}

/** 地图风格完整定义——新增风格只需实现此接口并注册到 index.ts */
export interface MapStyleDefinition {
    id: MapStyle
    label: string
    fontFamily: string
    oceanColor: string

    /** deck.gl 层配置（shaderInject / layerProps / deckEffects） */
    deckConfig: MapStyleDeckConfig

    /** 无用户底图时生成背景纹理（返回 DataURL 或 null） */
    createBackgroundTexture?: (canvas: {width: number; height: number}) => string | null

    /** 地点图标工厂 */
    buildLocationIcon?: (type: string, colorHex: string) => MapPreviewKeyLocationIcon | null

    /** Tooltip 工厂 */
    buildShapeTooltip?: (shape: MapPreviewShape) => MapDeckPreviewTooltip
    buildLocationTooltip?: (location: MapPreviewKeyLocation) => MapDeckPreviewTooltip

    /** Scene 后处理（如图标注入、iconSize 调整） */
    transformScene?: (scene: MapPreviewScene) => MapPreviewScene
}
