export interface ScoreNote {
  id: string
  key: string
  duration: 'q' | 'h' | '8'
  accidental?: '#' | 'b' | 'n'
  dynamic: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'
  tie: boolean
  expression: string
}

/** 每声部的换页与提示音设置（随版本快照保存） */
export interface CueSettings {
  /** 在第几小节之后换页 */
  turnAfterMeasure: number
  /** 换页处保留几小节同声部提示音 */
  cueMeasures: number
}

export interface Track {
  id: string
  name: string
  instrument: string
  clef: 'treble' | 'bass' | 'alto'
  transposition: number
  color: string
  notes: ScoreNote[]
  cues: CueSettings
}

export type CommentDisposition = 'adopted' | 'refused' | 'noted'

/** 评论到具体差异项的锚点（音符类给出 noteId，换页类留空） */
export interface CommentAnchor {
  trackId: string
  noteId?: string
  field: ChangeField
}

export interface ScoreComment {
  id: string
  measure: number
  author: string
  content: string
  resolved: boolean
  disposition?: CommentDisposition
  link?: CommentAnchor
}

/** 可比较的差异字段：音符属性 + 换页提示 */
export type ChangeField =
  | 'key'
  | 'duration'
  | 'dynamic'
  | 'tie'
  | 'expression'
  | 'cueAfterMeasure'
  | 'cueMeasures'

export type HunkStatus = 'pending' | 'accepted' | 'rejected'

export interface ChangeHunk {
  id: string
  trackId: string
  trackName: string
  kind: 'note' | 'cue'
  noteId?: string
  measure?: number
  beat?: number
  field: ChangeField
  label: string
  oldValue: string
  newValue: string
  status: HunkStatus
  linkedCommentId?: string
}

/** 差异处置草稿：逐条比较两个版本，接受后才并入总谱 */
export interface ReviewDraft {
  id: string
  baseId: string
  targetId: string
  startedAt: string
  hunks: ChangeHunk[]
}

export interface ScoreVersion {
  id: string
  author: string
  time: string
  summary: string
  trackNotes: Record<string, ScoreNote[]>
  cues: Record<string, CueSettings>
  /** 锁定后的出版冻结稿 */
  frozen?: boolean
}

/** 分谱生成时的全局设置，锁定基线时一并冻结 */
export interface PartSettings {
  showCueNotes: boolean
  cueMeasures: number
  turnAfterMeasure: number
}

export interface Baseline {
  id: string
  label: string
  createdAt: string
  sourceIds: [string, string]
  tracks: Track[]
  partSettings: PartSettings
  accepted: number
  rejected: number
}
