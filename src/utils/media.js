// ========== 縮圖 & 圖片工具 ==========

// 卡片縮圖：Cloudinary 優先 + 壓縮
export function getThumbUrl(media, width = 400) {
  const backup = media.backupUrl || media.thumbnailBackupUrl
  if (backup?.includes('cloudinary.com/')) {
    return backup.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`)
  }
  return backup || media.thumbnail || media.url
}

// 檢視大圖：Cloudinary 1080px
export function getViewUrl(media, width = 1080) {
  if (media.backupUrl?.includes('cloudinary.com/')) {
    return media.backupUrl.replace('/upload/', `/upload/w_${width},q_auto,f_auto/`)
  }
  return media.backupUrl || media.url
}

// ========== YouTube 工具 ==========

export function isYouTubeUrl(url) {
  if (!url) return false
  return /(?:youtube\.com\/(?:watch|embed|shorts)|youtu\.be\/)/i.test(url)
}

export function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

export function getYouTubeThumbnail(url) {
  const id = getYouTubeId(url)
  return id ? `https://img.youtube.com/vi/${id}/hqdefault.jpg` : null
}

// ========== 多平台影片解析（時間軸用） ==========

export function parseVideoUrl(url) {
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
export function isImageUrl(url) {
  if (!url) return false
  return /\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(url) ||
         url.includes('i.ibb.co') ||
         url.includes('imgur.com')
}

// 取得影片縮圖（多平台）
export function getVideoThumbnail(url) {
  const video = parseVideoUrl(url)
  if (!video) return null

  if (video.type === 'youtube') {
    return `https://img.youtube.com/vi/${video.id}/mqdefault.jpg`
  }

  // IG 和 Twitter 無法直接取得縮圖
  return null
}
