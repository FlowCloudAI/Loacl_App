import {useEffect, useMemo, useRef, useState} from 'react'
import {Button, Timeline, type TimelineEvent} from 'flowcloudai-ui'
import './TimelineDemo.css'

interface TimelinePreset {
    key: string
    label: string
    description: string
    yearStart: number
    yearEnd: number
    events: TimelineEvent[]
    overviewEvents: TimelineEvent[]
}

const TIMELINE_PRESETS: TimelinePreset[] = [
    {
        key: 'silk-road',
        label: '丝路编年',
        description: '混合单点事件与持续区间，适合联调 BCE/CE 跨越、区间条渲染、选中态与双时间线协同滚动。',
        yearStart: -150,
        yearEnd: 650,
        events: [
            {
                id: 'han-expansion',
                title: '张骞通西域',
                startTime: -138,
                description: '作为远行型单点事件，验证 BCE 年份显示与起点定位。',
            },
            {
                id: 'western-han-route',
                title: '汉朝经营西域',
                startTime: -60,
                endTime: 220,
                description: '长区间事件，用于观察持续段在不同缩放下的宽度变化。',
            },
            {
                id: 'kushan-rise',
                title: '贵霜帝国兴起',
                startTime: 30,
                endTime: 375,
                description: '与中亚商路相关的父级区间事件。',
            },
            {
                id: 'kushan-trade-peak',
                title: '贵霜贸易高峰',
                startTime: 127,
                endTime: 250,
                description: '子事件，验证 parentId 层级关系。',
                parentId: 'kushan-rise',
            },
            {
                id: 'roman-envoy',
                title: '大秦使者传闻',
                startTime: 166,
                description: '点状事件，方便测试点击选中与详情面板联动。',
            },
            {
                id: 'jin-fracture',
                title: '西晋末年交通受阻',
                startTime: 304,
                endTime: 439,
                description: '区间跨度中等，便于观察紧密事件堆叠布局。',
            },
            {
                id: 'northern-wei',
                title: '北魏整合北方',
                startTime: 386,
                endTime: 534,
                description: '后段区间事件，测试大范围时间轴在右侧滚动后的可见性。',
            },
            {
                id: 'xuanzang-ready',
                title: '玄奘西行前夜',
                startTime: 626,
                description: '结束端附近的单点事件，验证最右侧留白与选中。',
            },
        ],
        overviewEvents: [
            {id: 'overview-han', title: '两汉阶段', startTime: -150, endTime: 220},
            {id: 'overview-kushan', title: '贵霜阶段', startTime: 30, endTime: 375},
            {id: 'overview-fracture', title: '交通波动', startTime: 220, endTime: 534},
            {id: 'overview-sui-tang', title: '隋唐恢复', startTime: 581, endTime: 650},
        ],
    },
    {
        key: 'sea-route',
        label: '航海纪元',
        description: '更密集的近代时间段，适合观察缩放、连续区间和多事件快速切换的交互稳定性。',
        yearStart: 1400,
        yearEnd: 1920,
        events: [
            {
                id: 'ming-voyages',
                title: '郑和下西洋',
                startTime: 1405,
                endTime: 1433,
                description: '早段连续航海区间。',
            },
            {
                id: 'dias-round',
                title: '迪亚士抵达好望角',
                startTime: 1488,
                description: '单点事件，检查高密度近代节点的可点选性。',
            },
            {
                id: 'gama-route',
                title: '达伽马开辟航路',
                startTime: 1497,
                endTime: 1499,
                description: '短区间事件，适合观察缩放下的最小宽度表现。',
            },
            {
                id: 'iberian-network',
                title: '伊比利亚海上网络',
                startTime: 1500,
                endTime: 1640,
                description: '父级持续区间。',
            },
            {
                id: 'manila-trade',
                title: '马尼拉大帆船贸易',
                startTime: 1565,
                endTime: 1815,
                description: '超长区间，测试长条事件在拖拽滚动中的跟随感。',
                parentId: 'iberian-network',
            },
            {
                id: 'east-india',
                title: '东印度公司体系',
                startTime: 1600,
                endTime: 1874,
                description: '中后段长区间，和上一事件存在明显重叠。',
            },
            {
                id: 'steam-route',
                title: '蒸汽航运普及',
                startTime: 1838,
                endTime: 1914,
                description: '工业时代区间。',
            },
            {
                id: 'panama-open',
                title: '巴拿马运河通航',
                startTime: 1914,
                description: '时间范围尾部的点状事件。',
            },
        ],
        overviewEvents: [
            {id: 'overview-exploration', title: '大航海探索', startTime: 1400, endTime: 1550},
            {id: 'overview-colonial', title: '殖民航运', startTime: 1500, endTime: 1815},
            {id: 'overview-industrial', title: '工业航运', startTime: 1815, endTime: 1920},
        ],
    },
]

