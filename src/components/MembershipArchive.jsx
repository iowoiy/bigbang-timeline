import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Plus, X, Image, ChevronDown, Trash2, ExternalLink, Calendar, Save, Check, AlertCircle, Link2, Upload, Search, Grid, List, Play, ChevronLeft, ChevronRight, Lock, Download, Menu } from 'lucide-react'
import config from '../config'
import './MembershipArchive.css'

// BIGBANG 成員列表與顏色（不含勝利）
const MEMBERS = [
  { name: '全員', color: '#E5A500' },
  { name: 'G-Dragon', color: '#ed609f' },
  { name: 'T.O.P', color: '#8fc126' },
  { name: '太陽', color: '#d7171e' },
  { name: '大聲', color: '#f4e727' },
]

// 成員名稱別名對應（篩選用）
const MEMBER_ALIASES = {
  '大聲': ['Daesung'],
  '太陽': ['Taeyang'],
}

function getMemberColor(name) {
  const alias = Object.entries(MEMBER_ALIASES).find(([, v]) => v.includes(name))
  if (alias) return MEMBERS.find(m => m.name === alias[0])?.color || '#E5A500'
  return MEMBERS.find(m => m.name === name)?.color || '#E5A500'
}

function genId() {
  return 'mb-' + Date.now()
}

// 卡片縮圖：優先用 Cloudinary 縮圖（壓縮 + WebP），fallback 用原圖
// 主圖源：Cloudinary，ImgBB 為備份
function getThumbUrl(media) {
  if (media.backupUrl?.includes('cloudinary.com/')) {
    return media.backupUrl.replace('/upload/', '/upload/w_400,q_auto,f_auto/')
  }
  return media.backupUrl || media.url
}

function getViewUrl(media) {
  if (media.backupUrl?.includes('cloudinary.com/')) {
    return media.backupUrl.replace('/upload/', '/upload/w_1080,q_auto,f_auto/')
  }
  return media.backupUrl || media.url
}

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

function formatDateTime(dateStr, timeStr) {
  const datePart = formatDate(dateStr)
  if (!datePart) return ''
  if (!timeStr) return datePart
  return `${datePart} ${timeStr}`
}

// b.stage 站台設定
const BSTAGE_SITES = {
  gdragon: {
    label: 'G-Dragon (gdragon.ai)',
    domain: 'gdragon.ai',
    authorIds: '67a5e27bc8affa6b2c4b893b%2C677e145d5dba936413e31764',
    defaultMember: 'G-Dragon',
    authorMap: {
      '67a5e27bc8affa6b2c4b893b': 'G-Dragon',
      '677e145d5dba936413e31764': 'G-Dragon',
    },
  },
  daesung: {
    label: 'Daesung (daesung.bstage.in)',
    domain: 'daesung.bstage.in',
    authorIds: '64cb4a2654046402f5bde521',
    defaultMember: '大聲',
    authorMap: {
      '64cb4a2654046402f5bde521': '大聲',
    },
  },
  taeyang: {
    label: 'Taeyang (taeyang.bstage.in)',
    domain: 'taeyang.bstage.in',
    authorIds: '67361d0527162e668b09c620',
    defaultMember: '太陽',
    authorMap: {
      '67361d0527162e668b09c620': '太陽',
    },
  },
}

// 取得會員備份用的 ImgBB API Key
const MEMBERSHIP_IMGBB_KEY = config.MEMBERSHIP_IMGBB_API_KEY || config.IMGBB_API_KEY

// 上傳圖片到 ImgBB（會員備份專用）
async function uploadToImgBB(file) {
  const formData = new FormData()
  formData.append('image', file)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${MEMBERSHIP_IMGBB_KEY}`, {
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
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${MEMBERSHIP_IMGBB_KEY}`, {
    method: 'POST',
    body: formData
  })
  const data = await res.json()
  if (data.success) {
    return data.data.url
  }
  throw new Error('上傳失敗')
}

