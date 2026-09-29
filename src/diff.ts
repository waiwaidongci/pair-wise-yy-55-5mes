import type {
  ChangeField, ChangeHunk, CueSettings, ScoreComment, ScoreNote, ScoreVersion, Track,
} from './types'

export const FIELD_LABELS: Record<ChangeField, string> = {
  key: '音高',
  duration: '时值',
  dynamic: '力度',
  tie: '延音线',
  expression: '表情',
  cueAfterMeasure: '换页位置',
  cueMeasures: '提示音小节数',
}

const NOTE_FIELDS: ChangeField[] = ['key', 'duration', 'dynamic', 'tie', 'expression']

export const formatValue = (field: ChangeField, value: unknown): string => {
  switch (field) {
    case 'tie':
      return value ? '有延音线' : '无延音线'
    case 'duration':
      return ({ h: '二分音符', q: '四分音符', '8': '八分音符' } as Record<string, string>)[String(value)] ?? String(value)
    case 'cueAfterMeasure':
      return `第 ${value} 小节后换页`
    case 'cueMeasures':
      return value === 0 ? '不保留提示音' : `保留 ${value} 小节提示音`
    case 'expression':
      return value === '' || value == null ? '（无表情标记）' : String(value)
    case 'key':
      return String(value).replace('/', '')
    default:
      return String(value)
  }
}

const findLinkedComment = (
  comments: ScoreComment[], trackId: string, field: ChangeField, noteId?: string,
): string | undefined =>
  comments.find(
    (comment) =>
      comment.link?.trackId === trackId &&
      comment.link.field === field &&
      (comment.link.noteId == null || comment.link.noteId === noteId),
  )?.id

/** 逐条比较两个版本的音符、力度、延音线与换页提示，生成差异处置草稿 */
export const buildReview = (
  base: ScoreVersion,
  target: ScoreVersion,
  tracks: Track[],
  comments: ScoreComment[],
): ChangeHunk[] => {
  const hunks: ChangeHunk[] = []
  for (const track of tracks) {
    const baseNotes = base.trackNotes[track.id] ?? []
    const targetNotes = target.trackNotes[track.id] ?? []
    const count = Math.max(baseNotes.length, targetNotes.length)
    for (let i = 0; i < count; i += 1) {
      const baseNote: Partial<ScoreNote> = baseNotes[i] ?? {}
      const targetNote: Partial<ScoreNote> = targetNotes[i] ?? {}
      const noteId = (targetNote.id ?? baseNote.id) as string
      for (const field of NOTE_FIELDS) {
        const oldValue = baseNote[field as keyof ScoreNote]
        const newValue = targetNote[field as keyof ScoreNote]
        if (oldValue !== newValue) {
          hunks.push({
            id: `${track.id}:note:${noteId}:${field}`,
            trackId: track.id,
            trackName: track.name,
            kind: 'note',
            noteId,
            measure: Math.floor(i / 4) + 1,
            beat: (i % 4) + 1,
            field,
            label: FIELD_LABELS[field],
            oldValue: formatValue(field, oldValue),
            newValue: formatValue(field, newValue),
            status: 'pending',
            linkedCommentId: findLinkedComment(comments, track.id, field, noteId),
          })
        }
      }
    }

    const baseCue = base.cues[track.id]
    const targetCue = target.cues[track.id]
    if (baseCue && targetCue) {
      const cuePairs: Array<['cueAfterMeasure' | 'cueMeasures', keyof CueSettings]> = [
        ['cueAfterMeasure', 'turnAfterMeasure'],
        ['cueMeasures', 'cueMeasures'],
      ]
      for (const [field, cueKey] of cuePairs) {
        if (baseCue[cueKey] !== targetCue[cueKey]) {
          hunks.push({
            id: `${track.id}:cue:${field}`,
            trackId: track.id,
            trackName: track.name,
            kind: 'cue',
            field,
            label: FIELD_LABELS[field],
            oldValue: formatValue(field, baseCue[cueKey]),
            newValue: formatValue(field, targetCue[cueKey]),
            status: 'pending',
            linkedCommentId: findLinkedComment(comments, track.id, field),
          })
        }
      }
    }
  }
  return hunks
}

/**
 * 按处置结论合并：接受的差异取目标版本值并并入总谱，
 * 拒绝的差异保留基线原值并标记。
 */
export const buildMergedTracks = (
  base: ScoreVersion,
  target: ScoreVersion,
  tracks: Track[],
  hunks: ChangeHunk[],
): Track[] =>
  tracks.map((track) => {
    const merged: Track = structuredClone(track)
    const baseNotes = base.trackNotes[track.id] ?? []
    const targetNotes = target.trackNotes[track.id] ?? []
    merged.notes = baseNotes.map((baseNote, index) => {
      const targetNote = targetNotes[index]
      const next: ScoreNote = structuredClone(baseNote)
      if (!targetNote) return next
      for (const hunk of hunks) {
        if (
          hunk.status === 'accepted' &&
          hunk.kind === 'note' &&
          hunk.trackId === track.id &&
          hunk.noteId === baseNote.id
        ) {
          Object.assign(next, { [hunk.field]: targetNote[hunk.field as keyof ScoreNote] })
        }
      }
      return next
    })
    const cueHunks = hunks.filter((h) => h.kind === 'cue' && h.trackId === track.id)
    const baseCue = base.cues[track.id]
    if (baseCue) merged.cues = { ...baseCue }
    for (const hunk of cueHunks) {
      if (hunk.status !== 'accepted') continue
      const targetCue = target.cues[track.id]!
      if (hunk.field === 'cueAfterMeasure') merged.cues.turnAfterMeasure = targetCue.turnAfterMeasure
      if (hunk.field === 'cueMeasures') merged.cues.cueMeasures = targetCue.cueMeasures
    }
    return merged
  })

export const hunkSummary = (hunks: ChangeHunk[]) => ({
  total: hunks.length,
  pending: hunks.filter((h) => h.status === 'pending').length,
  accepted: hunks.filter((h) => h.status === 'accepted').length,
  rejected: hunks.filter((h) => h.status === 'rejected').length,
})
