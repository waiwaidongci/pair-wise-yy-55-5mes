import { useState } from 'react'
import { Alert, Button, InputNumber, Select, Space, Switch, Tag } from 'antd'
import { PrinterOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { updatePartSettings, viewBaseline } from '../store'
import type { PartSettings, ScoreNote } from '../types'

export default function Parts() {
  const dispatch = useDispatch<AppDispatch>()
  const { tracks, partSettings, baselines, activeBaselineId } = useSelector((state: RootState) => state.score)
  const baseline = baselines.find((item) => item.id === activeBaselineId) ?? null
  const [trackId, setTrackId] = useState(tracks[0]!.id)
  const track = tracks.find((item) => item.id === trackId)!
  const part = baseline?.parts.find((item) => item.trackId === trackId) ?? null
  const settings: PartSettings = baseline ? part!.settings : partSettings[trackId]!
  const notes: ScoreNote[] = baseline ? part!.notes : track.notes
  const setSettings = (patch: Partial<PartSettings>) => dispatch(updatePartSettings({ trackId, patch }))
  const cueTrack = tracks[(tracks.findIndex((item) => item.id === trackId) + 1) % tracks.length]

  return <main className="page">
    <div className="page-head no-print"><div><p className="eyebrow">分谱提取与出版排版</p><h1>演奏者分谱预览</h1><p>从总谱提取独立声部，单独调整换页、提示音、排练标记与打印分页。</p></div><Button type="primary" icon={<PrinterOutlined />} onClick={() => window.print()}>打印分谱</Button></div>
    {baseline
      ? <Alert className="no-print" type="info" showIcon style={{ marginBottom: 16 }} message={`正在查阅 ${baseline.label}（${baseline.id}）生成的四册分谱`} description={`锁定时间 ${baseline.lockedAt}，分谱按锁定时的换页与提示音设置生成，只读。`} action={<Button size="small" onClick={() => dispatch(viewBaseline(null))}>回到当前草稿</Button>} />
      : baselines.length > 0 && <Alert className="no-print" type="warning" showIcon style={{ marginBottom: 16 }} message={`基线 ${baselines[0]!.id} 已锁定，当前为新一轮草稿`} description="此处修改不会改动已锁定基线；旧基线可在“版本与评论 → 出版基线”查回。" />}
    <div className="panel no-print" style={{ marginBottom: 16 }}><Space wrap>
      <Select value={trackId} style={{ width: 180 }} options={tracks.map((item) => ({ value: item.id, label: `${item.name} · ${item.instrument}` }))} onChange={setTrackId} />
      <span>第</span><InputNumber min={1} max={12} value={settings.pageTurnAfter} disabled={!!baseline} onChange={(value) => setSettings({ pageTurnAfter: value ?? 1 })} /><span>小节后换页</span>
      <span>换页前提示音：</span><InputNumber min={0} max={8} value={settings.cueMeasures} disabled={!!baseline} onChange={(value) => setSettings({ cueMeasures: value ?? 0 })} /><span>小节</span>
      <Switch checked={settings.showCue} disabled={!!baseline} onChange={(checked) => setSettings({ showCue: checked })} checkedChildren="显示提示音" unCheckedChildren="隐藏提示音" />
      <Tag color={track.transposition ? 'purple' : 'blue'}>{track.transposition ? `移调 ${track.transposition}` : '不移调'}</Tag>
    </Space></div>
    <article className="part-page">
      <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '2px solid #0f172a', paddingBottom: 10 }}><div><h1 style={{ margin: 0, fontFamily: 'serif' }}>{track.name}</h1><small>{track.instrument} · 移调后记谱分谱</small></div><div style={{ textAlign: 'right' }}><b>《潮汐线》</b><div>沈青 作品</div><div>{baseline ? `${baseline.label} ${baseline.id} · 锁定稿` : '出版稿 · 当前草稿'}</div></div></div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}><b>I. 潮起 · ♩ = 72</b><span>1</span></div>
      {[0, 1, 2].map((measureIndex) => <div key={measureIndex}><div className="part-measure">{notes.slice(measureIndex * 4, measureIndex * 4 + 4).map((note, index) => <div key={note.id} className="part-note"><b>{note.key.replace('/', '')}</b><small style={{ display: 'block', color: '#64748b' }}>{note.dynamic}{note.tie ? ' ⁀' : ''}</small>{settings.showCue && settings.cueMeasures > 0 && index === 0 && measureIndex > 0 && <em style={{ display: 'block', fontSize: 10, color: '#2563eb' }}>提示：{cueTrack?.name}</em>}</div>)}</div>{measureIndex === 1 && <div style={{ textAlign: 'right', color: '#64748b', fontSize: 12 }}>换页 → 建议在第 {settings.pageTurnAfter} 小节后{settings.showCue && settings.cueMeasures > 0 ? `，保留 ${settings.cueMeasures} 小节提示音` : ''}</div>}</div>)}
      <div style={{ marginTop: 30, borderTop: '1px solid #94a3b8', paddingTop: 10, color: '#64748b', fontSize: 11 }}>© 2026 云谱出版社 · 仅限排练使用 · 禁止未授权复制{baseline ? ` · 本分册由 ${baseline.id} 于锁定时生成` : ''}</div>
    </article>
  </main>
}
