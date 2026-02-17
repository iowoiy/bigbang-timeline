// =====================================================
// 🔧 設定區
// =====================================================

const config = {
  // JSONBin 設定
  API_KEY: '$2a$10$GeeaO.HWzOMwBMOrF3XkceZdVwaMcJgr.sqx.pCWF/sSR2VfzFZrq',
  BIN_ID: import.meta.env.VITE_JSONBIN_BIN_ID || '6993496043b1c97be983d918',

  // 社群備份 JSONBin（可另開一個 bin 存放）
  SOCIAL_BIN_ID: import.meta.env.VITE_SOCIAL_BIN_ID || '69935f45ae596e708f2fc88b',

  // Instagram Scraper Worker URL（部署 Cloudflare Worker 後填入）
  IG_SCRAPER_URL: import.meta.env.VITE_IG_SCRAPER_URL || 'https://ig-scraper.iowoiy-yo.workers.dev',

  // ImgBB 圖片上傳設定（時間軸用）
  IMGBB_API_KEY: '5cbce8288a96071b5e9d505cbdd69846',

  // 社群備份專用 ImgBB API Key（留空則使用主要的 IMGBB_API_KEY）
  SOCIAL_IMGBB_API_KEY: import.meta.env.VITE_SOCIAL_IMGBB_API_KEY || '672b4da7edd52fce03eec8e05084b39f',

  // Cloudinary 備份設定
  CLOUDINARY_CLOUD_NAME: import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'dn0jpjoek',
  CLOUDINARY_UPLOAD_PRESET: import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'Bigbang-timeline',
}

export default config







