import type {MapDeckPreviewTooltip, MapPreviewKeyLocation, MapPreviewKeyLocationIcon, MapPreviewScene, MapPreviewShape} from 'flowcloudai-ui'
import type {MapStyleDefinition} from './types'
import {createRicePaperTexture} from './textures'
import {createInkBleedEffect} from './effects'
import {deckColorToHex, svgToDataUrl} from './utils'

function buildLocationIcon(type: string, colorHex: string): MapPreviewKeyLocationIcon | null {
    const isSettlement = /城|镇|都|村|港|要塞|关口/.test(type)
    return {
        url: svgToDataUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="16" fill="#f5f5f5" fill-opacity="0.9"/>
                <path d="${isSettlement ? 'M14 27L22 11L30 27M18 24H26' : 'M14 14L30 30M30 14L14 30'}"
                      stroke="${colorHex}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="22" cy="22" r="18" fill="none" stroke="#1a1a1a" stroke-width="1.4" stroke-dasharray="2.5 2"/>
            </svg>
        `),
        width: 44,
        height: 44,
        anchorX: 22,
        anchorY: 22,
    }
}

function buildShapeTooltip(shape: MapPreviewShape): MapDeckPreviewTooltip {
    return {
        html: `<div style="display:flex;flex-direction:column;gap:5px;min-width:170px;padding:10px 12px;border-radius:4px;background:rgba(255,255,255,0.96);color:#111111;border:1px solid rgba(17,17,17,0.22);box-shadow:6px 8px 0 rgba(17,17,17,0.08);font-family:&quot;STKaiti&quot;, &quot;KaiTi&quot;, &quot;FangSong&quot;, serif;"><strong>${shape.name}</strong><span>边界点数：${shape.polygon.length}</span></div>`,
        style: {
            backgroundColor: 'transparent',
            border: 'none',
            padding: '0',
            boxShadow: 'none',
        },
    }
}

function buildLocationTooltip(location: MapPreviewKeyLocation): MapDeckPreviewTooltip {
    return {
        html: `<div style="display:flex;flex-direction:column;gap:5px;min-width:180px;padding:10px 12px;border-radius:4px;background:rgba(255,255,255,0.96);color:#111111;border:1px solid rgba(17,17,17,0.22);box-shadow:6px 8px 0 rgba(17,17,17,0.08);font-family:&quot;STKaiti&quot;, &quot;KaiTi&quot;, &quot;FangSong&quot;, serif;"><strong>${location.name}</strong><span>类型：${location.type}</span><span>坐标：${Math.round(location.position[0])}, ${Math.round(location.position[1])}</span></div>`,
        style: {
            backgroundColor: 'transparent',
            border: 'none',
            padding: '0',
            boxShadow: 'none',
        },
    }
}

function transformScene(scene: MapPreviewScene): MapPreviewScene {
    return {
        ...scene,
        keyLocations: scene.keyLocations.map(location => {
            const icon = buildLocationIcon(location.type, deckColorToHex(location.color))
            return {
                ...location,
                icon,
                iconSize: icon ? 28 : undefined,
            }
        }),
    }
}

export const inkStyle: MapStyleDefinition = {
    id: 'ink',
    label: '水墨',
    fontFamily: '"STKaiti", "KaiTi", "FangSong", serif',
    oceanColor: '#c4c4c4',

    deckConfig: {
        polygonShaderInject: {
            'fs:DECKGL_FILTER_COLOR': `
                float lum = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
                float darkness = 1.0 - lum;
                color.r = lum;
                color.g = lum;
                color.b = lum * 0.94;
                color.a *= 0.4 + darkness * 0.55;
                // 向墨色偏移
                color.rgb = mix(color.rgb, vec3(0.05, 0.05, 0.06), 0.15);
            `,
        },
        polygonLayerProps: {
            lineWidthMinPixels: 8,
            getLineColor: () => [20, 20, 20, 110] as [number, number, number, number],
            getFillColor: (s: {fillColor: [number, number, number, number]}) =>
                [s.fillColor[0], s.fillColor[1], s.fillColor[2], 60] as [number, number, number, number],
        },
        scatterplotLayerProps: {
            getRadius: 6,
            radiusMaxPixels: 14,
            stroked: true,
            getLineColor: () => [255, 255, 255, 235] as [number, number, number, number],
            lineWidthMinPixels: 1.5,
        },
        iconLayerProps: {
            getSize: 28,
        },
        textLayerProps: {
            getSize: 14,
            getColor: () => [15, 15, 15, 240] as [number, number, number, number],
            fontFamily: '"STKaiti", "KaiTi", "FangSong", serif',
        },
        deckEffects: [createInkBleedEffect()],
    },

    createBackgroundTexture: (canvas) => createRicePaperTexture(canvas.width, canvas.height),
    buildLocationIcon,
    buildShapeTooltip,
    buildLocationTooltip,
    transformScene,
}
