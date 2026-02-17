import { useState, useEffect, useMemo, useRef } from 'react'
import { RefreshCw, Plus, X, Pencil, Image, Link, Camera, ChevronUp, Trash2, ExternalLink, Clock, Calendar, Save, History, Paperclip, Check, AlertCircle, Play, Film, ChevronLeft, ChevronRight, ArrowUpDown, Sun, Moon, Instagram } from 'lucide-react'
import config from './config'
import { AUTHORS, FAN_SINCE, findAuthor, authorName, authorEmoji, authorColor, badgeStyle } from './data/authors'
import { CATEGORIES, catColor, catBg, catLabel, monthLabel, dateLabel } from './data/categories'
import { DEFAULT_EVENTS } from './data/defaultEvents'
import SocialArchive from './components/SocialArchive'

const JSONBIN_URL = `https://api.jsonbin.io/v3/b/${config.BIN_ID}`

// BIGBANG 成員列表與顏色
const MEMBERS = [
  { name: '全員', color: '#D4AF37' },
  { name: 'G-Dragon', color: '#ed609f' },
  { name: 'T.O.P', color: '#8fc126' },
  { name: '太陽', color: '#d7171e' },
  { name: '大聲', color: '#f4e727' },
  { name: '勝利', color: '#1e92c6' },
]

function getMemberColor(name) {
  return MEMBERS.find(m => m.name === name)?.color || '#D4AF37'
}

// ========== 工具函式 ==========
function genId() {
  return 'e-' + Date.now()
}

function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// ========== 媒體工具函式 ==========
// 上傳圖片到 ImgBB
async function uploadToImgBB(file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${config.IMGBB_API_KEY}`, {
    method: 'POST',
    body: formData
  })
  const data = await res.json()
  if (data.success) {
    return data.data.url
  }
  throw new Error('上傳失敗')
}

// 上傳圖片到 Cloudinary 作為備份
async function uploadToCloudinary(file) {
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_UPLOAD_PRESET) {
    console.warn('Cloudinary 未設定，跳過備份')
    return null
  }

  try {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('upload_preset', config.CLOUDINARY_UPLOAD_PRESET)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${config.CLOUDINARY_CLOUD_NAME}/image/upload`,
      { method: 'POST', body: formData }
    )
    const data = await res.json()

    if (data.secure_url) {
      console.log('✅ Cloudinary 備份成功:', data.secure_url)
      return data.secure_url
    }
    throw new Error(data.error?.message || '上傳失敗')
  } catch (err) {
    console.warn('Cloudinary 備份失敗:', err.message)
    return null
  }
}

// 同時上傳到 ImgBB + Cloudinary（雙重備份）
async function uploadWithBackup(file) {
  const [imgbbUrl, cloudinaryUrl] = await Promise.all([
    uploadToImgBB(file),
    uploadToCloudinary(file)
  ])
  return { url: imgbbUrl, backupUrl: cloudinaryUrl }
}

// 解析影片連結，回傳嵌入資訊
function parseVideoUrl(url) {
  if (!url) return null

  // YouTube
  const ytMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/)
  if (ytMatch) {
    return { type: 'youtube', id: ytMatch[1] }
  }

  // Instagram Reels / Post
  const igMatch = url.match(/instagram\.com\/(?:reel|reels|p)\/([a-zA-Z0-9_-]+)/)
  if (igMatch) {
    return { type: 'instagram', id: igMatch[1], url }
  }

  // X (Twitter)
  const xMatch = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/)
  if (xMatch) {
    return { type: 'twitter', id: xMatch[1], url }
  }

  return null
}

// 判斷是否為圖片連結
function isImageUrl(url) {
  if (!url) return false
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url) ||
         url.includes('i.ibb.co') ||
         url.includes('imgur.com')
}

// 取得影片縮圖
function getVideoThumbnail(url) {
  const video = parseVideoUrl(url)
  if (!video) return null

  if (video.type === 'youtube') {
    return `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`
  }

  // IG 和 Twitter 無法直接取得縮圖
  return null
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

// ========== 媒體顯示元件 ==========
function MediaPreview({ url }) {
  const video = parseVideoUrl(url)

  // YouTube 嵌入
  if (video?.type === 'youtube') {
    return (
      <div className="media-embed">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video"
        />
      </div>
    )
  }

  // Instagram 嵌入
  if (video?.type === 'instagram') {
    return (
      <div className="media-embed media-embed-ig">
        <iframe
          src={`https://www.instagram.com/p/${video.id}/embed/captioned`}
          frameBorder="0"
          scrolling="no"
          allowTransparency="true"
          allowFullScreen
          title="Instagram post"
        />
      </div>
    )
  }

  // X/Twitter 連結
  if (video?.type === 'twitter') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="media-link-card">
        <span className="media-icon">𝕏</span>
        <span>X (Twitter) 貼文</span>
        <span className="media-arrow">→</span>
      </a>
    )
  }

  // 圖片
  if (isImageUrl(url)) {
    return (
      <div className="media-image">
        <img src={url} alt="uploaded" loading="lazy" />
      </div>
    )
  }

  return null
}

