import { useState, useEffect, useMemo, lazy, Suspense } from 'react'
import { RefreshCw, Plus, X, ChevronUp, Check, AlertCircle, Sun, Moon, Menu } from 'lucide-react'
import ImageCarousel from './components/ImageCarousel'
import EventCard from './components/EventCard'
import EventModal from './components/EventModal'
import TimelineFilters from './components/TimelineFilters'
import { AUTHORS, FAN_SINCE, authorName, authorEmoji, authorColor } from './data/authors'
import { DEFAULT_EVENTS } from './data/defaultEvents'
import { isImageUrl } from './utils/media'
import { uploadToCloudinary } from './utils/upload'
import { eventsApi, logVisitor } from './utils/api'
const SocialArchive = lazy(() => import('./components/SocialArchive'))
const MembershipArchive = lazy(() => import('./components/MembershipArchive'))

// 載入事件（fallback 到預設資料）
async function loadEvents() {
  try {
    const data = await eventsApi.load()
    if (Array.isArray(data) && data.length > 0) return data
    return DEFAULT_EVENTS
  } catch (e) {
    console.warn('載入失敗，使用預設資料', e)
    return DEFAULT_EVENTS
  }
}

// ========== 主元件 ==========
export default function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [me, setMe] = useState(null) // 作者身份
  const isAdmin = localStorage.getItem('isAdmin') === 'true'
  const [filter, setFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState([]) // 成員篩選（多選）
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  const [expandedId, setExpandedId] = useState(null) // 展開留言的卡片 ID
  const [showScrollTop, setShowScrollTop] = useState(false) // 回到頂部按鈕
  const [selectedYear, setSelectedYear] = useState(null) // 選中的年份
  const [yearSortDesc, setYearSortDesc] = useState(true) // 年份排序：true = 新到舊（降序）
  const [inlineNote, setInlineNote] = useState('') // 內嵌留言輸入
  const [imageSlider, setImageSlider] = useState({ open: false, images: [], index: 0 }) // 圖片輪播
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('lightMode') === 'true') // 淺色模式
  const [currentPage, setCurrentPage] = useState('timeline') // 頁面切換：'timeline' | 'social' | 'membership'
  const [menuOpen, setMenuOpen] = useState(false) // hamburger menu 開關
  const [migrating, setMigrating] = useState(false)
  const [migrateProgress, setMigrateProgress] = useState({ current: 0, total: 0, failed: 0 })

  // Toast helper - type: 'success' | 'error' | 'info'
  const flash = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // 載入資料
  useEffect(() => {
    loadEvents().then(data => {
      setEvents(data)
      setLoading(false)
    })
  }, [])

  // 淺色模式切換
  useEffect(() => {
    document.body.classList.toggle('light-mode', lightMode)
    localStorage.setItem('lightMode', lightMode)
  }, [lightMode])

  // 監聽滾動顯示回到頂部按鈕
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 400)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Modal 打開時鎖定背景滾動
  useEffect(() => {
    if (modal) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [modal])

  // 儲存單筆事件（新增或更新）
  const persistEvent = async (event, isNew = false) => {
    setSaving(true)
    try {
      if (isNew) {
        await eventsApi.create(event)
      } else {
        await eventsApi.update(event)
      }
      // 更新本地狀態
      if (isNew) {
        setEvents(prev => [...prev, event])
      } else {
        setEvents(prev => prev.map(e => e.id === event.id ? event : e))
      }
      flash('已儲存（所有人可見）', 'success')
    } catch {
      flash('儲存失敗，請稍後重試', 'error')
    }
    setSaving(false)
  }

  // 刪除單筆事件
  const persistDelete = async (id) => {
    setSaving(true)
    try {
      await eventsApi.delete(id)
      setEvents(prev => prev.filter(e => e.id !== id))
      flash('已刪除', 'success')
    } catch {
      flash('刪除失敗，請稍後重試', 'error')
    }
    setSaving(false)
  }

  const refresh = async () => {
    setSyncing(true)
    try {
      const data = await loadEvents()
      if (Array.isArray(data)) {
        setEvents(data)
        flash('已同步最新', 'success')
      }
    } catch {
      flash('載入失敗', 'error')
    }
    setSyncing(false)
  }

  // 批次遷移：把舊圖片（只有 ImgBB URL）補傳到 Cloudinary
  const migrateImages = async () => {
    if (migrating) return
    setMigrating(true)

    // 找出所有需要遷移的 events
    const tasks = events.filter(ev =>
      ev.media?.some(m => isImageUrl(m.url) && !m.backupUrl)
    )
    setMigrateProgress({ current: 0, total: tasks.length, failed: 0 })

    let failCount = 0
    for (let i = 0; i < tasks.length; i++) {
      const ev = tasks[i]
      let updated = false
      const newMedia = await Promise.all(ev.media.map(async m => {
        if (isImageUrl(m.url) && !m.backupUrl) {
          const cloudinaryUrl = await uploadToCloudinary(m.url)
          if (cloudinaryUrl) {
            updated = true
            return { ...m, backupUrl: cloudinaryUrl }
          }
          failCount++
        }
        return m
      }))

      if (updated) {
        try {
          await eventsApi.update({ ...ev, media: newMedia })
          setEvents(prev => prev.map(e => e.id === ev.id ? { ...e, media: newMedia } : e))
        } catch (err) {
          console.warn(`遷移 event ${ev.id} 更新失敗:`, err)
          failCount++
        }
      }
      setMigrateProgress({ current: i + 1, total: tasks.length, failed: failCount })
    }

    setMigrating(false)
    if (failCount === 0) {
      flash(`遷移完成！共 ${tasks.length} 筆事件`, 'success')
    } else {
      flash(`遷移完成，${failCount} 個失敗`, 'error')
    }
  }

  // 篩選與排序
  const filtered = useMemo(() => {
    let result = events

    // 分類篩選
    if (filter !== 'all') {
      result = result.filter(e => {
        if (e.cats && e.cats.includes(filter)) return true
        if (e.cat === filter) return true
        return false
      })
    }

    // 成員篩選（多選，符合任一即顯示）
    if (memberFilter.length > 0) {
      result = result.filter(e => memberFilter.some(m => e.members?.includes(m)))
    }

    return result
  }, [events, filter, memberFilter])

  const byYear = useMemo(() => {
    const m = {}
    filtered.forEach(e => {
      (m[e.year] ??= []).push(e)
    })
    return m
  }, [filtered])

  const years = useMemo(() => {
    const sorted = Object.keys(byYear).sort((a, b) => a - b)
    return yearSortDesc ? sorted.reverse() : sorted
  }, [byYear, yearSortDesc])

  const supplementedCount = useMemo(() =>
    events.filter(e => (e.links?.length || 0) + (e.notes?.length || 0) + (e.media?.length || 0) > 0).length
  , [events])

  const yearSpan = useMemo(() => {
    if (!events.length) return 0
    const yrs = events.map(e => e.year)
    return Math.max(...yrs) - Math.min(...yrs) + 1
  }, [events])

  const viewEvent = useMemo(() =>
    modal?.eventId ? events.find(e => e.id === modal.eventId) : null
  , [modal, events])


  const sortedEvents = (arr) => [...arr].sort((a, b) => {
    const monthDiff = (a.month || 0) - (b.month || 0)
    if (monthDiff !== 0) return monthDiff
    return (a.day || 0) - (b.day || 0)
  })


  // Modal helpers
  const openView = (ev) => {
    setModal({ mode: 'view', eventId: ev.id })
  }

  const openNew = () => {
    setModal({ mode: 'new' })
  }

  const openEdit = (ev) => {
    setModal({ mode: 'edit', eventId: ev.id })
  }

  const closeModal = () => {
    setModal(null)
  }

  // 內嵌留言儲存（直接在時間軸上）
  const saveInlineNote = (eventId) => {
    if (!inlineNote.trim()) return
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    const newNote = { text: inlineNote.trim(), author: me, ts: Date.now() }
    // editLog 只保留「新增」和「最後編輯」
    const createLog = (ev.editLog || []).find(log => log.action === '新增')
    const newEditLog = createLog
      ? [createLog, { author: me, action: '留言', ts: Date.now() }]
      : [{ author: me, action: '留言', ts: Date.now() }]
    const updated = {
      ...ev,
      notes: [...(ev.notes || []), newNote],
      editLog: newEditLog
    }
    persistEvent(updated, false)
    setInlineNote('')
    flash('留言已送出', 'success')
  }

  // 展開/收起留言
  const toggleExpand = (ev, e) => {
    e.stopPropagation()
    if (expandedId === ev.id) {
      setExpandedId(null)
      setInlineNote('')
    } else {
      setExpandedId(ev.id)
      setInlineNote('')
    }
  }

  // 刪除內嵌留言
  const deleteInlineNote = (eventId, noteIndex) => {
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    const newNotes = ev.notes.filter((_, i) => i !== noteIndex)
    // editLog 只保留「新增」和「最後編輯」
    const createLog = (ev.editLog || []).find(log => log.action === '新增')
    const newEditLog = createLog
      ? [createLog, { author: me, action: '刪除留言', ts: Date.now() }]
      : [{ author: me, action: '刪除留言', ts: Date.now() }]
    const updated = {
      ...ev,
      notes: newNotes,
      editLog: newEditLog
    }
    persistEvent(updated, false)
    flash('已刪除留言', 'success')
  }

  // ========== 選擇身份 ==========
  if (!me) {
    return (
      <div className="author-screen">
        <div className="text-center p-10 max-w-[460px]">
          <div className="text-[2.5rem] mb-2">👑</div>
          <h1 className="brand">BIGBANG</h1>
          <p className="text-text-secondary text-sm mt-2 italic">共筆年表 — 請選擇你的身份</p>
          <div className="author-grid">
            {AUTHORS.map(a => (
              <button
                key={a.id}
                className="author-btn"
                style={{ borderColor: a.color + '33' }}
                onClick={() => { setMe(a.id); logVisitor(a.id) }}
              >
                <span className="text-[1.8rem]">{a.emoji}</span>
                <span className="text-[15px] font-semibold" style={{ color: a.color }}>{a.name}</span>
              </button>
            ))}
          </div>
          <p className="text-text-dim text-[11px] mt-6">選擇後即可開始編輯，你的操作都會記錄署名</p>
        </div>
      </div>
    )
  }

  // ========== Loading ==========
  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand text-[3rem] tracking-[0.3em]">BIGBANG</div>
        <div className="text-text-secondary mt-3 text-sm">載入中...</div>
      </div>
    )
  }

  // ========== 社群備份頁面 ==========
  if (currentPage === 'social') {
    return <Suspense fallback={<div className="lazy-loading">載入中...</div>}><SocialArchive isAdmin={isAdmin} onBack={() => setCurrentPage('timeline')} currentPage={currentPage} setCurrentPage={setCurrentPage} /></Suspense>
  }

  // ========== 會員備份頁面 ==========
  if (currentPage === 'membership') {
    return <Suspense fallback={<div className="lazy-loading">載入中...</div>}><MembershipArchive isAdmin={isAdmin} onBack={() => setCurrentPage('timeline')} currentPage={currentPage} setCurrentPage={setCurrentPage} /></Suspense>
  }

  // ========== 主介面 ==========
  return (
    <div>
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && <Check size={14} />}
          {toast.type === 'error' && <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* 頂部工具列：logo + 同步（左）、新增（右） */}
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="top-bar-logo">BIGBANG</span>
          <button onClick={refresh} className={`sync-btn ${syncing ? 'syncing' : ''}`} title="同步" disabled={syncing}><RefreshCw size={14} /></button>
          {isAdmin && (
            <button
              onClick={migrateImages}
              disabled={migrating}
              className="sync-btn migrate-btn text-[10px] px-2 py-1 whitespace-nowrap"
              title="遷移舊圖片到 Cloudinary"
            >
              {migrating
                ? `遷移中 ${migrateProgress.current}/${migrateProgress.total}`
                : '遷移圖片'}
            </button>
          )}
        </div>
        <div className="top-bar-right">
          <button onClick={() => setLightMode(!lightMode)} className="theme-btn" title={lightMode ? '切換深色模式' : '切換淺色模式'}>
            {lightMode ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={openNew} className="add-btn"><Plus size={20} /></button>
          <div className="nav-menu-wrapper">
            <button onClick={() => setMenuOpen(!menuOpen)} className="hamburger-btn" title="選單">
              <Menu size={18} />
            </button>
            {menuOpen && (
              <>
                <div className="nav-menu-overlay" onClick={() => setMenuOpen(false)} />
                <div className="nav-menu">
                  <button className={`nav-menu-item ${currentPage === 'timeline' ? 'active' : ''}`} onClick={() => { setCurrentPage('timeline'); setMenuOpen(false) }}>
                    <span>📅</span> 時間軸
                  </button>
                  <button className={`nav-menu-item ${currentPage === 'social' ? 'active' : ''}`} onClick={() => { setCurrentPage('social'); setMenuOpen(false) }}>
                    <span>📷</span> 社群備份
                  </button>
                  <button className={`nav-menu-item ${currentPage === 'membership' ? 'active' : ''}`} onClick={() => { setCurrentPage('membership'); setMenuOpen(false) }}>
                    <span>🔒</span> 會員備份
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Header */}
      <div className="hero">
        <div className="text-[2rem]">👑</div>
        <h1 className="brand">BIGBANG</h1>
        <p className="text-text-secondary text-[13px] mt-1.5 italic">影視作品共筆年表</p>
        <div className="flex justify-center gap-6 mt-5 flex-wrap">
          <div className="text-center"><div className="stat-num">{events.length}</div><div className="stat-label">事件</div></div>
          <div className="text-center"><div className="stat-num">{supplementedCount}</div><div className="stat-label">已補充</div></div>
          <div className="text-center"><div className="stat-num">{yearSpan}</div><div className="stat-label">年</div></div>
        </div>
      </div>

      {/* Filters */}
      <TimelineFilters
        filter={filter} setFilter={setFilter}
        events={events}
        years={years}
        selectedYear={selectedYear} setSelectedYear={setSelectedYear}
        yearSortDesc={yearSortDesc} setYearSortDesc={setYearSortDesc}
        memberFilter={memberFilter} setMemberFilter={setMemberFilter}
      />

      {/* Timeline */}
      <div className="timeline">
        {years.map(year => (
          <div key={year} id={`year-${year}`} className="mb-11">
            <div className="year-header">
              <span className="year-num">{year}</span>
              <span className="text-[10px] text-text-dim">{byYear[year].length} 項</span>
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
              <EventCard key={ev.id} event={ev} onView={openView} onEdit={openEdit} />
            ))}
          </div>
        ))}
        {filtered.length === 0 && <div className="empty-state">此分類暫無資料</div>}
      </div>

      {/* Footer */}
      <div className="footer">
        <div className="font-display text-base tracking-[0.3em] text-gold-accent/25">BIGBANG · V.I.P</div>
        <p className="text-[10px] text-[#444] mt-1.5">共筆年表 · Since 2006</p>
      </div>

      {/* Modal */}
      {modal && (
        <EventModal
          mode={modal.mode}
          event={viewEvent}
          me={me}
          saving={saving}
          onSave={(parsed, isNew) => { persistEvent(parsed, isNew); closeModal() }}
          onDelete={(id) => { persistDelete(id); closeModal() }}
          onClose={closeModal}
          onEdit={openEdit}
          onOpenCarousel={(images, index) => setImageSlider({ open: true, images, index })}
          flash={flash}
        />
      )}

      {/* 底部留言輸入條 - 暫時隱藏
      {expandedId && (
        <div className="comment-bar">
          <div className="comment-bar-inner">
            <input
              value={inlineNote}
              onChange={e => setInlineNote(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && saveInlineNote(expandedId)}
              placeholder="寫點什麼..."
              autoFocus
            />
            <button onClick={() => saveInlineNote(expandedId)}>送出</button>
            <button onClick={() => { setExpandedId(null); setInlineNote('') }} className="comment-bar-close"><X size={14} /></button>
          </div>
        </div>
      )}
      */}

      {/* 懸浮按鈕：回到頂部 */}
      {showScrollTop && (
        <button
          className="floating-btn scroll-top"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ChevronUp size={20} />
        </button>
      )}

      {/* 圖片輪播 Modal */}
      {imageSlider.open && (
        <ImageCarousel
          images={imageSlider.images}
          initialIndex={imageSlider.index}
          onClose={() => setImageSlider({ open: false, images: [], index: 0 })}
        />
      )}
    </div>
  )
}
