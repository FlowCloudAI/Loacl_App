import {useCallback, useEffect, useMemo, useState} from 'react'
import {Button, Input, Select, useAlert} from 'flowcloudai-ui'
import {
    type AppendResult,
    dbAppendFrom,
    dbCreateBranch,
    dbGetSnapshotGraph,
    dbListBranches,
    dbRollbackTo,
    dbSnapshot,
    dbSnapshotWithMessage,
    dbSwitchBranch,
    type SnapshotBranchInfo,
    type SnapshotGraph,
    type SnapshotGraphNode,
} from '../api'
import './SnapshotPanel.css'

interface SnapshotPanelProps {
    className?: string
}

interface SnapshotGraphRow {
    node: SnapshotGraphNode
    lane: number
    laneCount: number
    lanePresenceAbove: boolean[]
    lanePresenceBelow: boolean[]
    connections: number[]
}

const GRAPH_COLORS = [
    '#ff8a65',
    '#4db6ac',
    '#64b5f6',
    '#ffd54f',
    '#ba68c8',
    '#81c784',
    '#f06292',
]

const LANE_GAP = 22
const GRAPH_MARGIN = 12

function formatSnapshotTime(timestamp: number): string {
    const date = new Date(timestamp * 1000)
    return new Intl.DateTimeFormat('zh-CN', {
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    }).format(date)
}

function formatSnapshotMessage(message: string): string {
    const parts = message.split(' ')
    if (parts.length >= 2 && (parts[0] === 'auto' || parts[0] === 'manual')) {
        return parts[0] === 'auto' ? '自动保存' : '手动保存'
    }
    return message
}

function getFirstEmptyLane(lanes: Array<string | null>): number {
    const index = lanes.findIndex(lane => lane === null)
    if (index >= 0) return index
    lanes.push(null)
    return lanes.length - 1
}

function buildGraphRows(nodes: SnapshotGraphNode[]): SnapshotGraphRow[] {
    const activeLanes: Array<string | null> = []
    const rows: SnapshotGraphRow[] = []

    for (const node of nodes) {
        let lane = activeLanes.findIndex(entry => entry === node.id)
        if (lane < 0) {
            lane = getFirstEmptyLane(activeLanes)
            activeLanes[lane] = node.id
        }

        const lanePresenceAbove = activeLanes.map(entry => entry !== null)
        const nextLanes = [...activeLanes]
        const connections: number[] = []
        const [firstParent, ...otherParents] = node.parents

        if (firstParent) {
            nextLanes[lane] = firstParent
            connections.push(lane)
        } else {
            nextLanes[lane] = null
        }

        for (const parentId of otherParents) {
            let parentLane = nextLanes.findIndex(entry => entry === parentId)
            if (parentLane < 0) {
                parentLane = getFirstEmptyLane(nextLanes)
                nextLanes[parentLane] = parentId
            }
            connections.push(parentLane)
        }

        while (nextLanes.length > 0 && nextLanes[nextLanes.length - 1] === null) {
            nextLanes.pop()
        }

        rows.push({
            node,
            lane,
            laneCount: Math.max(lanePresenceAbove.length, nextLanes.length, lane + 1),
            lanePresenceAbove,
            lanePresenceBelow: nextLanes.map(entry => entry !== null),
            connections,
        })

        activeLanes.splice(0, activeLanes.length, ...nextLanes)
    }

    return rows
}

function laneX(lane: number): number {
    return GRAPH_MARGIN + lane * LANE_GAP
}

