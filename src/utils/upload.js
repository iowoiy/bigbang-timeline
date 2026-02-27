import config from '../config'

// ========== API Key / 帳號分流 ==========

// context: 'timeline' | 'social' | 'membership' | 'bstage'
function getImgBBKey(context, member) {
  if (context === 'social' && member === 'G-Dragon' && config.GD_IMGBB_API_KEY) {
    return config.GD_IMGBB_API_KEY
  }
  if (context === 'social' && member === 'T.O.P' && config.TOP_IMGBB_API_KEY) {
    return config.TOP_IMGBB_API_KEY
  }
  if (context === 'social' || context === 'bstage') {
    return config.SOCIAL_IMGBB_API_KEY || config.IMGBB_API_KEY
  }
  if (context === 'membership') {
    return config.MEMBERSHIP_IMGBB_API_KEY || config.IMGBB_API_KEY
  }
  return config.IMGBB_API_KEY
}

function getCloudinaryConf(context, member) {
  if (context === 'social' && member === 'G-Dragon' && config.GD_CLOUDINARY_CLOUD_NAME) {
    return {
      cloudName: config.GD_CLOUDINARY_CLOUD_NAME,
      preset: config.GD_CLOUDINARY_PRESET,
    }
  }
  if (context === 'social' && member === 'T.O.P' && config.TOP_CLOUDINARY_CLOUD_NAME) {
    return {
      cloudName: config.TOP_CLOUDINARY_CLOUD_NAME,
      preset: config.TOP_CLOUDINARY_PRESET,
    }
  }
  if (context === 'social' || context === 'bstage') {
    return {
      cloudName: config.SOCIAL_CLOUDINARY_CLOUD_NAME || config.CLOUDINARY_CLOUD_NAME,
      preset: config.SOCIAL_CLOUDINARY_PRESET || config.CLOUDINARY_UPLOAD_PRESET,
    }
  }
  if (context === 'membership') {
    return {
      cloudName: config.MEMBERSHIP_CLOUDINARY_CLOUD_NAME || config.CLOUDINARY_CLOUD_NAME,
      preset: config.MEMBERSHIP_CLOUDINARY_PRESET || config.CLOUDINARY_UPLOAD_PRESET,
    }
  }
  return {
    cloudName: config.CLOUDINARY_CLOUD_NAME,
    preset: config.CLOUDINARY_UPLOAD_PRESET,
  }
}

// ========== 上傳函式 ==========

// 上傳檔案或 URL 到 ImgBB
export async function uploadToImgBB(fileOrUrl, { context = 'timeline', member } = {}) {
  const key = getImgBBKey(context, member)
  if (!key) throw new Error('ImgBB API key 未設定')

  const formData = new FormData()
  formData.append('image', fileOrUrl)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  if (data.success) return data.data.url
  throw new Error(data?.error?.message || '上傳失敗')
}

// 上傳檔案或 URL 到 Cloudinary（主要圖床）
export async function uploadToCloudinary(fileOrUrl, { context = 'timeline', member } = {}) {
  const { cloudName, preset } = getCloudinaryConf(context, member)
  if (!cloudName || !preset) throw new Error('Cloudinary 設定未完成')

  const formData = new FormData()
  formData.append('file', fileOrUrl)
  formData.append('upload_preset', preset)

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: formData }
  )
  const data = await res.json()

  if (data.secure_url) return data.secure_url
  throw new Error(data.error?.message || '上傳失敗')
}

// 同時上傳到 Cloudinary（主要）+ ImgBB（備用）
export async function uploadWithBackup(fileOrUrl, { context = 'timeline', member } = {}) {
  const opts = { context, member }
  const [cloudinaryUrl, imgbbUrl] = await Promise.all([
    uploadToCloudinary(fileOrUrl, opts),
    uploadToImgBB(fileOrUrl, opts).catch(err => {
      console.warn('ImgBB 備份失敗:', err.message)
      return null
    }),
  ])
  return { url: cloudinaryUrl, backupUrl: imgbbUrl }
}
