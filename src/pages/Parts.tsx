import { useState } from 'react'
import { Alert, Button, InputNumber, Segmented, Space, Switch, Tag } from 'antd'
import { LockOutlined, PrinterOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { updatePartSettings } from '../store'
import type { Track } from '../types'

export default function Parts() {
  const dispatch = useDispatch<AppDispatch>()
  const { tracks, baselines, newDraftStarted, partSettings } = useSelector((state: RootState) => state.score)
  const currentBaseline = baselines[baselines.length - 1]
  const frozen = Boolean(currentBaseline && !newDraftStarted)
  const sourceTracks: Track[] = frozen ? currentBaseline!.tracks : tracks
  const settings = frozen ? currentBaseline!.partSettings : partSettings
  const [activeTrack, setActiveTrack] = useState<string>('all')

  const visibleTracks = activeTrack === 'all'
    ? sourceTracks
    : sourceTracks.filter((track) => track.id === activeTrack)

  return <main className="page">
    <div className="page-head no-print">
      <div>
        <p className="eyebrow">分谱提取与出版排版</p>
        <h1>演奏者分谱{!frozen && '预览'}</h1>
        <p>{frozen
          ? `四册分谱已按基线 ${currentBaseline!.id} 锁定时的设置生成，只读；后续修改请从新草稿开始。`
          : '从总谱提取独立声部，调整换页与提示音；锁定基线时这些设置会一并冻结。'}</p>
      </div>
      <Space>
        {frozen && <Tag color="gold" icon={<LockOutlined />} style={{ padding: '4px 10px' }}>{currentBaseline!.id} 冻结稿</Tag>}
        <Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>
          {activeTrack === 'all' ? '打印四册分谱' : '打印本分谱'}
        </Button>
      </Space>
    </div>

    <div className="panel no-print" style={{ marginBottom: 16 }}>
      <Space wrap>
        <Segmented value={activeTrack} onChange={(value) => setActiveTrack(String(value))}
          options={[{ label: '全部四册', value: 'all' }, ...sourceTracks.map((item) => ({ label: item.name, value: item.id }))]} />
        <span>换页前提示音：</span>
        <InputNumber min={0} max={8} value={settings.cueMeasures} disabled={frozen}
          onChange={(value) => dispatch(updatePartSettings({ cueMeasures: value ?? 0 }))} />
        <span>小节</span>
        <Switch checked={settings.showCueNotes} disabled={frozen}
          onChange={(checked) => dispatch(updatePartSettings({ showCueNotes: checked }))}
          checkedChildren="显示提示音" unCheckedChildren="隐藏提示音" />
        <Tag color={frozen ? 'gold' : 'blue'}>{frozen ? '设置已冻结' : '设置可调整（随基线锁定）'}</Tag>
      </Space>
    </div>

    {frozen && activeTrack === 'all' && <Alert type="success" showIcon icon={<LockOutlined />} className="no-print" style={{ marginBottom: 16 }}
      message={`四册分谱均由 ${currentBaseline!.label} 生成（接受 ${currentBaseline!.accepted} 条、拒绝 ${currentBaseline!.rejected} 条差异），各册换页与提示音按锁定时值输出。`} />}

    {visibleTracks.map((track) => {
      const measures = [track.notes.slice(0, 4), track.notes.slice(4, 8), track.notes.slice(8, 12)]
      const nextTrack = sourceTracks[(sourceTracks.findIndex((item) => item.id === track.id) + 1) % sourceTracks.length]!
      return <article className="part-page" key={track.id} style={{ marginBottom: 22, breakInside: 'avoid' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 10 }}>
          <div>
            <h1 style={{ margin: 0, fontFamily: 'serif' }}>{track.name}</h1>
            <small>{track.instrument} · {track.transposition ? `移调 ${track.transposition > 0 ? '+' : ''}${track.transposition}` : '实音记谱'}分谱</small>
          </div>
          <div style={{ textAlign: 'right' }}>
            <b>《潮汐线》</b>
            <div>沈青 作品</div>
            <div>{frozen ? `${currentBaseline!.label} · ${currentBaseline!.id}` : '出版预览稿（未锁定）'}</div>
          </div>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
          <b>I. 潮起 · ♩ = 72</b><span>1</span>
        </div>
        {measures.map((measureNotes, measureIndex) => (
          <div key={measureIndex}>
            <div className="part-measure">
              {measureNotes.map((note, index) => (
                <div key={note.id} className="part-note">
                  <b>{note.key.replace('/', '')}</b>
                  <small style={{ display: 'block', color: '#64748b' }}>{note.dynamic}{note.tie ? ' ⁀' : ''}</small>
                </div>
              ))}
            </div>
            {measureIndex + 1 === track.cues.turnAfterMeasure && (
              <div style={{ textAlign: 'right', color: '#64748b', fontSize: 12 }}>换页 → 第 {track.cues.turnAfterMeasure} 小节后</div>
            )}
            {measureIndex + 1 === track.cues.turnAfterMeasure && settings.showCueNotes && track.cues.cueMeasures > 0 && (
              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', alignItems: 'baseline', fontFamily: 'serif' }}>
                <em style={{ fontSize: 11, color: '#2563eb' }}>提示（{nextTrack.name}，{track.cues.cueMeasures} 小节）：</em>
                {nextTrack.notes.slice(0, track.cues.cueMeasures * 4).map((cueNote) => (
                  <small key={cueNote.id} style={{ color: '#2563eb', fontSize: 11 }}>{cueNote.key.replace('/', '')}</small>
                ))}
              </div>
            )}
          </div>
        ))}
        <div style={{ marginTop: 30, borderTop: '1px solid #94a3b8', paddingTop: 10, color: '#64748b', fontSize: 11 }}>
          © 2026 云谱出版社 · {frozen ? `${currentBaseline!.id} 冻结出版稿` : '排练预览稿，未经基线锁定'} · 禁止未授权复制
        </div>
      </article>
    })}
  </main>
}
