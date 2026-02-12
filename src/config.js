// =====================================================
// 🔧 設定區 — 請填入你的 JSONBin 資訊
// =====================================================
// 1. 前往 https://jsonbin.io 註冊帳號
// 2. 建立一個新 Bin，內容填 {"init":true}
// 3. 將 API Key 和 Bin ID 填入下方，或設為環境變數
// =====================================================

const config = {
  API_KEY: import.meta.env.VITE_JSONBIN_API_KEY || '$2a$10$xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
  BIN_ID: import.meta.env.VITE_JSONBIN_BIN_ID || 'xxxxxxxxxxxxxxxxxxxxxxxx',
}

export default config
