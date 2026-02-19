import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, X, Image, Camera, ChevronDown, Trash2, ExternalLink, Calendar, Save, Check, AlertCircle, Link2, Upload, Search, Grid, List, Play, ChevronLeft, ChevronRight, RefreshCw, Heart, MessageCircle } from 'lucide-react'
import config from '../config'
import './BstageArchive.css'

// BIGBANG 成員列表與顏色（b.stage 沒有「全員」）
const MEMBERS = [
  { name: 'G-Dragon', color: '#ed609f' },
  { name: 'T.O.P', color: '#8fc126' },
  { name: '太陽', color: '#d7171e' },
  { name: '大聲', color: '#f4e727' },
  { name: '勝利', color: '#1e92c6' },
]

function getMemberColor(name) {
  return MEMBERS.find(m => m.name === name)?.color || '#E5A500'
}

function genId() {
  return 'b-' + Date.now()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// 取得社群備份用的 ImgBB API Key
const BSTAGE_IMGBB_KEY = config.SOCIAL_IMGBB_API_KEY || config.IMGBB_API_KEY

// 上傳圖片到 ImgBB
async function uploadToImgBB(file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${BSTAGE_IMGBB_KEY}`, {
    method: 'POST',
    body: formData
  })
  const data = await res.json()
  if (data.success) {
    return data.data.url
  }
  throw new Error('上傳失敗')
}

// 透過 URL 上傳圖片到 ImgBB
async function uploadUrlToImgBB(imageUrl) {
  const formData = new FormData()
  formData.append('image', imageUrl)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${BSTAGE_IMGBB_KEY}`, {
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
async function uploadToCloudinary(imageUrl) {
  if (!config.CLOUDINARY_CLOUD_NAME || !config.CLOUDINARY_UPLOAD_PRESET) {
    console.warn('Cloudinary 未設定，跳過備份')
    return null
  }

  try {
    const formData = new FormData()
    formData.append('file', imageUrl)
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

// 解析 YouTube 連結，取得影片 ID
function parseYouTubeUrl(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

// 取得 YouTube 縮圖
function getYouTubeThumbnail(url) {
  const videoId = parseYouTubeUrl(url)
  if (!videoId) return null
  return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
}

export default function BstageArchive({ isAdmin, onBack }) {
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // 篩選
  const [filterMember, setFilterMember] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('grid') // grid | list

  // 新增/編輯 Modal
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    member: 'G-Dragon',
    date: new Date().toISOString().split('T')[0],
    time: '',
    caption: '',
    media: [], // { url, type: 'image' | 'youtube', backupUrl, thumbnail }
    likes: 0,
    comments: 0,
    sourceUrl: '',
    notes: '',
  })
  const [uploading, setUploading] = useState(false)

  // YouTube 連結輸入
  const [youtubeUrl, setYoutubeUrl] = useState('')

  // 檢視貼文
  const [viewingItem, setViewingItem] = useState(null)
  const [viewingMediaIndex, setViewingMediaIndex] = useState(0)

  // 確認 Modal
  const [confirmModal, setConfirmModal] = useState(null)

  // 無限滾動
  const [displayCount, setDisplayCount] = useState(20)
  const loadMoreRef = useRef(null)

  // 手動輸入媒體網址
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualUrls, setManualUrls] = useState('')
  const [uploadingCount, setUploadingCount] = useState(0)

  // 載入資料
  useEffect(() => {
    loadArchives()
  }, [])

  async function loadArchives() {
    setLoading(true)
    try {
      const res = await fetch(`${config.API_URL}/bstage`)
      if (!res.ok) throw new Error('載入失敗')
      const data = await res.json()
      setArchives(data)
    } catch (err) {
      console.error('載入失敗', err)
      showToast('載入失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function createArchive(item) {
    const res = await fetch(`${config.API_URL}/bstage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.API_KEY
      },
      body: JSON.stringify(item)
    })
    if (!res.ok) throw new Error('建立失敗')
    return res.json()
  }

  async function updateArchive(item) {
    const res = await fetch(`${config.API_URL}/bstage/${item.id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': config.API_KEY
      },
      body: JSON.stringify(item)
    })
    if (!res.ok) throw new Error('更新失敗')
    return res.json()
  }

  async function deleteArchiveById(id) {
    const res = await fetch(`${config.API_URL}/bstage/${id}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': config.API_KEY }
    })
    if (!res.ok) throw new Error('刪除失敗')
    return res.json()
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  function showConfirm({ title, content, type = 'warning', confirmText = '確定', cancelText = '取消' }) {
    return new Promise((resolve) => {
      setConfirmModal({
        title,
        content,
        type,
        confirmText,
        cancelText,
        onConfirm: () => { setConfirmModal(null); resolve(true) },
        onCancel: () => { setConfirmModal(null); resolve(false) }
      })
    })
  }

  // 篩選後的資料
  const filteredArchives = useMemo(() => {
    return archives
      .filter(item => {
        if (filterMember !== 'all' && item.member !== filterMember) return false
        if (searchText && !item.caption?.toLowerCase().includes(searchText.toLowerCase())) return false
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [archives, filterMember, searchText])

  // 實際顯示的資料（無限滾動）
  const displayedArchives = useMemo(() => {
    return filteredArchives.slice(0, displayCount)
  }, [filteredArchives, displayCount])

  // 當 filter 改變時，重設顯示數量
  useEffect(() => {
    setDisplayCount(20)
  }, [filterMember, searchText])

  // 無限滾動 - IntersectionObserver
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && displayCount < filteredArchives.length) {
          setDisplayCount(prev => Math.min(prev + 20, filteredArchives.length))
        }
      },
      { threshold: 0.1 }
    )

    if (loadMoreRef.current) {
      observer.observe(loadMoreRef.current)
    }

    return () => observer.disconnect()
  }, [displayCount, filteredArchives.length])

  // 開啟新增 Modal
  function openAddModal() {
    setEditingItem(null)
    setFormData({
      member: 'G-Dragon',
      date: new Date().toISOString().split('T')[0],
      time: '',
      caption: '',
      media: [],
      likes: 0,
      comments: 0,
      sourceUrl: '',
      notes: '',
    })
    setYoutubeUrl('')
    setShowManualInput(false)
    setManualUrls('')
    setShowModal(true)
  }

  // 開啟編輯 Modal
  function openEditModal(item) {
    setEditingItem(item)
    setFormData({
      member: item.member,
      date: item.date,
      time: item.time || '',
      caption: item.caption || '',
      media: item.media || [],
      likes: item.likes || 0,
      comments: item.comments || 0,
      sourceUrl: item.sourceUrl || '',
      notes: item.notes || '',
    })
    setYoutubeUrl('')
    setShowManualInput(false)
    setManualUrls('')
    setShowModal(true)
  }

  // 開啟檢視 Modal
  function openViewModal(item) {
    setViewingItem(item)
    setViewingMediaIndex(0)
  }

  // 切換到上一則/下一則貼文
  function goToPrevPost() {
    const currentIndex = filteredArchives.findIndex(a => a.id === viewingItem?.id)
    if (currentIndex > 0) {
      setViewingItem(filteredArchives[currentIndex - 1])
      setViewingMediaIndex(0)
    }
  }

  function goToNextPost() {
    const currentIndex = filteredArchives.findIndex(a => a.id === viewingItem?.id)
    if (currentIndex < filteredArchives.length - 1) {
      setViewingItem(filteredArchives[currentIndex + 1])
      setViewingMediaIndex(0)
    }
  }

  function getCurrentPostIndex() {
    return filteredArchives.findIndex(a => a.id === viewingItem?.id)
  }

  // 從檢視切換到編輯
  function switchToEdit() {
    if (viewingItem) {
      openEditModal(viewingItem)
      setViewingItem(null)
    }
  }

  // 新增 YouTube 連結
  function addYoutubeLink() {
    if (!youtubeUrl.trim()) return
    const videoId = parseYouTubeUrl(youtubeUrl)
    if (!videoId) {
      showToast('無法解析 YouTube 連結', 'error')
      return
    }
    const thumbnail = `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`
    setFormData(prev => ({
      ...prev,
      media: [...prev.media, {
        url: youtubeUrl.trim(),
        type: 'youtube',
        thumbnail,
      }]
    }))
    setYoutubeUrl('')
    showToast('已新增 YouTube 影片')
  }

  // 處理手動輸入的媒體網址（圖片）
  async function handleManualUrlsSubmit() {
    if (!manualUrls.trim()) return

    const urls = manualUrls
      .split('\n')
      .map(u => u.trim())
      .filter(u => u && (u.startsWith('http') || u.startsWith('//')))

    if (urls.length === 0) {
      showToast('請輸入有效的網址', 'error')
      return
    }

    const newMedia = urls.map((url, i) => ({
      url,
      type: 'image',
      uploading: true,
      originalUrl: url,
      index: formData.media.length + i,
    }))

    setFormData(prev => ({
      ...prev,
      media: [...prev.media, ...newMedia]
    }))

    setUploadingCount(prev => prev + newMedia.length)

    for (const m of newMedia) {
      uploadSingleImage(m.originalUrl, m.index)
    }

    setManualUrls('')
    setShowManualInput(false)
    showToast(`已新增 ${urls.length} 個媒體`)
  }

  // 單張圖片背景上傳（同時上傳 ImgBB + Cloudinary 備份）
  async function uploadSingleImage(originalUrl, index) {
    try {
      const [imgbbUrl, cloudinaryUrl] = await Promise.all([
        uploadUrlToImgBB(originalUrl),
        uploadToCloudinary(originalUrl)
      ])

      setFormData(prev => ({
        ...prev,
        media: prev.media.map((m, i) =>
          i === index ? {
            ...m,
            url: imgbbUrl,
            backupUrl: cloudinaryUrl,
            uploading: false
          } : m
        )
      }))

      if (cloudinaryUrl) {
        console.log(`✅ 圖片 ${index + 1} 雙重備份完成`)
      }
    } catch (err) {
      console.warn(`圖片 ${index + 1} 上傳失敗`, err)
      setFormData(prev => ({
        ...prev,
        media: prev.media.map((m, i) =>
          i === index ? { ...m, uploading: false, uploadFailed: true } : m
        )
      }))
    } finally {
      setUploadingCount(prev => prev - 1)
    }
  }

  // 上傳媒體（本地檔案）
  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return

    setUploading(true)
    try {
      const newMedia = []
      for (const file of files) {
        const url = await uploadToImgBB(file)
        newMedia.push({ url, type: 'image' })
      }
      setFormData(prev => ({
        ...prev,
        media: [...prev.media, ...newMedia]
      }))
      showToast(`已新增 ${newMedia.length} 個檔案`)
    } catch (err) {
      console.error('上傳失敗', err)
      showToast('上傳失敗', 'error')
    } finally {
      setUploading(false)
    }
  }

  // 移除媒體
  function removeMedia(index) {
    setFormData(prev => ({
      ...prev,
      media: prev.media.filter((_, i) => i !== index)
    }))
  }

  // 儲存
  async function handleSave() {
    if (!formData.date || !formData.member) {
      showToast('請填寫必要欄位', 'error')
      return
    }

    // 檢查是否有正在上傳的圖片
    const stillUploading = formData.media.some(m => m.uploading)
    if (stillUploading) {
      const confirmSave = await showConfirm({
        title: '⚠️ 上傳未完成',
        type: 'warning',
        confirmText: '仍要儲存',
        cancelText: '等待上傳',
        content: (
          <div className="confirm-content">
            <p>還有圖片正在上傳中，確定要現在儲存嗎？</p>
            <p className="confirm-warning">未完成上傳的圖片可能無法正常顯示</p>
          </div>
        )
      })
      if (!confirmSave) return
    }

    const item = {
      id: editingItem?.id || genId(),
      member: formData.member,
      date: formData.date,
      time: formData.time,
      caption: formData.caption,
      media: formData.media.map(m => ({
        url: m.url,
        type: m.type,
        ...(m.backupUrl && { backupUrl: m.backupUrl }),
        ...(m.thumbnail && { thumbnail: m.thumbnail }),
      })),
      likes: parseInt(formData.likes) || 0,
      comments: parseInt(formData.comments) || 0,
      sourceUrl: formData.sourceUrl,
      notes: formData.notes,
      createdAt: editingItem?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    setSaving(true)
    try {
      if (editingItem) {
        await updateArchive(item)
        setArchives(archives.map(a => a.id === editingItem.id ? item : a))
      } else {
        await createArchive(item)
        setArchives([item, ...archives])
      }
      showToast('已儲存')
      setShowModal(false)
    } catch (err) {
      console.error('儲存失敗', err)
      showToast('儲存失敗', 'error')
    } finally {
      setSaving(false)
    }
  }

  // 刪除
  async function handleDelete(id) {
    const confirmDelete = await showConfirm({
      title: '🗑️ 刪除確認',
      type: 'danger',
      confirmText: '刪除',
      cancelText: '取消',
      content: (
        <div className="confirm-content">
          <p>確定要刪除這筆備份嗎？</p>
          <p className="confirm-warning">此操作無法復原</p>
        </div>
      )
    })
    if (!confirmDelete) return

    try {
      await deleteArchiveById(id)
      setArchives(archives.filter(a => a.id !== id))
      showToast('已刪除')
    } catch (err) {
      console.error('刪除失敗', err)
      showToast('刪除失敗', 'error')
    }
  }

  // 取得縮圖（圖片用第一張，YouTube 用縮圖）
  function getThumbUrl(item) {
    if (!item.media?.length) return null
    const first = item.media[0]
    if (first.type === 'youtube') {
      return first.thumbnail || getYouTubeThumbnail(first.url)
    }
    return first.url
  }

  // ===== Render =====

  if (loading) {
    return (
      <div className="bstage-archive-loading">
        <div className="loading-spinner"></div>
        <p>載入中...</p>
      </div>
    )
  }

  return (
    <div className="bstage-archive">
      {/* Header */}
      <header className="bstage-header">
        <button className="back-btn" onClick={onBack}>← 返回時間軸</button>
        <h1>⭐ b.stage 備份</h1>
        <button className="add-btn" onClick={openAddModal} title="新增備份">
          <Plus size={20} />
        </button>
      </header>

      {/* Filters */}
      <div className="bstage-filters">
        <div className="filter-row">
          {/* 成員篩選 */}
          <select
            value={filterMember}
            onChange={e => setFilterMember(e.target.value)}
            className="filter-select"
          >
            <option value="all">所有成員</option>
            {MEMBERS.map(m => (
              <option key={m.name} value={m.name}>{m.name}</option>
            ))}
          </select>

          {/* 搜尋 */}
          <div className="search-box">
            <Search size={16} />
            <input
              type="text"
              placeholder="搜尋內容..."
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
            />
          </div>

          {/* 檢視模式 */}
          <div className="view-toggle">
            <button
              className={viewMode === 'grid' ? 'active' : ''}
              onClick={() => setViewMode('grid')}
            >
              <Grid size={16} />
            </button>
            <button
              className={viewMode === 'list' ? 'active' : ''}
              onClick={() => setViewMode('list')}
            >
              <List size={16} />
            </button>
          </div>
        </div>

        <div className="filter-stats">
          共 {filteredArchives.length} 筆備份
        </div>
      </div>

      {/* Archive Grid/List */}
      <div className={`bstage-content ${viewMode}`}>
        {filteredArchives.length === 0 ? (
          <div className="empty-state">
            <Camera size={48} />
            <p>尚無備份資料</p>
            <button onClick={openAddModal}>新增第一筆</button>
          </div>
        ) : (
          displayedArchives.map(item => (
            <div
              key={item.id}
              className="archive-card"
              onClick={() => openViewModal(item)}
            >
              {/* 縮圖 */}
              <div className="archive-thumb">
                {item.media?.[0] ? (
                  item.media[0].type === 'youtube' ? (
                    <div className="video-thumb-img">
                      <img src={item.media[0].thumbnail || getYouTubeThumbnail(item.media[0].url)} alt="" loading="lazy" />
                      <Play size={24} className="play-overlay" />
                    </div>
                  ) : (
                    <img src={item.media[0].url} alt="" loading="lazy" />
                  )
                ) : (
                  <div className="no-thumb">
                    <Camera size={24} />
                  </div>
                )}
                {item.media?.length > 1 && (
                  <span className="media-count">+{item.media.length - 1}</span>
                )}
                {/* b.stage 標籤 */}
                <span className="type-badge">b.stage</span>
              </div>

              {/* 資訊 */}
              <div className="archive-info">
                <div className="archive-meta">
                  <span
                    className="member-tag"
                    style={{ background: getMemberColor(item.member) + '30', color: getMemberColor(item.member) }}
                  >
                    {item.member}
                  </span>
                  <span className="date">{formatDate(item.date)}</span>
                </div>
                {item.caption && (
                  <p className="archive-caption">{item.caption}</p>
                )}
                {/* 互動數據 */}
                {(item.likes > 0 || item.comments > 0) && (
                  <div className="archive-stats">
                    {item.likes > 0 && <span className="stat"><Heart size={12} /> {item.likes}</span>}
                    {item.comments > 0 && <span className="stat"><MessageCircle size={12} /> {item.comments}</span>}
                  </div>
                )}
              </div>
            </div>
          ))
        )}

        {/* 載入更多 sentinel */}
        {displayCount < filteredArchives.length && (
          <div ref={loadMoreRef} className="load-more-sentinel">
            <RefreshCw size={20} className="spinning" />
            <span>載入更多... ({displayCount}/{filteredArchives.length})</span>
          </div>
        )}
      </div>

      {/* View Modal */}
      {viewingItem && (
        <div className="modal-overlay view-modal-overlay" onClick={() => setViewingItem(null)}>
          {/* 頂部：貼文位置指示 */}
          <div className="post-nav-indicator" onClick={e => e.stopPropagation()}>
            {getCurrentPostIndex() + 1} / {filteredArchives.length}
          </div>

          {/* 左側：上一則按鈕 */}
          <button
            className="post-nav-side prev"
            onClick={(e) => { e.stopPropagation(); goToPrevPost() }}
            disabled={getCurrentPostIndex() <= 0}
            title="上一則"
          >
            <ChevronLeft size={32} />
          </button>

          <div className="view-modal" onClick={e => e.stopPropagation()}>
            {/* 關閉按鈕 */}
            <button className="view-close-btn" onClick={() => setViewingItem(null)}>
              <X size={24} />
            </button>

            {/* 媒體區域 */}
            <div className="view-media-area">
              {viewingItem.media?.length > 0 ? (
                <>
                  {viewingItem.media[viewingMediaIndex]?.type === 'youtube' ? (
                    <div className="youtube-embed">
                      <iframe
                        src={`https://www.youtube.com/embed/${parseYouTubeUrl(viewingItem.media[viewingMediaIndex].url)}`}
                        frameBorder="0"
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                        allowFullScreen
                        title="YouTube video"
                      />
                    </div>
                  ) : (
                    <img
                      src={viewingItem.media[viewingMediaIndex]?.url}
                      alt=""
                      className="view-media"
                    />
                  )}

                  {/* 輪播控制 */}
                  {viewingItem.media.length > 1 && (
                    <>
                      <button
                        className="media-nav prev"
                        onClick={() => setViewingMediaIndex(i => (i - 1 + viewingItem.media.length) % viewingItem.media.length)}
                      >
                        ‹
                      </button>
                      <button
                        className="media-nav next"
                        onClick={() => setViewingMediaIndex(i => (i + 1) % viewingItem.media.length)}
                      >
                        ›
                      </button>
                      <div className="media-dots">
                        {viewingItem.media.map((_, i) => (
                          <span
                            key={i}
                            className={`dot ${i === viewingMediaIndex ? 'active' : ''}`}
                            onClick={() => setViewingMediaIndex(i)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="no-media">
                  <Camera size={48} />
                  <p>無媒體檔案</p>
                </div>
              )}
            </div>

            {/* 資訊區域 */}
            <div className="view-info-area">
              <div className="view-header">
                <span
                  className="member-tag"
                  style={{ background: getMemberColor(viewingItem.member) + '30', color: getMemberColor(viewingItem.member) }}
                >
                  {viewingItem.member}
                </span>
                <span className="type-badge-inline">b.stage</span>
                <span className="view-date">{formatDate(viewingItem.date)}</span>
              </div>

              {/* 互動數據 */}
              {(viewingItem.likes > 0 || viewingItem.comments > 0) && (
                <div className="view-stats">
                  {viewingItem.likes > 0 && <span className="stat"><Heart size={14} /> {viewingItem.likes}</span>}
                  {viewingItem.comments > 0 && <span className="stat"><MessageCircle size={14} /> {viewingItem.comments}</span>}
                </div>
              )}

              {viewingItem.caption && (
                <div className="view-caption">
                  <p>{viewingItem.caption}</p>
                </div>
              )}

              {viewingItem.notes && (
                <div className="view-notes">
                  <strong>備註：</strong>
                  <p>{viewingItem.notes}</p>
                </div>
              )}

              <div className="view-actions">
                {viewingItem.sourceUrl && (
                  <a
                    href={viewingItem.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-link-btn"
                  >
                    <ExternalLink size={16} /> 開啟 b.stage
                  </a>
                )}
                <button className="view-edit-btn" onClick={switchToEdit}>
                  ✏️ 編輯
                </button>
              </div>
            </div>
          </div>

          {/* 右側：下一則按鈕 */}
          <button
            className="post-nav-side next"
            onClick={(e) => { e.stopPropagation(); goToNextPost() }}
            disabled={getCurrentPostIndex() >= filteredArchives.length - 1}
            title="下一則"
          >
            <ChevronRight size={32} />
          </button>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="bstage-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? '編輯備份' : '新增備份'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* 成員 */}
              <div className="form-group">
                <label>成員</label>
                <select
                  value={formData.member}
                  onChange={e => setFormData(prev => ({ ...prev, member: e.target.value }))}
                >
                  {MEMBERS.map(m => (
                    <option key={m.name} value={m.name}>{m.name}</option>
                  ))}
                </select>
              </div>

              {/* 日期時間 */}
              <div className="form-row">
                <div className="form-group">
                  <label><Calendar size={14} /> 發文日期</label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label>時間（選填）</label>
                  <input
                    type="time"
                    value={formData.time}
                    onChange={e => setFormData(prev => ({ ...prev, time: e.target.value }))}
                  />
                </div>
              </div>

              {/* b.stage 原始連結 */}
              <div className="form-group">
                <label><Link2 size={14} /> b.stage 原始連結（選填）</label>
                <input
                  type="url"
                  placeholder="貼上 b.stage 原始連結..."
                  value={formData.sourceUrl}
                  onChange={e => setFormData(prev => ({ ...prev, sourceUrl: e.target.value }))}
                />
              </div>

              {/* 媒體上傳 */}
              <div className="form-group">
                <label>
                  <Image size={14} /> 圖片/影片
                  {uploadingCount > 0 && (
                    <span className="upload-status">（{uploadingCount} 張上傳中...）</span>
                  )}
                </label>
                <div className="media-upload-area">
                  {formData.media.map((m, i) => (
                    <div key={i} className={`media-preview ${m.uploading ? 'uploading' : ''} ${m.uploadFailed ? 'failed' : ''}`}>
                      {m.type === 'youtube' ? (
                        <div className="video-preview-img">
                          <img src={m.thumbnail || getYouTubeThumbnail(m.url)} alt="" />
                          <Play size={16} className="play-icon" />
                        </div>
                      ) : (
                        <img src={m.url} alt="" />
                      )}
                      {m.uploading && (
                        <div className="upload-overlay">
                          <div className="mini-spinner"></div>
                        </div>
                      )}
                      {m.uploadFailed && (
                        <div className="upload-failed-badge" title="上傳失敗，將使用原始連結">⚠️</div>
                      )}
                      <button className="remove-media" onClick={() => removeMedia(i)}>
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                  <label className="upload-btn">
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleMediaUpload}
                      disabled={uploading}
                    />
                    {uploading ? (
                      <span className="uploading">上傳中...</span>
                    ) : (
                      <>
                        <Upload size={20} />
                        <span>上傳</span>
                      </>
                    )}
                  </label>
                  <button
                    type="button"
                    className="manual-url-toggle"
                    onClick={() => setShowManualInput(!showManualInput)}
                  >
                    <Link2 size={16} />
                    <span>貼上網址</span>
                  </button>
                </div>

                {/* YouTube 連結輸入 */}
                <div className="youtube-input">
                  <input
                    type="url"
                    placeholder="貼上 YouTube 連結..."
                    value={youtubeUrl}
                    onChange={e => setYoutubeUrl(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addYoutubeLink()}
                  />
                  <button onClick={addYoutubeLink} title="新增 YouTube 影片" disabled={!youtubeUrl.trim()}>
                    <Play size={16} /> YT
                  </button>
                </div>

                {/* 手動輸入媒體網址 */}
                {showManualInput && (
                  <div className="manual-url-input">
                    <p className="manual-hint">
                      💡 每行貼一個圖片網址
                    </p>
                    <textarea
                      placeholder="貼上圖片網址，每行一個..."
                      value={manualUrls}
                      onChange={e => setManualUrls(e.target.value)}
                      rows={4}
                    />
                    <div className="manual-actions">
                      <button
                        type="button"
                        className="cancel-manual"
                        onClick={() => {
                          setShowManualInput(false)
                          setManualUrls('')
                        }}
                      >
                        取消
                      </button>
                      <button
                        type="button"
                        className="submit-manual"
                        onClick={handleManualUrlsSubmit}
                      >
                        新增媒體
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* 互動數據 */}
              <div className="form-row">
                <div className="form-group">
                  <label><Heart size={14} /> 讚數</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.likes}
                    onChange={e => setFormData(prev => ({ ...prev, likes: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label><MessageCircle size={14} /> 留言數</label>
                  <input
                    type="number"
                    min="0"
                    placeholder="0"
                    value={formData.comments}
                    onChange={e => setFormData(prev => ({ ...prev, comments: e.target.value }))}
                  />
                </div>
              </div>

              {/* 原文內容 */}
              <div className="form-group">
                <label>原文內容</label>
                <textarea
                  placeholder="貼上 b.stage 原文內容..."
                  value={formData.caption}
                  onChange={e => setFormData(prev => ({ ...prev, caption: e.target.value }))}
                  rows={4}
                />
              </div>

              {/* 備註 */}
              <div className="form-group">
                <label>備註（選填）</label>
                <textarea
                  placeholder="其他備註..."
                  value={formData.notes}
                  onChange={e => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  rows={2}
                />
              </div>
            </div>

            <div className="modal-footer">
              {editingItem && (
                <button
                  className="delete-btn"
                  onClick={() => {
                    handleDelete(editingItem.id)
                    setShowModal(false)
                  }}
                >
                  <Trash2 size={16} /> 刪除
                </button>
              )}
              <button className="cancel-btn" onClick={() => setShowModal(false)}>
                取消
              </button>
              <button className="save-btn" onClick={handleSave} disabled={saving}>
                <Save size={16} /> {saving ? '儲存中...' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`toast ${toast.type}`}>
          {toast.type === 'error' ? <AlertCircle size={16} /> : <Check size={16} />}
          {toast.msg}
        </div>
      )}

      {/* 確認 Modal */}
      {confirmModal && (
        <div className="confirm-modal-overlay" onClick={confirmModal.onCancel}>
          <div className={`confirm-modal confirm-modal-${confirmModal.type}`} onClick={e => e.stopPropagation()}>
            <h3 className="confirm-modal-title">{confirmModal.title}</h3>
            <div className="confirm-modal-body">
              {confirmModal.content}
            </div>
            <div className="confirm-modal-actions">
              <button className="confirm-modal-cancel" onClick={confirmModal.onCancel}>
                {confirmModal.cancelText}
              </button>
              <button className={`confirm-modal-confirm confirm-modal-confirm-${confirmModal.type}`} onClick={confirmModal.onConfirm}>
                {confirmModal.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
