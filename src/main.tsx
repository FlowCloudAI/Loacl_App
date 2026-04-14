import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'

import App from './App.tsx'
import {setting_get_settings, showWindow} from './api'
import {AlertProvider, ContextMenuProvider, ThemeProvider} from 'flowcloudai-ui'
// @ts-expect-error - CSS import, no types needed
import 'flowcloudai-ui/style';
import './i18n' // 初始化 i18n

function isTauriRuntime(): boolean {
    return typeof window !== 'undefined'
        && (Object.prototype.hasOwnProperty.call(window, '__TAURI_INTERNALS__')
            || Object.prototype.hasOwnProperty.call(window, '__TAURI__'))
}

// 异步初始化主题
const initApp = async () => {
    let initialTheme = 'system'
    try {
        const settings = await setting_get_settings()
        if (settings.theme) {
            initialTheme = settings.theme
        }
    } catch (error) {
        console.warn('Failed to load settings, using default theme:', error)
    }

    if (isTauriRuntime()) {
        document.documentElement.classList.add('is-tauri')
        document.body.classList.add('is-tauri')
    }

    // 在 React 渲染前同步写入 data-theme，避免首帧闪白
    const resolvedTheme = initialTheme === 'system'
        ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
        : initialTheme
    document.documentElement.setAttribute('data-theme', resolvedTheme)

    // data-theme 已同步写入，下一帧再显示窗口，确保浏览器绘制的第一帧已带有正确主题
    requestAnimationFrame(() => {
        showWindow().catch(console.error)
    })

    createRoot(document.getElementById('root')!).render(
        <StrictMode>
            <ThemeProvider defaultTheme={initialTheme as 'system' | 'light' | 'dark'}>
                <ContextMenuProvider>
                    <AlertProvider>
                        <App/>
                    </AlertProvider>
                </ContextMenuProvider>
            </ThemeProvider>
        </StrictMode>,
    )
}

initApp().catch(console.error)
