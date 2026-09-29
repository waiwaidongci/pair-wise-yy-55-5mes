import { configureStore, createSlice, type PayloadAction } from '@reduxjs/toolkit'
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type { PartSettings, PublishingBaseline, ScoreComment, ScoreNote, ScoreVersion, Track, VersionDiff } from './types'
import { commentAnchors, seedComments, seedPartSettings, seedTracks, seedVersions } from './mock'
import { computeVersionDiffs, pageTurnValue } from './diff'

interface ScoreState {
  tracks: Track[]
  selectedTrackId: string
  selectedNoteIndex: number
  history: string[]
  future: string[]
  comments: ScoreComment[]
  versions: ScoreVersion[]
  partSettings: Record<string, PartSettings>
  diffs: VersionDiff[]
  baselines: PublishingBaseline[]
  activeBaselineId: string | null
  dirty: boolean
}

const initialState: ScoreState = {
  tracks: structuredClone(seedTracks),
  selectedTrackId: 'TR-01',
  selectedNoteIndex: 2,
  history: [],
  future: [],
  comments: structuredClone(seedComments),
  versions: structuredClone(seedVersions),
  partSettings: structuredClone(seedPartSettings),
  diffs: computeVersionDiffs(seedVersions[1]!, seedVersions[0]!, seedTracks, commentAnchors),
  baselines: [],
  activeBaselineId: null,
  dirty: false,
}

function snapshot(state: ScoreState) { state.history.push(JSON.stringify(state.tracks)); if (state.history.length > 40) state.history.shift(); state.future = []; state.dirty = true }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)) }
function persist(state: ScoreState) { if (typeof localStorage === 'undefined') return; localStorage.setItem('yy55-score-draft', JSON.stringify({ tracks: state.tracks, comments: state.comments, partSettings: state.partSettings, diffs: state.diffs })) }
function transposeKey(key: string, semitones: number) {
  const chromatic = ['c','c#','d','d#','e','f','f#','g','g#','a','a#','b']
  const [pitch, octaveText] = key.split('/')
  let index = chromatic.indexOf(pitch!.replace('b', '')) + semitones
  let octave = Number(octaveText)
  while (index < 0) { index += 12; octave -= 1 }
  while (index >= 12) { index -= 12; octave += 1 }
  return `${chromatic[index]}/${octave}`
}

/** 把一条差异的结论落到总谱（useAfter=true 取新版本值，false 保留原值） */
function applyDiffToScore(state: ScoreState, diff: VersionDiff, useAfter: boolean) {
  if (diff.kind === 'pageTurn') {
    const settings = state.partSettings[diff.trackId]
    if (settings) state.partSettings[diff.trackId] = pageTurnValue(diff, settings, useAfter)
    return
  }
  const track = state.tracks.find((item) => item.id === diff.trackId)
  const note = track?.notes[diff.noteIndex]
  const patch = useAfter ? diff.patch : diff.revert
  if (note && patch) Object.assign(note, patch)
}

function resolveLinkedComment(state: ScoreState, diff: VersionDiff) {
  if (!diff.linkedCommentId) return
  const comment = state.comments.find((item) => item.id === diff.linkedCommentId)
  if (comment) comment.resolved = true
}

