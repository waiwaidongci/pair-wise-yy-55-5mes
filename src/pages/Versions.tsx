import { Alert, Button, Card, Empty, Popconfirm, Progress, Table, Tabs, Tag, Timeline, Tooltip } from 'antd'
import { CheckOutlined, CloseOutlined, CommentOutlined, LockOutlined } from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import { acceptAllDiffs, acceptDiff, applyComment, lockBaseline, rejectAllDiffs, rejectDiff, resolveComment, viewBaseline } from '../store'
import type { DiffKind, VersionDiff } from '../types'

const kindMeta: Record<DiffKind, { color: string; label: string }> = {
  pitch: { color: 'blue', label: '音符' },
  duration: { color: 'geekblue', label: '时值' },
  dynamic: { color: 'orange', label: '力度' },
  tie: { color: 'purple', label: '延音线' },
  pageTurn: { color: 'cyan', label: '换页提示' },
}

function DecisionTag({ decision }: { decision: VersionDiff['decision'] }) {
  if (decision === 'accepted') return <Tag color="green">已接受 · 已并入总谱</Tag>
  if (decision === 'rejected') return <Tag color="red">已拒绝 · 保留原值</Tag>
  return <Tag>待处理</Tag>
}

export default function Versions() {
  const dispatch = useDispatch<AppDispatch>()
  const { comments, diffs, tracks, baselines, activeBaselineId, dirty } = useSelector((state: RootState) => state.score)
  const pending = diffs.filter((item) => item.decision === 'pending')
  const accepted = diffs.filter((item) => item.decision === 'accepted')
  const rejected = diffs.filter((item) => item.decision === 'rejected')
  const unresolvedComments = comments.filter((item) => !item.resolved)
  const locked = baselines.length > 0
  const decided = diffs.length - pending.length
  const totalSteps = diffs.length + comments.length
  const doneSteps = decided + comments.length - unresolvedComments.length
  const canLock = pending.length === 0 && unresolvedComments.length === 0 && (diffs.length > 0 || dirty)
  const lockHint = locked && !dirty
    ? '基线已锁定，新草稿暂无改动'
    : pending.length > 0
      ? `还有 ${pending.length} 条差异未处置`
      : unresolvedComments.length > 0
        ? `还有 ${unresolvedComments.length} 条待处理评论`
        : ''
  const trackName = (trackId: string) => tracks.find((item) => item.id === trackId)?.name ?? trackId

  const diffTab = <div>
    {locked && <Alert type="success" showIcon style={{ marginBottom: 14 }} message={`${baselines[0]!.label}（${baselines[0]!.id}）已锁定`} description={`四册分谱已按锁定时设置生成，共接受 ${baselines[0]!.acceptedCount} 条、拒绝 ${baselines[0]!.rejectedCount} 条差异。后续编辑从新草稿开始，旧基线可在“出版基线”页签查回。`} />}
    <div className="diff-summary">
      <Card size="small"><div className="diff-stat"><strong>{pending.length}</strong><span>待处理差异</span></div></Card>
      <Card size="small"><div className="diff-stat"><strong className="ok">{accepted.length}</strong><span>已接受并入</span></div></Card>
      <Card size="small"><div className="diff-stat"><strong className="no">{rejected.length}</strong><span>已拒绝保留原值</span></div></Card>
      <Card size="small"><div className="diff-stat"><strong>{unresolvedComments.length}</strong><span>待处理评论</span></div></Card>
      <div className="diff-bulk"><Tooltip title={pending.length === 0 ? '没有待处理差异' : ''}><Button type="primary" icon={<CheckOutlined />} disabled={pending.length === 0} onClick={() => dispatch(acceptAllDiffs())}>接受全部</Button></Tooltip><Tooltip title={pending.length === 0 ? '没有待处理差异' : ''}><Button danger icon={<CloseOutlined />} disabled={pending.length === 0} onClick={() => dispatch(rejectAllDiffs())}>拒绝全部</Button></Tooltip></div>
    </div>
    <div style={{ margin: '14px 0' }}><Progress percent={totalSteps ? Math.round((doneSteps / totalSteps) * 100) : 100} strokeColor="#2563eb" format={() => `${doneSteps}/${totalSteps} 项已处置`} /></div>
    {diffs.length === 0
      ? <Empty description={locked ? '本轮差异均已随基线锁定处置完毕，后续编辑从新草稿开始' : '暂无版本差异'} />
      : tracks.filter((track) => diffs.some((diff) => diff.trackId === track.id)).map((track) => <Card key={track.id} size="small" style={{ marginBottom: 14 }} title={<span>{track.name} <small style={{ color: '#94a3b8' }}>{track.instrument}</small></span>}>
        {diffs.filter((diff) => diff.trackId === track.id).map((diff) => <div className="diff-row" key={diff.id}>
          <Tag color={kindMeta[diff.kind].color}>{kindMeta[diff.kind].label}</Tag>
          <span>第 {diff.measure} 小节 · {diff.field}：<b className="old-value">{diff.before}</b> <CloseOutlined style={{ fontSize: 10, color: '#94a3b8' }} /> <b className="new-value">{diff.after}</b>{diff.linkedCommentId && <Tag icon={<CommentOutlined />} color="gold" style={{ marginLeft: 10 }}>关联 {diff.linkedCommentId}</Tag>}</span>
          <span className="diff-actions">{diff.decision === 'pending'
            ? <><Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => dispatch(acceptDiff(diff.id))}>接受</Button><Button size="small" danger icon={<CloseOutlined />} onClick={() => dispatch(rejectDiff(diff.id))}>拒绝</Button></>
            : <DecisionTag decision={diff.decision} />}</span>
        </div>)}
      </Card>)}
  </div>

  const commentsTab = <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 16 }}>
    <Card title={`评论锚点（${unresolvedComments.length} 条待处理）`}>{comments.map((comment) => {
      const linked = diffs.find((diff) => diff.linkedCommentId === comment.id)
      return <div key={comment.id} style={{ display: 'grid', gridTemplateColumns: '96px 1fr auto', gap: 12, alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #edf0f5' }}>
        <Tag icon={<CommentOutlined />}>第 {comment.measure} 小节</Tag>
        <div><b>{comment.author}</b><p style={{ margin: '4px 0' }}>{comment.content}</p>{linked && <small style={{ color: '#94a3b8' }}>关联差异：{trackName(linked.trackId)} · {kindMeta[linked.kind].label}（{linked.before} → {linked.after}）</small>}</div>
        <div>{comment.resolved
          ? <Tag color="green">已解决</Tag>
          : linked?.decision === 'pending'
            ? <Button size="small" type="primary" onClick={() => dispatch(applyComment(comment.id))}>应用并并入总谱</Button>
            : linked?.decision === 'rejected'
              ? <span><Tag color="red">差异已拒绝</Tag><Button size="small" onClick={() => dispatch(resolveComment(comment.id))}>了结评论</Button></span>
              : linked?.decision === 'accepted'
                ? <Tag color="green">已随差异接受</Tag>
                : <Button size="small" onClick={() => dispatch(resolveComment(comment.id))}>标记解决</Button>}</div>
      </div>
    })}</Card>
    <Card title="待决事项">
      <Alert type={canLock ? 'success' : 'warning'} showIcon message={canLock ? '可以锁定出版基线' : '基线尚不可锁定'} description={lockHint || '差异均有结论且评论已清零。'} style={{ marginBottom: 14 }} />
      <div className="check-row"><span>差异结论</span><b className={pending.length ? 'warning' : 'success'}>{decided}/{diffs.length}</b></div>
      <div className="check-row"><span>评论清零</span><b className={unresolvedComments.length ? 'warning' : 'success'}>{comments.length - unresolvedComments.length}/{comments.length}</b></div>
      <p className="muted">接受评论会把关联的力度、延音线等改动真正写入总谱；拒绝则保留原总谱值并在差异单中标清。</p>
    </Card>
  </div>

  const baselineTab = baselines.length === 0
    ? <Empty description="尚未锁定出版基线" />
    : <div>{baselines.map((baseline) => <Card key={baseline.id} style={{ marginBottom: 16 }} title={<span>{baseline.label} <Tag color="blue">{baseline.id}</Tag></span>} extra={activeBaselineId === baseline.id ? <Button onClick={() => dispatch(viewBaseline(null))}>回到当前草稿</Button> : <Button onClick={() => dispatch(viewBaseline(baseline.id))}>查回此基线</Button>}>
      <div style={{ display: 'flex', gap: 28, marginBottom: 12 }}>
        <span>锁定时间：<b>{baseline.lockedAt}</b></span>
        <span>基于版本：<Tag>{baseline.basedOn}</Tag></span>
        <span><Tag color="green">接受 {baseline.acceptedCount}</Tag><Tag color="red">拒绝 {baseline.rejectedCount}</Tag></span>
      </div>
      <Table rowKey="trackId" size="small" pagination={false} dataSource={baseline.parts} columns={[
        { title: '分册', dataIndex: 'trackName' },
        { title: '乐器', dataIndex: 'instrument' },
        { title: '移调', dataIndex: 'transposition', render: (value: number) => value ? `${value > 0 ? '+' : ''}${value} 半音` : '不移调' },
        { title: '换页', render: (_v, row) => `第 ${row.settings.pageTurnAfter} 小节后换页` },
        { title: '提示音', render: (_v, row) => row.settings.showCue ? `${row.settings.cueMeasures} 小节` : '隐藏' },
        { title: '音符', render: (_v, row) => `${row.notes.length} 个` },
      ]} />
      {activeBaselineId === baseline.id && <Alert style={{ marginTop: 12 }} type="info" showIcon message="正在查阅此基线，可在“分谱出版”页逐册查看锁定时生成的四册分谱（只读）。" />}
    </Card>)}</div>

  return <main className="page">
    <div className="page-head"><div><p className="eyebrow">版本、评论与出版基线</p><h1>差异比较与审阅</h1><p>逐条比较 v11 与 v12 的音符、力度、延音线与换页提示；接受后并入总谱，拒绝则保留原值并标清。</p></div>
      <Tooltip title={canLock ? '锁定后四册分谱按当前设置生成，总谱进入新一轮草稿，旧基线仍可查回' : lockHint}><Popconfirm title="锁定出版基线？" description="四册分谱将按当前设置生成；锁定后从新草稿继续编辑。" okText="锁定" cancelText="取消" disabled={!canLock} onConfirm={() => dispatch(lockBaseline())}><Button type="primary" icon={<LockOutlined />} disabled={!canLock}>{locked ? '为新草稿锁定基线' : '锁定出版基线'}</Button></Popconfirm></Tooltip>
    </div>
    <Tabs defaultActiveKey="diff" items={[
      { key: 'diff', label: `版本差异 (${pending.length})`, children: diffTab },
      { key: 'comments', label: `评论锚点 (${unresolvedComments.length})`, children: commentsTab },
      { key: 'baselines', label: `出版基线 (${baselines.length})`, children: baselineTab },
      { key: 'timeline', label: '操作历史', children: <Card><Timeline items={[
        ...baselines.map((baseline) => ({ color: 'green', children: `${baseline.lockedAt} 锁定 ${baseline.label}（${baseline.id}）：接受 ${baseline.acceptedCount} 条、拒绝 ${baseline.rejectedCount} 条，生成四册分谱` })),
        { color: 'blue', children: '16:28 沈青提交 v12：调整终段和声、圆号力度与连音线' },
        { color: 'gray', children: '14:10 方亦发布 v11：移调单簧管分谱并调整换气标记' },
      ]} /></Card> },
    ]} />
  </main>
}
