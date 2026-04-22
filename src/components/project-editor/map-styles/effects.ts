import type {Effect} from '@deck.gl/core'
import {PostProcessEffect} from '@deck.gl/core'

/**
 * 暗角后处理效果——边缘向中心逐渐变暗，模拟古地图/老照片氛围。
 */
export function createVignetteEffect(): Effect {
    const vignetteModule = {
        name: 'vignette',
        fs: `
            vec4 vignette_filterColor_ext(vec4 color, vec2 texSize, vec2 coord) {
                vec2 center = vec2(0.5, 0.5);
                float dist = distance(coord, center);
                float radius = 0.75;
                float amount = 0.35;
                float mask = smoothstep(radius, radius * 0.30, dist);
                color.rgb *= mix(1.0 - amount, 1.0, mask);
                return color;
            }
        `,
        passes: [{filter: true}],
        defaultUniforms: {},
        uniformTypes: {},
    }
    return new (PostProcessEffect as unknown as new (m: typeof vignetteModule, p: Record<string, never>) => Effect)(
        vignetteModule,
        {}
    )
}

/**
 * 水墨晕染后处理效果——暗色像素向外扩散，模拟墨在纸上化开。
 */
export function createInkBleedEffect(): Effect {
    const inkBleedModule = {
        name: 'inkBleed',
        fs: `
            vec4 inkBleed_sampleColor(sampler2D texSrc, vec2 texSize, vec2 coord) {
                vec2 texel = 1.0 / texSize;
                vec4 center = texture(texSrc, coord);

                // 3x3 加权模糊（近似高斯）
                vec4 sum = center * 4.0;
                sum += texture(texSrc, coord + vec2(-texel.x, -texel.y)) * 2.0;
                sum += texture(texSrc, coord + vec2( texel.x, -texel.y)) * 2.0;
                sum += texture(texSrc, coord + vec2(-texel.x,  texel.y)) * 2.0;
                sum += texture(texSrc, coord + vec2( texel.x,  texel.y)) * 2.0;
                sum += texture(texSrc, coord + vec2(-texel.x, 0.0)) * 1.0;
                sum += texture(texSrc, coord + vec2( texel.x, 0.0)) * 1.0;
                sum += texture(texSrc, coord + vec2(0.0, -texel.y)) * 1.0;
                sum += texture(texSrc, coord + vec2(0.0,  texel.y)) * 1.0;
                vec4 blurred = sum / 16.0;

                float lum = dot(center.rgb, vec3(0.299, 0.587, 0.114));
                float ink = 1.0 - lum;
                float alpha = center.a;

                // 暗色向外晕染
                vec4 result = mix(center, blurred, ink * 0.55 * alpha);
                // 轻微压暗晕染区，增加墨的堆积感
                result.rgb *= (1.0 - ink * 0.12);
                return result;
            }
        `,
        passes: [{sampler: true}],
        defaultUniforms: {},
        uniformTypes: {},
    }
    return new (PostProcessEffect as unknown as new (m: typeof inkBleedModule, p: Record<string, never>) => Effect)(
        inkBleedModule,
        {}
    )
}
