import { useState, useEffect, useMemo } from 'react'
import config from './config'
import { AUTHORS, FAN_SINCE, findAuthor, authorName, authorEmoji, authorColor, badgeStyle } from './data/authors'
import { CATEGORIES, catColor, catBg, catLabel, monthLabel } from './data/categories'
import { DEFAULT_EVENTS } from './data/defaultEvents'

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${config.BIN_ID}`

// ========== 工具函式 ==========
function genId() {
  return Date.now() + Math.random().toString(36).slice(2, 9)
}

function fanSinceYear(authorId) {
  for (const [year, ids] of Object.entries(FAN_SINCE)) {
    if (ids.includes(authorId)) return year
  }
  return null
}

function formatDate(y, m, d) {
  if (!m) return `${y} 年`
  if (!d) return `${y} 年 ${monthLabel(m)}`
  return `${y} 年 ${m} 月 ${d} 日`
}

// ========== API 函式 ==========
async function loadEvents() {
  try {
    const res = await fetch(JSONBIN_URL, {
      headers: { 'X-Master-Key': config.API_KEY }
    })
    const json = await res.json()
    const data = json.record
    if (Array.isArray(data) && data.length > 0) return data
    return DEFAULT_EVENTS
  } catch (e) {
    console.warn('載入失敗，使用預設資料', e)
    return DEFAULT_EVENTS
  }
}

async function saveEvents(events) {
  try {
    await fetch(JSONBIN_URL, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-Master-Key': config.API_KEY
      },
      body: JSON.stringify(events)
    })
    return true
  } catch (e) {
    console.error('儲存失敗', e)
    return false
  }
}

// ========== 主元件 ==========
export default function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [filter, setFilter] = useState('all')
  const [editingEvent, setEditingEvent] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState(null)

  // 載入資料
  useEffect(() => {
    loadEvents().then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [])

  // 儲存資料
  const doSave = async (newEvents) => {
    setEvents(newEvents)
    setSaving(true)
    await saveEvents(newEvents)
    setSaving(false)
  }

  // 篩選與排序
  const filteredEvents = useMemo(() => {
    let list = [...events]
    if (filter !== 'all') {
      list = list.filter(e => e.category === filter)
    }
    list.sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year
      if ((a.month || 0) !== (b.month || 0)) return (a.month || 0) - (b.month || 0)
      return (a.day || 0) - (b.day || 0)
    })
    return list
  }, [events, filter])

  // 新增/編輯事件
  const handleSaveEvent = (eventData) => {
    let newEvents
    if (editingEvent) {
      newEvents = events.map(e => e.id === editingEvent.id ? { ...eventData, id: e.id } : e)
    } else {
      newEvents = [...events, { ...eventData, id: genId() }]
    }
    doSave(newEvents)
    setShowForm(false)
    setEditingEvent(null)
  }

  // 刪除事件
  const handleDelete = (id) => {
    if (!confirm('確定要刪除這個事件嗎？')) return
    doSave(events.filter(e => e.id !== id))
  }

  // 新增連結
  const handleAddLink = (eventId, url, label) => {
    const newEvents = events.map(e => {
      if (e.id !== eventId) return e
      return {
        ...e,
        links: [...(e.links || []), { url, label, author: currentUser, ts: Date.now() }]
      }
    })
    doSave(newEvents)
  }

  // 新增筆記
  const handleAddNote = (eventId, text) => {
    const newEvents = events.map(e => {
      if (e.id !== eventId) return e
      return {
        ...e,
        notes: [...(e.notes || []), { text, author: currentUser, ts: Date.now() }]
      }
    })
    doSave(newEvents)
  }

  // ========== 選擇身份 ==========
  if (!currentUser) {
    return (
      <div className="app">
        <header className="header">
          <h1>BIGBANG 共筆年表</h1>
          <p className="subtitle">選擇你的身份</p>
        </header>
        <div className="author-select">
          {AUTHORS.map(a => (
            <button
              key={a.id}
              className="author-btn"
              style={{ '--author-color': a.color }}
              onClick={() => setCurrentUser(a.id)}
            >
              <span className="author-emoji">{a.emoji}</span>
              <span className="author-name">{a.name}</span>
              <span className="fan-since">入坑 {fanSinceYear(a.id)}</span>
            </button>
          ))}
        </div>
      </div>
    )
  }

  // ========== 主介面 ==========
  const user = findAuthor(currentUser)

  return (
    <div className="app">
      <header className="header">
        <h1>BIGBANG 共筆年表</h1>
        <div className="user-bar">
          <span className="current-user" style={badgeStyle(currentUser)}>
            {user.emoji} {user.name}
          </span>
          <button className="btn-small" onClick={() => setCurrentUser(null)}>切換身份</button>
          {saving && <span className="saving">儲存中...</span>}
        </div>
      </header>

      {/* 篩選列 */}
      <div className="filter-bar">
        <button
          className={`filter-btn ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          全部
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`filter-btn ${filter === key ? 'active' : ''}`}
            style={{ '--cat-color': cat.color }}
            onClick={() => setFilter(key)}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* 新增按鈕 */}
      <div className="action-bar">
        <button className="btn-primary" onClick={() => { setEditingEvent(null); setShowForm(true) }}>
          + 新增事件
        </button>
      </div>

      {/* 事件表單 */}
      {showForm && (
        <EventForm
          event={editingEvent}
          onSave={handleSaveEvent}
          onCancel={() => { setShowForm(false); setEditingEvent(null) }}
        />
      )}

      {/* 時間軸 */}
      {loading ? (
        <div className="loading">載入中...</div>
      ) : (
        <div className="timeline">
          {filteredEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              expanded={expandedId === event.id}
              onToggle={() => setExpandedId(expandedId === event.id ? null : event.id)}
              onEdit={() => { setEditingEvent(event); setShowForm(true) }}
              onDelete={() => handleDelete(event.id)}
              onAddLink={handleAddLink}
              onAddNote={handleAddNote}
              currentUser={currentUser}
            />
          ))}
        </div>
      )}

      <footer className="footer">
        <p>共 {events.length} 筆事件 · 由 6 位 VIP 共同維護</p>
      </footer>
    </div>
  )
}

