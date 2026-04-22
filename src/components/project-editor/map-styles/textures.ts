/**
 * 羊皮纸纹理生成器——暖黄底色 + 纤维线 + 岁月斑点。
 */
export function createParchmentTexture(width: number, height: number): string {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 暖黄底色
    ctx.fillStyle = '#e8d5b5'
    ctx.fillRect(0, 0, width, height)

    // 纤维纹理
    for (let i = 0; i < 600; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const len = 20 + Math.random() * 80
        const angle = (Math.random() - 0.5) * Math.PI
        ctx.globalAlpha = 0.03 + Math.random() * 0.06
        ctx.strokeStyle = Math.random() > 0.5 ? '#8b6914' : '#c2a86b'
        ctx.lineWidth = 0.5 + Math.random() * 1.5
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
        ctx.stroke()
    }

    // 随机斑点（霉斑/岁月痕迹）
    for (let i = 0; i < 200; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const r = 2 + Math.random() * 8
        ctx.globalAlpha = 0.02 + Math.random() * 0.05
        ctx.fillStyle = Math.random() > 0.5 ? '#6b4c1e' : '#a08050'
        ctx.beginPath()
        ctx.arc(x, y, r, 0, Math.PI * 2)
        ctx.fill()
    }

    ctx.globalAlpha = 1
    return canvas.toDataURL('image/png')
}

/**
 * 宣纸纹理生成器——米白底色 + 噪点 + 纸纤维。
 */
export function createRicePaperTexture(width: number, height: number): string {
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!

    // 米白底色
    ctx.fillStyle = '#f5f3ee'
    ctx.fillRect(0, 0, width, height)

    // 全局噪点
    const imageData = ctx.getImageData(0, 0, width, height)
    const data = imageData.data
    for (let i = 0; i < data.length; i += 4) {
        const noise = (Math.random() - 0.5) * 12
        data[i] = Math.min(255, Math.max(0, data[i] + noise))
        data[i + 1] = Math.min(255, Math.max(0, data[i + 1] + noise))
        data[i + 2] = Math.min(255, Math.max(0, data[i + 2] + noise))
    }
    ctx.putImageData(imageData, 0, 0)

    // 纸纤维
    for (let i = 0; i < 400; i++) {
        const x = Math.random() * width
        const y = Math.random() * height
        const len = 10 + Math.random() * 40
        const angle = (Math.random() - 0.5) * 0.5
        ctx.globalAlpha = 0.04 + Math.random() * 0.08
        ctx.strokeStyle = '#b0a898'
        ctx.lineWidth = 0.3 + Math.random() * 0.8
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len)
        ctx.stroke()
    }

    ctx.globalAlpha = 1
    return canvas.toDataURL('image/png')
}
