import config from '../config'

// ========== API Key / 帳號分流 ==========

// context: 'timeline' | 'social' | 'membership' | 'bstage'
function getImgBBKey(context, member) {
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
  const formData = new FormData()
  formData.append('image', fileOrUrl)
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${key}`, {
    method: 'POST',
    body: formData,
  })
  const data = await res.json()
  if (data.success) return data.data.url
  throw new Error('上傳失敗')
}

// 上傳檔案或 URL 到 Cloudinary 作為備份
export async function uploadToCloudinary(fileOrUrl, { context = 'timeline', member } = {}) {
  const { cloudName, preset } = getCloudinaryConf(context, member)
  if (!cloudName || !preset) {
    console.warn('Cloudinary 未設定，跳過備份')
    return null
  }

  try {
    const formData = new FormData()
    formData.append('file', fileOrUrl)
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

// 同時上傳到 ImgBB + Cloudinary（雙重備份）
export async function uploadWithBackup(fileOrUrl, { context = 'timeline', member } = {}) {
  const opts = { context, member }
  const [imgbbUrl, cloudinaryUrl] = await Promise.all([
    uploadToImgBB(fileOrUrl, opts),
    uploadToCloudinary(fileOrUrl, opts),
  ])
  return { url: imgbbUrl, backupUrl: cloudinaryUrl }
}
