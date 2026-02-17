import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, X, Image, Film, Camera, ChevronDown, Trash2, ExternalLink, Calendar, Save, Check, AlertCircle, Instagram, Link2, Upload, Search, Grid, List, Play } from 'lucide-react'
import config from '../config'
import { AUTHORS, authorName, authorEmoji, authorColor, badgeStyle } from '../data/authors'
import './SocialArchive.css'

// BIGBANG 成員列表與顏色
const MEMBERS = [
  { name: '全員', color: '#E5A500' },
  { name: 'G-Dragon', color: '#ed609f' },
  { name: 'T.O.P', color: '#8fc126' },
  { name: '太陽', color: '#d7171e' },
  { name: '大聲', color: '#f4e727' },
  { name: '勝利', color: '#1e92c6' },
]

// 貼文類型
const POST_TYPES = [
  { id: 'post', label: '貼文', icon: '📷', color: '#E1306C' },
  { id: 'story', label: 'Story', icon: '⭕', color: '#833AB4' },
  { id: 'reels', label: 'Reels', icon: '🎬', color: '#F77737' },
]

// IG 帳號對應
const IG_ACCOUNTS = {
  'G-Dragon': 'xxxibgdrgn',
  'T.O.P': 'ttt',
  '太陽': '__youngbae__',
  '大聲': 'd_lable_official',
  '勝利': '',
  '全員': 'bigbangofficial',
}

const SOCIAL_JSONBIN_URL = `https://api.jsonbin.io/v3/b/${config.SOCIAL_BIN_ID || config.BIN_ID}`

function getMemberColor(name) {
  return MEMBERS.find(m => m.name === name)?.color || '#E5A500'
}

