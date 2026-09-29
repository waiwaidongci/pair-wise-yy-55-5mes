import { configureStore, createSlice, current, type PayloadAction } from '@reduxjs/toolkit'
import { createApi, fakeBaseQuery } from '@reduxjs/toolkit/query/react'
import type {
  Baseline, CommentDisposition, HunkStatus, PartSettings, ScoreComment, ScoreNote, ScoreVersion, Track,
} from './types'
import { seedComments, seedTracks, seedVersions } from './mock'
import { buildMergedTracks, buildReview } from './diff'

interface ScoreState {
  tracks: Track[]
  selectedTrackId: string
  selectedNoteIndex: number
  history: string[]
  future: string[]
  comments: ScoreComment[]
  versions: ScoreVersion[]
  review: null | {
    id: string
    baseId: string
    targetId: string
    startedAt: string
    hunks: ReturnType<typeof buildReview>
  }
  /** 历次锁定的出版基线，最后一条为当前冻结稿，旧基线保留可查回 */
  baselines: Baseline[]
  /** 锁定基线后，后续编辑必须从新草稿开始 */
  newDraftStarted: boolean
  partSettings: PartSettings
  dirty: boolean
}

const DRAFT_KEY = 'yy55-score-draft'

const initialState = (): ScoreState => ({
  tracks: structuredClone(seedTracks),
  selectedTrackId: 'TR-01',
  selectedNoteIndex: 2,
  history: [],
  future: [],
  comments: structuredClone(seedComments),
  versions: structuredClone(seedVersions),
  review: null,
  baselines: [] as Baseline[],
  newDraftStarted: false,
  partSettings: { showCueNotes: true, cueMeasures: 2, turnAfterMeasure: 2 },
  dirty: false,
})

const persist = (state: ScoreState) => {
  localStorage.setItem(DRAFT_KEY, JSON.stringify({
    tracks: state.tracks,
    comments: state.comments,
    review: state.review,
    baselines: state.baselines,
    newDraftStarted: state.newDraftStarted,
    partSettings: state.partSettings,
  }))
}

function snapshot(state: ScoreState) {
  state.history.push(JSON.stringify(state.tracks))
  if (state.history.length > 40) state.history.shift()
  state.future = []
  state.dirty = true
  persist(state)
}

/** 锁定基线后、且尚未开启新草稿时，禁止改动总谱 */
const editingLocked = (state: ScoreState) => Boolean(state.baselines.length && !state.newDraftStarted)

function transposeKey(key: string, semitones: number) {
  const chromatic = ['c', 'c#', 'd', 'd#', 'e', 'f', 'f#', 'g', 'g#', 'a', 'a#', 'b']
  const [pitch, octaveText] = key.split('/')
  let index = chromatic.indexOf(pitch!.replace('b', '')) + semitones
  let octave = Number(octaveText)
  while (index < 0) { index += 12; octave -= 1 }
  while (index >= 12) { index -= 12; octave += 1 }
  return `${chromatic[index]}/${octave}`
}

