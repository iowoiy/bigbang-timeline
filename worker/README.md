# BIGBANG Timeline API Worker

使用 Cloudflare D1 作為資料庫的 API Worker。

## 設定步驟

### 1. 安裝依賴
```bash
cd worker
npm install
```

### 2. 建立 D1 資料庫
```bash
npm run d1:create
```
這會輸出 `database_id`，複製它。

### 3. 更新 wrangler.toml
把上一步的 `database_id` 填入 `wrangler.toml`：
```toml
[[d1_databases]]
binding = "DB"
database_name = "bigbang-db"
database_id = "你的 database_id"
```

### 4. 初始化資料庫 Schema
```bash
npm run d1:init
```

### 5. 設定 API Key（Secret）
```bash
wrangler secret put API_KEY
# 輸入你想要的 API Key
```

### 6. 本地測試
```bash
npm run dev
```

### 7. 部署
```bash
npm run deploy
```

## API 端點

### 時間軸
- `GET /api/events` - 取得所有事件
- `POST /api/events` - 新增事件
- `PUT /api/events/:id` - 更新事件
- `DELETE /api/events/:id` - 刪除事件

### 社群備份
- `GET /api/social` - 取得所有備份
- `POST /api/social` - 新增備份
- `PUT /api/social/:id` - 更新備份
- `DELETE /api/social/:id` - 刪除備份

### 資料遷移（一次性）
- `POST /api/migrate/events` - 匯入時間軸資料
- `POST /api/migrate/social` - 匯入社群備份資料

### 訪客記錄
- `POST /api/visitors` - 記錄訪客（不需 API Key）
- `GET /api/visitors` - 取得訪客記錄（需 API Key）

## 資料遷移

### 從 JSONBin 匯出資料
```bash
# 時間軸
curl -H "X-Master-Key: YOUR_KEY" \
  "https://api.jsonbin.io/v3/b/6993496043b1c97be983d918/latest" \
  -o events.json

# 社群備份（各成員）
curl -H "X-Master-Key: YOUR_KEY" \
  "https://api.jsonbin.io/v3/b/6994c471d0ea881f40c20bd4/latest" \
  -o social_gdragon.json
# ... 其他成員
```

### 匯入到 D1
```bash
# 時間軸（假設 events.json 裡有 record.events 或直接是陣列）
curl -X POST "https://bigbang-api.YOUR_DOMAIN.workers.dev/api/migrate/events" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d @events.json

# 社群備份
curl -X POST "https://bigbang-api.YOUR_DOMAIN.workers.dev/api/migrate/social" \
  -H "Content-Type: application/json" \
  -H "X-API-Key: YOUR_API_KEY" \
  -d @social_gdragon.json
```

## 訪客記錄查詢

```bash
# 最近 10 筆訪客
npx wrangler d1 execute bigbang-db --remote --command "SELECT id, author_id, ip, country, device, browser, datetime(timestamp/1000, 'unixepoch', '+8 hours') as time FROM visitors ORDER BY timestamp DESC LIMIT 10"

# 今日訪客數
npx wrangler d1 execute bigbang-db --remote --command "SELECT COUNT(*) as today FROM visitors WHERE timestamp > (strftime('%s','now','start of day')*1000)"

# 各身份統計
npx wrangler d1 execute bigbang-db --remote --command "SELECT author_id, COUNT(*) as count FROM visitors GROUP BY author_id ORDER BY count DESC"

# 各國訪客統計
npx wrangler d1 execute bigbang-db --remote --command "SELECT country, COUNT(*) as count FROM visitors GROUP BY country ORDER BY count DESC"

# 各裝置統計
npx wrangler d1 execute bigbang-db --remote --command "SELECT device, COUNT(*) as count FROM visitors GROUP BY device ORDER BY count DESC"

# 特定日期的訪客
npx wrangler d1 execute bigbang-db --remote --command "SELECT * FROM visitors WHERE date(timestamp/1000, 'unixepoch') = '2025-02-19' ORDER BY timestamp DESC"
```

## 注意事項
- GET 請求不需要 API Key
- POST/PUT/DELETE 需要在 header 加上 `X-API-Key`（除了 POST /api/visitors）
- CORS 已設定允許 `iowoiy.github.io` 和 `localhost`
