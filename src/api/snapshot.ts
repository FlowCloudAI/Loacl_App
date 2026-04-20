import {command} from './base'

export interface SnapshotInfo {
  id: string
  message: string
  timestamp: number
}

export interface SnapshotBranchInfo {
    name: string
    head?: string | null
    isCurrent: boolean
    isActive: boolean
}

export interface SnapshotGraphBranch {
    name: string
    target?: string | null
    isCurrent: boolean
    isActive: boolean
}

export interface SnapshotGraphNode {
    id: string
    shortId: string
    message: string
    timestamp: number
    parents: string[]
    branchNames: string[]
    isCurrentHead: boolean
    isActiveTip: boolean
}

export interface SnapshotGraph {
    activeBranch: string
    branches: SnapshotGraphBranch[]
    nodes: SnapshotGraphNode[]
}

export interface AppendResult {
  projects: number
  categories: number
  entries: number
  tagSchemas: number
  relations: number
  links: number
  entryTypes: number
  ideaNotes: number
}

export const dbSnapshot = () =>
  command<void>('db_snapshot')

export const dbSnapshotWithMessage = (message: string) =>
    command<void>('db_snapshot_with_message', {message})

export const dbGetActiveBranch = () =>
    command<string>('db_get_active_branch')

export const dbListBranches = () =>
    command<SnapshotBranchInfo[]>('db_list_branches')

export const dbCreateBranch = (branchName: string, fromRef?: string | null) =>
    command<void>('db_create_branch', {branchName, fromRef: fromRef ?? null})

export const dbSwitchBranch = (branchName: string) =>
    command<void>('db_switch_branch', {branchName})

export const dbListSnapshots = () =>
  command<SnapshotInfo[]>('db_list_snapshots')

export const dbListSnapshotsInBranch = (branchName: string) =>
    command<SnapshotInfo[]>('db_list_snapshots_in_branch', {branchName})

export const dbGetSnapshotGraph = () =>
    command<SnapshotGraph>('db_get_snapshot_graph')

export const dbSnapshotToBranch = (branchName: string, message: string) =>
    command<void>('db_snapshot_to_branch', {branchName, message})

export const dbRollbackTo = (snapshotId: string) =>
  command<void>('db_rollback_to', { snapshotId })

export const dbAppendFrom = (snapshotId: string) =>
  command<AppendResult>('db_append_from', { snapshotId })
