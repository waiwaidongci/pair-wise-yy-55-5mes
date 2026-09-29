import type { PartSettings, ScoreComment, ScoreNote, ScoreVersion, Track } from './types'

const notes = (keys: string[]): ScoreNote[] => keys.map((key, index) => ({ id: `N-${index + 1}`, key, duration: index % 4 === 0 ? 'h' : 'q', dynamic: index < 2 ? 'mp' : 'mf', tie: index === 2, expression: index === 3 ? 'dolce' : '' }))

export const seedTracks: Track[] = [
  { id: 'TR-01', name: '长笛', instrument: 'Flute', clef: 'treble', transposition: 0, color: '#2563eb', notes: notes(['c/5','d/5','e/5','g/5','a/5','g/5','e/5','d/5','c/5','e/5','g/5','a/5']) },
  { id: 'TR-02', name: '单簧管', instrument: 'Clarinet in Bb', clef: 'treble', transposition: -2, color: '#7c3aed', notes: notes(['d/4','e/4','f/4','a/4','c/5','a/4','f/4','e/4','d/4','f/4','a/4','c/5']) },
  { id: 'TR-03', name: '圆号', instrument: 'Horn in F', clef: 'treble', transposition: -7, color: '#d97706', notes: notes(['g/3','a/3','c/4','d/4','e/4','d/4','c/4','a/3','g/3','c/4','d/4','e/4']) },
  { id: 'TR-04', name: '大提琴', instrument: 'Violoncello', clef: 'bass', transposition: 0, color: '#059669', notes: notes(['c/3','g/3','e/3','d/3','c/3','g/3','a/3','g/3','c/3','e/3','g/3','a/3']) },
]

export const seedComments: ScoreComment[] = [
  { id: 'CM-1', measure: 2, author: '指挥 · 方亦', content: '圆号第 2 小节进入需再弱一级，避免覆盖大提琴主题。', resolved: false },
  { id: 'CM-2', measure: 3, author: '作曲 · 沈青', content: '第 3 小节末音增加延音线，与下一小节第一拍连奏。', resolved: false },
  { id: 'CM-3', measure: 6, author: '出版 · 赵晴', content: '单簧管分谱需在换页处保留 2 小节提示音。', resolved: true },
]

/** 评论锚点：声部:音符序号（或 :pageTurn）→ 评论 id */
export const commentAnchors: Record<string, string> = {
  'TR-03:4': 'CM-1',
  'TR-03:11': 'CM-2',
  'TR-02:pageTurn': 'CM-3',
}

const defaultSettings = (): PartSettings => ({ pageTurnAfter: 6, cueMeasures: 0, showCue: true })

/** 当前分谱出版设置（与 v11 一致） */
export const seedPartSettings: Record<string, PartSettings> = Object.fromEntries(seedTracks.map((track) => [track.id, defaultSettings()]))

const v11TrackNotes = Object.fromEntries(seedTracks.map((track) => [track.id, structuredClone(track.notes)]))

/** v12 在 v11 基础上的改动：终段和声、圆号力度、第 3 小节末延音线、单簧管换页提示音 */
const v12TrackNotes = structuredClone(v11TrackNotes)
v12TrackNotes['TR-01']![11]!.key = 'g/5'
v12TrackNotes['TR-03']![4]!.dynamic = 'mp'
v12TrackNotes['TR-03']![11]!.tie = true

const v12PartSettings = structuredClone(seedPartSettings)
v12PartSettings['TR-02']!.cueMeasures = 2

export const seedVersions: ScoreVersion[] = [
  { id: 'v12', author: '沈青', time: '今天 16:28', summary: '调整终段和声，补充圆号力度与连音线', trackNotes: v12TrackNotes, partSettings: v12PartSettings },
  { id: 'v11', author: '方亦', time: '今天 14:10', summary: '移调单簧管分谱并调整换气标记', trackNotes: v11TrackNotes, partSettings: structuredClone(seedPartSettings) },
]
