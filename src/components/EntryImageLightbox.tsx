import { useEffect, useState } from 'react'
import { Button, RollingBox, useAlert } from 'flowcloudai-ui'
import { open_entry_image_path } from '../api/worldflow'
import './EntryImageLightbox.css'

type LightboxImage = {
    src?: string
    path?: string | null
    url?: string | null
    alt?: string | null
    is_cover?: boolean
}

interface EntryImageLightboxProps {
    open: boolean
    images: LightboxImage[]
    currentIndex: number
    infoTitle: string
    onClose: () => void
    onIndexChange: (index: number) => void
    onSetCover: (index: number) => void
    onRemove: (index: number) => void
    onAddImage?: () => void
}

export default function EntryImageLightbox({
    open,
    images,
    currentIndex,
    infoTitle,
    onClose,
    onIndexChange,
    onSetCover,
    onRemove,
    onAddImage,
}: EntryImageLightboxProps) {
    const { showAlert } = useAlert()
    const [viewMode, setViewMode] = useState<'preview' | 'gallery'>('preview')

    useEffect(() => {
        if (open) setViewMode('preview')
    }, [open])

    if (!open || images.length === 0) return null

    const currentImage = images[currentIndex]

    async function handleRemoveClick() {
        const result = await showAlert('确认移除这张图片？', 'warning', 'confirm')
        if (result !== 'yes') return
        onRemove(currentIndex)
    }

    async function handleOpenLocalPath() {
        const rawPath = currentImage?.path
        if (!rawPath) {
            void showAlert('当前图片没有可打开的本地路径', 'warning')
            return
        }
        try {
            await open_entry_image_path(String(rawPath))
        } catch (error) {
            void showAlert(`打开图片失败: ${String(error)}`, 'error')
        }
    }

    function renderImageRail() {
        return (
            <RollingBox
                className="entry-editor-lightbox__gallery"
                horizontal
                vertical={false}
                thumbSize="thin"
            >
                <div className="entry-editor-lightbox__thumbs">
                    {images.map((image, index) => (
                        <button
                            key={`${image.path ?? image.url ?? index}-${index}`}
                            type="button"
                            className={`entry-editor-lightbox__thumb${index === currentIndex ? ' active' : ''}`}
                            onClick={() => {
                                onIndexChange(index)
                                if (viewMode === 'gallery') setViewMode('preview')
                            }}
                        >
                            <div className="entry-editor-lightbox__thumb-media">
                                {image.src ? (
                                    <img src={image.src} alt={image.alt || `${infoTitle} ${index + 1}`} />
                                ) : (
                                    <span className="entry-editor-lightbox__thumb-empty">{index + 1}</span>
                                )}
                            </div>
                        </button>
                    ))}
                    <button
                        type="button"
                        className="entry-editor-lightbox__thumb entry-editor-lightbox__thumb--add"
                        onClick={() => onAddImage?.()}
                        disabled={!onAddImage}
                    >
                        <div className="entry-editor-lightbox__thumb-media entry-editor-lightbox__thumb-media--add">
                            <span className="entry-editor-lightbox__thumb-plus">+</span>
                            <span className="entry-editor-lightbox__thumb-add-label">添加图片</span>
                        </div>
                    </button>
                </div>
            </RollingBox>
        )
    }

    return (
        <div className="entry-editor-lightbox" onClick={(event) => {
            if (event.target === event.currentTarget) onClose()
        }}>
            <div className="entry-editor-lightbox__dialog">
                <div className="entry-editor-lightbox__toolbar">
                    <div className="entry-editor-lightbox__meta">
                        <span>{currentIndex + 1} / {images.length}</span>
                        {currentImage?.is_cover && <span className="entry-editor-lightbox__badge">主图</span>}
                    </div>
                    <div className="entry-editor-lightbox__actions">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setViewMode((current) => current === 'preview' ? 'gallery' : 'preview')}
                        >
                            {viewMode === 'preview' ? '缩略图' : '大图预览'}
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onSetCover(currentIndex)}
                        >
                            设为主图
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleOpenLocalPath()}
                        >
                            打开所在文件夹
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRemoveClick()}
                        >
                            移除
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={onClose}
                        >
                            关闭
                        </Button>
                    </div>
                </div>

                {viewMode === 'preview' ? (
                    <>
                        <div className="entry-editor-lightbox__main">
                            {currentImage?.src ? (
                                <img
                                    src={currentImage.src}
                                    alt={currentImage.alt || infoTitle}
                                    className="entry-editor-lightbox__image"
                                />
                            ) : (
                                <div className="entry-editor-lightbox__empty">图片路径不可预览</div>
                            )}
                        </div>
                        {renderImageRail()}
                    </>
                ) : (
                    <div className="entry-editor-lightbox__gallery-view">
                        {renderImageRail()}
                    </div>
                )}
            </div>
        </div>
    )
}
