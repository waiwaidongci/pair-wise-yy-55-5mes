export interface ScoreNote {
  id: string
  key: string
  duration: 'q' | 'h' | '8'
  accidental?: '#' | 'b' | 'n'
  dynamic: 'pp' | 'p' | 'mp' | 'mf' | 'f' | 'ff'
  tie: boolean
  expression: string
}

export interface Track {
  id: string
  name: string
  instrument: string
  clef: 'treble' | 'bass' | 'alto'
  transposition: number
  color: string
  notes: ScoreNote[]
}

/** 分谱出版设置：换页位置与提示音 */
export interface PartSettings {
  /** 建议在第几小节后换页 */
  pageTurnAfter: number
  /** 换页前保留的提示音小节数 */
  cueMeasures: number
  /** 是否在分谱中显示提示音 */
  showCue: boolean
}

export interface ScoreComment {
  id: string
  measure: number
  author: string
  content: string
  resolved: boolean
}

export interface ScoreVersion {
  id: string
  author: string
  time: string
  summary: string
  trackNotes: Record<string, ScoreNote[]>
  partSettings: Record<string, PartSettings>
}

export type DiffKind = 'pitch' | 'duration' | 'dynamic' | 'tie' | 'pageTurn'
export type DiffDecision = 'pending' | 'accepted' | 'rejected'

/** 两个版本之间的一条差异及其处置结论 */
export interface VersionDiff {
  id: string
  kind: DiffKind
  trackId: string
  /** 1 起的小节号；换页提示差异表示换页所在小节 */
  measure: number
  /** 声部内音符序号（0 起）；换页提示差异为 -1 */
  noteIndex: number
  field: string
  before: string
  after: string
  /** 接受后并入总谱的音符补丁（换页提示差异为空） */
  patch?: Partial<ScoreNote>
  /** 拒绝后保留的原值补丁 */
  revert?: Partial<ScoreNote>
  linkedCommentId?: string
  decision: DiffDecision
}

/** 锁定后生成的单册分谱 */
export interface PartBook {
  trackId: string
  trackName: string
  instrument: string
  transposition: number
  settings: PartSettings
  notes: ScoreNote[]
}

/** 出版基线：锁定时的总谱与四册分谱快照 */
export interface PublishingBaseline {
  id: string
  label: string
  lockedAt: string
  basedOn: string
  trackNotes: Record<string, ScoreNote[]>
  partSettings: Record<string, PartSettings>
  parts: PartBook[]
  acceptedCount: number
  rejectedCount: number
}
