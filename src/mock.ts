import type { CueSettings, ScoreComment, ScoreNote, ScoreVersion, Track } from './types'

interface SeedTrack {
  id: string
  name: string
  instrument: string
  clef: Track['clef']
  transposition: number
  color: string
  keys: string[]
  /** 覆盖个别音符的属性（按序号） */
  overrides?: Partial<ScoreNote>[]
  cues: CueSettings
}

const buildNotes = (keys: string[], overrides: Partial<ScoreNote>[] = []): ScoreNote[] =>
  keys.map((key, index) => ({
    id: `N-${index + 1}`,
    key,
    duration: index % 4 === 0 ? 'h' : 'q',
    dynamic: index < 2 ? 'mp' : 'mf',
    tie: index === 2,
    expression: index === 3 ? 'dolce' : '',
    ...overrides[index],
  }))

const toTrack = (seed: SeedTrack): Track => ({
  id: seed.id,
  name: seed.name,
  instrument: seed.instrument,
  clef: seed.clef,
  transposition: seed.transposition,
  color: seed.color,
  notes: buildNotes(seed.keys, seed.overrides),
  cues: { ...seed.cues },
})

/* ---------------- v11（基线版本，方亦 14:10） ---------------- */
const v11Seeds: SeedTrack[] = [
  {
    id: 'TR-01', name: '长笛', instrument: 'Flute', clef: 'treble', transposition: 0, color: '#2563eb',
    keys: ['c/5', 'd/5', 'e/5', 'g/5', 'a/5', 'g/5', 'e/5', 'd/5', 'c/5', 'e/5', 'g/5', 'a/5'],
    cues: { turnAfterMeasure: 2, cueMeasures: 1 },
  },
  {
    id: 'TR-02', name: '单簧管', instrument: 'Clarinet in Bb', clef: 'treble', transposition: -2, color: '#7c3aed',
    keys: ['d/4', 'e/4', 'f/4', 'a/4', 'c/5', 'a/4', 'f/4', 'e/4', 'd/4', 'f/4', 'a/4', 'c/5'],
    // v11：换页在第 1 小节后，只留 0 小节提示音
    cues: { turnAfterMeasure: 1, cueMeasures: 0 },
  },
  {
    id: 'TR-03', name: '圆号', instrument: 'Horn in F', clef: 'treble', transposition: -7, color: '#d97706',
    keys: ['g/3', 'a/3', 'c/4', 'd/4', 'e/4', 'd/4', 'c/4', 'a/3', 'g/3', 'c/4', 'd/4', 'e/4'],
    // v11：第 2 小节（序号 5–8）力度 mf，末音（序号 8）无延音线
    cues: { turnAfterMeasure: 2, cueMeasures: 1 },
  },
  {
    id: 'TR-04', name: '大提琴', instrument: 'Violoncello', clef: 'bass', transposition: 0, color: '#059669',
    keys: ['c/3', 'g/3', 'e/3', 'd/3', 'c/3', 'g/3', 'a/3', 'g/3', 'c/3', 'e/3', 'g/3', 'a/3'],
    // v11 终段倒数第二音为 g/3
    cues: { turnAfterMeasure: 2, cueMeasures: 1 },
  },
]

/* ---------------- v12（目标版本，沈青 16:28） ---------------- */
const v12Seeds: SeedTrack[] = [
  {
    id: 'TR-01', name: '长笛', instrument: 'Flute', clef: 'treble', transposition: 0, color: '#2563eb',
    keys: ['c/5', 'd/5', 'e/5', 'g/5', 'a/5', 'g/5', 'e/5', 'd/5', 'c/5', 'e/5', 'g/5', 'a/5'],
    cues: { turnAfterMeasure: 2, cueMeasures: 1 },
  },
  {
    id: 'TR-02', name: '单簧管', instrument: 'Clarinet in Bb', clef: 'treble', transposition: -2, color: '#7c3aed',
    keys: ['d/4', 'e/4', 'f/4', 'a/4', 'c/5', 'a/4', 'f/4', 'e/4', 'd/4', 'f/4', 'a/4', 'c/5'],
    // v12：按出版意见，换页后移到第 2 小节，并保留 2 小节提示音（CM-3）
    cues: { turnAfterMeasure: 2, cueMeasures: 2 },
  },
  {
    id: 'TR-03', name: '圆号', instrument: 'Horn in F', clef: 'treble', transposition: -7, color: '#d97706',
    keys: ['g/3', 'a/3', 'c/4', 'd/4', 'e/4', 'd/4', 'c/4', 'a/3', 'g/3', 'c/4', 'd/4', 'e/4'],
    // v12：第 2 小节力度降为 p（CM-1）；末音加延音线（CM-2）
    overrides: [
      {}, {}, {}, {},
      { dynamic: 'p' }, { dynamic: 'p' }, { dynamic: 'p' }, { dynamic: 'p', tie: true },
      {}, {}, {}, {},
    ],
    cues: { turnAfterMeasure: 2, cueMeasures: 1 },
  },
  {
    id: 'TR-04', name: '大提琴', instrument: 'Violoncello', clef: 'bass', transposition: 0, color: '#059669',
    keys: ['c/3', 'g/3', 'e/3', 'd/3', 'c/3', 'g/3', 'a/3', 'g/3', 'c/3', 'e/3', 'g/3', 'a/3'],
    // v12：终段和声调整，倒数第二音 g/3 → a/3（无评论挂接）
    overrides: [{}, {}, {}, {}, {}, {}, {}, {}, {}, {}, { key: 'a/3' }, {}],
    cues: { turnAfterMeasure: 2, cueMeasures: 1 },
  },
]

export const seedTracks: Track[] = v11Seeds.map(toTrack)
export const v11Tracks: Track[] = v11Seeds.map(toTrack)
export const v12Tracks: Track[] = v12Seeds.map(toTrack)

export const seedComments: ScoreComment[] = [
  {
    id: 'CM-1', measure: 2, author: '指挥 · 方亦', resolved: false,
    content: '圆号第 2 小节进入需再弱一级，避免覆盖大提琴主题。',
    link: { trackId: 'TR-03', noteId: 'N-5', field: 'dynamic' },
  },
  {
    id: 'CM-2', measure: 3, author: '作曲 · 沈青', resolved: false,
    content: '第 3 小节末音增加延音线，与下一小节第一拍连奏。',
    link: { trackId: 'TR-03', noteId: 'N-8', field: 'tie' },
  },
  {
    id: 'CM-3', measure: 6, author: '出版 · 赵晴', resolved: true, disposition: 'noted',
    content: '单簧管分谱需在换页处保留 2 小节提示音。',
    link: { trackId: 'TR-02', field: 'cueMeasures' },
  },
]

export const seedVersions: ScoreVersion[] = [
  {
    id: 'v12', author: '沈青', time: '今天 16:28',
    summary: '调整终段和声，补充圆号力度与连音线，修正单簧管换页提示',
    trackNotes: Object.fromEntries(v12Tracks.map((track) => [track.id, structuredClone(track.notes)])),
    cues: Object.fromEntries(v12Tracks.map((track) => [track.id, structuredClone(track.cues)])),
  },
  {
    id: 'v11', author: '方亦', time: '今天 14:10',
    summary: '移调单簧管分谱并调整换气标记',
    trackNotes: Object.fromEntries(v11Tracks.map((track) => [track.id, structuredClone(track.notes)])),
    cues: Object.fromEntries(v11Tracks.map((track) => [track.id, structuredClone(track.cues)])),
  },
]
