import { useState } from 'react'
import {
  Alert, Button, Card, Drawer, Empty, Popconfirm, Progress, Select, Space, Table, Tabs, Tag, Timeline, Tooltip,
} from 'antd'
import {
  CheckCircleFilled, CloseCircleFilled, CommentOutlined, FileDoneOutlined, LockOutlined, MergeOutlined,
} from '@ant-design/icons'
import { useDispatch, useSelector } from 'react-redux'
import type { AppDispatch, RootState } from '../store'
import {
  decideAll, decideHunk, discardReview, lockBaseline, noteComment, startNewDraft, startReview,
} from '../store'
import type { Baseline, ChangeHunk, CommentDisposition } from '../types'
import { hunkSummary } from '../diff'

const DISPOSITION_META: Record<CommentDisposition, { color: string; text: string }> = {
  adopted: { color: 'green', text: '已采纳 · 并入总谱' },
  refused: { color: 'red', text: '已拒绝 · 保留原值' },
  noted: { color: 'blue', text: '已记录 · 不改总谱' },
}

export default function Versions() {
  const dispatch = useDispatch<AppDispatch>()
  const { versions, comments, review, baselines, tracks, newDraftStarted } =
    useSelector((state: RootState) => state.score)
  const [baseId, setBaseId] = useState(versions[1]?.id ?? versions[0]!.id)
  const [targetId, setTargetId] = useState(versions[0]!.id)
  const [viewing, setViewing] = useState<Baseline | null>(null)

  const summary = review ? hunkSummary(review.hunks) : null
  const openCommentCount = comments.filter((item) => !item.resolved).length
  const locked = baselines.length > 0 && !review
  const currentBaseline = baselines[baselines.length - 1]
  const lockReady = Boolean(review && summary?.pending === 0 && openCommentCount === 0)

  const hunkColumns = [
    {
      title: '位置', width: 132,
      render: (_: unknown, hunk: ChangeHunk) =>
        hunk.kind === 'note'
          ? `第 ${hunk.measure} 小节 · 第 ${hunk.beat} 拍`
          : '换页与提示音',
    },
    { title: '项目', width: 92, render: (_: unknown, hunk: ChangeHunk) => <Tag>{hunk.label}</Tag> },
    {
      title: `${review?.baseId ?? ''} 原值`, dataIndex: 'oldValue', key: 'old',
      render: (value: string, hunk: ChangeHunk) => (
        <span style={{ color: hunk.status === 'accepted' ? '#94a3b8' : '#b91c1c', textDecoration: hunk.status === 'accepted' ? 'line-through' : 'none' }}>{value}</span>
      ),
    },
    {
      title: `${review?.targetId ?? ''} 新值`, dataIndex: 'newValue', key: 'new',
      render: (value: string, hunk: ChangeHunk) => (
        <span style={{ color: hunk.status === 'rejected' ? '#94a3b8' : '#15803d', textDecoration: hunk.status === 'rejected' ? 'line-through' : 'none', fontWeight: 600 }}>{value}</span>
      ),
    },
    {
      title: '关联评论', width: 110,
      render: (_: unknown, hunk: ChangeHunk) => {
        if (!hunk.linkedCommentId) return <Tag>无挂接</Tag>
        const comment = comments.find((item) => item.id === hunk.linkedCommentId)
        return <Tooltip title={comment?.content}><Tag icon={<CommentOutlined />} color="geekblue">{hunk.linkedCommentId}</Tag></Tooltip>
      },
    },
    {
      title: '处置', width: 178,
      render: (_: unknown, hunk: ChangeHunk) => (
        <Space size={6}>
          <Button size="small" type={hunk.status === 'accepted' ? 'primary' : 'default'}
            icon={<CheckCircleFilled />}
            onClick={() => dispatch(decideHunk({ id: hunk.id, status: 'accepted' }))}>接受</Button>
          <Button size="small" danger={hunk.status === 'rejected'}
            type={hunk.status === 'rejected' ? 'primary' : 'default'}
            icon={<CloseCircleFilled />}
            onClick={() => dispatch(decideHunk({ id: hunk.id, status: 'rejected' }))}>拒绝</Button>
          {hunk.status === 'rejected' && <Tag color="red">保留原值</Tag>}
        </Space>
      ),
    },
  ]

  const diffTab = <>
    <Card style={{ marginBottom: 14 }}>
      {!review && <Space wrap>
        <span>比较版本：</span>
        <Select value={baseId} style={{ width: 130 }} onChange={setBaseId}
          options={versions.map((v) => ({ value: v.id, label: `${v.id} · ${v.author}`, disabled: v.id === targetId }))} />
        <MergeOutlined />
        <Select value={targetId} style={{ width: 130 }} onChange={setTargetId}
          options={versions.map((v) => ({ value: v.id, label: `${v.id} · ${v.author}`, disabled: v.id === baseId }))} />
        <Button type="primary" disabled={baseId === targetId}
          onClick={() => dispatch(startReview({ baseId, targetId }))}>逐条比较并生成处置草稿</Button>
        <span className="muted">版本页只展示摘要；差异须在此逐条接受后才会并入总谱，拒绝则保留原值。</span>
      </Space>}
      {review && <Space style={{ width: '100%', justifyContent: 'space-between' }}>
        <Space wrap>
          <Tag color="purple">处置草稿 {review.id}</Tag>
          <b>{review.baseId}</b> → <b>{review.targetId}</b>
          <Tag>开始 {review.startedAt}</Tag>
          <Tag color="green">待接受/拒绝 {summary?.pending}</Tag>
          <Tag icon={<CheckCircleFilled />} color="green">已接受 {summary?.accepted}</Tag>
          <Tag icon={<CloseCircleFilled />} color="red">已拒绝 {summary?.rejected}</Tag>
        </Space>
        <Space>
          <Button onClick={() => dispatch(decideAll('accepted'))}>全部接受</Button>
          <Button danger onClick={() => dispatch(decideAll('rejected'))}>全部拒绝</Button>
          <Popconfirm title="放弃该处置草稿？" description="所有结论将清除，总谱不变。" onConfirm={() => dispatch(discardReview())}>
            <Button>放弃草稿</Button>
          </Popconfirm>
        </Space>
      </Space>}
    </Card>

    {review && (summary?.pending ?? 0) > 0 && (
      <Alert type="warning" showIcon style={{ marginBottom: 14 }}
        message={`还有 ${summary!.pending} 条差异未处置；全部差异给出结论、待处理评论为零后才能锁定出版基线。`} />
    )}
    {review && openCommentCount > 0 && (
      <Alert type="warning" showIcon style={{ marginBottom: 14 }}
        message={`仍有 ${openCommentCount} 条待处理评论（见“评论锚点”页签）。`} />
    )}
    {review && lockReady && (
      <Alert type="success" showIcon style={{ marginBottom: 14 }}
        message="全部差异已有结论、待处理评论为零，可以锁定出版基线。"
        description="锁定时按结论生成冻结总谱，并冻结当前四册分谱设置；锁定后总谱只读，后续编辑从新草稿开始。" />
    )}

    {!review && !locked && <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 16 }}>
      {versions.map((version) => (
        <Card key={version.id} title={<span>{version.id} · {version.author} <Tag>{version.time}</Tag>{version.frozen && <Tag color="gold">冻结稿</Tag>}</span>}>
          <p>{version.summary}</p>
          <p className="muted">含 {Object.keys(version.trackNotes).length} 个声部快照、{Object.keys(version.cues).length} 组分页设置（摘要仅供浏览，不改动总谱）。</p>
        </Card>
      ))}
    </div>}

    {!review && locked && <Alert type="success" showIcon icon={<LockOutlined />} style={{ marginBottom: 14 }}
      message={`出版基线 ${currentBaseline?.id}（${currentBaseline?.label}）已锁定`}
      description={<>合并 {currentBaseline?.sourceIds.join(' → ')}：接受 {currentBaseline?.accepted} 条、拒绝 {currentBaseline?.rejected} 条；四册分谱已按锁定时设置生成，总谱当前只读。
        {!newDraftStarted && <Button style={{ marginLeft: 12 }} type="primary" onClick={() => dispatch(startNewDraft())}>开启新草稿继续编辑</Button>}
        {newDraftStarted && <Tag color="purple" style={{ marginLeft: 12 }}>新草稿已开启，可在总谱页继续编辑</Tag>}
      </>} />}

    {review && <Space direction="vertical" size={14} style={{ width: '100%' }}>
      {tracks.map((track) => {
        const hunks = review.hunks.filter((hunk) => hunk.trackId === track.id)
        if (!hunks.length) return null
        const trackSummary = hunkSummary(hunks)
        return <Card key={track.id}
          title={<Space><span style={{ color: track.color }}>●</span>{track.name}<small>{track.instrument}</small>
            <Tag>{trackSummary.total} 条差异</Tag>{trackSummary.pending === 0 && <Tag color="green">已处置完</Tag>}</Space>}>
          <Table<ChangeHunk> rowKey="id" size="small" pagination={false} columns={hunkColumns} dataSource={hunks} />
        </Card>
      })}
      {review.hunks.length === 0 && <Empty description="两个版本之间没有音符、力度、延音线或换页差异" />}
    </Space>}
  </>

  const commentTab = <div style={{ display: 'grid', gridTemplateColumns: '1.3fr .7fr', gap: 16 }}>
    <Card title={`评论锚点 · 待处理 ${openCommentCount}`}>{comments.map((comment) => {
      const linkedHunk = review?.hunks.find((hunk) => hunk.linkedCommentId === comment.id)
      return <div key={comment.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr auto', gap: 12, padding: '14px 0', borderBottom: '1px solid #edf0f5' }}>
        <Tag icon={<CommentOutlined />}>第 {comment.measure} 小节</Tag>
        <div>
          <b>{comment.author}</b>
          {comment.link && <Tag style={{ marginLeft: 8 }} color="cyan">
            {tracks.find((t) => t.id === comment.link!.trackId)?.name} · {comment.link.noteId ? `音符 ${comment.link.noteId}` : '换页设置'}
          </Tag>}
          <p style={{ margin: '4px 0' }}>{comment.content}</p>
          {comment.disposition && <Tag color={DISPOSITION_META[comment.disposition].color}>{DISPOSITION_META[comment.disposition].text}</Tag>}
        </div>
        <div>
          {comment.resolved
            ? <Tag color="green">已解决</Tag>
            : linkedHunk
              ? <Tag color="gold">随差异 {linkedHunk.status === 'pending' ? '待处置' : linkedHunk.status === 'accepted' ? '已接受' : '已拒绝'}</Tag>
              : <Space direction="vertical" size={4}>
                <Button size="small" type="primary" onClick={() => dispatch(noteComment({ id: comment.id, disposition: 'adopted' }))}>采纳（记录）</Button>
                <Button size="small" danger onClick={() => dispatch(noteComment({ id: comment.id, disposition: 'refused' }))}>拒绝并保留原值</Button>
              </Space>}
        </div>
      </div>
    })}</Card>
    <Card title="处置规则">
      <Alert type="info" showIcon message="评论不直接改总谱"
        description="挂接到具体差异的评论，在该条差异被接受时并入总谱（标记“已采纳”），被拒绝时保留原值并标记“已拒绝”；无挂接评论仅记录结论。待处理评论为零是锁定基线的必要条件。" />
      <Progress percent={comments.length ? Math.round((comments.length - openCommentCount) / comments.length * 100) : 100}
        status={openCommentCount ? 'active' : 'success'} style={{ marginTop: 16 }} />
      <p className="muted">{comments.length - openCommentCount}/{comments.length} 条已闭环。</p>
    </Card>
  </div>

  const baselineTab = <Space direction="vertical" size={14} style={{ width: '100%' }}>
    {baselines.length === 0 && <Empty description="尚未锁定出版基线" />}
    {[...baselines].reverse().map((baseline, reverseIndex) => {
      const isCurrent = reverseIndex === 0
      return <Card key={baseline.id}
        title={<Space><FileDoneOutlined />{baseline.id} · {baseline.label}{isCurrent && <Tag color="gold">当前冻结稿</Tag>}</Space>}
        extra={<Button onClick={() => setViewing(baseline)}>查回该基线</Button>}>
        <Space wrap>
          <Tag>锁定于 {baseline.createdAt}</Tag>
          <Tag>来源 {baseline.sourceIds.join(' → ')}</Tag>
          <Tag color="green">接受 {baseline.accepted} 条</Tag>
          <Tag color="red">拒绝 {baseline.rejected} 条</Tag>
          <Tag>四册分谱：{baseline.partSettings.showCueNotes ? '显示提示音' : '不显示提示音'} · 换页保留 {baseline.partSettings.cueMeasures} 小节</Tag>
        </Space>
      </Card>
    })}
    <Card title="版本时间线">
      <Timeline items={[
        ...versions.map((v) => ({
          color: v.frozen ? 'gold' : 'blue',
          children: `${v.time} ${v.author} 提交 ${v.id}：${v.summary}${v.frozen ? '（已冻结为出版稿）' : ''}`,
        })),
        { color: 'gray', children: '更早历史：版本只保存摘要与快照，不改动总谱' },
      ]} />
    </Card>
  </Space>

  return <main className="page">
    <div className="page-head">
      <div>
        <p className="eyebrow">版本、评论与出版基线</p>
        <h1>差异比较与审阅</h1>
        <p>逐条比较 v11 与 v12 的音符、力度、延音线和换页提示；接受才并入总谱，拒绝保留原值并标清。</p>
      </div>
      {review && summary && <Space direction="vertical" align="end">
        <Space>
          <Tag icon={<CheckCircleFilled />} color="green">接受 {summary.accepted}</Tag>
          <Tag icon={<CloseCircleFilled />} color="red">拒绝 {summary.rejected}</Tag>
          <Tag>待处理差异 {summary.pending} · 评论 {openCommentCount}</Tag>
        </Space>
        <Popconfirm
          title="锁定出版基线？"
          description="将按处置结论合并总谱并冻结四册分谱设置；锁定后总谱只读。"
          disabled={!lockReady}
          onConfirm={() => dispatch(lockBaseline())}>
          <Tooltip title={lockReady ? '' : '全部差异给出结论且待处理评论为零后才能锁定'}>
            <Button type="primary" size="large" icon={<LockOutlined />} disabled={!lockReady}>锁定出版基线</Button>
          </Tooltip>
        </Popconfirm>
      </Space>}
      {locked && <Space direction="vertical" align="end">
        <Tag color="gold" style={{ fontSize: 14, padding: '4px 12px' }} icon={<LockOutlined />}>{currentBaseline?.id} 已锁定</Tag>
        {!newDraftStarted
          ? <Button type="primary" onClick={() => dispatch(startNewDraft())}>开启新草稿继续编辑</Button>
          : <Tag color="purple">新草稿进行中</Tag>}
      </Space>}
    </div>
    <Tabs defaultActiveKey="diff" items={[
      { key: 'diff', label: '差异处置', children: diffTab },
      { key: 'comments', label: `评论锚点 (${openCommentCount})`, children: commentTab },
      { key: 'baseline', label: `基线与历史 (${baselines.length})`, children: baselineTab },
    ]} />
    <Drawer open={Boolean(viewing)} width={640} onClose={() => setViewing(null)}
      title={viewing ? `${viewing.id} · ${viewing.label}（只读查回）` : ''}>
      {viewing && <Space direction="vertical" size={16} style={{ width: '100%' }}>
        <Alert type="info" showIcon
          message={`锁定于 ${viewing.createdAt}，来源 ${viewing.sourceIds.join(' → ')}；接受 ${viewing.accepted} 条、拒绝 ${viewing.rejected} 条。`} />
        {viewing.tracks.map((track) => (
          <Card key={track.id} size="small"
            title={<Space><span style={{ color: track.color }}>●</span>{track.name}</Space>}
            extra={<Tag>{track.cues.turnAfterMeasure} 小节后换页 · {track.cues.cueMeasures} 小节提示音</Tag>}>
            <div className="note-strip" style={{ padding: 0 }}>
              {track.notes.map((note, index) => (
                <div key={note.id} className="note-chip" style={{ cursor: 'default', minWidth: 64 }}>
                  <b>{index + 1}</b>
                  <small>{note.key.replace('/', '')} · {note.dynamic}{note.tie ? ' ⁀' : ''}</small>
                </div>
              ))}
            </div>
          </Card>
        ))}
        <Card size="small" title="冻结的四册分谱设置">
          <p style={{ margin: 0 }}>提示音：{viewing.partSettings.showCueNotes ? '显示' : '隐藏'}；换页前保留 {viewing.partSettings.cueMeasures} 小节提示音，默认第 {viewing.partSettings.turnAfterMeasure} 小节后换页。</p>
        </Card>
      </Space>}
    </Drawer>
  </main>
}
