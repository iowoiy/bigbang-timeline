// =====================================================
// 🔧 設定區
// =====================================================

const config = {
  // Cloudflare D1 API 設定
  API_URL: 'https://bigbang-api.iowoiy-yo.workers.dev/api',
  API_KEY: 'bigbang2008vipmartina', // 你在 wrangler secret put API_KEY 設定的值

  // [舊版 JSONBin - 保留備用]
  // JSONBIN_API_KEY: '$2a$10$GeeaO.HWzOMwBMOrF3XkceZdVwaMcJgr.sqx.pCWF/sSR2VfzFZrq',
  // BIN_ID: '6993496043b1c97be983d918',
  // SOCIAL_BINS: {
  //   'G-Dragon': '6994c471d0ea881f40c20bd4',
  //   'T.O.P': '6994c47643b1c97be986ad4e',
  //   '太陽': '6994c477d0ea881f40c20be2',
  //   '大聲': '6994c479ae596e708f32788a',
  //   '全員': '6994c47aae596e708f327891',
  // },

  // Instagram Scraper Worker URL
  IG_SCRAPER_URL: 'https://ig-scraper.iowoiy-yo.workers.dev',

  // ImgBB 圖片上傳設定（時間軸用）
  IMGBB_API_KEY: '5cbce8288a96071b5e9d505cbdd69846',

  // 社群備份專用 ImgBB API Key
  SOCIAL_IMGBB_API_KEY: '672b4da7edd52fce03eec8e05084b39f',

  // Cloudinary 備份設定（時間軸用）
  CLOUDINARY_CLOUD_NAME: 'dxiciyujo',
  CLOUDINARY_UPLOAD_PRESET: 'bigbang-timeline',

  // 社群備份專用 Cloudinary
  SOCIAL_CLOUDINARY_CLOUD_NAME: 'dn0jpjoek',
  SOCIAL_CLOUDINARY_PRESET: 'bigbang-socialmedia',

  // 會員備份專用設定
  MEMBERSHIP_IMGBB_API_KEY: '5ba49f2d518646b1d60d3bb5749ffd18',
  MEMBERSHIP_CLOUDINARY_CLOUD_NAME: 'dqag3qras',
  MEMBERSHIP_CLOUDINARY_PRESET: 'bigbang-membership',

  // T.O.P 社群備份專用（資料量龐大，獨立存放）
  TOP_IMGBB_API_KEY: '0b1496efe89ea09d0615c315051728a5',
  TOP_CLOUDINARY_CLOUD_NAME: 'dgkgt9w1q',
  TOP_CLOUDINARY_PRESET: 'teamtttop',

  // G-Dragon 社群備份專用（資料量龐大，獨立存放）
  GD_IMGBB_API_KEY: 'eb1e9a7022e63ecc91b8710e5de5bf9c',
  GD_CLOUDINARY_CLOUD_NAME: 'de49vywlo',
  GD_CLOUDINARY_PRESET: 'gdragon-ig',
}

export default config