function formatYear(year: number) {
    if (year < 0) return `公元前 ${Math.abs(year)} 年`
    return `公元 ${year} 年`
}

function formatRange(event: TimelineEvent) {
    if (typeof event.endTime === 'number') {
        return `${formatYear(event.startTime)} - ${formatYear(event.endTime)}`
    }
    return formatYear(event.startTime)
}

export default function TimelineDemo() {
    const [presetKey, setPresetKey] = useState(TIMELINE_PRESETS[0].key)
    const [selectedEventId, setSelectedEventId] = useState<string | null>(TIMELINE_PRESETS[0].events[0]?.id ?? null)

    const activePreset = useMemo(
        () => TIMELINE_PRESETS.find((preset) => preset.key === presetKey) ?? TIMELINE_PRESETS[0],
        [presetKey],
    )

    const selectedIndex = useMemo(
        () => activePreset.events.findIndex((event) => event.id === selectedEventId),
        [activePreset.events, selectedEventId],
    )

    const eventStats = useMemo(() => {
        const rangeEvents = activePreset.events.filter((event) => typeof event.endTime === 'number').length
        const pointEvents = activePreset.events.length - rangeEvents
        const hierarchyEvents = activePreset.events.filter((event) => event.parentId).length
        return {rangeEvents, pointEvents, hierarchyEvents}
    }, [activePreset.events])

    const heroListRef = useRef<HTMLDivElement>(null)
    const heroCardRefs = useRef<Record<string, HTMLDivElement | null>>({})

    // 键盘左右键切换 Hero Card
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
            e.preventDefault()
            const currentIndex = activePreset.events.findIndex((ev) => ev.id === selectedEventId)
            if (currentIndex === -1) return
            let nextIndex: number
            if (e.key === 'ArrowLeft') {
                nextIndex = Math.max(0, currentIndex - 1)
            } else {
                nextIndex = Math.min(activePreset.events.length - 1, currentIndex + 1)
            }
            if (nextIndex !== currentIndex) {
                setSelectedEventId(activePreset.events[nextIndex].id)
            }
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [activePreset.events, selectedEventId])

    // Hero Card 切换时，滚动 Hero 列表到对应卡片
    useEffect(() => {
        if (!selectedEventId) return
        const cardEl = heroCardRefs.current[selectedEventId]
        const listEl = heroListRef.current
        if (!cardEl || !listEl) return
        const listRect = listEl.getBoundingClientRect()
        const cardRect = cardEl.getBoundingClientRect()
        const scrollLeft = listEl.scrollLeft + cardRect.left - listRect.left - (listRect.width - cardRect.width) / 2
        listEl.scrollTo({left: scrollLeft, behavior: 'smooth'})
    }, [selectedEventId])

    const handleTimelineSelect = (eventId: string | null) => {
        setSelectedEventId(eventId)
    }

    return (
        <div className="timeline-demo">
            <div className="timeline-demo__header">
                <div>
                    <p className="timeline-demo__eyebrow">Timeline 本地联调入口</p>
                    <h1 className="timeline-demo__title">时间线 Demo</h1>
                    <p className="timeline-demo__description">
                        上方使用 Hero Card 列表通过左右键切换事件，下方 Timeline 自动滚动到对应位置；点击下方事件也会同步更新上方焦点。
                    </p>
                </div>
                <div className="timeline-demo__actions">
                    {TIMELINE_PRESETS.map((preset) => (
                        <Button
                            key={preset.key}
                            size="sm"
                            variant={preset.key === activePreset.key ? 'outline' : 'ghost'}
                            onClick={() => {
                                setPresetKey(preset.key)
                                setSelectedEventId(preset.events[0]?.id ?? null)
                            }}
                        >
                            {preset.label}
                        </Button>
                    ))}
                    <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setSelectedEventId(null)}
                    >
                        清空选中
                    </Button>
                    <Button
                        size="sm"
                        onClick={() => setSelectedEventId(activePreset.events[0]?.id ?? null)}
                    >
                        重置焦点
                    </Button>
                </div>
            </div>

            <div className="timeline-demo__meta">
                <div className="timeline-demo__meta-card">
                    <span className="timeline-demo__meta-label">事件总数</span>
                    <span className="timeline-demo__meta-value">{activePreset.events.length} 个</span>
                </div>
                <div className="timeline-demo__meta-card">
                    <span className="timeline-demo__meta-label">持续区间</span>
                    <span className="timeline-demo__meta-value">{eventStats.rangeEvents} 个</span>
                </div>
                <div className="timeline-demo__meta-card">
                    <span className="timeline-demo__meta-label">单点事件</span>
                    <span className="timeline-demo__meta-value">{eventStats.pointEvents} 个</span>
                </div>
                <div className="timeline-demo__meta-card">
                    <span className="timeline-demo__meta-label">层级事件</span>
                    <span className="timeline-demo__meta-value">{eventStats.hierarchyEvents} 个</span>
                </div>
                <div className="timeline-demo__meta-card timeline-demo__meta-card--wide">
                    <span className="timeline-demo__meta-label">时间范围</span>
                    <span className="timeline-demo__meta-value">
                        {formatYear(activePreset.yearStart)} - {formatYear(activePreset.yearEnd)}
                    </span>
                </div>
                <div className="timeline-demo__meta-card timeline-demo__meta-card--wide">
                    <span className="timeline-demo__meta-label">预设说明</span>
                    <span className="timeline-demo__meta-value timeline-demo__meta-value--normal">
                        {activePreset.description}
                    </span>
                </div>
            </div>

            {/* Hero Card 列表 */}
            <div className="timeline-demo__hero-panel">
                <div className="timeline-demo__panel-head">
                    <div>
                        <h2 className="timeline-demo__panel-title">事件概览</h2>
                        <p className="timeline-demo__panel-text">
                            使用 ← → 方向键切换当前焦点事件，下方 Timeline 会自动跟随滚动。
                        </p>
                    </div>
                    <span className="timeline-demo__sync-tag">
                        {selectedIndex + 1} / {activePreset.events.length}
                    </span>
                </div>
                <div className="timeline-demo__hero-list" ref={heroListRef}>
                    {activePreset.events.map((event) => {
                        const isSelected = event.id === selectedEventId
                        return (
                            <div
                                key={event.id}
                                ref={(el) => {
                                    heroCardRefs.current[event.id] = el
                                }}
                                className={`timeline-demo__hero-card ${isSelected ? 'timeline-demo__hero-card--selected' : ''}`}
                                onClick={() => setSelectedEventId(event.id)}
                                tabIndex={0}
                                role="button"
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault()
                                        setSelectedEventId(event.id)
                                    }
                                }}
                            >
                                <div className="timeline-demo__hero-title">{event.title}</div>
                                <div className="timeline-demo__hero-range">{formatRange(event)}</div>
                                <p className="timeline-demo__hero-desc">{event.description}</p>
                            </div>
                        )
                    })}
                </div>
            </div>

            <div className="timeline-demo__timeline-panel">
                <div className="timeline-demo__panel-head">
                    <div>
                        <h2 className="timeline-demo__panel-title">主时间线</h2>
                        <p className="timeline-demo__panel-text">
                            鼠标放在时间轴区域滚轮缩放，事件内容区域滚轮横向平滑滚动，点击事件卡片与上方 Hero 列表联动。
                        </p>
                    </div>
                </div>
                <div className="timeline-demo__timeline-shell">
                    <Timeline
                        events={activePreset.events}
                        yearStart={activePreset.yearStart}
                        yearEnd={activePreset.yearEnd}
                        selectedEventId={selectedEventId}
                        onEventSelect={handleTimelineSelect}
                    />
                </div>
            </div>
        </div>
    )
}
