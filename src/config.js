// =====================================================
// 🔧 設定區
// =====================================================

const config = {
  // JSONBin 設定
  API_KEY: import.meta.env.VITE_JSONBIN_API_KEY || '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  BIN_ID: import.meta.env.VITE_JSONBIN_BIN_ID || 'xxxxxxxxxxxxxxxxxxxxxxxx',

  // ImgBB 圖片上傳設定
  IMGBB_API_KEY: '5cbce8288a96071b5e9d505cbdd69846',
}

export default config
