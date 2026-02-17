import { useState, useEffect, useMemo, useRef } from 'react'
import { Plus, X, Image, Film, Camera, ChevronDown, Trash2, ExternalLink, Calendar, Save, Check, AlertCircle, Instagram, Link2, Upload, Search, Grid, List, Play, CheckSquare, Square, RefreshCw, ImageOff, ChevronLeft, ChevronRight } from 'lucide-react'
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

export default function SocialArchive({ isAdmin, onBack }) {
  const [archives, setArchives] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(null)

  // 篩選
  const [filterMember, setFilterMember] = useState('all')
  const [filterType, setFilterType] = useState('all')
  const [filterHasVideo, setFilterHasVideo] = useState(false) // 只顯示含影片的
  const [filterBrokenImages, setFilterBrokenImages] = useState(false) // 只顯示有壞圖的
  const [searchText, setSearchText] = useState('')
  const [viewMode, setViewMode] = useState('grid') // grid | list

  // 壞圖檢查
  const [brokenImageMap, setBrokenImageMap] = useState({}) // { archiveId: [brokenIndexes] }
  const [checkingBroken, setCheckingBroken] = useState(false)
  const [checkProgress, setCheckProgress] = useState({ current: 0, total: 0 })

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

  // 勾選模式
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [batchSyncing, setBatchSyncing] = useState(false)
  const [batchProgress, setBatchProgress] = useState({ current: 0, total: 0 })
  const [currentSyncingId, setCurrentSyncingId] = useState(null) // 目前正在同步的項目 ID
  const batchCancelRef = useRef(false) // 用來取消批次同步

  // 確認 Modal
  const [confirmModal, setConfirmModal] = useState(null)

  // 無限滾動
  const [displayCount, setDisplayCount] = useState(20)
  const loadMoreRef = useRef(null)

  // 載入資料
  useEffect(() => {
    loadArchives()
  }, [])

  async function loadArchives() {
    setLoading(true)
    try {
      // 從 D1 API 載入所有社群備份
      const res = await fetch(`${config.API_URL}/social`)
      if (!res.ok) throw new Error('載入失敗')
      const data = await res.json()
      // 資料已按 updated_at DESC 排序
      setArchives(data)
    } catch (err) {
      console.error('載入失敗', err)
      showToast('載入失敗', 'error')
    } finally {
      setLoading(false)
    }
  }

  // 建立新的社群備份
  async function createArchive(item) {
    const res = await fetch(`${config.API_URL}/social`, {
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

  // 更新社群備份
  async function updateArchive(item) {
    const res = await fetch(`${config.API_URL}/social/${item.id}`, {
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

  // 刪除社群備份
  async function deleteArchiveById(id) {
    const res = await fetch(`${config.API_URL}/social/${id}`, {
      method: 'DELETE',
      headers: { 'X-API-Key': config.API_KEY }
    })
    if (!res.ok) throw new Error('刪除失敗')
    return res.json()
  }

  // 儲存（相容舊邏輯，用於批次更新後重新載入）
  async function saveArchives(newArchives) {
    setArchives(newArchives)
    showToast('已儲存')
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

  // 檢查貼文是否含有影片
  function hasVideo(item) {
    return item.media?.some(m => m.type === 'video')
  }

  // 檢查貼文是否有壞圖
  function hasBrokenImages(item) {
    return brokenImageMap[item.id]?.length > 0
  }

  // 檢查單張圖片是否壞掉（用 fetch HEAD 請求）
  async function checkImageUrl(url) {
    if (!url) return true // 沒有 URL 視為壞的
    try {
      const res = await fetch(url, { method: 'HEAD', mode: 'no-cors' })
      // no-cors 模式下無法讀取 status，但如果完全無法連線會拋出錯誤
      return true // 假設可連線
    } catch {
      return false
    }
  }

  // 用 fetch 檢查圖片是否可載入（比 Image 物件更準確）
  async function checkImageLoadable(url) {
    if (!url) return false

    try {
      // 使用 fetch 發送 HEAD 請求檢查資源狀態
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000) // 10 秒超時

      const response = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      // 只有 200-299 狀態碼才算成功
      if (!response.ok) {
        console.log(`❌ 圖片檢查失敗 (HTTP ${response.status}): ${url}`)
        return false
      }

      return true
    } catch (error) {
      // HEAD 請求被 CORS 擋住，改用 Image 物件作為備用方案
      // 不設定 crossOrigin，讓瀏覽器用一般模式載入（404 會觸發 onerror）
      return new Promise(resolve => {
        const img = new window.Image()

        const timeout = setTimeout(() => {
          img.src = ''
          resolve(false)
        }, 10000)

        img.onload = () => {
          clearTimeout(timeout)
          // 額外檢查：圖片尺寸不是 0
          if (img.naturalWidth === 0 || img.naturalHeight === 0) {
            resolve(false)
          } else {
            resolve(true)
          }
        }

        img.onerror = () => {
          clearTimeout(timeout)
          resolve(false)
        }

        img.src = url
      })
    }
  }

  // 檢查所有圖片
  async function checkAllBrokenImages() {
    setCheckingBroken(true)
    setCheckProgress({ current: 0, total: archives.length })

    const newBrokenMap = {}
    let checkedCount = 0

    for (const item of archives) {
      const brokenIndexes = []

      if (item.media?.length > 0) {
        for (let i = 0; i < item.media.length; i++) {
          const m = item.media[i]
          // 檢查圖片（影片只檢查縮圖）
          const urlToCheck = m.type === 'video' ? m.thumbnail : m.url

          if (urlToCheck) {
            const isOk = await checkImageLoadable(urlToCheck)
            if (!isOk) {
              brokenIndexes.push(i)
            }
          }
        }
      }

      if (brokenIndexes.length > 0) {
        newBrokenMap[item.id] = brokenIndexes
      }

      checkedCount++
      setCheckProgress({ current: checkedCount, total: archives.length })
    }

    setBrokenImageMap(newBrokenMap)
    setCheckingBroken(false)

    const totalBroken = Object.keys(newBrokenMap).length
    if (totalBroken > 0) {
      showToast(`檢查完成：${totalBroken} 筆有壞圖`, 'error')
    } else {
      showToast('檢查完成：沒有發現壞圖 ✅')
    }
  }

  // 篩選後的資料
  const filteredArchives = useMemo(() => {
    return archives
      .filter(item => {
        if (filterMember !== 'all' && item.member !== filterMember) return false
        if (filterType !== 'all' && item.type !== filterType) return false
        if (filterHasVideo && !hasVideo(item)) return false
        if (filterBrokenImages && !hasBrokenImages(item)) return false
        if (searchText && !item.caption?.toLowerCase().includes(searchText.toLowerCase())) return false
        return true
      })
      .sort((a, b) => new Date(b.date) - new Date(a.date))
  }, [archives, filterMember, filterType, filterHasVideo, filterBrokenImages, searchText, brokenImageMap])

  // 實際顯示的資料（無限滾動）
  const displayedArchives = useMemo(() => {
    return filteredArchives.slice(0, displayCount)
  }, [filteredArchives, displayCount])

  // 當 filter 改變時，重設顯示數量
  useEffect(() => {
    setDisplayCount(20)
  }, [filterMember, filterType, filterHasVideo, filterBrokenImages, searchText])

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

  // 取得目前貼文在列表中的位置
  function getCurrentPostIndex() {
    return filteredArchives.findIndex(a => a.id === viewingItem?.id)
  }

  // 單筆同步抓取狀態（改用 Set 追蹤多個同時同步的項目）
  const [syncingIds, setSyncingIds] = useState(new Set())

  // 檢查某個項目是否正在同步
  function isItemSyncing(itemId) {
    return syncingIds.has(itemId)
  }

  // 單筆同步抓取（檢視模式中使用）
  async function handleSingleSync() {
    if (!viewingItem?.igUrl) {
      showToast('此貼文沒有 IG 連結', 'error')
      return
    }

    // 檢查是否已經在同步
    if (isItemSyncing(viewingItem.id)) {
      showToast('此貼文正在同步中...', 'info')
      return
    }

    // 記錄要同步的項目（即使離開 modal 也能繼續）
    const itemToSync = { ...viewingItem }
    const itemId = viewingItem.id

    // 加入同步中列表
    setSyncingIds(prev => new Set(prev).add(itemId))

    try {
      const data = await fetchIGData(itemToSync.igUrl)

      // 檢查抓取是否成功
      if (!data.success || !data.media?.length) {
        // 抓取失敗或資料為空，詢問是否覆蓋
        const confirmOverwrite = await showConfirm({
          title: '⚠️ 抓取失敗',
          type: 'warning',
          confirmText: '清空媒體',
          cancelText: '取消',
          content: (
            <div className="confirm-content">
              <p>可能原因：</p>
              <ul>
                <li>IG 貼文已被刪除</li>
                <li>IG API 暫時無法存取</li>
                <li>網路連線問題</li>
              </ul>
              <p className="confirm-warning">是否仍要清空此貼文的媒體資料？</p>
            </div>
          )
        })
        if (!confirmOverwrite) {
          setSyncingIds(prev => {
            const next = new Set(prev)
            next.delete(itemId)
            return next
          })
          return
        }
      } else {
        // 抓取成功，檢查內容是否有變化
        const oldMediaCount = itemToSync.media?.length || 0
        const newMediaCount = data.media?.length || 0
        const oldCaption = (itemToSync.caption || '').trim()
        const newCaption = (data.caption || '').trim()

        // 比較圖片數量和內容
        const mediaCountChanged = oldMediaCount !== newMediaCount
        const captionChanged = oldCaption !== newCaption && newCaption !== ''

        // 如果有變化，顯示確認對話框
        if (mediaCountChanged || captionChanged) {
          const oldPreview = oldCaption.substring(0, 80) + (oldCaption.length > 80 ? '...' : '')
          const newPreview = newCaption.substring(0, 80) + (newCaption.length > 80 ? '...' : '')

          const confirmOverwrite = await showConfirm({
            title: '📝 資料變更確認',
            type: 'info',
            confirmText: '覆蓋',
            cancelText: '取消',
            content: (
              <div className="confirm-content">
                <p>抓取到的資料與現有資料不同：</p>
                {mediaCountChanged && (
                  <div className="diff-item">
                    <span className="diff-label">📷 媒體數量</span>
                    <div className="diff-values">
                      <span className="diff-old">{oldMediaCount} 張</span>
                      <span className="diff-arrow">→</span>
                      <span className="diff-new">{newMediaCount} 張</span>
                    </div>
                  </div>
                )}
                {captionChanged && (
                  <div className="diff-item">
                    <span className="diff-label">📝 內容</span>
                    <div className="diff-text">
                      <div className="diff-old">{oldPreview || '(空)'}</div>
                      <div className="diff-new">{newPreview}</div>
                    </div>
                  </div>
                )}
                <p className="confirm-question">確定要覆蓋嗎？</p>
              </div>
            )
          })
          if (!confirmOverwrite) {
            setSyncingIds(prev => {
              const next = new Set(prev)
              next.delete(itemId)
              return next
            })
            showToast('已取消同步')
            return
          }
        }
      }

      // 更新資料（這裡開始是背景執行，即使離開也會繼續）
      showToast('同步中，檢查並上傳圖片...', 'info')

      const newMedia = data.media?.length > 0
        ? await uploadMediaList(data.media, itemToSync.media || [])
        : []

      const updatedItem = {
        ...itemToSync,
        media: newMedia,
        caption: data.caption || itemToSync.caption,
        updatedAt: Date.now()
      }

      // 更新 archives（用最新的 archives 狀態）
      setArchives(prevArchives => {
        const newArchives = prevArchives.map(a =>
          a.id === itemId ? updatedItem : a
        )
        // 存到 D1
        updateArchive(updatedItem)
          .catch(err => console.warn('D1 儲存失敗:', err))
        return newArchives
      })

      // 如果還在看同一則貼文，更新 viewingItem
      setViewingItem(prev => {
        if (prev?.id === itemId) {
          return updatedItem
        }
        return prev
      })
      setViewingMediaIndex(0)

      if (newMedia.length > 0) {
        showToast(`✅ 同步完成：${newMedia.length} 個媒體`)
      } else {
        showToast('已清空媒體資料', 'info')
      }
    } catch (err) {
      console.error('同步失敗:', err)
      showToast('❌ 同步失敗：' + err.message, 'error')
    } finally {
      // 從同步中列表移除
      setSyncingIds(prev => {
        const next = new Set(prev)
        next.delete(itemId)
        return next
      })
    }
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
      createdAt: editingItem?.createdAt || Date.now(),
      updatedAt: Date.now(),
    }

    setSaving(true)
    try {
      if (editingItem) {
        // 更新現有
        await updateArchive(item)
        setArchives(archives.map(a => a.id === editingItem.id ? item : a))
      } else {
        // 新增
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

  // ===== 勾選模式 =====

  // 切換單筆選取
  function toggleSelect(id) {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    )
  }

  // 全選/取消全選（只選取目前篩選結果）
  function toggleSelectAll() {
    if (selectedIds.length === filteredArchives.length) {
      setSelectedIds([])
    } else {
      setSelectedIds(filteredArchives.map(a => a.id))
    }
  }

  // 上傳媒體列表（智慧同步：檢查現有備份是否可用，只上傳壞掉或新的圖）
  // existingMedia: 現有的已備份媒體列表（可選）
  // ImgBB 上傳成功就回傳，Cloudinary 在背景上傳
  async function uploadMediaList(mediaList, existingMedia = []) {
    const result = []
    const cloudinaryTasks = [] // 背景上傳任務

    for (let i = 0; i < mediaList.length; i++) {
      const m = mediaList[i]
      const existing = existingMedia[i] // 對應位置的現有媒體

      if (m.type === 'image') {
        // 檢查現有備份是否可用
        if (existing?.type === 'image') {
          // 先檢查主要備份（ImgBB）
          if (existing?.url?.includes('i.ibb.co')) {
            const isAlive = await checkImageLoadable(existing.url)
            if (isAlive) {
              console.log(`✅ 圖片 ${i + 1} ImgBB 備份可用，跳過上傳`)
              result.push({ ...existing })
              continue
            }
          }

          // ImgBB 壞了，檢查 Cloudinary 備份
          if (existing?.backupUrl?.includes('cloudinary')) {
            const isBackupAlive = await checkImageLoadable(existing.backupUrl)
            if (isBackupAlive) {
              console.log(`✅ 圖片 ${i + 1} Cloudinary 備份可用，切換使用`)
              result.push({
                url: existing.backupUrl, // 用 Cloudinary 當主要 URL
                type: 'image',
                backupUrl: existing.backupUrl
              })
              continue
            }
          }

          console.log(`⚠️ 圖片 ${i + 1} 所有備份都失效，重新上傳`)
        }

        // 需要上傳新圖片
        try {
          console.log(`📤 上傳圖片 ${i + 1}...`)
          const imgbbUrl = await uploadUrlToImgBB(m.url)
          const mediaItem = {
            url: imgbbUrl,
            type: 'image'
          }
          result.push(mediaItem)

          // Cloudinary 背景上傳（非阻塞）
          const itemIndex = result.length - 1
          cloudinaryTasks.push(
            uploadToCloudinary(m.url).then(cloudinaryUrl => {
              if (cloudinaryUrl) {
                result[itemIndex].backupUrl = cloudinaryUrl
              }
            }).catch(err => console.warn('Cloudinary 背景上傳失敗:', err))
          )
        } catch (err) {
          console.warn('圖片上傳失敗:', err)
          result.push({ url: m.url, type: 'image' })
        }
      } else if (m.type === 'video') {
        // 影片保留原始 URL，只處理縮圖
        const videoItem = { url: m.url, type: 'video' }

        if (m.thumbnail) {
          // 檢查現有縮圖備份是否可用
          if (existing?.type === 'video') {
            // 先檢查主要縮圖備份（ImgBB）
            if (existing?.thumbnail?.includes('i.ibb.co')) {
              const isAlive = await checkImageLoadable(existing.thumbnail)
              if (isAlive) {
                console.log(`✅ 影片 ${i + 1} 縮圖 ImgBB 備份可用，跳過上傳`)
                videoItem.thumbnail = existing.thumbnail
                if (existing.thumbnailBackupUrl) {
                  videoItem.thumbnailBackupUrl = existing.thumbnailBackupUrl
                }
                result.push(videoItem)
                continue
              }
            }

            // ImgBB 壞了，檢查 Cloudinary 縮圖備份
            if (existing?.thumbnailBackupUrl?.includes('cloudinary')) {
              const isBackupAlive = await checkImageLoadable(existing.thumbnailBackupUrl)
              if (isBackupAlive) {
                console.log(`✅ 影片 ${i + 1} 縮圖 Cloudinary 備份可用，切換使用`)
                videoItem.thumbnail = existing.thumbnailBackupUrl
                videoItem.thumbnailBackupUrl = existing.thumbnailBackupUrl
                result.push(videoItem)
                continue
              }
            }

            console.log(`⚠️ 影片 ${i + 1} 縮圖所有備份都失效，重新上傳`)
          }

          // 需要上傳新縮圖
          try {
            console.log(`📤 上傳影片 ${i + 1} 縮圖...`)
            const imgbbUrl = await uploadUrlToImgBB(m.thumbnail)
            videoItem.thumbnail = imgbbUrl

            // Cloudinary 背景上傳
            cloudinaryTasks.push(
              uploadToCloudinary(m.thumbnail).then(cloudinaryUrl => {
                if (cloudinaryUrl) {
                  videoItem.thumbnailBackupUrl = cloudinaryUrl
                }
              }).catch(err => console.warn('Cloudinary 縮圖背景上傳失敗:', err))
            )
          } catch (err) {
            console.warn('縮圖上傳失敗:', err)
            videoItem.thumbnail = m.thumbnail
          }
        }
        result.push(videoItem)
      }
    }

    // 背景執行 Cloudinary 上傳（不等待）
    if (cloudinaryTasks.length > 0) {
      Promise.all(cloudinaryTasks).then(() => {
        console.log('✅ Cloudinary 背景上傳完成')
      })
    }

    return result
  }

  // 合併媒體列表（只更新影片 URL，保留現有 thumbnail）
  function mergeMediaWithVideoOnly(existingMedia, newMedia) {
    // 建立一個映射：根據 index 或類型配對
    const result = existingMedia.map((existing, i) => {
      const newItem = newMedia[i]

      if (existing.type === 'video' && newItem?.type === 'video') {
        // 影片：只更新 URL，保留現有的 thumbnail
        return {
          ...existing,
          url: newItem.url, // 使用新的影片 URL
          // 保留現有的 thumbnail 和 thumbnailBackupUrl
        }
      } else if (existing.type === 'image') {
        // 圖片：保留現有的，不更新
        return existing
      }
      return existing
    })
    return result
  }

  // 取消批次同步
  function cancelBatchSync() {
    batchCancelRef.current = true
    showToast('正在取消同步...', 'info')
  }

  // 批次同步抓取
  async function handleBatchSync() {
    const selected = archives.filter(a => selectedIds.includes(a.id) && a.igUrl)
    if (selected.length === 0) {
      showToast('沒有可同步的項目（需有 IG 連結）', 'error')
      return
    }

    // 如果是「含影片」篩選模式，只更新影片 URL
    const videoOnlyMode = filterHasVideo

    batchCancelRef.current = false // 重置取消狀態
    setBatchSyncing(true)
    setBatchProgress({ current: 0, total: selected.length })

    let successCount = 0

    for (const item of selected) {
      // 檢查是否已取消
      if (batchCancelRef.current) {
        break
      }

      // 設定目前正在同步的項目
      setCurrentSyncingId(item.id)
      await new Promise(resolve => setTimeout(resolve, 0)) // 讓 UI 更新

      try {
        const data = await fetchIGData(item.igUrl)

        // 再次檢查是否已取消（抓取 IG 後）
        if (batchCancelRef.current) {
          break
        }

        if (data.success && data.media?.length > 0) {
          let updatedItem
          if (videoOnlyMode) {
            // 只更新影片 URL，保留現有 thumbnail
            const mergedMedia = mergeMediaWithVideoOnly(item.media, data.media)
            updatedItem = {
              ...item,
              media: mergedMedia,
              updatedAt: Date.now()
            }
            console.log(`✅ ${item.id} 影片 URL 已更新（保留 thumbnail）`)
          } else {
            // 智慧同步：檢查現有備份，只上傳壞掉或新的圖
            const newMedia = await uploadMediaList(data.media, item.media || [])

            // 再次檢查是否已取消（上傳後）
            if (batchCancelRef.current) {
              break
            }

            updatedItem = {
              ...item,
              media: newMedia,
              caption: data.caption || item.caption,
              updatedAt: Date.now()
            }
          }

          // 即時更新畫面（每完成一筆就更新）
          setArchives(prev => prev.map(a => a.id === item.id ? updatedItem : a))
          successCount++

          // 強制讓出執行緒，讓 React 有機會更新 UI
          await new Promise(resolve => setTimeout(resolve, 0))
        }
      } catch (err) {
        console.warn(`同步 ${item.id} 失敗:`, err)
      }
      setBatchProgress(p => ({ ...p, current: p.current + 1 }))

      // 每筆處理完也讓出執行緒
      await new Promise(resolve => setTimeout(resolve, 0))
    }

    // 批次同步完成（每筆在處理時已經單獨存到 D1）

    const wasCancelled = batchCancelRef.current
    setCurrentSyncingId(null) // 清除同步中的項目
    setBatchSyncing(false)
    setSelectMode(false)
    setSelectedIds([])

    if (wasCancelled) {
      showToast(`已取消同步（已完成 ${successCount} 筆）`, 'info')
    } else if (videoOnlyMode) {
      showToast(`影片同步完成：${successCount}/${selected.length} 筆成功`)
    } else {
      showToast(`同步完成：${successCount}/${selected.length} 筆成功`)
    }
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

          {/* 含影片篩選 */}
          <button
            className={`filter-video-btn ${filterHasVideo ? 'active' : ''}`}
            onClick={() => setFilterHasVideo(!filterHasVideo)}
            title="只顯示含影片的貼文"
          >
            <Film size={16} />
            <span>影片</span>
          </button>

          {/* 壞圖篩選（僅管理員可見） */}
          {isAdmin && (
            <button
              className={`filter-broken-btn ${filterBrokenImages ? 'active' : ''}`}
              onClick={() => {
                if (Object.keys(brokenImageMap).length === 0 && !checkingBroken) {
                  // 還沒檢查過，先執行檢查
                  checkAllBrokenImages()
                }
                setFilterBrokenImages(!filterBrokenImages)
              }}
              title="檢查並篩選壞圖"
              disabled={checkingBroken}
            >
              {checkingBroken ? (
                <>
                  <span className="mini-spinner"></span>
                  <span>{checkProgress.current}/{checkProgress.total}</span>
                </>
              ) : (
                <>
                  <ImageOff size={16} />
                  <span>壞圖{Object.keys(brokenImageMap).length > 0 ? ` (${Object.keys(brokenImageMap).length})` : ''}</span>
                </>
              )}
            </button>
          )}

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

          {/* 勾選模式（僅管理員可見） */}
          {isAdmin && (
            <button
              className={`select-mode-btn ${selectMode ? 'active' : ''}`}
              onClick={() => {
                setSelectMode(!selectMode)
                setSelectedIds([])
              }}
              title="勾選模式"
            >
              <CheckSquare size={16} />
            </button>
          )}
        </div>

        <div className="filter-stats">
          共 {filteredArchives.length} 筆備份
          {selectMode && filteredArchives.length > 0 && (
            <button className="select-all-btn" onClick={toggleSelectAll}>
              {selectedIds.length === filteredArchives.length ? '取消全選' : '全選'}
            </button>
          )}
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
          displayedArchives.map(item => (
            <div
              key={item.id}
              className={`archive-card ${selectMode && selectedIds.includes(item.id) ? 'selected' : ''}`}
              onClick={() => selectMode ? toggleSelect(item.id) : openViewModal(item)}
            >
              {/* 勾選框 */}
              {selectMode && (
                <div
                  className="card-checkbox"
                  onClick={(e) => { e.stopPropagation(); toggleSelect(item.id) }}
                >
                  {selectedIds.includes(item.id) ? <CheckSquare size={20} /> : <Square size={20} />}
                </div>
              )}
              {/* 縮圖 */}
              <div className="archive-thumb">
                {item.media?.[0] ? (
                  item.media[0].type === 'video' ? (
                    item.media[0].thumbnail ? (
                      // 有縮圖就顯示縮圖
                      <div className="video-thumb-img">
                        <img src={item.media[0].thumbnail} alt="" loading="lazy" />
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
                {/* 類型標籤 */}
                <span
                  className="type-badge"
                  style={{ background: POST_TYPES.find(t => t.id === item.type)?.color }}
                >
                  {POST_TYPES.find(t => t.id === item.type)?.icon}
                </span>
                {/* 壞圖警示 */}
                {brokenImageMap[item.id]?.length > 0 && (
                  <span className="broken-badge" title={`${brokenImageMap[item.id].length} 張圖片損壞`}>
                    <ImageOff size={14} />
                    {brokenImageMap[item.id].length}
                  </span>
                )}
                {/* 同步中 Loading 覆蓋層（支援單則同步 syncingIds 和批次同步 currentSyncingId） */}
                {(syncingIds.has(item.id) || currentSyncingId === item.id) && (
                  <div className="syncing-overlay">
                    <RefreshCw size={24} className="spinning" />
                    <span>同步中...</span>
                  </div>
                )}
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
          {/* 頂部：貼文位置指示（放在 modal 外面） */}
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
                  <>
                    <a
                      href={viewingItem.igUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="view-link-btn"
                    >
                      <ExternalLink size={16} /> 開啟 IG
                    </a>
                    <button
                      className="view-sync-btn"
                      onClick={handleSingleSync}
                      disabled={isItemSyncing(viewingItem.id)}
                      title="重新抓取 IG 資料"
                    >
                      <RefreshCw size={16} className={isItemSyncing(viewingItem.id) ? 'spinning' : ''} />
                      {isItemSyncing(viewingItem.id) ? '同步中...' : '同步'}
                    </button>
                  </>
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
                  {formData.media.map((m, i) => {
                    // 檢查這張圖是否在壞圖列表中
                    const isBroken = editingItem && brokenImageMap[editingItem.id]?.includes(i)
                    return (
                      <div key={i} className={`media-preview ${m.uploading ? 'uploading' : ''} ${m.uploadFailed ? 'failed' : ''} ${isBroken ? 'broken' : ''}`}>
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
                        {isBroken && (
                          <div className="broken-image-badge" title="此圖片已損壞，請重新上傳">
                            <ImageOff size={14} />
                          </div>
                        )}
                        <button className="remove-media" onClick={() => removeMedia(i)}>
                          <X size={14} />
                        </button>
                      </div>
                    )
                  })}
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

      {/* 批次操作列 */}
      {selectMode && selectedIds.length > 0 && (
        <div className="batch-action-bar">
          <span className="batch-count">已選取 {selectedIds.length} 筆</span>
          <div className="batch-actions">
            {!batchSyncing && (
              <button className="batch-cancel-btn" onClick={() => setSelectedIds([])}>
                取消選取
              </button>
            )}
            {batchSyncing ? (
              <button
                className="batch-stop-btn"
                onClick={cancelBatchSync}
              >
                <X size={16} />
                取消同步 ({batchProgress.current}/{batchProgress.total})
              </button>
            ) : (
              <button
                className="batch-sync-btn"
                onClick={handleBatchSync}
              >
                <RefreshCw size={16} />
                同步抓取
              </button>
            )}
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