function genId() {
  return 's-' + Date.now()
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateTime(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

// 取得社群備份用的 ImgBB API Key（有設定專用的就用專用的，沒有就用主要的）
const SOCIAL_IMGBB_KEY = config.SOCIAL_IMGBB_API_KEY || config.IMGBB_API_KEY

// 上傳圖片到 ImgBB（社群備份專用）
async function uploadToImgBB(file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${SOCIAL_IMGBB_KEY}`, {
    method: 'POST',
    body: formData
  })
  const data = await res.json()
  if (data.success) {
    return data.data.url
  }
  throw new Error('上傳失敗')
}

// 透過 URL 上傳圖片到 ImgBB（用於 IG 圖片，社群備份專用）
async function uploadUrlToImgBB(imageUrl) {
  const formData = new FormData()
  formData.append('image', imageUrl)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${SOCIAL_IMGBB_KEY}`, {
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

// 根據 IG 帳號判斷成員
function detectMemberFromUsername(username) {
  if (!username) return '全員'
  const lowerUsername = username.toLowerCase()
  for (const [member, igAccount] of Object.entries(IG_ACCOUNTS)) {
    if (igAccount && lowerUsername === igAccount.toLowerCase()) {
      return member
    }
  }
  return '全員'
}

// 從 IG 連結抓取完整資訊（使用 Cloudflare Worker）
async function fetchIGData(url) {
  // 如果沒有設定 Worker URL，只做基本解析
  if (!config.IG_SCRAPER_URL) {
    const postMatch = url.match(/instagram\.com\/p\/([a-zA-Z0-9_-]+)/)
    const reelMatch = url.match(/instagram\.com\/(?:reel|reels)\/([a-zA-Z0-9_-]+)/)
    const storyMatch = url.match(/instagram\.com\/stories\/([^\/]+)\/(\d+)/)

    let type = 'post'
    if (reelMatch) type = 'reels'
    else if (storyMatch) type = 'story'

    return {
      success: false,
      type,
      message: '請先設定 IG_SCRAPER_URL（Cloudflare Worker）'
    }
  }

  try {
    const apiUrl = `${config.IG_SCRAPER_URL}/scrape?url=${encodeURIComponent(url)}`
    const res = await fetch(apiUrl)
    const data = await res.json()
    return data
  } catch (error) {
    console.error('IG 抓取失敗:', error)
    return { success: false, error: error.message }
  }
}

export default function SocialArchive({ me, onBack }) {
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // 篩選
  const [filterMember, setFilterMember] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('grid') // grid | list

  // 新增/編輯 Modal
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    type: 'post',
    member: '全員',
    date: new Date().toISOString().split('T')[0],
    time: '',
    igUrl: '',
    caption: '',
    media: [], // { url, type: 'image' | 'video' }
    notes: '',
  })
  const [uploading, setUploading] = useState(false)

  // 檢視貼文
  const [viewingItem, setViewingItem] = useState(null)
  const [viewingMediaIndex, setViewingMediaIndex] = useState(0)

  // 載入資料
  useEffect(() => {
    loadArchives()
  }, [])

  async function loadArchives() {
    setLoading(true)
    try {
      // 先嘗試從 localStorage 載入
      const cached = localStorage.getItem('socialArchives')
      if (cached) {
        setArchives(JSON.parse(cached))
      }

      // 從 JSONBin 載入（如果有設定）
      if (config.SOCIAL_BIN_ID) {
        const res = await fetch(`${SOCIAL_JSONBIN_URL}/latest`, {
          headers: { 'X-Master-Key': config.API_KEY }
        })
        if (res.ok) {
          const data = await res.json()
          if (data.record?.archives) {
            setArchives(data.record.archives)
            localStorage.setItem('socialArchives', JSON.stringify(data.record.archives))
          }
        }
      }
    } catch (err) {
      console.error('載入失敗', err)
      showToast('載入失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  async function saveArchives(newArchives) {
    setSaving(true)
    try {
      // 存到 localStorage
      localStorage.setItem('socialArchives', JSON.stringify(newArchives))

      // 存到 JSONBin（如果有設定）
      if (config.SOCIAL_BIN_ID) {
        await fetch(SOCIAL_JSONBIN_URL, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'X-Master-Key': config.API_KEY
          },
          body: JSON.stringify({ archives: newArchives, updatedAt: Date.now() })
        })
      }

      setArchives(newArchives)
      showToast('已儲存')
    } catch (err) {
      console.error('儲存失敗', err)
      showToast('儲存失敗', 'error')
    } finally {
      setSaving(false)
    }
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // 篩選後的資料
  const filteredArchives = useMemo(() => {
    return archives
      .filter(item => {
        if (filterMember !== 'all' && item.member !== filterMember) return false
        if (filterType !== 'all' && item.type !== filterType) return false
        if (searchText && !item.caption?.toLowerCase().includes(searchText.toLowerCase())) return false
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [archives, filterMember, filterType, searchText])

  // 開啟新增 Modal
  function openAddModal() {
    setEditingItem(null)
    setFormData({
      type: 'post',
      member: '全員',
      date: new Date().toISOString().split('T')[0],
      time: '',
      igUrl: '',
      caption: '',
      media: [],
      notes: '',
    })
    setShowModal(true)
  }

  // 開啟編輯 Modal
  function openEditModal(item) {
    setEditingItem(item)
    setFormData({
      type: item.type,
      member: item.member,
      date: item.date,
      time: item.time || '',
      igUrl: item.igUrl || '',
      caption: item.caption || '',
      media: item.media || [],
      notes: item.notes || '',
    })
    setShowModal(true)
  }

  // 開啟檢視 Modal
  function openViewModal(item) {
    setViewingItem(item)
    setViewingMediaIndex(0)
  }

  // 從檢視切換到編輯
  function switchToEdit() {
    if (viewingItem) {
      openEditModal(viewingItem)
      setViewingItem(null)
    }
  }

  // 處理 IG 連結貼上 - 自動抓取資料
  const [fetching, setFetching] = useState(false)
  const [fetchProgress, setFetchProgress] = useState('')
  const [uploadingCount, setUploadingCount] = useState(0) // 背景上傳中的數量
  const [showManualInput, setShowManualInput] = useState(false) // 手動輸入模式
  const [manualUrls, setManualUrls] = useState('') // 手動輸入的網址

  async function handleIGUrlPaste() {
    if (!formData.igUrl) return

    setFetching(true)
    setFetchProgress('抓取中...')
    try {
      const data = await fetchIGData(formData.igUrl)

      if (data.success && data.media?.length > 0) {
        // 自動填入抓到的資料
        const detectedMember = detectMemberFromUsername(data.owner?.username)
        const postDate = data.date ? data.date.split('T')[0] : formData.date
        const mediaList = data.media || []

        // 先用原始 URL 顯示預覽，標記為 uploading
        const previewMedia = mediaList.map((m, i) => ({
          url: m.url || m.thumbnail,
          type: m.type,
          thumbnail: m.thumbnail || null, // 保存影片縮圖
          uploading: m.type === 'image', // 圖片需要上傳
          thumbnailUploading: m.type === 'video' && m.thumbnail, // 影片縮圖需要上傳
          originalUrl: m.url,
          originalThumbnail: m.thumbnail, // 保存原始縮圖 URL
          index: i,
        }))

        setFormData(prev => ({
          ...prev,
          type: data.type || prev.type,
          member: detectedMember,
          date: postDate,
          caption: data.caption || prev.caption,
          media: previewMedia,
        }))

        setFetching(false)
        setFetchProgress('')
        setShowManualInput(false)
        showToast(`✅ 已抓取 ${mediaList.length} 個媒體，背景上傳中...`)

        // 背景上傳圖片到 ImgBB
        const imagesToUpload = previewMedia.filter(m => m.type === 'image')
        // 影片縮圖也要上傳
        const thumbnailsToUpload = previewMedia.filter(m => m.type === 'video' && m.thumbnail)

        setUploadingCount(imagesToUpload.length + thumbnailsToUpload.length)

        for (const m of imagesToUpload) {
          // 非同步上傳，不等待
          uploadSingleImage(m.originalUrl, m.index)
        }

        // 上傳影片縮圖
        for (const m of thumbnailsToUpload) {
          uploadVideoThumbnail(m.originalThumbnail, m.index)
        }
      } else {
        // 抓取失敗，顯示手動輸入選項
        const postMatch = formData.igUrl.match(/instagram\.com\/p\//)
        const reelMatch = formData.igUrl.match(/instagram\.com\/(?:reel|reels)\//)
        let type = 'post'
        if (reelMatch) type = 'reels'

        setFormData(prev => ({ ...prev, type }))
        setShowManualInput(true)
        showToast('⚠️ 自動抓取失敗，請手動輸入媒體網址', 'info')
        setFetching(false)
        setFetchProgress('')
      }
    } catch (err) {
      console.error('解析失敗', err)
      setShowManualInput(true)
      showToast('⚠️ 抓取失敗，請手動輸入媒體網址', 'error')
      setFetching(false)
      setFetchProgress('')
    }
  }

  // 處理手動輸入的媒體網址
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

    // 判斷媒體類型
    const newMedia = urls.map((url, i) => {
      const isVideo = /\.(mp4|mov|webm|m4v)/i.test(url) || url.includes('video')
      return {
        url,
        type: isVideo ? 'video' : 'image',
        uploading: !isVideo, // 圖片需要上傳到 ImgBB
        originalUrl: url,
        index: formData.media.length + i,
      }
    })

    setFormData(prev => ({
      ...prev,
      media: [...prev.media, ...newMedia]
    }))

    // 背景上傳圖片
    const imagesToUpload = newMedia.filter(m => m.type === 'image')
    setUploadingCount(prev => prev + imagesToUpload.length)

    for (const m of imagesToUpload) {
      uploadSingleImage(m.originalUrl, m.index)
    }

    setManualUrls('')
    setShowManualInput(false)
    showToast(`已新增 ${urls.length} 個媒體`)
  }

  // 單張圖片背景上傳（同時上傳 ImgBB + Cloudinary 備份）
  async function uploadSingleImage(originalUrl, index) {
    try {
      // 同時上傳到 ImgBB 和 Cloudinary
      const [imgbbUrl, cloudinaryUrl] = await Promise.all([
        uploadUrlToImgBB(originalUrl),
        uploadToCloudinary(originalUrl)
      ])

      // 上傳成功，更新該圖片的 URL（主要用 ImgBB，備份用 Cloudinary）
      setFormData(prev => ({
        ...prev,
        media: prev.media.map((m, i) =>
          i === index ? {
            ...m,
            url: imgbbUrl,
            backupUrl: cloudinaryUrl, // Cloudinary 備份 URL
            uploading: false
          } : m
        )
      }))

      if (cloudinaryUrl) {
        console.log(`✅ 圖片 ${index + 1} 雙重備份完成`)
      }
    } catch (err) {
      console.warn(`圖片 ${index + 1} 上傳失敗`, err)
      // 上傳失敗，標記為失敗但保留原始 URL
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

  // 影片縮圖背景上傳（同時上傳 ImgBB + Cloudinary 備份）
  async function uploadVideoThumbnail(originalThumbnailUrl, index) {
    try {
      // 同時上傳到 ImgBB 和 Cloudinary
      const [imgbbUrl, cloudinaryUrl] = await Promise.all([
        uploadUrlToImgBB(originalThumbnailUrl),
        uploadToCloudinary(originalThumbnailUrl)
      ])

      // 上傳成功，更新該影片的縮圖 URL
      setFormData(prev => ({
        ...prev,
        media: prev.media.map((m, i) =>
          i === index ? {
            ...m,
            thumbnail: imgbbUrl,
            thumbnailBackupUrl: cloudinaryUrl, // Cloudinary 備份縮圖
            thumbnailUploading: false
          } : m
        )
      }))

      if (cloudinaryUrl) {
        console.log(`✅ 影片 ${index + 1} 縮圖雙重備份完成`)
      }
    } catch (err) {
      console.warn(`影片 ${index + 1} 縮圖上傳失敗`, err)
      // 上傳失敗，標記但保留原始 URL
      setFormData(prev => ({
        ...prev,
        media: prev.media.map((m, i) =>
          i === index ? { ...m, thumbnailUploading: false, thumbnailFailed: true } : m
        )
      }))
    } finally {
      setUploadingCount(prev => prev - 1)
    }
  }

  // 上傳媒體
  async function handleMediaUpload(e) {
    const files = Array.from(e.target.files)
    if (!files.length) return

    setUploading(true)
    try {
      const newMedia = []
      for (const file of files) {
        const isVideo = file.type.startsWith('video/')
        if (isVideo) {
          // 影片暫時用 base64（之後可改用 Cloudinary）
          const url = URL.createObjectURL(file)
          newMedia.push({ url, type: 'video', localFile: file })
        } else {
          // 圖片上傳到 ImgBB
          const url = await uploadToImgBB(file)
          newMedia.push({ url, type: 'image' })
        }
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
      const confirmSave = confirm('還有圖片正在上傳中，確定要現在儲存嗎？\n（未完成上傳的圖片可能無法正常顯示）')
      if (!confirmSave) return
    }

    const item = {
      id: editingItem?.id || genId(),
      type: formData.type,
      member: formData.member,
      date: formData.date,
      time: formData.time,
      igUrl: formData.igUrl,
      caption: formData.caption,
      media: formData.media.map(m => ({
        url: m.url,
        type: m.type,
        ...(m.backupUrl && { backupUrl: m.backupUrl }), // Cloudinary 備份 URL
        ...(m.thumbnail && { thumbnail: m.thumbnail }), // 影片縮圖
        ...(m.thumbnailBackupUrl && { thumbnailBackupUrl: m.thumbnailBackupUrl }), // 縮圖備份 URL
      })),
      notes: formData.notes,
      createdBy: me,
      createdAt: editingItem?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    let newArchives
    if (editingItem) {
      newArchives = archives.map(a => a.id === editingItem.id ? item : a)
    } else {
      newArchives = [item, ...archives]
    }

    await saveArchives(newArchives)
    setShowModal(false)
  }

  // 刪除
  async function handleDelete(id) {
    if (!confirm('確定要刪除這筆備份嗎？')) return
    const newArchives = archives.filter(a => a.id !== id)
    await saveArchives(newArchives)
  }

  // ===== Render =====

  if (loading) {
    return (
      <div className="social-archive-loading">
        <div className="loading-spinner"></div>
        <p>載入中...</p>
      </div>
    )
  }

  return (
    <div className="social-archive">
      {/* Header */}
      <header className="social-header">
        <button className="back-btn" onClick={onBack}>← 返回時間軸</button>
        <h1>📱 社群備份</h1>
        <button className="add-btn" onClick={openAddModal} title="新增備份">
          <Plus size={20} />
        </button>
      </header>

      {/* Filters */}
      <div className="social-filters">
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

          {/* 類型篩選 */}
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value)}
            className="filter-select"
          >
            <option value="all">所有類型</option>
            {POST_TYPES.map(t => (
              <option key={t.id} value={t.id}>{t.icon} {t.label}</option>
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
      <div className={`social-content ${viewMode}`}>
        {filteredArchives.length === 0 ? (
          <div className="empty-state">
            <Instagram size={48} />
            <p>尚無備份資料</p>
            <button onClick={openAddModal}>新增第一筆</button>
          </div>
        ) : (
          filteredArchives.map(item => (
            <div
              key={item.id}
              className="archive-card"
              onClick={() => openViewModal(item)}
            >
              {/* 縮圖 */}
              <div className="archive-thumb">
                {item.media?.[0] ? (
                  item.media[0].type === 'video' ? (
                    item.media[0].thumbnail ? (
                      // 有縮圖就顯示縮圖
                      <div className="video-thumb-img">
                        <img src={item.media[0].thumbnail} alt="" />
                        <Play size={24} className="play-overlay" />
                      </div>
                    ) : (
                      // 沒縮圖就用影片自動生成
                      <div className="video-thumb-auto">
                        <video src={item.media[0].url} muted preload="metadata" />
                        <Play size={24} className="play-overlay" />
                      </div>
                    )
                  ) : (
                    <img src={item.media[0].url} alt="" />
                  )
                ) : (
                  <div className="no-thumb">
                    <Camera size={24} />
                  </div>
                )}
                {item.media?.length > 1 && (
                  <span className="media-count">+{item.media.length - 1}</span>
                )}
                {/* 類型標籤 */}
                <span
                  className="type-badge"
                  style={{ background: POST_TYPES.find(t => t.id === item.type)?.color }}
                >
                  {POST_TYPES.find(t => t.id === item.type)?.icon}
                </span>
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
              </div>
            </div>
          ))
        )}
      </div>

      {/* View Modal */}
      {viewingItem && (
        <div className="modal-overlay view-modal-overlay" onClick={() => setViewingItem(null)}>
          <div className="view-modal" onClick={e => e.stopPropagation()}>
            {/* 關閉按鈕 */}
            <button className="view-close-btn" onClick={() => setViewingItem(null)}>
              <X size={24} />
            </button>

            {/* 媒體區域 */}
            <div className="view-media-area">
              {viewingItem.media?.length > 0 ? (
                <>
                  {viewingItem.media[viewingMediaIndex]?.type === 'video' ? (
                    <video
                      src={viewingItem.media[viewingMediaIndex].url}
                      controls
                      autoPlay
                      className="view-media"
                    />
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
                <span
                  className="type-badge"
                  style={{ background: POST_TYPES.find(t => t.id === viewingItem.type)?.color }}
                >
                  {POST_TYPES.find(t => t.id === viewingItem.type)?.icon} {POST_TYPES.find(t => t.id === viewingItem.type)?.label}
                </span>
                <span className="view-date">{formatDate(viewingItem.date)}</span>
              </div>

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
                {viewingItem.igUrl && (
                  <a
                    href={viewingItem.igUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="view-link-btn"
                  >
                    <ExternalLink size={16} /> 開啟 IG
                  </a>
                )}
                <button className="view-edit-btn" onClick={switchToEdit}>
                  ✏️ 編輯
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => setShowModal(false)}>
          <div className="social-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? '編輯備份' : '新增備份'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* IG 連結（自動抓取） */}
              <div className="form-group">
                <label><Instagram size={14} /> IG 連結{config.IG_SCRAPER_URL ? '（自動抓取）' : '（選填）'}</label>
                <div className="ig-url-input">
                  <input
                    type="url"
                    placeholder="貼上 Instagram 連結，自動抓取圖片和文字..."
                    value={formData.igUrl}
                    onChange={e => setFormData(prev => ({ ...prev, igUrl: e.target.value }))}
                    onBlur={handleIGUrlPaste}
                    disabled={fetching}
                  />
                  <button onClick={handleIGUrlPaste} title="抓取資料" disabled={fetching}>
                    {fetching ? <span className="fetching-spinner"></span> : <Link2 size={16} />}
                  </button>
                  {fetchProgress && <span className="fetch-progress">{fetchProgress}</span>}
                </div>
              </div>

              {/* 類型 & 成員 */}
              <div className="form-row">
                <div className="form-group">
                  <label>類型</label>
                  <div className="type-selector">
                    {POST_TYPES.map(t => (
                      <button
                        key={t.id}
                        className={formData.type === t.id ? 'active' : ''}
                        style={formData.type === t.id ? { background: t.color } : {}}
                        onClick={() => setFormData(prev => ({ ...prev, type: t.id }))}
                      >
                        {t.icon} {t.label}
                      </button>
                    ))}
                  </div>
                </div>

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
                      {m.type === 'video' ? (
                        m.thumbnail ? (
                          // 有縮圖
                          <div className="video-preview-img">
                            <img src={m.thumbnail} alt="" />
                            <Play size={16} className="play-icon" />
                          </div>
                        ) : (
                          // 沒縮圖，用影片自動生成
                          <div className="video-preview-auto">
                            <video src={m.url} muted preload="metadata" />
                            <Play size={16} className="play-icon" />
                          </div>
                        )
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
                      accept="image/*,video/*"
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

                {/* 手動輸入媒體網址 */}
                {showManualInput && (
                  <div className="manual-url-input">
                    <p className="manual-hint">
                      💡 提示：在 IG 貼文上右鍵「複製圖片網址」，每行貼一個
                    </p>
                    <textarea
                      placeholder="貼上圖片/影片網址，每行一個...&#10;例如：&#10;https://scontent-xxx.cdninstagram.com/...jpg&#10;https://scontent-xxx.cdninstagram.com/...mp4"
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

              {/* 原文內容 */}
              <div className="form-group">
                <label>原文內容</label>
                <textarea
                  placeholder="貼上 IG 原文內容..."
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
    </div>
  )
}