// 上傳圖片到 Cloudinary 作為備份（會員備份專用帳號）
async function uploadToCloudinary(imageUrl) {
  const cloudName = config.MEMBERSHIP_CLOUDINARY_CLOUD_NAME || config.CLOUDINARY_CLOUD_NAME
  const preset = config.MEMBERSHIP_CLOUDINARY_PRESET || config.CLOUDINARY_UPLOAD_PRESET
  if (!cloudName || !preset) {
    console.warn('Cloudinary 未設定，跳過備份')
    return null
  }

  try {
    const formData = new FormData()
    formData.append('file', imageUrl)
    formData.append('upload_preset', preset)

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
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

// 判斷是否為 YouTube 連結
function isYouTubeUrl(url) {
  if (!url) return false
  return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/i.test(url)
}

// 取得 YouTube 影片 ID
function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

// 取得 YouTube 縮圖
function getYouTubeThumbnail(url) {
  const id = getYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

function MembershipArchive({ isAdmin, onBack, currentPage, setCurrentPage }) {
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)
  const [navMenuOpen, setNavMenuOpen] = useState(false)

  // 篩選
  const [filterMember, setFilterMember] = useState('all')
  const [filterType, setFilterType] = useState('all') // all | video | paid
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('grid') // grid | list

  // 新增/編輯 Modal
  const [showModal, setShowModal] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [formData, setFormData] = useState({
    member: '全員',
    date: new Date().toISOString().split('T')[0],
    time: '',
    caption: '',
    media: [], // { url, type: 'image' | 'youtube', backupUrl?, thumbnail? }
    sourceUrl: '',
    notes: '',
  })
  const [uploading, setUploading] = useState(false)

  // 檢視貼文
  const [viewingItem, setViewingItem] = useState(null)
  const [viewingMediaIndex, setViewingMediaIndex] = useState(0)

  // 確認 Modal
  const [confirmModal, setConfirmModal] = useState(null)

  // 無限滾動
  // 虛擬化列表
  const scrollRef = useRef(null)
  const [columns, setColumns] = useState(3)

  // 手動輸入模式
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualUrls, setManualUrls] = useState('')
  const [uploadingCount, setUploadingCount] = useState(0)

  // b.stage 匯入
  const [showImportModal, setShowImportModal] = useState(false)
  const [bstageToken, setBstageToken] = useState('')
  const [importSite, setImportSite] = useState('gdragon')
  const [importPhase, setImportPhase] = useState(null) // null | 'fetching' | 'processing' | 'done'
  const [importFetchProgress, setImportFetchProgress] = useState({ page: 0, totalItems: 0 })
  const [importProcessProgress, setImportProcessProgress] = useState({ current: 0, total: 0, skipped: 0, success: 0, failed: 0 })
  const [importLog, setImportLog] = useState([])
  const [forceUpdate, setForceUpdate] = useState(false)
  const importCancelRef = useRef(false)

  // 載入資料
  useEffect(() => {
    loadArchives()
  }, [])

  async function loadArchives() {
    setLoading(true)
    try {
      const res = await fetch(`${config.API_URL}/membership`)
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

  // 建立新的會員備份
  async function createArchive(item) {
    const res = await fetch(`${config.API_URL}/membership`, {
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

  // 更新會員備份
  async function updateArchive(item) {
    const res = await fetch(`${config.API_URL}/membership/${item.id}`, {
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

  // 刪除會員備份
  async function deleteArchiveById(id) {
    const res = await fetch(`${config.API_URL}/membership/${id}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': config.API_KEY }
    })
    if (!res.ok) throw new Error('刪除失敗')
    return res.json()
  }

  // ===== b.stage 匯入功能 =====

  function addImportLog(msg, type = 'info') {
    setImportLog(prev => [...prev, { msg, type, ts: Date.now() }])
  }

  // Phase 1：快速抓取所有分頁
  async function fetchAllBstagePages(token, siteKey) {
    const site = BSTAGE_SITES[siteKey]
    const allItems = []
    let page = 1
    const pageSize = 24
    let isLast = false

    while (!isLast) {
      if (importCancelRef.current) break

      const url = `https://${site.domain}/svc/home/api/v1/home/star/feeds?authorIds=${site.authorIds}&page=${page}&pageSize=${pageSize}`

      const res = await fetch(url, {
        headers: { 'authorization': `Bearer ${token}` }
      })

      if (!res.ok) {
        if (res.status === 401) throw new Error('Token 已過期，請重新登入 b.stage 取得新的 Token')
        throw new Error(`API 錯誤: ${res.status}`)
      }

      const data = await res.json()

      if (data?.items?.length > 0) {
        allItems.push(...data.items)
      }

      isLast = data?.isLast ?? true
      page++

      setImportFetchProgress({ page: page - 1, totalItems: allItems.length })
      addImportLog(`第 ${page - 1} 頁：已抓取 ${allItems.length} 筆`, 'info')
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    return allItems
  }

  // 轉換單筆 b.stage 資料
  // 顯示時自動去除重複段落（修正舊資料 caption 重複問題）
  function dedupCaption(caption) {
    if (!caption) return caption
    const parts = caption.split('\n\n')
    if (parts.length === 2 && parts[0].trim() === parts[1].trim()) {
      return parts[0].trim()
    }
    return caption
  }

  function transformBstageItem(item, siteKey) {
    const site = BSTAGE_SITES[siteKey]
    const publishedDate = new Date(item.publishedAt || item.createdAt)
    const dateStr = publishedDate.toISOString().split('T')[0]
    const timeStr = publishedDate.toTimeString().slice(0, 5)

    // 提取圖片 URL
    const images = []
    if (item.images && item.images.length > 0) {
      for (const img of item.images) {
        const imgUrl = typeof img === 'string' ? img : (img.url || img.path || img.source)
        if (imgUrl) images.push({ originalUrl: imgUrl, type: 'image' })
      }
    } else if (item.mainImage) {
      const mainUrl = typeof item.mainImage === 'string' ? item.mainImage : (item.mainImage.url || item.mainImage.path)
      if (mainUrl) images.push({ originalUrl: mainUrl, type: 'image' })
    }

    // 影片：提取縮圖
    let videoNote = ''
    if (item.video) {
      const thumbPaths = item.video.thumbnailPaths || []
      for (const tp of thumbPaths) {
        const thumbUrl = typeof tp === 'string' ? tp : (tp.url || tp.path)
        if (thumbUrl) {
          images.unshift({ originalUrl: thumbUrl, type: 'image' })
          break
        }
      }
      const hlsPath = item.video.hlsPath?.path || item.video.dashPath?.path || ''
      if (hlsPath) videoNote = `[影片] ${hlsPath}`
    }

    const member = site.authorMap[item.author?.id] || site.defaultMember
    // 去重：title 和 description 常常相同或包含關係
    let caption = ''
    const t = (item.title || '').trim()
    const d = (item.description || '').trim()
    if (t && d) {
      caption = t === d ? t : (d.includes(t) ? d : `${t}\n\n${d}`)
    } else {
      caption = t || d
    }

    return {
      id: `mb-bstage-${item.id}`,
      member,
      date: dateStr,
      time: timeStr,
      caption: caption || '',
      images,
      sourceUrl: `https://${site.domain}/story/feed/${item.typeId || item.id}`,
      notes: videoNote,
      bstageId: item.id,
      paid: item.paid || false,
    }
  }

  // Phase 2：逐筆處理（去重、上傳、存 D1）
  async function processImportItems(items) {
    setImportPhase('processing')
    setImportProcessProgress({ current: 0, total: items.length, skipped: 0, success: 0, failed: 0 })

    // 從 API 重新載入最新資料來建去重集合（避免 state 過期導致重複 INSERT）
    let latestArchives = archives
    try {
      const res = await fetch(`${config.API_URL}/membership`)
      if (res.ok) {
        latestArchives = await res.json()
        setArchives(latestArchives)
      }
    } catch (e) {
      console.warn('重新載入資料失敗，使用現有 state 去重', e)
    }
    const existingIds = new Set(latestArchives.map(a => a.id))
    const existingSourceUrls = new Set(latestArchives.map(a => a.sourceUrl).filter(Boolean))

    for (let i = 0; i < items.length; i++) {
      if (importCancelRef.current) break

      const item = items[i]

      // 已存在的貼文
      if (existingIds.has(item.id) || existingSourceUrls.has(item.sourceUrl)) {
        if (forceUpdate) {
          // 強制更新：不重傳圖片，更新 caption / date / time
          const matchId = existingIds.has(item.id) ? item.id : null
          const existing = latestArchives.find(a => a.id === matchId || a.sourceUrl === item.sourceUrl)
          if (existing) {
            const newCaption = dedupCaption(item.caption)
            const updated = { ...existing, caption: newCaption, date: item.date, time: item.time, updatedAt: Date.now() }
            await updateArchive(updated).catch(err => console.warn('更新失敗:', err))
            setArchives(prev => prev.map(a => a.id === updated.id ? updated : a))
            addImportLog(`🔄 已更新: ${item.date} ${newCaption?.slice(0, 30) || '(無文字)'}`, 'info')
          }
        } else {
          addImportLog(`⏭ 跳過（已存在）: ${item.date} ${item.caption?.slice(0, 30) || '(無文字)'}`, 'info')
        }
        setImportProcessProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          skipped: prev.skipped + 1
        }))
        continue
      }

      try {
        // 上傳圖片（ImgBB + Cloudinary 雙備份）
        const uploadedMedia = []
        for (const img of item.images) {
          try {
            const [imgbbUrl, cloudinaryUrl] = await Promise.all([
              uploadUrlToImgBB(img.originalUrl),
              uploadToCloudinary(img.originalUrl)
            ])
            uploadedMedia.push({
              url: imgbbUrl,
              type: img.type,
              ...(cloudinaryUrl && { backupUrl: cloudinaryUrl }),
            })
          } catch (uploadErr) {
            console.warn('圖片上傳失敗，使用原始 URL:', uploadErr)
            uploadedMedia.push({ url: img.originalUrl, type: img.type })
            addImportLog(`⚠ 圖片備份失敗，使用原始連結`, 'warn')
          }
        }

        // 建立記錄並存 D1
        const record = {
          id: item.id,
          member: item.member,
          date: item.date,
          time: item.time,
          caption: item.caption,
          media: uploadedMedia,
          sourceUrl: item.sourceUrl,
          notes: item.notes,
          paid: item.paid || false,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        const result = await createArchive(record)
        if (result.skipped) {
          setImportProcessProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            skipped: prev.skipped + 1
          }))
          addImportLog(`⏭ 跳過（D1 已存在）: ${item.date} ${item.caption?.slice(0, 30) || '(無文字)'}`, 'info')
        } else {
          setArchives(prev => [record, ...prev])
          existingIds.add(item.id)
          existingSourceUrls.add(item.sourceUrl)
          setImportProcessProgress(prev => ({
            ...prev,
            current: prev.current + 1,
            success: prev.success + 1
          }))
          addImportLog(`✅ ${item.date} ${item.caption?.slice(0, 40) || '(無文字)'}`, 'success')
        }

      } catch (err) {
        console.error(`匯入失敗: ${item.id}`, err)
        setImportProcessProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          failed: prev.failed + 1
        }))
        addImportLog(`❌ 失敗: ${item.date} - ${err.message}`, 'error')
      }

      await new Promise(resolve => setTimeout(resolve, 50))
    }
  }

  // 主流程
  async function handleStartImport() {
    if (!bstageToken.trim()) {
      showToast('請輸入 b.stage Token', 'error')
      return
    }

    // 自動去掉 Bearer 前綴
    let token = bstageToken.trim()
    if (token.toLowerCase().startsWith('bearer ')) {
      token = token.slice(7)
    }

    const siteKey = importSite
    const siteName = BSTAGE_SITES[siteKey].label

    importCancelRef.current = false
    setImportLog([])
    setImportPhase('fetching')
    setImportFetchProgress({ page: 0, totalItems: 0 })
    addImportLog(`開始從 ${siteName} 抓取資料...`, 'info')

    try {
      // Phase 1
      const rawItems = await fetchAllBstagePages(token, siteKey)

      if (importCancelRef.current) {
        setImportPhase('done')
        addImportLog('已取消匯入', 'warn')
        return
      }

      addImportLog(`✅ 抓取完成：共 ${rawItems.length} 筆貼文`, 'success')

      // 轉換
      const transformed = rawItems.map(item => transformBstageItem(item, siteKey))

      // Phase 2
      await processImportItems(transformed)

      if (importCancelRef.current) {
        addImportLog('已取消匯入', 'warn')
      } else {
        addImportLog('🎉 匯入完成！', 'success')
      }

    } catch (err) {
      addImportLog(`❌ 錯誤: ${err.message}`, 'error')
      showToast(err.message, 'error')
    } finally {
      setImportPhase('done')
    }
  }

  function handleCancelImport() {
    importCancelRef.current = true
    addImportLog('正在取消...', 'warn')
  }

  function showToast(msg, type = 'success') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // 顯示確認 Modal（Promise-based）
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
        if (filterMember !== 'all' && item.member !== filterMember && !MEMBER_ALIASES[filterMember]?.includes(item.member)) return false
        if (filterType === 'video' && !item.notes?.includes('[影片]')) return false
        if (filterType === 'paid' && !item.paid) return false
        if (searchText && !item.caption?.toLowerCase().includes(searchText.toLowerCase())) return false
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [archives, filterMember, filterType, searchText])

  // 測量容器寬度，計算每行幾列
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      const w = el.clientWidth - 32
      setColumns(viewMode === 'grid' ? Math.max(2, Math.floor(w / 276)) : 1) // 至少 2 欄
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [viewMode])

  // 虛擬化行數
  const rowCount = useMemo(() => Math.ceil(filteredArchives.length / columns), [filteredArchives.length, columns])

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => viewMode === 'grid' ? 340 : 120,
    overscan: 3,
  })

  // 開啟新增 Modal
  function openAddModal() {
    setEditingItem(null)
    setFormData({
      member: '全員',
      date: new Date().toISOString().split('T')[0],
      time: '',
      caption: '',
      media: [],
      sourceUrl: '',
      notes: '',
      paid: false,
    })
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
      sourceUrl: item.sourceUrl || '',
      notes: item.notes || '',
      paid: item.paid || false,
    })
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

    const newMedia = urls.map((url, i) => {
      if (isYouTubeUrl(url)) {
        return {
          url,
          type: 'youtube',
          thumbnail: getYouTubeThumbnail(url),
          index: formData.media.length + i,
        }
      }
      return {
        url,
        type: 'image',
        uploading: true,
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
        // 圖片上傳到 ImgBB
        const [imgbbUrl, cloudinaryUrl] = await Promise.all([
          uploadToImgBB(file),
          uploadToCloudinary(URL.createObjectURL(file))
        ])
        newMedia.push({
          url: imgbbUrl,
          type: 'image',
          ...(cloudinaryUrl && { backupUrl: cloudinaryUrl }),
        })
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

  // 新增 YouTube 連結
  const [youtubeInput, setYoutubeInput] = useState('')

  function handleAddYoutube() {
    if (!youtubeInput.trim()) return
    if (!isYouTubeUrl(youtubeInput)) {
      showToast('請輸入有效的 YouTube 連結', 'error')
      return
    }
    const thumbnail = getYouTubeThumbnail(youtubeInput)
    setFormData(prev => ({
      ...prev,
      media: [...prev.media, {
        url: youtubeInput.trim(),
        type: 'youtube',
        thumbnail,
      }]
    }))
    setYoutubeInput('')
    showToast('已新增 YouTube 影片')
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
      sourceUrl: formData.sourceUrl,
      notes: formData.notes,
      paid: formData.paid || false,
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

  // ===== Render =====

  if (loading) {
    return (
      <div className="membership-loading">
        <div className="loading-spinner"></div>
        <p>載入中...</p>
      </div>
    )
  }

  return (
    <div className="membership-archive">
      {/* Header */}
      <header className="membership-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1>🔒 會員備份</h1>
        </div>
        <div className="header-actions">
          {isAdmin && (
            <button className="membership-import-btn" onClick={() => setShowImportModal(true)} title="從 b.stage 匯入">
              <Download size={18} />
            </button>
          )}
          <button className="add-btn" onClick={openAddModal} title="新增備份">
            <Plus size={20} />
          </button>
          {setCurrentPage && (
            <div className="nav-menu-wrapper">
              <button onClick={() => setNavMenuOpen(!navMenuOpen)} className="hamburger-btn" title="選單">
                <Menu size={18} />
              </button>
              {navMenuOpen && (
                <>
                  <div className="nav-menu-overlay" onClick={() => setNavMenuOpen(false)} />
                  <div className="nav-menu">
                    <button className={`nav-menu-item ${currentPage === 'timeline' ? 'active' : ''}`} onClick={() => { setCurrentPage('timeline'); setNavMenuOpen(false) }}>
                      <span>📅</span> 時間軸
                    </button>
                    <button className={`nav-menu-item ${currentPage === 'social' ? 'active' : ''}`} onClick={() => { setCurrentPage('social'); setNavMenuOpen(false) }}>
                      <span>📷</span> 社群備份
                    </button>
                    <button className={`nav-menu-item ${currentPage === 'membership' ? 'active' : ''}`} onClick={() => { setCurrentPage('membership'); setNavMenuOpen(false) }}>
                      <span>🔒</span> 會員備份
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="membership-filters">
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
            <option value="video">🎬 含影片</option>
            <option value="paid">🔒 會員限定</option>
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
      <div ref={scrollRef} className="membership-content-scroll">
        {filteredArchives.length === 0 ? (
          <div className="empty-state">
            <Lock size={48} />
            <p>尚無會員備份資料</p>
            <button onClick={openAddModal}>新增第一筆</button>
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: 'relative' }}>
            {virtualizer.getVirtualItems().map(vRow => {
              const startIdx = vRow.index * columns
              const rowItems = filteredArchives.slice(startIdx, startIdx + columns)
              return (
                <div
                  key={vRow.key}
                  className={`membership-content ${viewMode}`}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vRow.start}px)`,
                    ...(viewMode === 'grid' ? { gridTemplateColumns: `repeat(${columns}, 1fr)` } : {}),
                  }}
                  ref={virtualizer.measureElement}
                  data-index={vRow.index}
                >
                  {rowItems.map(item => (
                    <div
                      key={item.id}
                      className="archive-card"
                      onClick={() => openViewModal(item)}
                    >
                      <div className="archive-thumb">
                        {item.media?.[0] ? (
                          item.media[0].type === 'youtube' ? (
                            <div className="video-thumb-img">
                              <img src={item.media[0].thumbnail || getYouTubeThumbnail(item.media[0].url)} alt="" loading="lazy" width={260} height={260} />
                              <Play size={24} className="play-overlay" />
                            </div>
                          ) : (
                            <img src={getThumbUrl(item.media[0])} alt="" loading="lazy" width={260} height={260} />
                          )
                        ) : (
                          <div className="no-thumb">
                            <img src={`${import.meta.env.BASE_URL}bigbang-default.png`} alt="BIGBANG" />
                          </div>
                        )}
                        {item.media?.length > 1 && (
                          <span className="media-count">+{item.media.length - 1}</span>
                        )}
                      </div>

                      <div className="archive-info">
                        <div className="archive-meta">
                          <span
                            className="member-tag"
                            style={{ background: getMemberColor(item.member) + '30', color: getMemberColor(item.member) }}
                          >
                            {item.member}
                          </span>
                          {item.paid && <span className="paid-badge">🔒 會員</span>}
                          <span className="date">{formatDateTime(item.date, item.time)}</span>
                        </div>
                        {item.caption && (
                          <p className="archive-caption">{dedupCaption(item.caption)}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )
            })}
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
                    <iframe
                      src={`https://www.youtube.com/embed/${getYouTubeId(viewingItem.media[viewingMediaIndex].url)}?autoplay=1`}
                      allow="autoplay; encrypted-media"
                      allowFullScreen
                      className="view-media view-youtube"
                    />
                  ) : (
                    <img
                      key={`${viewingItem.id}-${viewingMediaIndex}`}
                      src={getViewUrl(viewingItem.media[viewingMediaIndex])}
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
                  <img src={`${import.meta.env.BASE_URL}bigbang-default.png`} alt="BIGBANG" className="no-media-img" />
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
                {viewingItem.paid && <span className="paid-badge">🔒 會員限定</span>}
                <span className="view-date">{formatDateTime(viewingItem.date, viewingItem.time)}</span>
              </div>

              {viewingItem.caption && (
                <div className="view-caption">
                  <p>{dedupCaption(viewingItem.caption)}</p>
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
                    <ExternalLink size={16} /> 開啟原文
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
          <div className="membership-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editingItem ? '編輯備份' : '新增備份'}</h2>
              <button className="close-btn" onClick={() => setShowModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* 成員 & 日期 */}
              <div className="form-row">
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

              {/* 原始連結 */}
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
                  <Image size={14} /> 圖片 / YouTube 影片
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
                      <span className="uploading-text">上傳中...</span>
                    ) : (
                      <>
                        <Upload size={20} />
                        <span>上傳圖片</span>
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
                <div className="youtube-input-row">
                  <input
                    type="url"
                    placeholder="貼上 YouTube 連結..."
                    value={youtubeInput}
                    onChange={e => setYoutubeInput(e.target.value)}
                  />
                  <button onClick={handleAddYoutube} title="新增 YouTube 影片">
                    <Play size={16} /> 新增影片
                  </button>
                </div>

                {/* 手動輸入媒體網址 */}
                {showManualInput && (
                  <div className="manual-url-input">
                    <p className="manual-hint">
                      💡 提示：每行貼一個圖片網址，支援圖片和 YouTube 連結
                    </p>
                    <textarea
                      placeholder="貼上圖片/YouTube 網址，每行一個..."
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
                <label>貼文內容</label>
                <textarea
                  placeholder="貼上 b.stage 貼文內容..."
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

              {/* 會員限定 */}
              <div className="form-group paid-checkbox-group">
                <label className="paid-checkbox-label">
                  <input
                    type="checkbox"
                    checked={formData.paid || false}
                    onChange={e => setFormData(prev => ({ ...prev, paid: e.target.checked }))}
                  />
                  <span>🔒 會員限定內容</span>
                </label>
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

      {/* b.stage 匯入 Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => { if (!importPhase || importPhase === 'done') { setShowImportModal(false); setImportPhase(null); setBstageToken(''); setImportLog([]) } }}>
          <div className="membership-modal import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Download size={18} /> 從 b.stage 匯入</h2>
              <button className="close-btn" onClick={() => {
                if (importPhase && importPhase !== 'done') {
                  handleCancelImport()
                } else {
                  setShowImportModal(false)
                  setImportPhase(null)
                  setBstageToken('')
                  setImportLog([])
                }
              }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {/* 站台選擇 + Token 輸入 */}
              {!importPhase && (
                <>
                  <div className="form-group">
                    <label>選擇站台</label>
                    <select
                      className="import-site-select"
                      value={importSite}
                      onChange={e => setImportSite(e.target.value)}
                    >
                      {Object.entries(BSTAGE_SITES).map(([key, site]) => (
                        <option key={key} value={key}>{site.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label>Bearer Token</label>
                    <textarea
                      className="import-token-input"
                      placeholder="從 b.stage 開發者工具複製 Bearer token..."
                      value={bstageToken}
                      onChange={e => setBstageToken(e.target.value)}
                      rows={3}
                    />
                    <p className="import-hint">
                      在 {BSTAGE_SITES[importSite].domain} 登入 → F12 開發者工具 → Network →
                      找任意 API 請求 → 複製 authorization header 的值
                      <br />⚠️ Token 約 30 分鐘過期，每個站台需使用各自的 Token
                    </p>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={forceUpdate}
                        onChange={e => setForceUpdate(e.target.checked)}
                      />
                      強制更新已存在的貼文（不重傳圖片，僅更新文字/日期）
                    </label>
                  </div>
                </>
              )}

              {/* Phase 1 進度 */}
              {importPhase === 'fetching' && (
                <div className="import-progress-section">
                  <h3>🔄 抓取 b.stage 資料中...</h3>
                  <p className="import-progress-text">
                    第 {importFetchProgress.page} 頁，已抓取 {importFetchProgress.totalItems} 筆
                  </p>
                  <div className="import-progress-bar">
                    <div className="import-progress-bar-fill fetching" />
                  </div>
                </div>
              )}

              {/* Phase 2 進度 */}
              {(importPhase === 'processing' || importPhase === 'done') && (
                <div className="import-progress-section">
                  <h3>{importPhase === 'done' ? '✅ 匯入完成' : '📦 處理中...'}</h3>
                  <div className="import-stats">
                    <span className="import-stat success">✅ {importProcessProgress.success}</span>
                    <span className="import-stat skipped">⏭ {importProcessProgress.skipped}</span>
                    <span className="import-stat failed">❌ {importProcessProgress.failed}</span>
                  </div>
                  {importProcessProgress.total > 0 && (
                    <>
                      <div className="import-progress-bar">
                        <div
                          className="import-progress-bar-fill"
                          style={{ width: `${(importProcessProgress.current / importProcessProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="import-progress-text">
                        {importProcessProgress.current} / {importProcessProgress.total}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Log */}
              {importLog.length > 0 && (
                <div className="import-log">
                  {importLog.map((log, i) => (
                    <div key={i} className={`import-log-line import-log-${log.type}`}>{log.msg}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!importPhase && (
                <>
                  <button className="cancel-btn" onClick={() => { setShowImportModal(false); setBstageToken('') }}>
                    取消
                  </button>
                  <button className="save-btn" onClick={handleStartImport} disabled={!bstageToken.trim()}>
                    <Download size={16} /> 開始匯入
                  </button>
                </>
              )}
              {importPhase && importPhase !== 'done' && (
                <button className="cancel-btn" onClick={handleCancelImport}>
                  取消匯入
                </button>
              )}
              {importPhase === 'done' && (
                <button className="save-btn" onClick={() => {
                  setShowImportModal(false)
                  setImportPhase(null)
                  setBstageToken('')
                  setImportLog([])
                  setImportSite('gdragon')
                }}>
                  關閉
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default memo(MembershipArchive)
