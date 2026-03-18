import { useState, useEffect, useMemo, useRef, memo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Plus, X, Image, ChevronDown, Trash2, ExternalLink, Calendar, Save, Check, AlertCircle, Link2, Upload, Search, Grid, List, Play, ChevronLeft, ChevronRight, Lock, Download } from 'lucide-react'
import NavMenu from './NavMenu'
import { MEMBERS_NO_VICTORY as MEMBERS, MEMBER_ALIASES, getMemberColor, genId } from '../utils/members'
import MemberFilterDropdown from './MemberFilterDropdown'
import { getThumbUrl, getViewUrl, isYouTubeUrl, getYouTubeId, getYouTubeThumbnail } from '../utils/media'
import { formatDate, formatDateTime } from '../utils/date'
import { uploadToImgBB, uploadToCloudinary } from '../utils/upload'
import { membershipApi } from '../utils/api'
import './ArchiveBase.css'
import './MembershipArchive.css'

// HLS 影片播放元件（支援 .m3u8，動態載入 hls.js）
function HlsVideo({ src, className }) {
  const videoRef = useRef(null)

  useEffect(() => {
    const video = videoRef.current
    if (!video || !src) return

    // Safari 原生支援 HLS
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src
      return
    }

    // Chrome/Firefox：動態載入 hls.js
    let hls = null
    import('hls.js').then(({ default: Hls }) => {
      if (!Hls.isSupported()) { video.src = src; return }
      hls = new Hls()
      hls.loadSource(src)
      hls.attachMedia(video)
    }).catch(() => { video.src = src })

    return () => { if (hls) hls.destroy() }
  }, [src])

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      className={className}
    />
  )
}

// b.stage 站台設定
const BSTAGE_SITES = {
  gdragon: {
    label: 'G-Dragon (gdragon.ai)',
    domain: 'gdragon.ai',
    mediaPrefix: 'gd',
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
    mediaPrefix: 'daesung',
    authorIds: '64cb4a2654046402f5bde521',
    defaultMember: '大聲',
    authorMap: {
      '64cb4a2654046402f5bde521': '大聲',
    },
  },
  taeyang: {
    label: 'Taeyang (taeyang.bstage.in)',
    domain: 'taeyang.bstage.in',
    mediaPrefix: 'taeyang',
    authorIds: '67361d0527162e668b09c620',
    defaultMember: '太陽',
    authorMap: {
      '67361d0527162e668b09c620': '太陽',
    },
  },
}

