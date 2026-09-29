import { Alert, Button, Card, Col, Progress, Row, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { scoreApi } from '../store'

export default function Overview() {
  const navigate = useNavigate()
  const tracks = useSelector((state: RootState) => state.score.tracks)
  const comments = useSelector((state: RootState) => state.score.comments)
  const diffs = useSelector((state: RootState) => state.score.diffs)
  const baselines = useSelector((state: RootState) => state.score.baselines)
  const { data } = scoreApi.endpoints.getPublishingProfile.useQuery()
  const unresolved = comments.filter((item) => !item.resolved).length
  const pendingDiffs = diffs.filter((item) => item.decision === 'pending').length
  const pageTurnPending = diffs.some((item) => item.kind === 'pageTurn' && item.decision === 'pending')
  const progressTotal = diffs.length + comments.length
  const progressDone = (diffs.length - pendingDiffs) + (comments.length - unresolved)
  const percent = progressTotal ? Math.round((progressDone / progressTotal) * 100) : 100
  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">乐谱、移调与出版准备</p><h1>{data?.title ?? '总谱出版工作台'}</h1><p>统一管理多声部总谱、移调乐器分谱、换页提示、版本差异与评论锚点。</p></div><Button type="primary" onClick={() => navigate('/score')}>进入总谱编辑</Button></div>
    <Row gutter={[14,14]} className="metrics"><Col xs={24} sm={12} xl={6}><Card className="metric"><span>声部数量</span><strong>{tracks.length}</strong><small>4 个乐手分谱</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>总谱小节</span><strong>12</strong><small>4/4 拍 · C 大调</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>待处理评论</span><strong>{unresolved}</strong><small>{pendingDiffs} 条差异待处置</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>预计页数</span><strong>{data?.pages ?? 46}</strong><small>交付 {data?.deadline ?? '2026-10-12'}</small></Card></Col></Row>
    {baselines.length > 0
      ? <Alert type="success" showIcon message={`${baselines[0]!.label}（${baselines[0]!.id}）已锁定，四册分谱已按当时设置生成`} description="当前总谱为新一轮草稿，旧基线仍可在“版本与评论 → 出版基线”查回。" action={<Button size="small" onClick={() => navigate('/versions')}>查看基线</Button>} style={{ marginBottom: 16 }} />
      : pendingDiffs + unresolved > 0
        ? <Alert type="warning" showIcon message="轮次差异需要处理" description={`v11 → v12 尚有 ${pendingDiffs} 条差异未结论、${unresolved} 条评论待处理；接受后才并入总谱，拒绝则保留原值并标清。`} action={<Button size="small" onClick={() => navigate('/versions')}>查看差异</Button>} style={{ marginBottom: 16 }} />
        : <Alert type="success" showIcon message="差异均有结论、待处理评论已清零，可锁定出版基线" action={<Button size="small" type="primary" onClick={() => navigate('/versions')}>去锁定</Button>} style={{ marginBottom: 16 }} />}
    <Row gutter={[16,16]}><Col xs={24} xl={16}><Card title="声部与出版状态"><Table rowKey="id" pagination={false} dataSource={tracks} columns={[{title:'声部',dataIndex:'name'},{title:'乐器',dataIndex:'instrument'},{title:'移调',render:(_value,row)=><Tag color={row.transposition ? 'purple' : 'blue'}>{row.transposition ? `${row.transposition > 0 ? '+' : ''}${row.transposition} 半音` : '不移调'}</Tag>},{title:'小节',render:(_value,row)=>`${new Set(row.notes.map(note=>note.id.split('-')[1])).size} 组 / ${row.notes.length} 音`},{title:'状态',render:()=> <Tag color="green">可排版</Tag>}]} /></Card></Col><Col xs={24} xl={8}><Card title="出版检查"><div className="check-row"><span>和弦拼写校验</span><b className="success">通过</b></div><div className="check-row"><span>节奏完整性</span><b className="success">通过</b></div><div className="check-row"><span>换页与提示音</span><b className={pageTurnPending ? 'warning' : 'success'}>{pageTurnPending ? '待处置' : '已确认'}</b></div><div className="check-row"><span>分谱移调</span><b className="success">已与总谱同步</b></div><Progress percent={percent} strokeColor="#2563eb" /><p className="muted">{baselines.length ? '基线锁定后从新草稿继续编辑。' : '完成全部评论与差异处理后方可锁定出版版本。'}</p></Card></Col></Row>
  </main>
}