// ========== 主元件 ==========
export default function App() {
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [me, setMe] = useState(null)
  const [filter, setFilter] = useState('all')
  const [memberFilter, setMemberFilter] = useState([]) // 成員篩選（多選）
  const [modal, setModal] = useState(null)
  const [toast, setToast] = useState(null)

  // Form state
  const [form, setForm] = useState({
    id: '', year: 2025, month: 1, day: 1, cats: ['music'], title: '', desc: '',
    members: [], links: [], notes: [], media: [], editLog: []
  })
  const [expandedId, setExpandedId] = useState(null) // 展開留言的卡片 ID
  const [showScrollTop, setShowScrollTop] = useState(false) // 回到頂部按鈕
  const [yearNavOpen, setYearNavOpen] = useState(false) // 年份導航收合
  const [selectedYear, setSelectedYear] = useState(null) // 選中的年份
  const [yearSortDesc, setYearSortDesc] = useState(true) // 年份排序：true = 新到舊（降序）
  const [memberNavOpen, setMemberNavOpen] = useState(false) // 成員篩選收合
  const [inlineNote, setInlineNote] = useState('') // 內嵌留言輸入
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const [imageSlider, setImageSlider] = useState({ open: false, images: [], index: 0 }) // 圖片輪播
  const [touchStart, setTouchStart] = useState(null) // 觸控起始位置
  const [lightMode, setLightMode] = useState(() => localStorage.getItem('lightMode') === 'true') // 淺色模式
  const [currentPage, setCurrentPage] = useState('timeline') // 頁面切換：'timeline' | 'social'

  const fileInputRef = useRef(null)

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

  // 儲存資料
  const persist = async (newEvents) => {
    setSaving(true)
    try {
      await saveEvents(newEvents)
      setEvents(newEvents)
      flash('已儲存（所有人可見）', 'success')
    } catch {
      flash('儲存失敗，請稍後重試', 'error')
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

  const isEditing = modal?.mode === 'edit' || modal?.mode === 'new'

  const sortedEvents = (arr) => [...arr].sort((a, b) => {
    const monthDiff = (a.month || 0) - (b.month || 0)
    if (monthDiff !== 0) return monthDiff
    return (a.day || 0) - (b.day || 0)
  })

  const hasExtra = (ev) => (ev.links?.length || 0) + (ev.notes?.length || 0) + (ev.media?.length || 0) > 0
  const lastEditor = (ev) => ev.editLog?.length ? ev.editLog[ev.editLog.length - 1].author : null

  // Modal helpers
  const setFormFromEvent = (ev) => {
    // 相容舊資料：cat 字串轉成 cats 陣列
    const cats = ev.cats ? [...ev.cats] : (ev.cat ? [ev.cat] : ['music'])
    setForm({
      id: ev.id,
      year: ev.year,
      month: ev.month,
      day: ev.day || 1,
      cats: cats,
      title: ev.title,
      desc: ev.desc,
      members: [...(ev.members || [])],
      links: JSON.parse(JSON.stringify(ev.links || [])),
      notes: JSON.parse(JSON.stringify(ev.notes || [])),
      media: JSON.parse(JSON.stringify(ev.media || [])),
      editLog: JSON.parse(JSON.stringify(ev.editLog || []))
    })
  }

  const openView = (ev) => {
    setFormFromEvent(ev)
    setLinkUrl(''); setLinkLabel(''); setNoteInput(''); setMediaUrl('')
    setShowLog(false); setConfirmDel(false)
    setModal({ mode: 'view', eventId: ev.id })
  }

  const openNew = () => {
    const newId = genId()
    const today = new Date()
    setForm({
      id: newId, year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate(), cats: ['music'],
      title: '', desc: '', members: ['全員'],
      links: [], notes: [], media: [], editLog: []
    })
    setLinkUrl(''); setLinkLabel(''); setNoteInput(''); setMediaUrl('')
    setModal({ mode: 'new' })
  }

  const openEdit = (ev) => {
    setFormFromEvent(ev)
    setLinkUrl(''); setLinkLabel(''); setNoteInput(''); setMediaUrl('')
    setShowLog(false); setConfirmDel(false)
    setModal({ mode: 'edit', eventId: ev.id })
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
      day: parseInt(form.day) || 1,
      cats: form.cats,
      cat: form.cats[0] || 'music', // 保留 cat 欄位相容舊資料
      title: form.title,
      desc: form.desc,
      members: form.members,
      links: form.links,
      notes: form.notes,
      media: form.media,
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
    saveSupplements({ links: newLinks })
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
    saveSupplements({ notes: newNotes })
  }

  // Media
  const addMediaUrl = () => {
    if (!mediaUrl.trim()) return
    let u = mediaUrl.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    setForm(f => ({
      ...f,
      media: [...f.media, { url: u, author: me, ts: Date.now() }]
    }))
    setMediaUrl('')
  }

  const removeMedia = (i) => {
    setForm(f => ({ ...f, media: f.media.filter((_, idx) => idx !== i) }))
  }

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // 過濾有效檔案
    const validFiles = files.filter(file => {
      if (file.size > 32 * 1024 * 1024) {
        flash(`${file.name} 太大，最大 32MB`, 'error')
        return false
      }
      if (!file.type.startsWith('image/')) {
        flash(`${file.name} 不是圖片檔案`, 'error')
        return false
      }
      return true
    })

    if (validFiles.length === 0) return

    setUploading(true)
    let successCount = 0

    for (const file of validFiles) {
      try {
        const { url, backupUrl } = await uploadWithBackup(file)
        setForm(f => ({
          ...f,
          media: [...f.media, { url, backupUrl, author: me, ts: Date.now() }]
        }))
        successCount++
      } catch {
        flash(`${file.name} 上傳失敗`, 'error')
      }
    }

    if (successCount > 0) {
      flash(`已上傳 ${successCount} 張圖片`, 'success')
    }
    setUploading(false)
    // 清空 input
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // 處理貼上圖片
  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return

    const imageFiles = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }

    if (imageFiles.length === 0) return

    e.preventDefault()
    setUploading(true)
    let successCount = 0

    for (const file of imageFiles) {
      if (file.size > 32 * 1024 * 1024) {
        flash('圖片太大，最大 32MB', 'error')
        continue
      }
      try {
        const { url, backupUrl } = await uploadWithBackup(file)
        setForm(f => ({
          ...f,
          media: [...f.media, { url, backupUrl, author: me, ts: Date.now() }]
        }))
        successCount++
      } catch {
        flash('圖片上傳失敗', 'error')
      }
    }

    if (successCount > 0) {
      flash(`已貼上 ${successCount} 張圖片`, 'success')
    }
    setUploading(false)
  }

  const addMediaAndSave = () => {
    if (!mediaUrl.trim()) return
    let u = mediaUrl.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    const newMedia = [...form.media, { url: u, author: me, ts: Date.now() }]
    setMediaUrl('')
    saveSupplements({ media: newMedia })
  }

  const saveSupplements = (updates) => {
    const ev = events.find(e => e.id === modal?.eventId)
    if (!ev) return
    const updated = {
      ...ev,
      links: updates.links || form.links,
      notes: updates.notes || form.notes,
      media: updates.media || form.media,
      editLog: [...(ev.editLog || []), { author: me, action: '補充', ts: Date.now() }]
    }
    persist(events.map(e => e.id === updated.id ? updated : e))
    setForm(f => ({
      ...f,
      links: updates.links || f.links,
      notes: updates.notes || f.notes,
      media: updates.media || f.media
    }))
  }

  // 內嵌留言儲存（直接在時間軸上）
  const saveInlineNote = (eventId) => {
    if (!inlineNote.trim()) return
    const ev = events.find(e => e.id === eventId)
    if (!ev) return
    const newNote = { text: inlineNote.trim(), author: me, ts: Date.now() }
    const updated = {
      ...ev,
      notes: [...(ev.notes || []), newNote],
      editLog: [...(ev.editLog || []), { author: me, action: '留言', ts: Date.now() }]
    }
    persist(events.map(e => e.id === updated.id ? updated : e))
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
    const updated = {
      ...ev,
      notes: newNotes,
      editLog: [...(ev.editLog || []), { author: me, action: '刪除留言', ts: Date.now() }]
    }
    persist(events.map(e => e.id === updated.id ? updated : e))
    flash('已刪除留言', 'success')
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

  // ========== 社群備份頁面 ==========
  if (currentPage === 'social') {
    return <SocialArchive me={me} onBack={() => setCurrentPage('timeline')} />
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
        </div>
        <div className="top-bar-right">
          {/* 社群備份按鈕（暫時隱藏）
          <button onClick={() => setCurrentPage('social')} className="social-btn" title="社群備份">
            <Instagram size={16} />
          </button>
          */}
          <button onClick={() => setLightMode(!lightMode)} className="theme-btn" title={lightMode ? '切換深色模式' : '切換淺色模式'}>
            {lightMode ? <Moon size={16} /> : <Sun size={16} />}
          </button>
          <button onClick={openNew} className="add-btn"><Plus size={20} /></button>
        </div>
      </div>

      {/* Header */}
      <div className="hero">
        <div style={{ fontSize: '2rem' }}>👑</div>
        <h1 className="brand">BIGBANG</h1>
        <p style={{ color: '#888', fontSize: 13, marginTop: 6, fontStyle: 'italic' }}>影視作品共筆年表</p>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 24, marginTop: 20, flexWrap: 'wrap' }}>
          <div style={{ textAlign: 'center' }}><div className="stat-num">{events.length}</div><div className="stat-label">事件</div></div>
          <div style={{ textAlign: 'center' }}><div className="stat-num">{supplementedCount}</div><div className="stat-label">已補充</div></div>
          <div style={{ textAlign: 'center' }}><div className="stat-num">{yearSpan}</div><div className="stat-label">年</div></div>
        </div>
      </div>

      {/* Filters */}
      <div className="filters">
        {/* 第一排：分類篩選 */}
        <div className="filter-row">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
            全部 <span style={{ opacity: 0.6, fontSize: 10 }}>{events.length}</span>
          </button>
          {Object.entries(CATEGORIES).map(([key, cat]) => (
            <button
              key={key}
              className={`filter-btn ${filter === key ? 'active' : ''}`}
              onClick={() => setFilter(key)}
            >
              {cat.label} <span style={{ opacity: 0.6, fontSize: 10 }}>{events.filter(e => (e.cats && e.cats.includes(key)) || e.cat === key).length}</span>
            </button>
          ))}
        </div>

        {/* 第二排：年份 + 成員 */}
        <div className="filter-row">
          {/* 年份篩選 */}
          <div className="filter-dropdown">
            <button
              className="filter-btn dropdown-toggle"
              onClick={() => { setYearNavOpen(!yearNavOpen); setMemberNavOpen(false) }}
            >
              年份 <span className="dropdown-arrow">{yearNavOpen ? '▲' : '▼'}</span>
            </button>
            {yearNavOpen && (
              <div className="filter-dropdown-list">
                {years.map(year => (
                  <button
                    key={year}
                    className={`filter-dropdown-item ${selectedYear === year ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedYear(year)
                      const el = document.getElementById(`year-${year}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      setYearNavOpen(false)
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* 年份排序切換 */}
          <button
            className="year-sort-btn"
            onClick={() => setYearSortDesc(!yearSortDesc)}
            title={yearSortDesc ? '目前：新 → 舊' : '目前：舊 → 新'}
          >
            <ArrowUpDown size={12} />
          </button>

          {/* 成員篩選（多選） */}
          <div className="filter-dropdown">
            <button
              className={`filter-btn dropdown-toggle member-toggle ${memberFilter.length > 0 ? 'active' : ''}`}
              onClick={() => { setMemberNavOpen(!memberNavOpen); setYearNavOpen(false) }}
            >
              {memberFilter.length === 0 ? '成員' : `成員(${memberFilter.length})`} <span className="dropdown-arrow">{memberNavOpen ? '▲' : '▼'}</span>
            </button>
            {memberNavOpen && (
              <div className="filter-dropdown-list">
                <button
                  className={`filter-dropdown-item ${memberFilter.length === 0 ? 'active' : ''}`}
                  onClick={() => setMemberFilter([])}
                >
                  全部
                </button>
                {MEMBERS.filter(m => m.name !== '全員').map(m => (
                  <button
                    key={m.name}
                    className={`filter-dropdown-item ${memberFilter.includes(m.name) ? 'active' : ''}`}
                    style={{
                      color: memberFilter.includes(m.name) ? m.color : undefined,
                      borderColor: memberFilter.includes(m.name) ? m.color : undefined
                    }}
                    onClick={() => {
                      if (memberFilter.includes(m.name)) {
                        setMemberFilter(memberFilter.filter(x => x !== m.name))
                      } else {
                        setMemberFilter([...memberFilter, m.name])
                      }
                    }}
                  >
                    {m.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="timeline">
        {years.map(year => (
          <div key={year} id={`year-${year}`} style={{ marginBottom: 44 }}>
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
            {sortedEvents(byYear[year]).map(ev => {
              // 取得第一個分類顏色（相容舊資料）
              const primaryCat = (ev.cats && ev.cats[0]) || ev.cat || 'music'
              const isExpanded = expandedId === ev.id
              return (
              <div key={ev.id}>
                <div
                  className="event-card"
                  style={{ borderLeft: '3px solid ' + catColor(primaryCat) }}
                >
                  <div className="month-col" style={{ color: catColor(primaryCat) }}>{dateLabel(ev.month, ev.day)}</div>
                  <div style={{ flex: 1, minWidth: 0 }} onClick={() => openView(ev)}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
                      {/* 顯示多個分類標籤，相容舊資料 */}
                      {(ev.cats || [ev.cat]).filter(Boolean).map(c => (
                        <span key={c} className="cat-tag" style={{ background: catBg(c), color: catColor(c) }}>{catLabel(c)}</span>
                      ))}
                      {hasExtra(ev) && <span style={{ fontSize: 9, color: '#2A9D8F', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Paperclip size={9} />已補充</span>}
                      {(ev.media?.length > 0) && <span style={{ fontSize: 9, color: '#D4AF37', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Image size={9} />{ev.media.length}</span>}
                      {lastEditor(ev) && (
                        <span style={{ fontSize: 9, color: '#555' }}>·
                          <span className="abadge sm" style={badgeStyle(lastEditor(ev))}>{authorEmoji(lastEditor(ev))} {authorName(lastEditor(ev))}</span>
                        </span>
                      )}
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, lineHeight: 1.4 }}>{ev.title}</div>
                    <div className="event-desc">{ev.desc}</div>

                    {/* 媒體預覽（卡片中顯示第一張圖片或影片縮圖） */}
                    {ev.media?.length > 0 && (() => {
                      const firstImg = ev.media.find(m => isImageUrl(m.url))
                      const firstVid = !firstImg ? ev.media.find(m => getVideoThumbnail(m.url)) : null
                      const thumbUrl = firstImg ? firstImg.url : firstVid ? getVideoThumbnail(firstVid.url) : null
                      if (!thumbUrl) return null
                      return (
                        <div className="card-thumbnail">
                          <img src={thumbUrl} alt="" />
                          {firstVid && <div className="card-thumbnail-play">▶</div>}
                        </div>
                      )
                    })()}

                    {ev.links && ev.links.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                        {ev.links.map((lk, i) => (
                          <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer" className="link-tag" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                            <Link size={10} />{lk.label}
                          </a>
                        ))}
                      </div>
                    )}
                    {/* 事件卡留言預覽 - 暫時隱藏
                    {ev.notes && ev.notes.length > 0 && (
                      <div style={{ marginTop: 5, fontSize: 11, color: '#999', fontStyle: 'italic', borderLeft: '2px solid rgba(212,175,55,0.2)', paddingLeft: 8 }}>
                        💬 {ev.notes[ev.notes.length - 1].text} —
                        <span className="abadge sm" style={badgeStyle(ev.notes[ev.notes.length - 1].author)}>
                          {authorEmoji(ev.notes[ev.notes.length - 1].author)} {authorName(ev.notes[ev.notes.length - 1].author)}
                        </span>
                      </div>
                    )}
                    */}
                    {ev.members && ev.members.length > 0 && (
                      <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {ev.members.map(m => <span key={m} className="member-tag" style={{ borderColor: getMemberColor(m), color: getMemberColor(m) }}>{m}</span>)}
                      </div>
                    )}
                  </div>
                  {/* 右側圖示區 */}
                  <div className="card-actions">
                    {/* 留言功能暫時隱藏
                    <button
                      className={`card-icon-btn ${isExpanded ? 'active' : ''}`}
                      onClick={(e) => toggleExpand(ev, e)}
                      title="留言"
                    >
                      💬
                      {ev.notes?.length > 0 && <span className="icon-badge">{ev.notes.length}</span>}
                    </button>
                    */}
                    <button
                      className="card-icon-btn"
                      onClick={(e) => { e.stopPropagation(); openEdit(ev) }}
                      title="編輯"
                    >
                      <Pencil size={14} />
                    </button>
                  </div>
                </div>
                {/* 展開留言紀錄 - 暫時隱藏
                {isExpanded && ev.notes && ev.notes.length > 0 && (
                  <div className="inline-comments">
                    {ev.notes.map((n, i) => (
                      <div key={i} className="inline-comment-item">
                        <span style={{ color: authorColor(n.author), fontSize: 11 }}>{authorEmoji(n.author)} {authorName(n.author)}</span>
                        <span className="inline-comment-text">{n.text}</span>
                        <span className="inline-comment-time">{formatTime(n.ts)}</span>
                        <button
                          onClick={() => deleteInlineNote(ev.id, i)}
                          className="inline-comment-delete"
                          title="刪除"
                        ><X size={12} /></button>
                      </div>
                    ))}
                  </div>
                )}
                */}
              </div>
              )
            })}
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
                {modal.mode === 'new' ? <><Plus size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 新增事件</> : modal.mode === 'edit' ? <><Pencil size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 編輯事件</> : <><Calendar size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> 事件詳情</>}
              </div>
              <button onClick={closeModal} className="modal-close-btn"><X size={16} /></button>
            </div>

            {/* Edit / New Form */}
            {isEditing && (
              <div>
                <label className="form-label">標題</label>
                <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="事件標題" className="form-input" />
                <label className="form-label">描述</label>
                <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="事件描述" rows={3} className="form-input" />
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">日期</label>
                  <input
                    type="date"
                    value={`${form.year}-${String(form.month).padStart(2, '0')}-${String(form.day || 1).padStart(2, '0')}`}
                    onChange={e => {
                      const [y, m, d] = e.target.value.split('-').map(Number)
                      setForm(f => ({ ...f, year: y, month: m, day: d }))
                    }}
                    className="form-input"
                  />
                </div>
                <div style={{ marginBottom: 12 }}>
                  <label className="form-label">分類（可多選）</label>
                    <div className="member-select category-select">
                      {Object.entries(CATEGORIES).map(([k, v]) => {
                        const isSelected = form.cats.includes(k)
                        return (
                          <button
                            key={k}
                            type="button"
                            className={`member-chip ${isSelected ? 'selected' : ''}`}
                            style={isSelected ? { background: v.bg, borderColor: v.color, color: v.color } : {}}
                            onClick={() => {
                              setForm(f => {
                                if (isSelected) {
                                  // 取消選擇，但至少保留一個
                                  const newCats = f.cats.filter(c => c !== k)
                                  return { ...f, cats: newCats.length > 0 ? newCats : f.cats }
                                } else {
                                  return { ...f, cats: [...f.cats, k] }
                                }
                              })
                            }}
                          >
                            {v.label}
                          </button>
                        )
                      })}
                    </div>
                </div>
                <label className="form-label">成員</label>
                <div className="member-select">
                  {MEMBERS.map(member => {
                    const isSelected = form.members.includes(member.name)
                    const isAll = member.name === '全員'
                    return (
                      <button
                        key={member.name}
                        type="button"
                        className={`member-chip ${isSelected ? 'selected' : ''}`}
                        style={isSelected ? { background: member.color + '22', borderColor: member.color, color: member.color } : {}}
                        onClick={() => {
                          if (isAll) {
                            // 點全員：如果已選全員則清空，否則只選全員
                            setForm(f => ({ ...f, members: isSelected ? [] : ['全員'] }))
                          } else {
                            // 點個別成員：移除全員，切換該成員
                            setForm(f => {
                              let newMembers = f.members.filter(x => x !== '全員')
                              if (isSelected) {
                                newMembers = newMembers.filter(x => x !== member.name)
                              } else {
                                newMembers = [...newMembers, member.name]
                              }
                              return { ...f, members: newMembers }
                            })
                          }
                        }}
                      >
                        {member.name}
                      </button>
                    )
                  })}
                </div>

                <div className="divider" />

                {/* Media */}
                <label className="form-label"><Image size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />圖片 / 影片</label>
                <div className="media-grid">
                  {form.media.map((m, i) => {
                    const thumbnail = getVideoThumbnail(m.url)
                    const video = parseVideoUrl(m.url)
                    return (
                      <div key={i} className="media-grid-item">
                        {isImageUrl(m.url) ? (
                          <img src={m.url} alt="" />
                        ) : thumbnail ? (
                          <div className="media-grid-video-thumb">
                            <img src={thumbnail} alt="" />
                            <div className="media-grid-play"><Play size={20} /></div>
                          </div>
                        ) : (
                          <div className={`media-grid-video ${video?.type === 'instagram' ? 'ig-video' : ''}`}>
                            {video?.type === 'instagram' ? <Camera size={24} /> : <Film size={24} />}
                            <span>{video?.type === 'instagram' ? 'IG' : video?.type === 'twitter' ? 'X' : '影片'}</span>
                          </div>
                        )}
                        <button onClick={() => removeMedia(i)} className="media-grid-delete"><X size={12} /></button>
                      </div>
                    )
                  })}
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input
                    value={mediaUrl}
                    onChange={e => setMediaUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addMediaUrl()}
                    onPaste={handlePaste}
                    placeholder="貼上圖片或 YouTube / IG / X 連結"
                    className="form-input"
                    style={{ flex: '1 1 200px', marginBottom: 0 }}
                  />
                  <button onClick={addMediaUrl} className="gold-btn">+</button>
                  <span style={{ color: '#555', fontSize: 11 }}>或</span>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                    multiple
                    onChange={handleFileUpload}
                    style={{ display: 'none' }}
                  />
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploading}
                    className="upload-btn"
                  >
                    {uploading ? '上傳中...' : <><Camera size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />上傳圖片</>}
                  </button>
                </div>

                <div className="divider" />

                {/* Links */}
                <label className="form-label"><Link size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />相關連結</label>
                {form.links.map((lk, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 8px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4 }}>
                    <span style={{ flex: 1, fontSize: 11, color: '#2A9D8F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}><Link size={10} />{lk.label}</span>
                    {lk.author && <span className="abadge sm" style={badgeStyle(lk.author)}>{authorEmoji(lk.author)} {authorName(lk.author)}</span>}
                    <button onClick={() => removeLink(i)} style={{ background: 'none', border: 'none', color: '#E63946', fontSize: 12, display: 'flex', alignItems: 'center' }}><X size={12} /></button>
                  </div>
                ))}
                <div className="link-input-group">
                  <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="名稱（可選）" className="form-input" />
                  <div style={{ display: 'flex', gap: 6 }}>
                    <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="貼上網址" className="form-input" style={{ flex: 1, marginBottom: 0 }} />
                    <button onClick={addLink} className="gold-btn">+ 新增</button>
                  </div>
                </div>

                <div className="divider" />

                <div className="form-actions">
                  <button onClick={closeModal} className="cancel-btn">取消</button>
                  <button onClick={saveEvent} disabled={saving || !form.title?.trim()} className="gold-btn save-btn">{saving ? '儲存中...' : <><Save size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />儲存</>}</button>
                </div>
                {modal.mode === 'edit' && (
                  confirmDel ? (
                    <div className="form-actions" style={{ marginTop: 8 }}>
                      <button onClick={() => setConfirmDel(false)} className="cancel-btn">取消刪除</button>
                      <button onClick={deleteEvent} style={{ flex: 1, padding: '12px 16px', background: '#E63946', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600 }}>確定刪除</button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDel(true)} className="del-btn" style={{ width: '100%', marginTop: 8, padding: '12px 16px', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}><Trash2 size={14} />刪除事件</button>
                  )
                )}
              </div>
            )}

            {/* View Mode - 只顯示詳情 */}
            {modal.mode === 'view' && viewEvent && (
              <div>
                {/* 事件基本資訊 */}
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap', marginBottom: 8 }}>
                  {(viewEvent.cats || [viewEvent.cat]).filter(Boolean).map(c => (
                    <span key={c} className="cat-tag" style={{ background: catBg(c), color: catColor(c) }}>{catLabel(c)}</span>
                  ))}
                  <span style={{ fontSize: 11, color: '#666' }}>{viewEvent.year}/{viewEvent.month}{viewEvent.day ? `/${viewEvent.day}` : ''}</span>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.4, marginBottom: 6 }}>{viewEvent.title}</h3>
                <p style={{ fontSize: 13, color: '#999', lineHeight: 1.7, marginBottom: 8, whiteSpace: 'pre-line' }}>{viewEvent.desc}</p>
                {viewEvent.members?.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 12 }}>
                    {viewEvent.members.map(m => <span key={m} className="member-tag" style={{ fontSize: 10, padding: '2px 7px', borderColor: getMemberColor(m), color: getMemberColor(m) }}>{m}</span>)}
                  </div>
                )}

                {/* Media in view - 分開顯示影片和圖片 */}
                {viewEvent.media?.length > 0 && (() => {
                  const videos = viewEvent.media.filter(m => parseVideoUrl(m.url))
                  const images = viewEvent.media.filter(m => isImageUrl(m.url))
                  return (
                    <>
                      {/* 影片優先顯示 */}
                      {videos.length > 0 && (
                        <>
                          <div className="divider" style={{ marginTop: 0 }} />
                          <h4 style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Film size={12} />影片</h4>
                          {videos.map((m, i) => (
                            <div key={i} style={{ marginBottom: 12 }}>
                              <MediaPreview url={m.url} />
                              <div style={{ fontSize: 10, color: '#555', marginTop: 4 }}>
                                {m.author && <span className="abadge sm" style={badgeStyle(m.author)}>{authorEmoji(m.author)} {authorName(m.author)}</span>}
                                {' '}{formatTime(m.ts)}
                              </div>
                            </div>
                          ))}
                        </>
                      )}

                      {/* 圖片列表，點擊開啟輪播 */}
                      {images.length > 0 && (
                        <>
                          <div className="divider" style={{ marginTop: 0 }} />
                          <h4 style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Image size={12} />圖片 ({images.length})</h4>
                          <div className="image-list">
                            {images.map((m, i) => (
                              <div
                                key={i}
                                className="image-list-item"
                                onClick={() => setImageSlider({ open: true, images, index: i })}
                              >
                                <img src={m.url} alt="" />
                                <div className="image-list-overlay">
                                  <span>{i + 1}/{images.length}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
                    </>
                  )
                })()}

                {/* Links in view */}
                {viewEvent.links?.length > 0 && (
                  <>
                    <div className="divider" style={{ marginTop: 0 }} />
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}><Link size={12} />相關連結</h4>
                    {viewEvent.links.map((lk, i) => (
                      <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: 'rgba(255,255,255,0.03)', borderRadius: 6, marginBottom: 4, textDecoration: 'none' }}>
                        <span style={{ flex: 1, fontSize: 12, color: '#2A9D8F', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 4 }}><Link size={10} />{lk.label}</span>
                        {lk.author && <span className="abadge sm" style={badgeStyle(lk.author)}>{authorEmoji(lk.author)}</span>}
                      </a>
                    ))}
                  </>
                )}

                {/* Notes in view */}
                {viewEvent.notes?.length > 0 && (
                  <>
                    <div className="divider" style={{ marginTop: 0 }} />
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: '#D4AF37', marginBottom: 8 }}>💬 留言</h4>
                    {viewEvent.notes.map((n, i) => (
                      <div key={i} style={{ padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ fontSize: 12, color: '#aaa', marginBottom: 2 }}>{n.text}</div>
                        <div style={{ fontSize: 10, color: '#555' }}>
                          <span className="abadge sm" style={badgeStyle(n.author)}>{authorEmoji(n.author)} {authorName(n.author)}</span>
                          {' '}{formatTime(n.ts)}
                        </div>
                      </div>
                    ))}
                  </>
                )}

                <div className="divider" />

                {/* 底部操作區 */}
                <div className="form-actions">
                  <button onClick={() => setShowLog(!showLog)} className="cancel-btn">{showLog ? '收起紀錄' : <><History size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />編輯紀錄</>}</button>
                  <button onClick={() => openEdit(viewEvent)} className="gold-btn save-btn" style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}><Pencil size={14} />編輯</button>
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
        <div className="image-slider-overlay" onClick={() => setImageSlider({ open: false, images: [], index: 0 })}>
          <button className="image-slider-close"><X size={24} /></button>
          <div
            className="image-slider-container"
            onClick={e => e.stopPropagation()}
            onTouchStart={e => setTouchStart(e.touches[0].clientX)}
            onTouchEnd={e => {
              if (touchStart === null) return
              const touchEnd = e.changedTouches[0].clientX
              const diff = touchStart - touchEnd
              if (Math.abs(diff) > 50) {
                if (diff > 0) {
                  // 向左滑 = 下一張
                  setImageSlider(s => ({ ...s, index: (s.index + 1) % s.images.length }))
                } else {
                  // 向右滑 = 上一張
                  setImageSlider(s => ({ ...s, index: (s.index - 1 + s.images.length) % s.images.length }))
                }
              }
              setTouchStart(null)
            }}
          >
            <button
              className="image-slider-nav prev"
              onClick={() => setImageSlider(s => ({ ...s, index: (s.index - 1 + s.images.length) % s.images.length }))}
              disabled={imageSlider.images.length <= 1}
            >
              <ChevronLeft size={28} />
            </button>
            <div className="image-slider-main">
              <img src={imageSlider.images[imageSlider.index]?.url} alt="" draggable={false} />
              <div className="image-slider-info">
                <span>{imageSlider.index + 1} / {imageSlider.images.length}</span>
                {imageSlider.images[imageSlider.index]?.author && (
                  <span className="abadge sm" style={badgeStyle(imageSlider.images[imageSlider.index].author)}>
                    {authorEmoji(imageSlider.images[imageSlider.index].author)} {authorName(imageSlider.images[imageSlider.index].author)}
                  </span>
                )}
              </div>
            </div>
            <button
              className="image-slider-nav next"
              onClick={() => setImageSlider(s => ({ ...s, index: (s.index + 1) % s.images.length }))}
              disabled={imageSlider.images.length <= 1}
            >
              <ChevronRight size={28} />
            </button>
          </div>
          {/* 縮圖列表 */}
          {imageSlider.images.length > 1 && (
            <div className="image-slider-thumbs">
              {imageSlider.images.map((img, i) => (
                <div
                  key={i}
                  className={`image-slider-thumb ${i === imageSlider.index ? 'active' : ''}`}
                  onClick={(e) => { e.stopPropagation(); setImageSlider(s => ({ ...s, index: i })) }}
                >
                  <img src={img.url} alt="" />
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
