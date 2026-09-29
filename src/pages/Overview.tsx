import { Alert, Button, Card, Col, Progress, Row, Table, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '../store'
import { scoreApi } from '../store'

export default function Overview() {
  const navigate = useNavigate()
  const tracks = useSelector((state: RootState) => state.score.tracks)
  const comments = useSelector((state: RootState) => state.score.comments)
  const review = useSelector((state: RootState) => state.score.review)
  const baselines = useSelector((state: RootState) => state.score.baselines)
  const newDraftStarted = useSelector((state: RootState) => state.score.newDraftStarted)
  const { data } = scoreApi.endpoints.getPublishingProfile.useQuery()
  const openComments = comments.filter((item) => !item.resolved).length
  const pendingHunks = review?.hunks.filter((hunk) => hunk.status === 'pending').length ?? 0
  const currentBaseline = baselines[baselines.length - 1]
  const locked = Boolean(currentBaseline && !newDraftStarted)
  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">乐谱、移调与出版准备</p><h1>{data?.title ?? '总谱出版工作台'}</h1><p>统一管理多声部总谱、移调乐器分谱、换页提示、版本差异与评论锚点。</p></div><Button type="primary" onClick={() => navigate('/score')}>进入总谱编辑</Button></div>
    <Row gutter={[14,14]} className="metrics"><Col xs={24} sm={12} xl={6}><Card className="metric"><span>声部数量</span><strong>{tracks.length}</strong><small>4 个乐手分谱</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>总谱小节</span><strong>12</strong><small>4/4 拍 · C 大调</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>待处理评论</span><strong>{openComments}</strong><small>指挥与作曲意见</small></Card></Col><Col xs={24} sm={12} xl={6}><Card className="metric"><span>预计页数</span><strong>{data?.pages ?? 46}</strong><small>交付 {data?.deadline ?? '2026-10-12'}</small></Card></Col></Row>
    {locked && <Alert type="success" showIcon message={`出版基线 ${currentBaseline!.id} 已锁定`} description={`四册分谱已按锁定时设置生成；总谱只读，后续编辑从新草稿开始，旧基线可查回。`} action={<Button size="small" onClick={() => navigate('/versions')}>查看基线</Button>} style={{ marginBottom: 16 }} />}
    {!locked && review && <Alert type="warning" showIcon message="差异处置草稿进行中" description={`${review.baseId} → ${review.targetId}：还剩 ${pendingHunks} 条差异未处置、${openComments} 条评论待处理；全部闭环后才能锁定出版基线。`} action={<Button size="small" onClick={() => navigate('/versions')}>继续处置</Button>} style={{ marginBottom: 16 }} />}
    {!locked && !review && <Alert type="warning" showIcon message="轮次差异需要处理" description="v11 → v12 的音符、力度、延音线与换页提示差异尚未逐条处置；接受后才会并入总谱。" action={<Button size="small" onClick={() => navigate('/versions')}>查看差异</Button>} style={{ marginBottom: 16 }} />}
    <Row gutter={[16,16]}><Col xs={24} xl={16}><Card title="声部与出版状态"><Table rowKey="id" pagination={false} dataSource={tracks} columns={[{title:'声部',dataIndex:'name'},{title:'乐器',dataIndex:'instrument'},{title:'移调',render:(_value,row)=><Tag color={row.transposition ? 'purple' : 'blue'}>{row.transposition ? `${row.transposition > 0 ? '+' : ''}${row.transposition} 半音` : '不移调'}</Tag>},{title:'小节',render:(_value,row)=>`${new Set(row.notes.map(note=>note.id.split('-')[1])).size} 组 / ${row.notes.length} 音`},{title:'状态',render:()=><Tag color="green">可排版</Tag>}]} /></Card></Col><Col xs={24} xl={8}><Card title="出版检查"><div className="check-row"><span>和弦拼写校验</span><b className="success">通过</b></div><div className="check-row"><span>节奏完整性</span><b className="success">通过</b></div><div className="check-row"><span>换页与提示音</span>{locked ? <b className="success">已随基线冻结</b> : review ? <b className={pendingHunks ? 'danger' : 'success'}>{pendingHunks ? `${pendingHunks} 项待处置` : '已处置'}</b> : <b className="danger">待逐条比较</b>}</div><div className="check-row"><span>分谱移调</span><b className="success">已与总谱同步</b></div><Progress percent={locked ? 100 : review ? Math.round(((review.hunks.length - pendingHunks) / Math.max(1, review.hunks.length)) * 100) : 40} strokeColor="#2563eb" /><p className="muted">{locked ? '出版基线已锁定，分册按冻结设置输出。' : '完成全部差异与评论处理后方可锁定出版版本。'}</p></Card></Col></Row>
  </main>
}