export default function SnapshotPanel({className}: SnapshotPanelProps) {
    const {showAlert} = useAlert()
    const [branches, setBranches] = useState<SnapshotBranchInfo[]>([])
    const [graph, setGraph] = useState<SnapshotGraph>({activeBranch: '', branches: [], nodes: []})
    const [activeBranch, setActiveBranch] = useState('')
    const [loading, setLoading] = useState(false)
    const [actionId, setActionId] = useState<string | null>(null)
    const [saving, setSaving] = useState(false)
    const [branchSwitching, setBranchSwitching] = useState(false)
    const [message, setMessage] = useState('')
    const [newBranchName, setNewBranchName] = useState('')

    const load = useCallback(async () => {
        setLoading(true)
        try {
            const [branchList, snapshotGraph] = await Promise.all([
                dbListBranches(),
                dbGetSnapshotGraph(),
            ])
            setBranches(branchList)
            setGraph(snapshotGraph)
            setActiveBranch(snapshotGraph.activeBranch)
        } catch (error) {
            console.error('加载快照图失败', error)
            void showAlert('加载版本信息失败', 'error')
        } finally {
            setLoading(false)
        }
    }, [showAlert])

    useEffect(() => {
        void load()
    }, [load])

    const handleSnapshot = useCallback(async () => {
        setSaving(true)
        try {
            const trimmedMessage = message.trim()
            if (trimmedMessage) {
                await dbSnapshotWithMessage(trimmedMessage)
            } else {
                await dbSnapshot()
            }
            setMessage('')
            void showAlert('快照已创建', 'success')
            await load()
        } catch (error) {
            console.error('创建快照失败', error)
            void showAlert('创建快照失败', 'error')
        } finally {
            setSaving(false)
        }
    }, [load, message, showAlert])

    const handleCreateBranch = useCallback(async () => {
        const trimmedName = newBranchName.trim()
        if (!trimmedName) {
            void showAlert('请输入分支名称', 'warning')
            return
        }

        try {
            await dbCreateBranch(trimmedName)
            setNewBranchName('')
            void showAlert('分支已创建', 'success')
            await load()
        } catch (error) {
            console.error('创建分支失败', error)
            void showAlert('创建分支失败', 'error')
        }
    }, [load, newBranchName, showAlert])

    const handleSwitchBranch = useCallback(async (branchName: string) => {
        if (!branchName || branchName === activeBranch) return

        const confirmed = await showAlert(
            `切换到分支「${branchName}」会把数据库恢复到该分支最新版本，是否继续？`,
            'warning',
            'confirm',
        )
        if (confirmed !== 'yes') return

        setBranchSwitching(true)
        try {
            await dbSwitchBranch(branchName)
            void showAlert(`已切换到分支「${branchName}」`, 'success')
            await load()
        } catch (error) {
            console.error('切换分支失败', error)
            void showAlert('切换分支失败', 'error')
        } finally {
            setBranchSwitching(false)
        }
    }, [activeBranch, load, showAlert])

    const handleRollback = useCallback(async (snapshot: Pick<SnapshotGraphNode, 'id' | 'message'>) => {
        const confirmed = await showAlert(
            `确定回退到「${formatSnapshotMessage(snapshot.message)}」？\n当前状态会先自动保存。`,
            'warning',
            'confirm',
        )
        if (confirmed !== 'yes') return

        setActionId(snapshot.id)
        try {
            await dbRollbackTo(snapshot.id)
            void showAlert('回退成功', 'success')
            await load()
        } catch (error) {
            console.error('回退失败', error)
            void showAlert('回退失败', 'error')
        } finally {
            setActionId(null)
        }
    }, [load, showAlert])

    const handleAppend = useCallback(async (snapshot: Pick<SnapshotGraphNode, 'id' | 'message'>) => {
        const confirmed = await showAlert(
            `确定从「${formatSnapshotMessage(snapshot.message)}」追加恢复缺失记录？`,
            'warning',
            'confirm',
        )
        if (confirmed !== 'yes') return

        setActionId(snapshot.id)
        try {
            const result: AppendResult = await dbAppendFrom(snapshot.id)
            const parts = [
                result.projects && `项目 ${result.projects}`,
                result.categories && `分类 ${result.categories}`,
                result.entries && `词条 ${result.entries}`,
                result.tagSchemas && `标签 ${result.tagSchemas}`,
                result.relations && `关系 ${result.relations}`,
                result.links && `链接 ${result.links}`,
                result.entryTypes && `类型 ${result.entryTypes}`,
                result.ideaNotes && `便签 ${result.ideaNotes}`,
            ].filter(Boolean)
            void showAlert(parts.length > 0 ? `已恢复: ${parts.join(', ')}` : '无新增记录', 'success')
            await load()
        } catch (error) {
            console.error('追加恢复失败', error)
            void showAlert('追加恢复失败', 'error')
        } finally {
            setActionId(null)
        }
    }, [load, showAlert])

    const branchOptions = useMemo(() => (
        branches.map(branch => ({
            value: branch.name,
            label: branch.isActive ? `${branch.name}（当前）` : branch.name,
        }))
    ), [branches])

    const graphRows = useMemo(() => buildGraphRows(graph.nodes), [graph.nodes])

    return (
        <div className={`snapshot-panel${className ? ` ${className}` : ''}`}>
            <div className="snapshot-panel__header">
                <h3 className="snapshot-panel__title">版本管理</h3>
            </div>

            <div className="snapshot-panel__section">
                <div className="snapshot-panel__section-title">当前分支</div>
                <div className="snapshot-panel__branch-row">
                    <Select
                        options={branchOptions}
                        value={activeBranch}
                        onChange={(value) => void handleSwitchBranch(String(value))}
                        style={{flex: 1}}
                        disabled={loading || branchSwitching || branches.length === 0}
                    />
                    <span className="snapshot-panel__branch-badge">{activeBranch || '未初始化'}</span>
                </div>
                <div className="snapshot-panel__branch-create">
                    <Input
                        placeholder="新分支名称，例如 feature/世界观重写"
                        value={newBranchName}
                        onChange={setNewBranchName}
                    />
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleCreateBranch()}
                        disabled={loading || branchSwitching}
                    >
                        新建分支
                    </Button>
                </div>
            </div>

            <div className="snapshot-panel__section">
                <div className="snapshot-panel__section-title">手动保存</div>
                <div className="snapshot-panel__save-row">
                    <Input
                        placeholder="可选：输入本次版本说明"
                        value={message}
                        onChange={setMessage}
                    />
                    <Button variant="primary" size="sm" onClick={() => void handleSnapshot()}
                            disabled={loading || saving}>
                        保存
                    </Button>
                </div>
            </div>

            {loading && graphRows.length === 0 ? (
                <div className="snapshot-panel__empty">正在加载…</div>
            ) : graphRows.length === 0 ? (
                <div className="snapshot-panel__empty">
                    {activeBranch ? `分支「${activeBranch}」暂无历史版本` : '暂无历史版本'}
                </div>
            ) : (
                <div className="snapshot-panel__graph">
                    {graphRows.map((row, index) => {
                        const svgWidth = Math.max(84, GRAPH_MARGIN * 2 + row.laneCount * LANE_GAP)
                        const centerY = 26
                        const bottomY = 52
                        return (
                            <div key={row.node.id} className="snapshot-panel__graph-row">
                                <div className="snapshot-panel__graph-rail" style={{width: `${svgWidth}px`}}>
                                    <svg width={svgWidth} height={58} viewBox={`0 0 ${svgWidth} 58`}
                                         className="snapshot-panel__graph-svg">
                                        {Array.from({length: row.laneCount}, (_, lane) => {
                                            const color = GRAPH_COLORS[lane % GRAPH_COLORS.length]
                                            const x = laneX(lane)
                                            const hasTop = row.lanePresenceAbove[lane]
                                            const hasBottom = row.lanePresenceBelow[lane]
                                            return (
                                                <g key={`${row.node.id}-lane-${lane}`}>
                                                    {hasTop ? <line x1={x} y1="0" x2={x} y2={centerY} stroke={color}
                                                                    strokeWidth="2"/> : null}
                                                    {hasBottom ?
                                                        <line x1={x} y1={centerY} x2={x} y2={bottomY} stroke={color}
                                                              strokeWidth="2"/> : null}
                                                </g>
                                            )
                                        })}
                                        {row.connections
                                            .filter(parentLane => parentLane !== row.lane)
                                            .map(parentLane => {
                                                const fromX = laneX(row.lane)
                                                const toX = laneX(parentLane)
                                                const color = GRAPH_COLORS[parentLane % GRAPH_COLORS.length]
                                                return (
                                                    <path
                                                        key={`${row.node.id}-${parentLane}`}
                                                        d={`M ${fromX} ${centerY} C ${fromX} ${centerY + 10}, ${toX} ${centerY + 12}, ${toX} ${bottomY}`}
                                                        fill="none"
                                                        stroke={color}
                                                        strokeWidth="2"
                                                    />
                                                )
                                            })}
                                        <circle
                                            cx={laneX(row.lane)}
                                            cy={centerY}
                                            r={row.node.isActiveTip || row.node.isCurrentHead ? 6 : 5}
                                            fill={row.node.isActiveTip ? 'var(--fc-color-primary)' : GRAPH_COLORS[row.lane % GRAPH_COLORS.length]}
                                            stroke="var(--fc-color-bg)"
                                            strokeWidth="2"
                                        />
                                    </svg>
                                </div>
                                <div
                                    className={`snapshot-panel__item${row.node.isActiveTip ? ' snapshot-panel__item--active' : ''}`}>
                                    <div className="snapshot-panel__item-meta">
                                        <span className="snapshot-panel__item-index">#{graphRows.length - index}</span>
                                        <span className="snapshot-panel__item-type">
                                            {row.node.message.startsWith('auto') ? '自动' : '手动'}
                                        </span>
                                        {row.node.isActiveTip ?
                                            <span className="snapshot-panel__item-badge">活动分支</span> : null}
                                        {row.node.isCurrentHead && !row.node.isActiveTip ?
                                            <span className="snapshot-panel__item-badge">HEAD</span> : null}
                                    </div>
                                    <div className="snapshot-panel__item-time">
                                        {formatSnapshotTime(row.node.timestamp)}
                                    </div>
                                    <div className="snapshot-panel__item-message">
                                        {formatSnapshotMessage(row.node.message)}
                                    </div>
                                    <div className="snapshot-panel__item-id">
                                        {row.node.shortId}
                                    </div>
                                    {row.node.branchNames.length > 0 ? (
                                        <div className="snapshot-panel__branch-tags">
                                            {row.node.branchNames.map(branchName => (
                                                <span key={`${row.node.id}-${branchName}`}
                                                      className="snapshot-panel__branch-tag">
                                                    {branchName}
                                                </span>
                                            ))}
                                        </div>
                                    ) : null}
                                    <div className="snapshot-panel__item-actions">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={actionId === row.node.id}
                                            onClick={() => void handleRollback(row.node)}
                                        >
                                            回退
                                        </Button>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            disabled={actionId === row.node.id}
                                            onClick={() => void handleAppend(row.node)}
                                        >
                                            恢复
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )
                    })}
                </div>
            )}
        </div>
    )
}