// ========== 事件卡片 ==========
function EventCard({ event, expanded, onToggle, onEdit, onDelete, onAddLink, onAddNote, currentUser }) {
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [noteText, setNoteText] = useState('')

  const handleSubmitLink = (e) => {
    e.preventDefault()
    if (!linkUrl.trim()) return
    onAddLink(event.id, linkUrl.trim(), linkLabel.trim() || linkUrl.trim())
    setLinkUrl('')
    setLinkLabel('')
  }

  const handleSubmitNote = (e) => {
    e.preventDefault()
    if (!noteText.trim()) return
    onAddNote(event.id, noteText.trim())
    setNoteText('')
  }

  return (
    <div
      className="event-card"
      style={{ '--cat-color': catColor(event.category), '--cat-bg': catBg(event.category) }}
    >
      <div className="event-header" onClick={onToggle}>
        <span className="event-date">{formatDate(event.year, event.month, event.day)}</span>
        <span className="event-category">{catLabel(event.category)}</span>
      </div>
      <h3 className="event-title" onClick={onToggle}>{event.title}</h3>
      {event.desc && <p className="event-desc">{event.desc}</p>}

      {expanded && (
        <div className="event-details">
          {/* 連結列表 */}
          <div className="links-section">
            <h4>連結</h4>
            {(event.links || []).length === 0 && <p className="empty">尚無連結</p>}
            <ul>
              {(event.links || []).map((link, i) => (
                <li key={i}>
                  <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                  <span className="by" style={badgeStyle(link.author)}>
                    {authorEmoji(link.author)} {authorName(link.author)}
                  </span>
                </li>
              ))}
            </ul>
            <form className="add-form" onSubmit={handleSubmitLink}>
              <input
                type="url"
                placeholder="https://..."
                value={linkUrl}
                onChange={e => setLinkUrl(e.target.value)}
              />
              <input
                type="text"
                placeholder="標題（選填）"
                value={linkLabel}
                onChange={e => setLinkLabel(e.target.value)}
              />
              <button type="submit">新增連結</button>
            </form>
          </div>

          {/* 筆記列表 */}
          <div className="notes-section">
            <h4>筆記</h4>
            {(event.notes || []).length === 0 && <p className="empty">尚無筆記</p>}
            <ul>
              {(event.notes || []).map((note, i) => (
                <li key={i}>
                  <p>{note.text}</p>
                  <span className="by" style={badgeStyle(note.author)}>
                    {authorEmoji(note.author)} {authorName(note.author)}
                  </span>
                </li>
              ))}
            </ul>
            <form className="add-form" onSubmit={handleSubmitNote}>
              <input
                type="text"
                placeholder="寫點什麼..."
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
              />
              <button type="submit">新增筆記</button>
            </form>
          </div>

          {/* 操作按鈕 */}
          <div className="event-actions">
            <button className="btn-edit" onClick={onEdit}>編輯</button>
            <button className="btn-delete" onClick={onDelete}>刪除</button>
          </div>
        </div>
      )}
    </div>
  )
}

// ========== 事件表單 ==========
function EventForm({ event, onSave, onCancel }) {
  const [year, setYear] = useState(event?.year || 2006)
  const [month, setMonth] = useState(event?.month || '')
  const [day, setDay] = useState(event?.day || '')
  const [category, setCategory] = useState(event?.category || 'milestone')
  const [title, setTitle] = useState(event?.title || '')
  const [desc, setDesc] = useState(event?.desc || '')

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!title.trim()) return alert('請輸入標題')
    onSave({
      year: parseInt(year),
      month: month ? parseInt(month) : null,
      day: day ? parseInt(day) : null,
      category,
      title: title.trim(),
      desc: desc.trim(),
      links: event?.links || [],
      notes: event?.notes || []
    })
  }

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h2>{event ? '編輯事件' : '新增事件'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <label>
              年份 *
              <input type="number" min="1990" max="2030" value={year} onChange={e => setYear(e.target.value)} required />
            </label>
            <label>
              月份
              <select value={month} onChange={e => setMonth(e.target.value)}>
                <option value="">不指定</option>
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{m} 月</option>
                ))}
              </select>
            </label>
            <label>
              日期
              <input type="number" min="1" max="31" value={day} onChange={e => setDay(e.target.value)} />
            </label>
          </div>
          <div className="form-row">
            <label>
              分類 *
              <select value={category} onChange={e => setCategory(e.target.value)} required>
                {Object.entries(CATEGORIES).map(([key, cat]) => (
                  <option key={key} value={key}>{cat.label}</option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-row">
            <label>
              標題 *
              <input type="text" value={title} onChange={e => setTitle(e.target.value)} required />
            </label>
          </div>
          <div className="form-row">
            <label>
              描述
              <textarea value={desc} onChange={e => setDesc(e.target.value)} rows={3} />
            </label>
          </div>
          <div className="form-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>取消</button>
            <button type="submit" className="btn-primary">儲存</button>
          </div>
        </form>
      </div>
    </div>
  )
}
