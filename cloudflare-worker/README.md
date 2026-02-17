# Instagram Scraper - Cloudflare Worker

用於抓取 Instagram 公開貼文的圖片、影片和文字內容。

## 部署步驟

### 1. 登入 Cloudflare

前往 [Cloudflare Dashboard](https://dash.cloudflare.com/) 登入（沒有帳號請先註冊，免費）

### 2. 建立 Worker

1. 點選左側選單 **Workers & Pages**
2. 點選 **Create**
3. 選擇 **Create Worker**
4. 取一個名字，例如 `ig-scraper`
5. 點選 **Deploy**

### 3. 編輯程式碼

1. 部署後點選 **Edit code**
2. 刪除預設的程式碼
3. 複製 `ig-scraper.js` 的全部內容貼上
4. 點選 **Deploy**

### 4. 取得 Worker URL

部署完成後，你會得到一個 URL，格式如下：
```
https://ig-scraper.你的帳號.workers.dev
```

### 5. 設定允許的網域

在 `ig-scraper.js` 中修改 `ALLOWED_ORIGINS`，加入你的網站網址：

```javascript
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'https://你的網站.vercel.app',
  'https://你的網站.github.io',
];
```

## 使用方式

### API 端點

```
GET /scrape?url=<instagram_post_url>
```

### 範例

```
https://ig-scraper.xxx.workers.dev/scrape?url=https://www.instagram.com/p/DSknU0TD17o/
```

### 回傳格式

```json
{
  "success": true,
  "type": "post",
  "shortcode": "DSknU0TD17o",
  "caption": "貼文內容...",
  "date": "2024-01-15T12:00:00.000Z",
  "owner": {
    "username": "xxxibgdrgn",
    "fullName": "G-Dragon"
  },
  "media": [
    {
      "type": "image",
      "url": "https://...",
      "width": 1080,
      "height": 1350
    }
  ]
}
```

## 限制

- ✅ 支援公開貼文（Post）
- ✅ 支援 Reels
- ✅ 支援輪播（多張圖片）
- ❌ 不支援 Story（需要登入）
- ❌ 不支援私人帳號

## 免費額度

Cloudflare Workers 免費方案：
- 每天 100,000 次請求
- 每次請求最多 10ms CPU 時間

對於個人備份用途完全夠用！