const scoreSlice = createSlice({
  name: 'score',
  initialState,
  reducers: {
    selectTrack(state, action: PayloadAction<string>) { state.selectedTrackId = action.payload; state.selectedNoteIndex = 0 },
    selectNote(state, action: PayloadAction<number>) { state.selectedNoteIndex = action.payload },
    addNote(state) {
      snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; const template = track.notes[Math.min(track.notes.length - 1, state.selectedNoteIndex)]
      track.notes.splice(state.selectedNoteIndex + 1, 0, { id: `N-${Date.now()}`, key: template?.key ?? 'c/4', duration: 'q', dynamic: template?.dynamic ?? 'mf', tie: false, expression: '' }); state.selectedNoteIndex += 1; persist(state)
    },
    removeNote(state) { snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; if (track.notes.length > 1) track.notes.splice(state.selectedNoteIndex, 1); state.selectedNoteIndex = Math.max(0, state.selectedNoteIndex - 1); persist(state) },
    updateNote(state, action: PayloadAction<Partial<ScoreNote>>) { snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; Object.assign(track.notes[state.selectedNoteIndex]!, action.payload); persist(state) },
    transposeTrack(state, action: PayloadAction<number>) { snapshot(state); const track = state.tracks.find((item) => item.id === state.selectedTrackId)!; track.notes.forEach((note) => { note.key = transposeKey(note.key, action.payload) }); track.transposition += action.payload; persist(state) },
    undo(state) { const previous = state.history.pop(); if (!previous) return; state.future.push(JSON.stringify(state.tracks)); state.tracks = JSON.parse(previous); state.dirty = true; persist(state) },
    redo(state) { const next = state.future.pop(); if (!next) return; state.history.push(JSON.stringify(state.tracks)); state.tracks = JSON.parse(next); state.dirty = true; persist(state) },
    resolveComment(state, action: PayloadAction<string>) { const comment = state.comments.find((item) => item.id === action.payload); if (comment) comment.resolved = true; state.dirty = true; persist(state) },
    /** 应用评论：把关联差异按新版本值并入总谱，并了结评论 */
    applyComment(state, action: PayloadAction<string>) {
      const diff = state.diffs.find((item) => item.linkedCommentId === action.payload)
      if (diff && diff.decision === 'pending') { applyDiffToScore(state, diff, true); diff.decision = 'accepted' }
      const comment = state.comments.find((item) => item.id === action.payload)
      if (comment) comment.resolved = true
      state.dirty = true; persist(state)
    },
    /** 接受差异：并入总谱 */
    acceptDiff(state, action: PayloadAction<string>) {
      const diff = state.diffs.find((item) => item.id === action.payload)
      if (!diff || diff.decision !== 'pending') return
      applyDiffToScore(state, diff, true)
      diff.decision = 'accepted'
      resolveLinkedComment(state, diff)
      state.dirty = true; persist(state)
    },
    /** 拒绝差异：保留原值并标清 */
    rejectDiff(state, action: PayloadAction<string>) {
      const diff = state.diffs.find((item) => item.id === action.payload)
      if (!diff || diff.decision !== 'pending') return
      applyDiffToScore(state, diff, false)
      diff.decision = 'rejected'
      state.dirty = true; persist(state)
    },
    acceptAllDiffs(state) {
      state.diffs.forEach((diff) => { if (diff.decision === 'pending') { applyDiffToScore(state, diff, true); diff.decision = 'accepted'; resolveLinkedComment(state, diff) } })
      state.dirty = true; persist(state)
    },
    rejectAllDiffs(state) {
      state.diffs.forEach((diff) => { if (diff.decision === 'pending') { applyDiffToScore(state, diff, false); diff.decision = 'rejected' } })
      state.dirty = true; persist(state)
    },
    updatePartSettings(state, action: PayloadAction<{ trackId: string; patch: Partial<PartSettings> }>) {
      const settings = state.partSettings[action.payload.trackId]
      if (settings) Object.assign(settings, action.payload.patch)
      state.dirty = true; persist(state)
    },
    /** 锁定出版基线：全部差异有结论且待处理评论为零时才可调用 */
    lockBaseline(state) {
      if (state.diffs.some((diff) => diff.decision === 'pending')) return
      if (state.comments.some((comment) => !comment.resolved)) return
      const accepted = state.diffs.filter((diff) => diff.decision === 'accepted').length
      const baseline: PublishingBaseline = {
        id: `BL-${state.baselines.length + 1}`,
        label: `出版基线 ${state.baselines.length + 1}`,
        lockedAt: new Date().toLocaleString('zh-CN', { hour12: false }),
        basedOn: state.versions[0]?.id ?? 'v12',
        trackNotes: Object.fromEntries(state.tracks.map((track) => [track.id, clone(track.notes)])),
        partSettings: clone(state.partSettings),
        parts: state.tracks.map((track) => ({ trackId: track.id, trackName: track.name, instrument: track.instrument, transposition: track.transposition, settings: clone(state.partSettings[track.id]!), notes: clone(track.notes) })),
        acceptedCount: accepted,
        rejectedCount: state.diffs.length - accepted,
      }
      state.baselines.unshift(baseline)
      state.activeBaselineId = baseline.id
      // 后续编辑从新草稿开始：差异处置单清空，草稿视为干净
      state.diffs = []
      state.dirty = false
      persist(state)
    },
    viewBaseline(state, action: PayloadAction<string | null>) { state.activeBaselineId = action.payload },
    saveVersion(state) {
      const nextNumber = Math.max(...state.versions.map((version) => Number(version.id.slice(1)) || 0)) + 1
      state.versions.unshift({ id: `v${nextNumber}`, author: '当前用户', time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }), summary: '保存当前总谱与分谱调整', trackNotes: Object.fromEntries(state.tracks.map((track) => [track.id, clone(track.notes)])), partSettings: clone(state.partSettings) })
      state.dirty = false; if (typeof localStorage !== 'undefined') localStorage.removeItem('yy55-score-draft')
    },
    restoreDraft(state) {
      if (typeof localStorage === 'undefined') return
      const raw = localStorage.getItem('yy55-score-draft'); if (!raw) return
      const draft = JSON.parse(raw)
      state.tracks = draft.tracks; state.comments = draft.comments
      if (draft.partSettings) state.partSettings = draft.partSettings
      if (draft.diffs) state.diffs = draft.diffs
      state.dirty = true
    },
  },
})

export const scoreApi = createApi({
  reducerPath: 'scoreApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getPublishingProfile: builder.query<{ title: string; publisher: string; pages: number; deadline: string }, void>({ queryFn: async () => ({ data: { title: '《潮汐线》室内交响作品', publisher: '云谱出版社', pages: 46, deadline: '2026-10-12' } }) }),
  }),
})

export const { selectTrack, selectNote, addNote, removeNote, updateNote, transposeTrack, undo, redo, resolveComment, applyComment, acceptDiff, rejectDiff, acceptAllDiffs, rejectAllDiffs, updatePartSettings, lockBaseline, viewBaseline, saveVersion, restoreDraft } = scoreSlice.actions
export const store = configureStore({ reducer: { score: scoreSlice.reducer, [scoreApi.reducerPath]: scoreApi.reducer }, middleware: (getDefault) => getDefault().concat(scoreApi.middleware) })
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
