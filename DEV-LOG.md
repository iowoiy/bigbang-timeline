# BIGBANG 共筆年表 — 開發日誌

> React 18 + Vite 6 + Tailwind CSS v4 | 部署於 GitHub Pages
> 後端：Cloudflare D1 + Workers

---

## 已完成的重構 / 優化

### Phase 1：抽出共用工具函式 → `utils/`
- `utils/members.js` — 成員常數 `MEMBERS`、`getMemberColor()`、`genId()`
- `utils/media.js` — 縮圖/檢視 URL、YouTube 判斷與縮圖
- `utils/date.js` — `formatDate()`、`formatDateTime()`
- `utils/upload.js` — ImgBB / Cloudinary 上傳統一介面
- `utils/api.js` — 時間軸 / 社群 / 會員 / B-stage 四組 CRUD
- `data/authors.js` — 作者常數 & badge style
- `data/categories.js` — 分類常數 & 顏色
- `config.js` — API base URL 等環境設定

### Phase 2：拆分 App.jsx 元件
- `EventCard.jsx` (83 行) — 時間軸卡片
- `EventModal.jsx` (521 行) — 新增/編輯事件 Modal
- `ImageCarousel.jsx` (78 行) — 圖片輪播
- `TimelineFilters.jsx` (115 行) — 年份/成員/分類篩選
- `NavMenu.jsx` (36 行) — 漢堡選單導航

### Phase 3：統一 API CRUD → `utils/api.js`
- 四頁面 API 呼叫統一到 `timelineApi` / `socialApi` / `membershipApi` / `bstageApi`

### Phase 4：引入 Tailwind CSS v4
- 安裝 `@tailwindcss/vite`，建立 `src/tailwind.css`
- `@theme` 區塊註冊品牌色、字型、斷點、動畫
- 定義 `body` / `body.light-mode` CSS 變數系統

### Phase 5：CSS 變數統一主題
- 4 個 CSS 檔硬寫色碼全部替換為 CSS custom properties
- 刪除大量重複的 `body.light-mode` override（淨減 581 行）
- 涵蓋檔案：`App.css`、`SocialArchive.css`、`MembershipArchive.css`、`BstageArchive.css`

### 其他已完成
- 廢棄程式碼清理 + Google Fonts preload
- 共用 `NavMenu` 元件（三頁面共用漢堡選單）

---

## 目前程式碼規模

| 檔案 | 行數 | 備註 |
|------|------|------|
| `App.jsx` | 435 | 主頁面 + 時間軸 |
| `SocialArchive.jsx` | 1,971 | 需拆分 |
| `MembershipArchive.jsx` | 1,597 | 需拆分 |
| `BstageArchive.jsx` | 987 | 可拆分 |
| `EventModal.jsx` | 521 | 可拆分 |
| `App.css` | 1,856 | |
| `SocialArchive.css` | 2,311 | 與其他 archive 大量重複 |
| `MembershipArchive.css` | 2,143 | 同上 |
| `BstageArchive.css` | 1,664 | 同上 |
| `tailwind.css` | 163 | 主題變數定義 |
| **JS 總計** | **~6,300** | |
| **CSS 總計** | **~8,137** | |

---

## 待做優化（按優先度）

### 高優先

1. **三個 Archive CSS 抽出共用樣式**
   - 建立 `ArchiveBase.css`，modal / 卡片 / 篩選器 / toast / 表單 / 確認 dialog / 檢視 modal 全部共用
   - 三個 archive CSS 各只保留該頁獨有的樣式
   - 預估減少 ~2,000–3,000 行重複 CSS

2. **拆分 SocialArchive.jsx (1,971 行)**
   - 抽出 ViewModal、EditModal、ConfirmDialog
   - 抽出 `useBatchOperations` hook（批次操作邏輯）
   - 抽出 `useBrokenImageCheck` hook

3. **拆分 MembershipArchive.jsx (1,597 行)**
   - 抽出 ImportModal（b.stage 匯入流程）
   - 抽出 ViewModal、EditModal

4. **Vite manualChunks 移除 hls.js**
   - hls.js 512KB 目前被強制分成獨立 chunk，但應讓 lazy loading 自然處理
   - 只有 MembershipArchive 用到，已 `React.lazy` 載入

5. **EventCard 加 React.memo**
   - 時間軸頁 100+ 張卡片，每次 state 變更全部 re-render

### 中優先

6. **加 vite-plugin-compression** — gzip/brotli 壓縮，傳輸量再減 60-70%
7. **BstageArchive 改為 React.lazy** — 目前沒有 lazy loading（Social 和 Membership 都有）
8. **Modal focus trap** — 無障礙合規
9. **icon-only 按鈕加 ARIA label** — 螢幕閱讀器支援
10. **圖片加 `loading="lazy"`** — 減少首屏下載量

### 低優先

11. `src/backup/*.json` 移出 src 目錄（避免被打包）
12. 加 `prefers-reduced-motion` 媒體查詢
13. ImageCarousel 鍵盤方向鍵導航
14. 清理空的 `src/hooks/` 目錄（或開始放 custom hooks）

---

## 技術架構

```
src/
├── App.jsx                 # 主頁面（時間軸）
├── App.css                 # 時間軸樣式
├── main.jsx                # 入口
├── config.js               # 環境設定
├── tailwind.css            # Tailwind v4 主題 + CSS 變數
├── components/
│   ├── EventCard.jsx       # 時間軸卡片
│   ├── EventModal.jsx      # 事件編輯 Modal
│   ├── ImageCarousel.jsx   # 圖片輪播
│   ├── TimelineFilters.jsx # 篩選器
│   ├── NavMenu.jsx         # 漢堡選單
│   ├── SocialArchive.jsx   # 社群備份頁（IG）
│   ├── SocialArchive.css
│   ├── MembershipArchive.jsx # 會員備份頁
│   ├── MembershipArchive.css
│   ├── BstageArchive.jsx   # B.stage 備份頁
│   └── BstageArchive.css
├── data/
│   ├── authors.js          # 作者定義
│   ├── categories.js       # 分類定義
│   └── defaultEvents.js    # 預設事件資料
└── utils/
    ├── api.js              # API CRUD
    ├── date.js             # 日期格式化
    ├── media.js            # 媒體 URL 處理
    ├── members.js          # 成員常數
    └── upload.js           # 圖片上傳
```

## 主題系統

暗/亮模式透過 `body` / `body.light-mode` 的 CSS custom properties 切換：

- 背景：`--bg`, `--bg-surface`, `--bg-surface-hover`, `--bg-header`, `--bg-deep`
- 文字：`--text`, `--text-secondary`, `--text-muted`, `--text-dim`, `--text-hint`, `--text-body`, `--text-strong`
- 邊框：`--border`, `--border-gold`, `--border-light`, `--border-medium`
- 覆蓋：`--overlay-subtle`, `--overlay-light`, `--overlay-backdrop`
- 組合：`--gradient-gold`, `--shadow-gold`, `--focus-ring`
- 金色 RGB 通道：`--gold-accent-rgb`（用於 `rgba(var(--gold-accent-rgb), ALPHA)`）

品牌色在 `@theme` 區塊定義：`--color-gold`, `--color-red`, `--color-teal` 等，不隨模式切換。

---

## 部署

- GitHub Pages，base path: `/bigbang-timeline/`
- `npm run build` → Vite 打包
- deploy commits 使用 `gh-pages` 分支

## 後端

- Cloudflare D1（SQLite）+ Workers
- 各頁面獨立 API endpoint
- 圖片：ImgBB + Cloudinary 雙備份
