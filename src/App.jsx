import { useState, useEffect, useMemo } from 'react'
import config from './config'
import { AUTHORS, FAN_SINCE, findAuthor, authorName, authorEmoji, authorColor, badgeStyle } from './data/authors'
import { CATEGORIES, catColor, catBg, catLabel, monthLabel } from './data/categories'
import { DEFAULT_EVENTS } from './data/defaultEvents'

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${config.BIN_ID}`

// ========== 工具函式 ==========
function genId() {
  return 'e-' + Date.now()
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ========== API 函式 ==========
async function loadEvents() {
  try {
    const res = await fetch(`${JSONBIN_URL}/latest`, {
      headers: { 'X-Master-Key': config.API_KEY, 'X-Bin-Meta': 'false' }
    })
    const data = await res.json()
    if (Array.isArray(data) && data.length > 0) return data
    return DEFAULT_EVENTS
  } catch (e) {
    console.warn('載入失敗，使用預設資料', e)
    return DEFAULT_EVENTS
  }
}

async function saveEvents(events) {
  const res = await fetch(JSONBIN_URL, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Master-Key': config.API_KEY
    },
    body: JSON.stringify(events)
  })
  if (!res.ok) throw new Error('Save failed')
}

// ========== 主元件 ==========
export default function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [me, setMe] = useState(null)
  const [filter, setFilter] = useState('all')
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  // Form state
  const [form, setForm] = useState({
    id: '', year: 2025, month: 1, cat: 'music', title: '', desc: '',
    membersStr: '', links: [], notes: [], editLog: []
  })
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [confirmDel, setConfirmDel] = useState(false)
  const [showLog, setShowLog] = useState(false)

  // Toast helper
  const flash = (msg) => {
    setToast(msg)
    setTimeout(() => setToast(null), 2500)
  }

  // 載入資料
  useEffect(() => {
    loadEvents().then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [])

  // 儲存資料
  const persist = async (newEvents) => {
    setSaving(true)
    try {
      await saveEvents(newEvents)
      setEvents(newEvents)
      flash('✅ 已儲存（所有人可見）')
    } catch {
      flash('❌ 儲存失敗，請稍後重試')
    }
    setSaving(false)
  }

  const refresh = async () => {
    try {
      const data = await loadEvents()
      if (Array.isArray(data)) {
        setEvents(data)
        flash('🔄 已同步最新')
      }
    } catch {
      flash('載入失敗')
    }
  }

  // 篩選與排序
  const filtered = useMemo(() => {
    return filter === 'all' ? events : events.filter(e => e.cat === filter)
  }, [events, filter])

  const byYear = useMemo(() => {
    const m = {}
    filtered.forEach(e => {
      (m[e.year] ??= []).push(e)
    })
    return m
  }, [filtered])

  const years = useMemo(() => Object.keys(byYear).sort((a, b) => a - b), [byYear])

  const supplementedCount = useMemo(() =>
    events.filter(e => (e.links?.length || 0) + (e.notes?.length || 0) > 0).length
  , [events])

  const yearSpan = useMemo(() => {
    if (!events.length) return 0
    const yrs = events.map(e => e.year)
    return Math.max(...yrs) - Math.min(...yrs) + 1
  }, [events])

  const viewEvent = useMemo(() =>
    modal?.eventId ? events.find(e => e.id === modal.eventId) : null
  , [modal, events])

  const isEditing = modal?.mode === 'edit' || modal?.mode === 'new'

  const sortedEvents = (arr) => [...arr].sort((a, b) => (a.month || 0) - (b.month || 0))

  const hasExtra = (ev) => (ev.links?.length || 0) + (ev.notes?.length || 0) > 0
  const lastEditor = (ev) => ev.editLog?.length ? ev.editLog[ev.editLog.length - 1].author : null

  // Modal helpers
  const setFormFromEvent = (ev) => {
    setForm({
      id: ev.id,
      year: ev.year,
      month: ev.month,
      cat: ev.cat,
      title: ev.title,
      desc: ev.desc,
      membersStr: (ev.members || []).join(', '),
      links: JSON.parse(JSON.stringify(ev.links || [])),
      notes: JSON.parse(JSON.stringify(ev.notes || [])),
      editLog: JSON.parse(JSON.stringify(ev.editLog || []))
    })
  }

  const openView = (ev) => {
    setFormFromEvent(ev)
    setLinkUrl(''); setLinkLabel(''); setNoteInput('')
    setShowLog(false); setConfirmDel(false)
    setModal({ mode: 'view', eventId: ev.id })
  }

  const openNew = () => {
    const newId = genId()
    setForm({
      id: newId, year: 2025, month: 1, cat: 'music',
      title: '', desc: '', membersStr: '全員',
      links: [], notes: [], editLog: []
    })
    setLinkUrl(''); setLinkLabel(''); setNoteInput('')
    setModal({ mode: 'new' })
  }

  const closeModal = () => {
    setModal(null)
    setConfirmDel(false)
    setShowLog(false)
  }

  // Save event
  const saveEvent = () => {
    const parsed = {
      id: form.id,
      year: parseInt(form.year) || 2025,
      month: parseInt(form.month) || 1,
      cat: form.cat,
      title: form.title,
      desc: form.desc,
      members: form.membersStr.split(',').map(s => s.trim()).filter(Boolean),
      links: form.links,
      notes: form.notes,
      editLog: [...form.editLog, { author: me, action: modal.mode === 'new' ? '新增' : '編輯', ts: Date.now() }]
    }
    let next
    if (modal.mode === 'new') {
      next = [...events, parsed]
    } else {
      next = events.map(e => e.id === parsed.id ? parsed : e)
    }
    persist(next)
    closeModal()
  }

  const deleteEvent = () => {
    persist(events.filter(e => e.id !== form.id))
    closeModal()
  }

  // Links
  const addLink = () => {
    if (!linkUrl.trim()) return
    let u = linkUrl.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    setForm(f => ({
      ...f,
      links: [...f.links, { url: u, label: linkLabel.trim() || u, author: me, ts: Date.now() }]
    }))
    setLinkUrl(''); setLinkLabel('')
  }

  const removeLink = (i) => {
    setForm(f => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }))
  }

  const addLinkAndSave = () => {
    if (!linkUrl.trim()) return
    let u = linkUrl.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    const newLinks = [...form.links, { url: u, label: linkLabel.trim() || u, author: me, ts: Date.now() }]
    setLinkUrl(''); setLinkLabel('')
    saveSupplements(newLinks, form.notes)
  }

  // Notes
  const addNote = () => {
    if (!noteInput.trim()) return
    setForm(f => ({
      ...f,
      notes: [...f.notes, { text: noteInput.trim(), author: me, ts: Date.now() }]
    }))
    setNoteInput('')
  }

  const removeNote = (i) => {
    setForm(f => ({ ...f, notes: f.notes.filter((_, idx) => idx !== i) }))
  }

  const addNoteAndSave = () => {
    if (!noteInput.trim()) return
    const newNotes = [...form.notes, { text: noteInput.trim(), author: me, ts: Date.now() }]
    setNoteInput('')
    saveSupplements(form.links, newNotes)
  }

  const saveSupplements = (links, notes) => {
    const ev = events.find(e => e.id === modal?.eventId)
    if (!ev) return
    const updated = {
      ...ev,
      links: links,
      notes: notes,
      editLog: [...(ev.editLog || []), { author: me, action: '補充', ts: Date.now() }]
    }
    persist(events.map(e => e.id === updated.id ? updated : e))
    setForm(f => ({ ...f, links, notes }))
  }

  // ========== 選擇身份 ==========
  if (!me) {
    return (
      <div className="author-screen">
        <div style={{ textAlign: 'center', padding: 40, maxWidth: 460 }}>
          <div style={{ fontSize: '2.5rem', marginBottom: 8 }}>👑</div>
          <h1 className="brand">BIGBANG</h1>
          <p style={{ color: '#888', fontSize: 14, marginTop: 8, fontStyle: 'italic' }}>共筆年表 — 請選擇你的身份</p>
          <div className="author-grid">
            {AUTHORS.map(a => (
              <button
                key={a.id}
                className="author-btn"
                style={{ borderColor: a.color + '33' }}
                onClick={() => setMe(a.id)}
              >
                <span style={{ fontSize: '1.8rem' }}>{a.emoji}</span>
                <span style={{ fontSize: 15, fontWeight: 600, color: a.color }}>{a.name}</span>
              </button>
            ))}
          </div>
          <p style={{ color: '#555', fontSize: 11, marginTop: 24 }}>選擇後即可開始編輯，你的操作都會記錄署名</p>
        </div>
      </div>
    )
  }

  // ========== Loading ==========
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand" style={{ fontSize: '3rem', letterSpacing: '0.3em' }}>BIGBANG</div>
        <div style={{ color: '#888', marginTop: 12, fontSize: 14 }}>載入中...</div>
      </div>
    )
  }

  // ========== 主介面 ==========
  return (
    <div>
      {/* Toast */}
      {toast && <div className="toast">{toast}</div>}

      {/* Header */}
      <div className="hero">
        <div style={{ fontSize: '2rem' }}>👑</div>
        <h1 className="brand">BIGBANG</h1>
        <p style={{ color: '#888', fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>影視作品共筆年表</p>
        <div className="identity-bar">
          <span style={{ fontSize: 12, color: '#888' }}>登入為</span>
          <span className="abadge" style={badgeStyle(me)}>{authorEmoji(me)} {authorName(me)}</span>
          <button onClick={() => setMe(null)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, textDecoration: 'underline' }}>切換</button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}><div className="stat-num">{events.length}</div><div className="stat-label">事件</div></div>
          <div style={{ textAlign: 'center' }}><div className="stat-num">{supplementedCount}</div><div className="stat-label">已補充</div></div>
          <div style={{ textAlign: 'center' }}><div className="stat-num">{yearSpan}</div><div className="stat-label">年</div></div>
        </div>
        <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button onClick={refresh} style={{ padding: '6px 16px', background: 'transparent', border: '1px solid rgba(212,175,55,0.3)', color: '#D4AF37', borderRadius: 20, fontSize: 11 }}>🔄 同步</button>
          <button onClick={openNew} style={{ padding: '6px 16px', background: '#D4AF37', border: 'none', color: '#0A0A0A', borderRadius: 20, fontSize: 11, fontWeight: 600 }}>＋ 新增事件</button>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          全部 <span style={{ opacity: 0.6, fontSize: 10 }}>{events.length}</span>
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`filter-btn ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {cat.label} <span style={{ opacity: 0.6, fontSize: 10 }}>{events.filter(e => e.cat === key).length}</span>
          </button>
        ))}
      </div>

      {/* Timeline */}
      <div className="timeline">
        {years.map(year => (
          <div key={year} style={{ marginBottom: 44 }}>
            <div className="year-header">
              <span className="year-num">{year}</span>
              <span style={{ fontSize: 10, color: '#555' }}>{byYear[year].length} 項</span>
              {(FAN_SINCE[year] || []).map(aid => (
                <span
                  key={aid}
                  className="fan-badge"
                  style={{ background: authorColor(aid) + '18', color: authorColor(aid), border: '1px solid ' + authorColor(aid) + '30' }}
                >
                  {authorEmoji(aid)} {authorName(aid)} 入坑
                </span>
              ))}
            </div>
            {sortedEvents(byYear[year]).map(ev => (
              <div
                key={ev.id}
                className="event-card"
                style={{ borderLeft: '3px solid ' + catColor(ev.cat) }}
                onClick={() => openView(ev)}
              >
                <div className="month-col" style={{ color: catColor(ev.cat) }}>{monthLabel(ev.month)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                    <span className="cat-tag" style={{ background: catBg(ev.cat), color: catColor(ev.cat) }}>{catLabel(ev.cat)}</span>
                    {hasExtra(ev) && <span style={{ fontSize: 9, color: '#2A9D8F' }}>📎 已補充</span>}
                    {lastEditor(ev) && (
                      <span style={{ fontSize: 9, color: '#555' }}>·
                        <span className="abadge sm" style={badgeStyle(lastEditor(ev))}>{authorEmoji(lastEditor(ev))} {authorName(lastEditor(ev))}</span>
                      </span>
                    )}
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, lineHeight: 1.4 }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: '#777', lineHeight: 1.6 }}>{ev.desc}</div>
                  {ev.links && ev.links.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                      {ev.links.map((lk, i) => (
                        <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer" className="link-tag" onClick={e => e.stopPropagation()}>
                          🔗 {lk.label}
                        </a>
                      ))}
                    </div>
                  )}
                  {ev.notes && ev.notes.length > 0 && (
                    <div style={{ marginTop: 5, fontSize: 11, color: '#999', fontStyle: 'italic', borderLeft: '2px solid rgba(212,175,55,0.2)', paddingLeft: 8 }}>
                      💬 {ev.notes[ev.notes.length - 1].text} —
                      <span className="abadge sm" style={badgeStyle(ev.notes[ev.notes.length - 1].author)}>
                        {authorEmoji(ev.notes[ev.notes.length - 1].author)} {authorName(ev.notes[ev.notes.length - 1].author)}
                      </span>
                    </div>
                  )}
                  {ev.members && ev.members.length > 0 && (
                    <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                      {ev.members.map(m => <span key={m} className="member-tag">{m}</span>)}
                    </div>
                  )}
                </div>
                <div style={{ flexShrink: 0, alignSelf: 'center', fontSize: 12, color: '#444' }}>✏️</div>
              </div>
            ))}
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-state">此分類暫無資料</div>}
      </div>

      {/* Footer */}
      <div className="footer">
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, letterSpacing: '0.3em', color: 'rgba(212,175,55,0.25)' }}>BIGBANG · V.I.P</div>
        <p style={{ fontSize: 10, color: '#444', marginTop: 6 }}>共筆年表 · Since 2006</p>
      </div>

      {/* Modal */}
      {modal && (
        <div className="overlay" onClick={(e) => e.target === e.currentTarget && closeModal()}>
          <div className="modal">
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 700, color: '#D4AF37' }}>
                {modal.mode === 'new' ? '＋ 新增事件' : modal.mode === 'edit' ? '✏️ 編輯事件' : '📋 事件詳情'}
              </div>
              <button onClick={closeModal} style={{ background: 'none', border: 'none', color: '#666', fontSize: 20, lineHeight: 1 }}>✕</button>
            </div>

            {/* Edit / New Form */}
            {isEditing && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
                  <div>
                    <label className="form-label">年份</label>
                    <input type="number" value={form.year} onChange={e => setForm(f => ({ ...f, year: e.target.value }))} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">月份</label>
                    <select value={form.month} onChange={e => setForm(f => ({ ...f, month: e.target.value }))} className="form-input">
                      {[1,2,3,4,5,6,7,8,9,10,11,12].map(i => <option key={i} value={i}>{i}月</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">分類</label>
                    <select value={form.cat} onChange={e => setForm(f => ({ ...f, cat: e.target.value }))} className="form-input">
                      {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                </div>
                <label className="form-label">標題</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="事件標題" className="form-input" />
                <label className="form-label">描述</label>
                <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="事件描述" rows={3} className="form-input" />
                <label className="form-label">成員（逗號分隔）</label>
                <input value={form.membersStr} onChange={e => setForm(f => ({ ...f, membersStr: e.target.value }))} placeholder="G-Dragon, T.O.P, 太陽, 大聲, 勝利" className="form-input" />

                <div className="divider" />

                {/* Links */}
                <label className="form-label">🔗 相關連結</label>
                {form.links.map((lk, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#2A9D8F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 {lk.label}</span>
                    {lk.author && <span className="abadge sm" style={badgeStyle(lk.author)}>{authorEmoji(lk.author)} {authorName(lk.author)}</span>}
                    <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', color: '#E63946', fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                  <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="名稱" className="form-input" style={{ flex: '1 1 100px', marginBottom: 0 }} />
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="網址" className="form-input" style={{ flex: '2 1 150px', marginBottom: 0 }} />
                  <button onClick={addLink} className="gold-btn">+</button>
                </div>

                <div className="divider" />

                {/* Notes */}
                <label className="form-label">💬 備註留言</label>
                {form.notes.map((n, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#aaa' }}>{n.text}</span>
                    {n.author && <span className="abadge sm" style={badgeStyle(n.author)}>{authorEmoji(n.author)} {authorName(n.author)}</span>}
                    <button onClick={() => removeNote(i)} style={{ background: 'none', border: 'none', color: '#E63946', fontSize: 12 }}>✕</button>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
                  <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNote()} placeholder="寫點什麼..." className="form-input" style={{ flex: 1, marginBottom: 0 }} />
                  <button onClick={addNote} className="gold-btn">+</button>
                </div>

                <div className="divider" />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={saveEvent} disabled={saving || !form.title?.trim()} className="gold-btn" style={{ padding: '8px 24px' }}>{saving ? '儲存中...' : '💾 儲存'}</button>
                    <button onClick={closeModal} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#888', borderRadius: 8, fontSize: 12 }}>取消</button>
                  </div>
                  {modal.mode === 'edit' && (
                    confirmDel ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontSize: 11, color: '#E63946' }}>確定？</span>
                        <button onClick={deleteEvent} style={{ padding: '6px 12px', background: '#E63946', color: '#fff', border: 'none', borderRadius: 6, fontSize: 11, fontWeight: 600 }}>刪除</button>
                        <button onClick={() => setConfirmDel(false)} style={{ padding: '6px 12px', background: 'transparent', border: '1px solid #555', color: '#888', borderRadius: 6, fontSize: 11 }}>取消</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDel(true)} className="del-btn">🗑 刪除事件</button>
                    )
                  )}
                </div>
              </div>
            )}

            {/* View Mode */}
            {modal.mode === 'view' && viewEvent && (
              <div>
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  <span className="cat-tag" style={{ background: catBg(viewEvent.cat), color: catColor(viewEvent.cat) }}>{catLabel(viewEvent.cat)}</span>
                  <span style={{ fontSize: 11, color: '#666' }}>{viewEvent.year} · {monthLabel(viewEvent.month)}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>{viewEvent.title}</h3>
                <p style={{ fontSize: 13, color: '#999', lineHeight: 1.7, marginBottom: 4 }}>{viewEvent.desc}</p>
                {viewEvent.members?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 16 }}>
                    {viewEvent.members.map(m => <span key={m} className="member-tag" style={{ fontSize: 10, padding: '2px 7px' }}>{m}</span>)}
                  </div>
                )}

                <div className="divider" style={{ marginTop: 0 }} />

                {/* Links in view */}
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 8 }}>🔗 相關連結</h4>
                {form.links?.length > 0 ? (
                  form.links.map((lk, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4 }}>
                      <a href={lk.url} target="_blank" rel="noopener noreferrer" style={{ flex: 1, fontSize: 12, color: '#2A9D8F', textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>🔗 {lk.label}</a>
                      {lk.author && <span className="abadge sm" style={badgeStyle(lk.author)}>{authorEmoji(lk.author)} {authorName(lk.author)}</span>}
                      <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', color: '#E63946', fontSize: 12 }}>✕</button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>尚無連結</p>
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
                  <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="名稱" className="form-input" style={{ flex: '1 1 80px', marginBottom: 0, fontSize: 12 }} />
                  <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLinkAndSave()} placeholder="網址 https://..." className="form-input" style={{ flex: '2 1 140px', marginBottom: 0, fontSize: 12 }} />
                  <button onClick={addLinkAndSave} className="gold-btn">+ 新增</button>
                </div>

                {/* Notes in view */}
                <h4 style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 8 }}>💬 備註留言</h4>
                {form.notes?.length > 0 ? (
                  form.notes.map((n, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 6, padding: '6px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4 }}>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: 12, color: '#bbb' }}>{n.text}</span>
                        <div style={{ fontSize: 10, color: '#555', marginTop: 2 }}>
                          {n.author && <span className="abadge sm" style={badgeStyle(n.author)}>{authorEmoji(n.author)} {authorName(n.author)}</span>}
                          {' '}{formatTime(n.ts)}
                        </div>
                      </div>
                      <button onClick={() => removeNote(i)} style={{ background: 'none', border: 'none', color: '#E63946', fontSize: 12 }}>✕</button>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 11, color: '#555', marginBottom: 8 }}>尚無備註</p>
                )}
                <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
                  <input value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && addNoteAndSave()} placeholder="寫點什麼..." className="form-input" style={{ flex: 1, marginBottom: 0, fontSize: 12 }} />
                  <button onClick={addNoteAndSave} className="gold-btn">+ 留言</button>
                </div>

                <div className="divider" />

                <div style={{ display: 'flex', gap: 8, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' }}>
                  <button onClick={() => setModal(m => ({ ...m, mode: 'edit' }))} className="gold-btn" style={{ padding: '8px 20px', fontSize: 12 }}>✏️ 編輯事件內容</button>
                  <button onClick={() => setShowLog(!showLog)} style={{ background: 'none', border: 'none', color: '#555', fontSize: 11, textDecoration: 'underline' }}>{showLog ? '收起' : '📜 編輯紀錄'}</button>
                </div>

                {showLog && (
                  <div style={{ marginTop: 12, padding: 12, background: 'rgba(255,255,255,0.02)', borderRadius: 8 }}>
                    <div style={{ fontSize: 11, color: '#666', marginBottom: 6 }}>編輯紀錄（最新在前）</div>
                    {viewEvent.editLog?.length > 0 ? (
                      [...viewEvent.editLog].reverse().map((log, i) => (
                        <div key={i} style={{ fontSize: 11, color: '#777', padding: '3px 0', display: 'flex', alignItems: 'center', gap: 6 }}>
                          <span className="abadge sm" style={badgeStyle(log.author)}>{authorEmoji(log.author)} {authorName(log.author)}</span>
                          <span>{log.action}</span>
                          <span style={{ color: '#444' }}>{formatTime(log.ts)}</span>
                        </div>
                      ))
                    ) : (
                      <div style={{ fontSize: 11, color: '#444' }}>尚無紀錄</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
