import type {MapDeckPreviewTooltip, MapPreviewKeyLocation, MapPreviewKeyLocationIcon, MapPreviewScene, MapPreviewShape} from 'flowcloudai-ui'
import type {MapStyleDefinition} from './types'
import {createParchmentTexture} from './textures'
import {createVignetteEffect} from './effects'
import {deckColorToHex, svgToDataUrl} from './utils'

function buildLocationIcon(_type: string, colorHex: string): MapPreviewKeyLocationIcon | null {
    return {
        url: svgToDataUrl(`
            <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 44 44">
                <circle cx="22" cy="22" r="17" fill="#f7e7bc" stroke="${colorHex}" stroke-width="2.2"/>
                <path d="M22 8L27.5 18.5L38 22L27.5 25.5L22 36L16.5 25.5L6 22L16.5 18.5Z" fill="${colorHex}" fill-opacity="0.92"/>
                <circle cx="22" cy="22" r="3.2" fill="#fff8e7"/>
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
        html: `<div style="display:flex;flex-direction:column;gap:4px;min-width:180px;padding:12px 14px;border-radius:12px;background:linear-gradient(180deg, rgba(249,237,203,0.98), rgba(230,207,160,0.96));color:#5c3b22;border:1px solid rgba(120,78,39,0.35);box-shadow:0 14px 32px rgba(88,52,24,0.18);font-family:&quot;Georgia&quot;, &quot;Times New Roman&quot;, &quot;STSong&quot;, serif;"><strong style="font-size:14px;">${shape.name}</strong><span>边界点数：${shape.polygon.length}</span></div>`,
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
        html: `<div style="display:flex;flex-direction:column;gap:4px;min-width:190px;padding:12px 14px;border-radius:12px;background:linear-gradient(180deg, rgba(249,237,203,0.98), rgba(230,207,160,0.96));color:#5c3b22;border:1px solid rgba(120,78,39,0.35);box-shadow:0 14px 32px rgba(88,52,24,0.18);font-family:&quot;Georgia&quot;, &quot;Times New Roman&quot;, &quot;STSong&quot;, serif;"><strong style="font-size:14px;">${location.name}</strong><span>类型：${location.type}</span><span>坐标：${Math.round(location.position[0])}, ${Math.round(location.position[1])}</span></div>`,
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
                iconSize: icon ? 30 : undefined,
            }
        }),
    }
}

export const tolkienStyle: MapStyleDefinition = {
    id: 'tolkien',
    label: '托尔金',
    fontFamily: '"Georgia", "Times New Roman", "STSong", serif',
    oceanColor: '#c9a86c',

    deckConfig: {
        polygonShaderInject: {
            'fs:DECKGL_FILTER_COLOR': `
                float lum = color.r * 0.299 + color.g * 0.587 + color.b * 0.114;
                color.r = min(lum * 1.40 + 0.13, 1.0);
                color.g = min(lum * 1.12 + 0.07, 1.0);
                color.b = min(lum * 0.68, 1.0);
                color.a *= 0.88;
                // 细微噪点抖动，模拟墨水在羊皮纸上的不均匀沉积
                float n = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898,78.233))) * 43758.5453);
                color.rgb *= (0.96 + n * 0.08);
            `,
        },
        polygonLayerProps: {
            lineWidthMinPixels: 2.5,
        },
        scatterplotLayerProps: {
            getRadius: 7,
            radiusMaxPixels: 16,
            stroked: true,
            getLineColor: () => [245, 232, 199, 255] as [number, number, number, number],
            lineWidthMinPixels: 2,
        },
        iconLayerProps: {
            getSize: 30,
        },
        textLayerProps: {
            getSize: 15,
            getColor: () => [92, 59, 34, 255] as [number, number, number, number],
            fontFamily: '"Georgia", "Times New Roman", "STSong", serif',
        },
        deckEffects: [createVignetteEffect()],
    },

    createBackgroundTexture: (canvas) => createParchmentTexture(canvas.width, canvas.height),
    buildLocationIcon,
    buildShapeTooltip,
    buildLocationTooltip,
    transformScene,
}
