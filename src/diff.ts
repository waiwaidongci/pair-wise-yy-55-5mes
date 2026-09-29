import type { DiffKind, PartSettings, ScoreNote, ScoreVersion, Track, VersionDiff } from './types'

const NOTES_PER_MEASURE = 4

const kindField: Record<DiffKind, string> = {
  pitch: '音高',
  duration: '时值',
  dynamic: '力度',
  tie: '延音线',
  pageTurn: '换页提示',
}

const durationText: Record<ScoreNote['duration'], string> = { q: '四分音符', h: '二分音符', '8': '八分音符' }

function noteDiff(
  trackId: string,
  noteIndex: number,
  kind: DiffKind,
  before: string,
  after: string,
  patch: Partial<ScoreNote>,
  revert: Partial<ScoreNote>,
  linkedCommentId?: string,
): VersionDiff {
  return {
    id: `DF-${trackId}-${noteIndex}-${kind}`,
    kind,
    trackId,
    measure: Math.floor(noteIndex / NOTES_PER_MEASURE) + 1,
    noteIndex,
    field: kindField[kind],
    before,
    after,
    patch,
    revert,
    linkedCommentId,
    decision: 'pending',
  }
}

/** 逐音符比较两个版本，产出音符（音高/时值）、力度、延音线与换页提示差异 */
export function computeVersionDiffs(
  from: ScoreVersion,
  to: ScoreVersion,
  tracks: Track[],
  commentByAnchor: Record<string, string>,
): VersionDiff[] {
  const diffs: VersionDiff[] = []
  for (const track of tracks) {
    const beforeNotes = from.trackNotes[track.id] ?? []
    const afterNotes = to.trackNotes[track.id] ?? []
    const count = Math.max(beforeNotes.length, afterNotes.length)
    for (let index = 0; index < count; index += 1) {
      const a = beforeNotes[index]
      const b = afterNotes[index]
      if (!a || !b) continue
      const anchor = `${track.id}:${index}`
      if (a.key !== b.key || a.accidental !== b.accidental) {
        diffs.push(noteDiff(track.id, index, 'pitch', a.key, b.key, { key: b.key, accidental: b.accidental }, { key: a.key, accidental: a.accidental }, commentByAnchor[anchor]))
      }
      if (a.duration !== b.duration) {
        diffs.push(noteDiff(track.id, index, 'duration', durationText[a.duration], durationText[b.duration], { duration: b.duration }, { duration: a.duration }, commentByAnchor[anchor]))
      }
      if (a.dynamic !== b.dynamic) {
        diffs.push(noteDiff(track.id, index, 'dynamic', a.dynamic, b.dynamic, { dynamic: b.dynamic }, { dynamic: a.dynamic }, commentByAnchor[anchor]))
      }
      if (a.tie !== b.tie) {
        diffs.push(noteDiff(track.id, index, 'tie', a.tie ? '有延音线' : '无延音线', b.tie ? '有延音线' : '无延音线', { tie: b.tie }, { tie: a.tie }, commentByAnchor[anchor]))
      }
    }
    const beforeSettings = from.partSettings[track.id]
    const afterSettings = to.partSettings[track.id]
    if (beforeSettings && afterSettings && beforeSettings.cueMeasures !== afterSettings.cueMeasures) {
      diffs.push({
        id: `DF-${track.id}-pageTurn`,
        kind: 'pageTurn',
        trackId: track.id,
        measure: afterSettings.pageTurnAfter,
        noteIndex: -1,
        field: kindField.pageTurn,
        before: `提示音 ${beforeSettings.cueMeasures} 小节`,
        after: `提示音 ${afterSettings.cueMeasures} 小节`,
        linkedCommentId: commentByAnchor[`${track.id}:pageTurn`],
        decision: 'pending',
      })
    }
  }
  return diffs
}

/** 应用换页提示差异：返回新的提示音小节数 */
export function pageTurnValue(diff: VersionDiff, settings: PartSettings, useAfter: boolean): PartSettings {
  const match = /(\d+)/.exec(useAfter ? diff.after : diff.before)
  return { ...settings, cueMeasures: match ? Number(match[1]) : settings.cueMeasures }
}