const scoreSlice = createSlice({
  name: 'score',
  initialState: initialState(),
  reducers: {
    selectTrack(state, action: PayloadAction<string>) {
      state.selectedTrackId = action.payload
      state.selectedNoteIndex = 0
    },
    selectNote(state, action: PayloadAction<number>) { state.selectedNoteIndex = action.payload },
    addNote(state) {
      if (editingLocked(state)) return
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      const template = track.notes[Math.min(track.notes.length - 1, state.selectedNoteIndex)]
      track.notes.splice(state.selectedNoteIndex + 1, 0, {
        id: `N-${Date.now()}`, key: template?.key ?? 'c/4', duration: 'q',
        dynamic: template?.dynamic ?? 'mf', tie: false, expression: '',
      })
      state.selectedNoteIndex += 1
    },
    removeNote(state) {
      if (editingLocked(state)) return
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      if (track.notes.length > 1) track.notes.splice(state.selectedNoteIndex, 1)
      state.selectedNoteIndex = Math.max(0, state.selectedNoteIndex - 1)
    },
    updateNote(state, action: PayloadAction<Partial<ScoreNote>>) {
      if (editingLocked(state)) return
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      Object.assign(track.notes[state.selectedNoteIndex]!, action.payload)
    },
    transposeTrack(state, action: PayloadAction<number>) {
      if (editingLocked(state)) return
      snapshot(state)
      const track = state.tracks.find((item) => item.id === state.selectedTrackId)!
      track.notes.forEach((note) => { note.key = transposeKey(note.key, action.payload) })
      track.transposition += action.payload
    },
    undo(state) {
      const previous = state.history.pop()
      if (!previous) return
      state.future.push(JSON.stringify(state.tracks))
      state.tracks = JSON.parse(previous)
      state.dirty = true
      persist(state)
    },
    redo(state) {
      const next = state.future.pop()
      if (!next) return
      state.history.push(JSON.stringify(state.tracks))
      state.tracks = JSON.parse(next)
      state.dirty = true
      persist(state)
    },

    /* ---------- 评论 ---------- */
    resolveComment(state, action: PayloadAction<string>) {
      const comment = state.comments.find((item) => item.id === action.payload)
      if (comment) { comment.resolved = true; comment.disposition ??= 'noted' }
      state.dirty = true
      persist(state)
    },
    /** 对未挂接到差异的评论给出结论：采纳（记录）或拒绝（保留原值并标清） */
    noteComment(state, action: PayloadAction<{ id: string; disposition: CommentDisposition }>) {
      const comment = state.comments.find((item) => item.id === action.payload.id)
      if (comment) {
        comment.resolved = true
        comment.disposition = action.payload.disposition
      }
      persist(state)
    },

    /* ---------- 差异处置草稿 ---------- */
    startReview(state, action: PayloadAction<{ baseId: string; targetId: string }>) {
      const base = state.versions.find((v) => v.id === action.payload.baseId)
      const target = state.versions.find((v) => v.id === action.payload.targetId)
      if (!base || !target || base.id === target.id) return
      const hunks = buildReview(base, target, state.tracks, state.comments)
      state.review = {
        id: `RV-${Date.now()}`,
        baseId: base.id,
        targetId: target.id,
        startedAt: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        hunks,
      }
      persist(state)
    },
    decideHunk(state, action: PayloadAction<{ id: string; status: HunkStatus }>) {
      const review = state.review
      if (!review) return
      const hunk = review.hunks.find((item) => item.id === action.payload.id)
      if (!hunk) return
      hunk.status = action.payload.status
      // 挂接评论随差异结论闭环：采纳并入总谱，拒绝则保留原值并在评论上标清
      if (hunk.linkedCommentId) {
        const comment = state.comments.find((item) => item.id === hunk.linkedCommentId)
        if (comment && !comment.resolved) {
          comment.resolved = true
          comment.disposition = action.payload.status === 'accepted' ? 'adopted' : 'refused'
        }
      }
      persist(state)
    },
    decideAll(state, action: PayloadAction<HunkStatus>) {
      const review = state.review
      if (!review) return
      for (const hunk of review.hunks) {
        hunk.status = action.payload
        if (hunk.linkedCommentId) {
          const comment = state.comments.find((item) => item.id === hunk.linkedCommentId)
          if (comment && !comment.resolved) {
            comment.resolved = true
            comment.disposition = action.payload === 'accepted' ? 'adopted' : 'refused'
          }
        }
      }
      persist(state)
    },
    discardReview(state) {
      state.review = null
      persist(state)
    },

    /* ---------- 出版基线 ---------- */
    lockBaseline(state) {
      const review = state.review
      if (!review) return
      const hasPending = review.hunks.some((hunk) => hunk.status === 'pending')
      const hasOpenComment = state.comments.some((comment) => !comment.resolved)
      if (hasPending || hasOpenComment) return
      // 合并基于纯数据快照，避免对 Immer 草稿做深拷贝
      const plain = current(state)
      const base = plain.versions.find((v) => v.id === review.baseId)!
      const target = plain.versions.find((v) => v.id === review.targetId)!
      const merged = buildMergedTracks(base, target, plain.tracks, plain.review!.hunks)
      const accepted = review.hunks.filter((h) => h.status === 'accepted').length
      const rejected = review.hunks.filter((h) => h.status === 'rejected').length
      const baseline: Baseline = {
        id: `PB-${state.baselines.length + 1}`,
        label: `出版基线 ${review.targetId}`,
        createdAt: new Date().toLocaleString('zh-CN', {
          month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
        }),
        sourceIds: [review.baseId, review.targetId],
        tracks: merged,
        partSettings: structuredClone(plain.partSettings),
        accepted,
        rejected,
      }
      state.tracks = merged
      state.baselines.push(baseline)
      state.history = []
      state.future = []
      state.review = null
      state.newDraftStarted = false
      state.dirty = false
      const frozenVersion = state.versions.find((v) => v.id === review!.targetId)
      if (frozenVersion) frozenVersion.frozen = true
      persist(state)
    },
    /** 锁定后开启新草稿：总谱可继续编辑，旧基线保留可查 */
    startNewDraft(state) {
      if (!state.baselines.length) return
      state.newDraftStarted = true
      state.dirty = true
      persist(state)
    },
    updatePartSettings(state, action: PayloadAction<Partial<PartSettings>>) {
      if (state.baselines.length && !state.newDraftStarted) return
      state.partSettings = { ...state.partSettings, ...action.payload }
      persist(state)
    },
    saveVersion(state) {
      const nextNumber = state.versions.reduce((max, version) => {
        const numeric = Number(version.id.replace('v', ''))
        return Number.isNaN(numeric) ? max : Math.max(max, numeric)
      }, 0) + 1
      const plainTracks = current(state).tracks
      const version: ScoreVersion = {
        id: `v${nextNumber}`,
        author: '当前用户',
        time: new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }),
        summary: state.baselines.length ? `基于 ${state.baselines[state.baselines.length - 1]!.id} 的后续编辑` : '保存当前总谱与分谱调整',
        trackNotes: Object.fromEntries(plainTracks.map((track) => [track.id, structuredClone(track.notes)])),
        cues: Object.fromEntries(plainTracks.map((track) => [track.id, structuredClone(track.cues)])),
      }
      state.versions.unshift(version)
      state.dirty = false
      localStorage.removeItem(DRAFT_KEY)
    },
    restoreDraft(state) {
      const raw = localStorage.getItem(DRAFT_KEY)
      if (!raw) return
      const draft = JSON.parse(raw)
      if (draft.tracks) state.tracks = draft.tracks
      if (draft.comments) state.comments = draft.comments
      if ('review' in draft) state.review = draft.review
      if ('baselines' in draft) state.baselines = draft.baselines
      if ('baseline' in draft && Array.isArray(draft.baseline)) state.baselines = draft.baseline
      if ('newDraftStarted' in draft) state.newDraftStarted = draft.newDraftStarted
      if (draft.partSettings) state.partSettings = draft.partSettings
      state.dirty = true
    },
  },
})

export const scoreApi = createApi({
  reducerPath: 'scoreApi',
  baseQuery: fakeBaseQuery(),
  endpoints: (builder) => ({
    getPublishingProfile: builder.query<{ title: string; publisher: string; pages: number; deadline: string }, void>({
      queryFn: async () => ({
        data: { title: '《潮汐线》室内交响作品', publisher: '云谱出版社', pages: 46, deadline: '2026-10-12' },
      }),
    }),
  }),
})

export const {
  selectTrack, selectNote, addNote, removeNote, updateNote, transposeTrack, undo, redo,
  resolveComment, noteComment,
  startReview, decideHunk, decideAll, discardReview,
  lockBaseline, startNewDraft, updatePartSettings, saveVersion, restoreDraft,
} = scoreSlice.actions
export const store = configureStore({
  reducer: { score: scoreSlice.reducer, [scoreApi.reducerPath]: scoreApi.reducer },
  middleware: (getDefault) => getDefault().concat(scoreApi.middleware),
})
export type RootState = ReturnType<typeof store.getState>
export type AppDispatch = typeof store.dispatch