function MembershipArchive({ isAdmin, onBack, currentPage, setCurrentPage }) {
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // 篩選
  const [filterMembers, setFilterMembers] = useState([]) // 多選成員
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
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
  const [columns, setColumns] = useState(() => window.innerWidth < 500 ? 2 : Math.max(2, Math.floor(Math.min(900, window.innerWidth) / 280)))

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
  const [videoOnly, setVideoOnly] = useState(false)
  const importCancelRef = useRef(false)

  // TOPSX 匯入
  const [showTopsxModal, setShowTopsxModal] = useState(false)
  const [topsxJson, setTopsxJson] = useState('')
  const [topsxPhase, setTopsxPhase] = useState(null) // null | 'processing' | 'done'
  const [topsxProgress, setTopsxProgress] = useState({ current: 0, total: 0, skipped: 0, success: 0, failed: 0 })
  const [topsxLog, setTopsxLog] = useState([])
  const topsxCancelRef = useRef(false)

  // 載入資料
  useEffect(() => {
    loadArchives()
  }, [])

  async function loadArchives() {
    setLoading(true)
    try {
      const data = await membershipApi.load()
      setArchives(data)
    } catch (err) {
      console.error('載入失敗', err)
      showToast('載入失敗', 'error')
    } finally {
      setLoading(false)
    }
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

    // 影片：縮圖放第一個，影片 URL 放第二個
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
      // 組合完整影片 URL：https://media.static.bstage.in/{mediaPrefix}/media/{videoId}/hls/ori.m3u8
      const videoId = item.video.id || item.video._id || ''
      if (videoId) {
        const videoUrl = `https://media.static.bstage.in/${site.mediaPrefix}/media/${videoId}/hls/ori.m3u8`
        images.push({ originalUrl: videoUrl, type: 'video' })
        videoNote = `[影片] ${videoUrl}`
      } else {
        const hlsPath = item.video.hlsPath?.path || item.video.dashPath?.path || ''
        if (hlsPath) {
          let videoUrl = hlsPath
          if (!hlsPath.startsWith('http')) {
            // hlsPath 可能是 /media/{id}/hls/ori.m3u8 或 media/{id}/hls/ori.m3u8
            const cleanPath = hlsPath.startsWith('/') ? hlsPath.slice(1) : hlsPath
            videoUrl = `https://media.static.bstage.in/${site.mediaPrefix}/${cleanPath}`
          }
          images.push({ originalUrl: videoUrl, type: 'video' })
          videoNote = `[影片] ${videoUrl}`
        }
      }
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
      latestArchives = await membershipApi.load()
      setArchives(latestArchives)
    } catch (e) {
      console.warn('重新載入資料失敗，使用現有 state 去重', e)
    }
    const existingIds = new Set(latestArchives.map(a => a.id))
    const existingSourceUrls = new Set(latestArchives.map(a => a.sourceUrl).filter(Boolean))

    for (let i = 0; i < items.length; i++) {
      if (importCancelRef.current) break

      const item = items[i]
      const hasVideo = item.images?.some(img => img.type === 'video')

      // 「只更新影片」模式：跳過沒有影片的貼文
      if (videoOnly && !hasVideo) {
        setImportProcessProgress(prev => ({
          ...prev,
          current: prev.current + 1,
          skipped: prev.skipped + 1
        }))
        addImportLog(`⏭ 跳過（非影片）: ${item.date} ${item.caption?.slice(0, 30) || '(無文字)'}`, 'info')
        continue
      }

      // 已存在的貼文
      if (existingIds.has(item.id) || existingSourceUrls.has(item.sourceUrl)) {
        if (forceUpdate || videoOnly) {
          // 強制更新：更新 caption / date / time + 影片資訊
          const matchId = existingIds.has(item.id) ? item.id : null
          const existing = latestArchives.find(a => a.id === matchId || a.sourceUrl === item.sourceUrl)
          if (existing) {
            const newCaption = dedupCaption(item.caption)
            const updateData = { ...existing, caption: newCaption, date: item.date, time: item.time, updatedAt: Date.now() }
            // videoOnly 模式：同時更新影片和備註
            if (videoOnly && hasVideo) {
              // 保留原有圖片，加入/更新影片資源
              const existingImages = (existing.media || []).filter(m => m.type !== 'video')
              const newVideos = item.images.filter(img => img.type === 'video').map(img => ({ url: img.originalUrl, type: 'video' }))
              updateData.media = [...existingImages, ...newVideos]
              updateData.notes = item.notes || existing.notes
            }
            await membershipApi.update(updateData).catch(err => console.warn('更新失敗:', err))
            setArchives(prev => prev.map(a => a.id === updateData.id ? updateData : a))
            addImportLog(`🔄 已更新${hasVideo ? '（含影片）' : ''}: ${item.date} ${newCaption?.slice(0, 30) || '(無文字)'}`, 'info')
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
        // 上傳圖片（Cloudinary 主要 + ImgBB 備用），影片保留原始 URL
        const uploadedMedia = []
        for (const img of item.images) {
          // 影片不上傳圖床，直接保留原始 URL
          if (img.type === 'video') {
            uploadedMedia.push({ url: img.originalUrl, type: 'video' })
            continue
          }
          try {
            const mbOpts = { context: 'membership' }
            const [cloudinaryUrl, imgbbUrl] = await Promise.all([
              uploadToCloudinary(img.originalUrl, mbOpts),
              uploadToImgBB(img.originalUrl, mbOpts).catch(err => {
                console.warn('ImgBB 備份失敗:', err.message)
                return null
              })
            ])
            uploadedMedia.push({
              url: cloudinaryUrl,
              type: img.type,
              ...(imgbbUrl && { backupUrl: imgbbUrl }),
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

        const result = await membershipApi.create(record)
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
      const videoCount = transformed.filter(t => t.images?.some(img => img.type === 'video')).length
      if (videoCount > 0) addImportLog(`🎬 其中 ${videoCount} 筆含影片`, 'info')

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

  // ===== TOPSX 匯入功能 =====

  function addTopsxLog(msg, type = 'info') {
    setTopsxLog(prev => [...prev, { msg, type, ts: Date.now() }])
  }

  async function handleStartTopsxImport() {
    let items
    try {
      items = JSON.parse(topsxJson.trim())
      if (!Array.isArray(items)) throw new Error('格式錯誤')
    } catch {
      showToast('JSON 格式錯誤，請確認貼上的內容', 'error')
      return
    }

    topsxCancelRef.current = false
    setTopsxLog([])
    setTopsxPhase('processing')
    setTopsxProgress({ current: 0, total: items.length, skipped: 0, success: 0, failed: 0 })
    addTopsxLog(`開始處理 ${items.length} 筆 TOPSX 內容...`, 'info')

    // 重新載入最新資料做去重
    let latestArchives = archives
    try {
      latestArchives = await membershipApi.load()
      setArchives(latestArchives)
    } catch (e) {
      console.warn('重新載入資料失敗，使用現有 state 去重', e)
    }
    const existingSourceUrls = new Set(latestArchives.map(a => a.sourceUrl).filter(Boolean))

    for (let i = 0; i < items.length; i++) {
      if (topsxCancelRef.current) break

      const item = items[i]
      const sourceUrl = item.src // CDN 原始 URL 當作 sourceUrl 去重

      // 去重
      if (existingSourceUrls.has(sourceUrl)) {
        setTopsxProgress(prev => ({ ...prev, current: prev.current + 1, skipped: prev.skipped + 1 }))
        addTopsxLog(`⏭ 跳過（已存在）: ${item.date || ''}`, 'info')
        continue
      }

      try {
        const uploadOpts = { context: 'topsx' }
        const [cloudinaryUrl, imgbbUrl] = await Promise.all([
          uploadToCloudinary(item.src, uploadOpts),
          uploadToImgBB(item.src, uploadOpts).catch(err => {
            console.warn('ImgBB 備份失敗:', err.message)
            return null
          })
        ])

        const record = {
          id: `mb-topsx-${Date.now()}-${i}`,
          member: 'T.O.P',
          date: item.date || new Date().toISOString().split('T')[0],
          time: '',
          caption: item.caption || '',
          media: [{
            url: cloudinaryUrl,
            type: 'image',
            ...(imgbbUrl && { backupUrl: imgbbUrl }),
          }],
          sourceUrl: sourceUrl,
          notes: 'TOPSX Contents',
          paid: true,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        }

        const result = await membershipApi.create(record)
        if (result.skipped) {
          setTopsxProgress(prev => ({ ...prev, current: prev.current + 1, skipped: prev.skipped + 1 }))
          addTopsxLog(`⏭ 跳過（D1 已存在）: ${item.date || ''}`, 'info')
        } else {
          setArchives(prev => [record, ...prev])
          existingSourceUrls.add(sourceUrl)
          setTopsxProgress(prev => ({ ...prev, current: prev.current + 1, success: prev.success + 1 }))
          addTopsxLog(`✅ ${item.date || ''} 備份完成`, 'success')
        }
      } catch (err) {
        console.error(`TOPSX 匯入失敗:`, err)
        setTopsxProgress(prev => ({ ...prev, current: prev.current + 1, failed: prev.failed + 1 }))
        addTopsxLog(`❌ 失敗: ${err.message}`, 'error')
      }

      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (topsxCancelRef.current) {
      addTopsxLog('已取消匯入', 'warn')
    } else {
      addTopsxLog('🎉 匯入完成！', 'success')
    }
    setTopsxPhase('done')
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
        // 多選成員篩選
        if (filterMembers.length > 0) {
          const matchMember = filterMembers.some(m => item.member === m || MEMBER_ALIASES[m]?.includes(item.member))
          if (!matchMember) return false
        }
        if (filterType === 'video' && !item.notes?.includes('[影片]')) return false
        if (filterType === 'paid' && !item.paid) return false
        if (searchText && !item.caption?.toLowerCase().includes(searchText.toLowerCase())) return false
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [archives, filterMembers, filterType, searchText])

  // 測量容器寬度，計算每行幾列
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const measure = () => {
      if (viewMode !== 'grid') { setColumns(1); return }
      // 取容器寬度與視窗寬度的較小值，確保手機不會算錯
      const w = Math.min(el.clientWidth, window.innerWidth)
      if (w < 500) { setColumns(2); return }
      setColumns(Math.max(2, Math.floor(w / 280)))
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
    gap: viewMode === 'grid' ? 16 : 10,
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

  // 單張圖片背景上傳（同時上傳 Cloudinary 主要 + ImgBB 備用）
  async function uploadSingleImage(originalUrl, index) {
    try {
      const mbOpts = { context: 'membership' }
      const [cloudinaryUrl, imgbbUrl] = await Promise.all([
        uploadToCloudinary(originalUrl, mbOpts),
        uploadToImgBB(originalUrl, mbOpts).catch(err => {
          console.warn('ImgBB 備份失敗:', err.message)
          return null
        })
      ])

      setFormData(prev => ({
        ...prev,
        media: prev.media.map((m, i) =>
          i === index ? {
            ...m,
            url: cloudinaryUrl,
            backupUrl: imgbbUrl,
            uploading: false
          } : m
        )
      }))

      if (imgbbUrl) {
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
        // 圖片上傳到 Cloudinary（主要）+ ImgBB（備用）
        const mbOpts = { context: 'membership' }
        const [cloudinaryUrl, imgbbUrl] = await Promise.all([
          uploadToCloudinary(file, mbOpts),
          uploadToImgBB(file, mbOpts).catch(err => {
            console.warn('ImgBB 備份失敗:', err.message)
            return null
          })
        ])
        newMedia.push({
          url: cloudinaryUrl,
          type: 'image',
          ...(imgbbUrl && { backupUrl: imgbbUrl }),
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
      id: editingItem?.id || genId('mb'),
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
        await membershipApi.update(item)
        setArchives(archives.map(a => a.id === editingItem.id ? item : a))
      } else {
        await membershipApi.create(item)
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
      await membershipApi.delete(id)
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
      <div className="archive-page-loading">
        <div className="loading-spinner"></div>
        <p>載入中...</p>
      </div>
    )
  }

  return (
    <div className="membership-archive archive-page">
      {/* Header */}
      <header className="archive-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1>🔒 會員備份</h1>
        </div>
        <div className="header-actions">
          {isAdmin && (<>
            <button className="membership-import-btn" onClick={() => setShowTopsxModal(true)} title="從 TOPSX 匯入" style={{ fontSize: 12, fontWeight: 700, padding: '6px 10px' }}>
              TX
            </button>
            <button className="membership-import-btn" onClick={() => setShowImportModal(true)} title="從 b.stage 匯入">
              <Download size={18} />
            </button>
          </>)}
          <button className="add-btn" onClick={openAddModal} title="新增備份">
            <Plus size={20} />
          </button>
          {setCurrentPage && (
            <NavMenu currentPage={currentPage} setCurrentPage={setCurrentPage} />
          )}
        </div>
      </header>

      {/* Filters */}
      <div className="archive-filters">
        <div className="filter-row">
          {/* 成員篩選（多選） */}
          <MemberFilterDropdown
            selectedMembers={filterMembers}
            onChange={setFilterMembers}
            isOpen={memberDropdownOpen}
            onToggle={() => setMemberDropdownOpen(!memberDropdownOpen)}
          />

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
                  className={`archive-content ${viewMode}`}
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
                        {(() => {
                          // 找第一張圖片當縮圖（跳過 video type）
                          const thumb = item.media?.find(m => m.type !== 'video') || item.media?.[0]
                          const hasVideo = item.media?.some(m => m.type === 'video')
                          if (!thumb) return (
                            <div className="no-thumb">
                              <img src={`${import.meta.env.BASE_URL}bigbang-default.png`} alt="BIGBANG" />
                            </div>
                          )
                          return thumb.type === 'youtube' ? (
                            <div className="video-thumb-img">
                              <img src={thumb.thumbnail || getYouTubeThumbnail(thumb.url)} alt="" loading="lazy" width={260} height={260} />
                              <Play size={24} className="play-overlay" />
                            </div>
                          ) : (
                            <div className={hasVideo ? 'video-thumb-img' : ''}>
                              <img src={getThumbUrl(thumb)} alt="" loading="lazy" width={260} height={260} />
                              {hasVideo && <Play size={24} className="play-overlay" />}
                            </div>
                          )
                        })()}
                        {item.media?.length > 1 && (
                          <span className="media-count">+{item.media.length - 1}</span>
                        )}
                        {item.paid && (
                          <span className="paid-overlay"><Lock size={14} /></span>
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
                          <span className="date">{formatDate(item.date)}</span>
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
                  ) : viewingItem.media[viewingMediaIndex]?.type === 'video' ? (
                    <HlsVideo
                      key={`${viewingItem.id}-${viewingMediaIndex}`}
                      src={viewingItem.media[viewingMediaIndex].url}
                      className="view-media"
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

              {isAdmin && viewingItem.notes && (
                <div className="view-notes">
                  <strong>備註：</strong>
                  <p>{(() => {
                    // 從 sourceUrl 反推 mediaPrefix
                    const prefix = Object.values(BSTAGE_SITES).find(s => viewingItem.sourceUrl?.includes(s.domain))?.mediaPrefix || ''
                    return viewingItem.notes.split(/(https?:\/\/[^\s]+|\/media\/[^\s]+)/g).map((part, i) => {
                      if (/^https?:\/\//.test(part)) {
                        return <a key={i} href={part} target="_blank" rel="noopener noreferrer" style={{ color: '#D4AF37', wordBreak: 'break-all' }}>{part}</a>
                      }
                      if (/^\/media\//.test(part)) {
                        const fullUrl = `https://media.static.bstage.in/${prefix}${part}`
                        return <a key={i} href={fullUrl} target="_blank" rel="noopener noreferrer" style={{ color: '#D4AF37', wordBreak: 'break-all' }}>{part}</a>
                      }
                      return part
                    })
                  })()}</p>
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
          <div className="archive-modal" onClick={e => e.stopPropagation()}>
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

      {/* TOPSX 匯入 Modal */}
      {showTopsxModal && (
        <div className="modal-overlay" onClick={() => { if (!topsxPhase || topsxPhase === 'done') { setShowTopsxModal(false); setTopsxPhase(null); setTopsxJson(''); setTopsxLog([]) } }}>
          <div className="archive-modal import-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h2><Download size={18} /> 從 TOPSX 匯入</h2>
              <button className="close-btn" onClick={() => {
                if (topsxPhase && topsxPhase !== 'done') {
                  topsxCancelRef.current = true
                  addTopsxLog('正在取消...', 'warn')
                } else {
                  setShowTopsxModal(false)
                  setTopsxPhase(null)
                  setTopsxJson('')
                  setTopsxLog([])
                }
              }}>
                <X size={20} />
              </button>
            </div>

            <div className="modal-body">
              {!topsxPhase && (
                <>
                  <div className="form-group">
                    <label>步驟 1：在 TOPSX 網站 Console 執行腳本</label>
                    <div className="import-hint" style={{ background: '#1a1a2e', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.6, marginTop: 8 }}>
                      <p style={{ marginBottom: 8 }}>登入 <a href="https://en.top-official.co/29" target="_blank" rel="noopener" style={{ color: '#f0c040' }}>TOPSX Contents</a> → F12 開發者工具 → Console → 貼上以下腳本：</p>
                      <pre style={{ background: '#111', padding: 10, borderRadius: 6, overflow: 'auto', maxHeight: 120, fontSize: 11, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{`(()=>{const imgs=document.querySelectorAll('[data-src]');const seen=new Set();const items=[];imgs.forEach(el=>{const src=el.getAttribute('data-src');if(seen.has(src))return;seen.add(src);const m=src.match(/\\/thumbnail\\/(\\d{8})\\//);const d=m?m[1].replace(/(\\d{4})(\\d{2})(\\d{2})/,'$1-$2-$3'):'';items.push({src,date:d})});console.log(JSON.stringify(items));copy(JSON.stringify(items));alert('已複製 '+items.length+' 筆到剪貼簿！')})();`}</pre>
                    </div>
                  </div>
                  <div className="form-group" style={{ marginTop: 12 }}>
                    <label>步驟 2：貼上腳本輸出的 JSON</label>
                    <textarea
                      className="import-token-input"
                      placeholder='貼上 JSON 陣列，格式如：[{"src":"https://cdn.imweb.me/...","date":"2026-03-16"}, ...]'
                      value={topsxJson}
                      onChange={e => setTopsxJson(e.target.value)}
                      rows={5}
                    />
                    {topsxJson.trim() && (() => {
                      try {
                        const parsed = JSON.parse(topsxJson.trim())
                        return <p className="import-hint" style={{ color: '#4caf50' }}>✅ 解析到 {parsed.length} 筆圖片</p>
                      } catch {
                        return <p className="import-hint" style={{ color: '#f44336' }}>❌ JSON 格式錯誤</p>
                      }
                    })()}
                  </div>
                </>
              )}

              {/* 進度 */}
              {(topsxPhase === 'processing' || topsxPhase === 'done') && (
                <div className="import-progress-section">
                  <h3>{topsxPhase === 'done' ? '✅ 匯入完成' : '📦 處理中...'}</h3>
                  <div className="import-stats">
                    <span className="import-stat success">✅ {topsxProgress.success}</span>
                    <span className="import-stat skipped">⏭ {topsxProgress.skipped}</span>
                    <span className="import-stat failed">❌ {topsxProgress.failed}</span>
                  </div>
                  {topsxProgress.total > 0 && (
                    <>
                      <div className="import-progress-bar">
                        <div
                          className="import-progress-bar-fill"
                          style={{ width: `${(topsxProgress.current / topsxProgress.total) * 100}%` }}
                        />
                      </div>
                      <p className="import-progress-text">
                        {topsxProgress.current} / {topsxProgress.total}
                      </p>
                    </>
                  )}
                </div>
              )}

              {/* Log */}
              {topsxLog.length > 0 && (
                <div className="import-log">
                  {topsxLog.map((log, i) => (
                    <div key={i} className={`import-log-line import-log-${log.type}`}>{log.msg}</div>
                  ))}
                </div>
              )}
            </div>

            <div className="modal-footer">
              {!topsxPhase && (
                <>
                  <button className="cancel-btn" onClick={() => { setShowTopsxModal(false); setTopsxJson('') }}>
                    取消
                  </button>
                  <button className="save-btn" onClick={handleStartTopsxImport} disabled={!topsxJson.trim()}>
                    <Download size={16} /> 開始匯入
                  </button>
                </>
              )}
              {topsxPhase === 'processing' && (
                <button className="cancel-btn" onClick={() => { topsxCancelRef.current = true; addTopsxLog('正在取消...', 'warn') }}>
                  取消匯入
                </button>
              )}
              {topsxPhase === 'done' && (
                <button className="save-btn" onClick={() => {
                  setShowTopsxModal(false)
                  setTopsxPhase(null)
                  setTopsxJson('')
                  setTopsxLog([])
                }}>
                  關閉
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* b.stage 匯入 Modal */}
      {showImportModal && (
        <div className="modal-overlay" onClick={() => { if (!importPhase || importPhase === 'done') { setShowImportModal(false); setImportPhase(null); setBstageToken(''); setImportLog([]) } }}>
          <div className="archive-modal import-modal" onClick={e => e.stopPropagation()}>
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
                  <div className="form-group" style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={forceUpdate}
                        onChange={e => setForceUpdate(e.target.checked)}
                      />
                      強制更新已存在的貼文（不重傳圖片，僅更新文字/日期）
                    </label>
                    <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={videoOnly}
                        onChange={e => setVideoOnly(e.target.checked)}
                      />
                      🎬 只處理含影片的貼文（更新影片連結到已存在的貼文）
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
