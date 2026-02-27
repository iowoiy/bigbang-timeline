#!/usr/bin/env node
/**
 * IG 帳號貼文完整備份腳本 — Node.js 版
 *
 * 功能：抓取 IG 帳號所有貼文 → 跳過已備份的 → 上傳圖片到 ImgBB/Cloudinary → 寫入 D1
 *
 * 用法：
 *   node fetch-ig-urls.mjs <username>
 *   node fetch-ig-urls.mjs xxxibgdrgn
 *   node fetch-ig-urls.mjs ttt --reels-only
 *
 * 選項：
 *   --reels-only    只備份 Reels
 *   --posts-only    只備份一般貼文
 *   --urls-only     只收集 URL（不上傳/不存 DB，舊模式）
 *   --limit <n>     最多處理 n 筆新貼文（預設：全部）
 *   --output <file> URL 模式下輸出到檔案
 *   --delay <ms>    IG 請求間隔毫秒（預設：2000）
 *   --dry-run       只列出會新增的貼文，不實際執行
 *   --full-scan     完整掃描所有貼文（不因連續重複而停止）
 *
 * Cookie 取得方式：
 *   1. 在瀏覽器登入 instagram.com
 *   2. F12 → Network → 重新整理頁面
 *   3. 找任一個 instagram.com 請求 → Headers → Request Headers → Cookie
 *   4. 右鍵 Copy value → 貼到下方 COOKIE 常數
 */

// ====== 把你的 IG cookie 貼在這裡 ======
const COOKIE = `ig_did=51C3A405-4CD5-4903-9C27-8335F834DA8E; mid=aTavNQAEAAEYQXt7jttUX4pVfyOw; datr=6P42aT3iIFmJtCJaNJzi5Oqs; ps_l=1; ps_n=1; ds_user_id=25247850326; csrftoken=wXFt49YoDtQiIZ6aFNHFkk1fi8hEgeJG; dpr=1; sessionid=25247850326%3APSrJCv7wa9QSi8%3A12%3AAYi1SD7-N9nLARQkMaWZuyUqIkXk1laIsZg5SD1GcLk; wd=908x823; rur="HIL\\05425247850326\\0541803763111:01fec7cd6b746e52c8875fcf5415b1e84037f48463ddaa00393298243232c0834ed04980"`;

// ====== D1 API 設定（與前端 config.js 同步） ======
const D1_API_URL = 'https://bigbang-api.iowoiy-yo.workers.dev/api';
const D1_API_KEY = 'bigbang2008vipmartina';

// ====== 圖片上傳設定 ======
const UPLOAD_KEYS = {
  'G-Dragon': {
    imgbb: 'eb1e9a7022e63ecc91b8710e5de5bf9c',
    cloudName: 'de49vywlo',
    preset: 'gdragon-ig',
  },
  'T.O.P': {
    imgbb: '0b1496efe89ea09d0615c315051728a5',
    cloudName: 'dgkgt9w1q',
    preset: 'teamtttop',
  },
  _default: {
    imgbb: '672b4da7edd52fce03eec8e05084b39f',
    cloudName: 'dn0jpjoek',
    preset: 'bigbang-socialmedia',
  },
};

// ====== IG 帳號 → 成員對應 ======
const IG_ACCOUNTS = {
  'xxxibgdrgn': 'G-Dragon',
  'ttt': 'T.O.P',
  'tttopost': 'T.O.P',
  '__youngbae__': '太陽',
  'd_lable_official': '大聲',
  'bigbangofficial': '全員',
};

// 額外帳號（prefix match）
const IG_ACCOUNT_PREFIXES = [
  { prefix: 'top.ttt.story', member: 'T.O.P', type: 'story' },
];

// ============================================================

const IG_APP_ID = '936619743392459';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== 命令列參數 =====
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    username: null,
    reelsOnly: false,
    postsOnly: false,
    urlsOnly: false,
    limit: Infinity,
    output: null,
    delay: 2000,
    dryRun: false,
    fullScan: false,
  };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--reels-only') opts.reelsOnly = true;
    else if (arg === '--posts-only') opts.postsOnly = true;
    else if (arg === '--urls-only') opts.urlsOnly = true;
    else if (arg === '--dry-run') opts.dryRun = true;
    else if (arg === '--full-scan') opts.fullScan = true;
    else if (arg === '--limit' && args[i + 1]) opts.limit = parseInt(args[++i], 10);
    else if (arg === '--output' && args[i + 1]) opts.output = args[++i];
    else if (arg === '--delay' && args[i + 1]) opts.delay = parseInt(args[++i], 10);
    else if (!arg.startsWith('--') && !opts.username) opts.username = arg;
  }
  return opts;
}

// ===== 成員偵測 =====
function detectMember(username) {
  if (!username) return '全員';
  const lower = username.toLowerCase();
  for (const [acct, member] of Object.entries(IG_ACCOUNTS)) {
    if (lower === acct.toLowerCase()) return member;
  }
  for (const { prefix, member } of IG_ACCOUNT_PREFIXES) {
    if (lower.startsWith(prefix.toLowerCase())) return member;
  }
  return '全員';
}

// ===== ID 生成（與前端 genId 一致）=====
function genId() {
  return 's-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
}

// ===== IG HTTP 請求 =====
function igHeaders() {
  const csrfToken = COOKIE.match(/csrftoken=([^;]+)/)?.[1] ?? '';
  return {
    'Cookie': COOKIE,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    'X-IG-App-ID': IG_APP_ID,
    'X-CSRFToken': csrfToken,
    'Referer': 'https://www.instagram.com/',
    'Accept': '*/*',
  };
}

async function igFetch(url) {
  const res = await fetch(url, { headers: igHeaders() });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const text = await res.text();
  if (!text.startsWith('{') && !text.startsWith('[')) {
    throw new Error('回傳非 JSON（cookie 可能過期）');
  }
  return JSON.parse(text);
}

// ===== D1 API =====
async function d1Fetch(endpoint, options = {}) {
  const res = await fetch(`${D1_API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': D1_API_KEY,
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) throw new Error(`D1 API ${res.status}`);
  return res.json();
}

async function loadExistingArchives() {
  return d1Fetch('/social').catch(() => []);
}

async function saveToD1(item) {
  return d1Fetch('/social', { method: 'POST', body: JSON.stringify(item) });
}

// ===== 下載 IG 圖片（帶 cookie）=====
async function downloadImage(url) {
  const res = await fetch(url, {
    headers: {
      'Cookie': COOKIE,
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
    },
  });
  if (!res.ok) throw new Error(`下載失敗 HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 100) throw new Error(`下載檔案太小 (${buf.length} bytes)`);
  return buf.toString('base64');
}

// ===== 圖片上傳 =====
function getUploadKeys(member) {
  return UPLOAD_KEYS[member] || UPLOAD_KEYS._default;
}

async function uploadToImgBB(base64, member) {
  const { imgbb } = getUploadKeys(member);
  const form = new FormData();
  form.append('image', base64);
  const res = await fetch(`https://api.imgbb.com/1/upload?key=${imgbb}`, {
    method: 'POST',
    body: form,
  });
  const data = await res.json();
  if (data.success) return data.data.url;
  throw new Error(data?.error?.message || 'ImgBB 上傳失敗');
}

async function uploadToCloudinary(base64, member) {
  const { cloudName, preset } = getUploadKeys(member);
  const form = new FormData();
  form.append('file', `data:image/jpeg;base64,${base64}`);
  form.append('upload_preset', preset);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: 'POST', body: form }
  );
  const data = await res.json();
  if (data.secure_url) return data.secure_url;
  throw new Error(data?.error?.message || 'Cloudinary 上傳失敗');
}

// 上傳單張圖片（先下載 → Cloudinary 主 + ImgBB 備）
async function uploadImage(imageUrl, member) {
  let base64;
  try {
    base64 = await downloadImage(imageUrl);
  } catch (err) {
    console.error(`\n      ⚠️ 下載圖片失敗: ${err.message}`);
    return { url: imageUrl, type: 'image' };
  }

  let cloudinaryUrl = null;
  let imgbbUrl = null;

  // Cloudinary（主要）
  try {
    cloudinaryUrl = await uploadToCloudinary(base64, member);
  } catch (err) {
    console.error(`\n      ⚠️ Cloudinary: ${err.message}`);
  }

  // ImgBB（備用）
  try {
    imgbbUrl = await uploadToImgBB(base64, member);
  } catch (err) {
    console.error(`\n      ⚠️ ImgBB: ${err.message}`);
  }

  // 至少一個成功就用，都失敗就用原始 URL
  const url = cloudinaryUrl || imgbbUrl || imageUrl;
  const backupUrl = cloudinaryUrl ? imgbbUrl : null;
  return { url, type: 'image', ...(backupUrl && { backupUrl }) };
}

// ===== 從 feed item 提取媒體列表 =====
function extractMedia(item) {
  const media = [];

  if (item.carousel_media) {
    // 輪播貼文
    for (const m of item.carousel_media) {
      if (m.video_versions?.length) {
        media.push({
          type: 'video',
          url: m.video_versions[0].url,
          thumbnail: m.image_versions2?.candidates?.[0]?.url || null,
        });
      } else if (m.image_versions2?.candidates?.length) {
        media.push({
          type: 'image',
          url: m.image_versions2.candidates[0].url,
        });
      }
    }
  } else if (item.video_versions?.length) {
    // 單一影片
    media.push({
      type: 'video',
      url: item.video_versions[0].url,
      thumbnail: item.image_versions2?.candidates?.[0]?.url || null,
    });
  } else if (item.image_versions2?.candidates?.length) {
    // 單一圖片
    media.push({
      type: 'image',
      url: item.image_versions2.candidates[0].url,
    });
  }

  return media;
}

// ===== 上傳整筆貼文的所有媒體 =====
async function uploadMediaList(mediaList, member) {
  const result = [];

  for (let i = 0; i < mediaList.length; i++) {
    const m = mediaList[i];

    if (m.type === 'image') {
      const uploaded = await uploadImage(m.url, member);
      result.push(uploaded);
    } else if (m.type === 'video') {
      // 影片保留原始 URL，只上傳縮圖
      const videoItem = { url: m.url, type: 'video' };

      if (m.thumbnail) {
        let thumbBase64;
        try {
          thumbBase64 = await downloadImage(m.thumbnail);
        } catch (err) {
          console.error(`\n      ⚠️ 下載縮圖失敗: ${err.message}`);
          videoItem.thumbnail = m.thumbnail;
          result.push(videoItem);
          continue;
        }

        let cloudinaryThumb = null;
        let imgbbThumb = null;
        try { cloudinaryThumb = await uploadToCloudinary(thumbBase64, member); } catch (err) {
          console.error(`\n      ⚠️ 縮圖 Cloudinary: ${err.message}`);
        }
        try { imgbbThumb = await uploadToImgBB(thumbBase64, member); } catch (err) {
          console.error(`\n      ⚠️ 縮圖 ImgBB: ${err.message}`);
        }

        videoItem.thumbnail = cloudinaryThumb || imgbbThumb || m.thumbnail;
        if (cloudinaryThumb && imgbbThumb) videoItem.thumbnailBackupUrl = imgbbThumb;
      }

      result.push(videoItem);
    }
  }

  return result;
}

// ===== 從 URL 提取 shortcode（去重用） =====
// 只比 shortcode，不比 /p/ vs /reel/ 避免格式不一致
function extractShortcode(url) {
  if (!url) return '';
  const m = url.match(/\/(p|reel|reels|tv)\/([a-zA-Z0-9_-]+)/);
  return m ? m[2] : '';
}

// ===== 從 taken_at 轉台灣時間 =====
function toTaiwanDateTime(takenAt) {
  if (!takenAt) return { date: new Date().toISOString().split('T')[0], time: '' };
  const utc = new Date(takenAt * 1000);
  const tw = new Date(utc.getTime() + 8 * 60 * 60 * 1000);
  const date = `${tw.getUTCFullYear()}-${String(tw.getUTCMonth() + 1).padStart(2, '0')}-${String(tw.getUTCDate()).padStart(2, '0')}`;
  const time = `${String(tw.getUTCHours()).padStart(2, '0')}:${String(tw.getUTCMinutes()).padStart(2, '0')}`;
  return { date, time };
}

// ===== 主程式 =====
async function main() {
  const opts = parseArgs();

  if (!opts.username) {
    console.error(`
用法：node fetch-ig-urls.mjs <username> [選項]

選項：
  --reels-only    只備份 Reels
  --posts-only    只備份一般貼文
  --urls-only     只收集 URL（不上傳/不存 DB）
  --limit <n>     最多處理 n 筆新貼文
  --output <file> URL 模式下輸出到檔案
  --delay <ms>    IG 請求間隔（預設 2000）
  --dry-run       只列出新貼文，不實際執行
  --full-scan     完整掃描（不因連續重複停止）

範例：
  node fetch-ig-urls.mjs xxxibgdrgn
  node fetch-ig-urls.mjs ttt --reels-only
  node fetch-ig-urls.mjs xxxibgdrgn --dry-run
  node fetch-ig-urls.mjs xxxibgdrgn --urls-only --output gd-urls.txt
`);
    process.exit(1);
  }

  if (!COOKIE) {
    console.error('❌ 請先在腳本中設定 COOKIE');
    process.exit(1);
  }

  const { username, reelsOnly, postsOnly, urlsOnly, limit, output, delay, dryRun, fullScan } = opts;

  if (fullScan) {
    console.error('🔄 完整掃描模式：將掃描所有貼文，不會因連續重複而停止');
  }

  // ── Step 1: 取得 user_id ──
  console.error(`🔍 查詢用戶 @${username} ...`);
  let userId, postCount;
  try {
    const data = await igFetch(
      `https://i.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(username)}`
    );
    const user = data?.data?.user;
    if (!user?.id) throw new Error('找不到用戶');
    userId = user.id;
    postCount = user.edge_owner_to_timeline_media?.count ?? null;
    console.error(`   ✅ 用戶 ID: ${userId}  (${user.full_name || username})`);
    console.error(`   📊 貼文數: ${postCount ?? '未知'}`);
  } catch (e) {
    console.error(`\n❌ ${e.message}`);
    console.error('   請確認 cookie 是否過期 / 帳號是否正確');
    process.exit(1);
  }

  const member = detectMember(username);
  console.error(`   👤 成員：${member}`);

  // ── Step 2: 載入現有資料（去重用） ──
  let existingUrls = new Set();
  if (!urlsOnly) {
    console.error('\n📦 載入現有備份資料...');
    try {
      const archives = await loadExistingArchives();
      existingUrls = new Set(
        archives.map((a) => extractShortcode(a.igUrl)).filter(Boolean)
      );
      console.error(`   已有 ${existingUrls.size} 筆（將跳過重複）`);
    } catch (e) {
      console.error(`   ⚠️ 載入失敗: ${e.message}（將不做去重）`);
    }
  }

  // ── Step 3: 抓取貼文（邊抓邊去重，連續重複即停） ──
  const newItems = [];     // 新貼文
  let skipCount = 0;       // 跳過的重複數
  let totalFetched = 0;
  let maxId = null;
  let page = 0;
  let retryCount = 0;
  const MAX_RETRIES = 5;
  const CONSECUTIVE_DUP_STOP = 100; // 連續碰到這麼多筆已存在的就停（調高以避免遺漏）

  console.error(`\n🚀 開始抓取 @${username} 的貼文...\n`);

  let consecutiveDups = 0;
  let stopped = false;

  while (!stopped) {
    try {
      page++;
      const pct = postCount ? ` (${Math.min(Math.round((totalFetched / postCount) * 100), 100)}%)` : '';
      process.stderr.write(`📄 第 ${page} 頁${pct}...`);

      let url = `https://www.instagram.com/api/v1/feed/user/${userId}/?count=33`;
      if (maxId) url += `&max_id=${maxId}`;
      const data = await igFetch(url);

      const items = data?.items;
      if (!items?.length) {
        console.error(' ✅ 沒有更多貼文了。');
        break;
      }

      let newCount = 0;
      let dupCount = 0;

      for (const item of items) {
        const code = item.code;
        if (!code) continue;

        const productType = item.product_type;
        let type = 'p';
        if (productType === 'clips') type = 'reel';
        else if (productType === 'igtv') type = 'tv';

        // 篩選類型
        if (reelsOnly && type !== 'reel') continue;
        if (postsOnly && type === 'reel') continue;

        totalFetched++;

        // 即時去重（直接用 shortcode 比對）
        if (!urlsOnly) {
          if (existingUrls.has(code)) {
            skipCount++;
            dupCount++;
            consecutiveDups++;

            if (!fullScan && consecutiveDups >= CONSECUTIVE_DUP_STOP) {
              console.error(` ⏭️ 連續 ${CONSECUTIVE_DUP_STOP} 筆重複，後面都是舊的了（加 --full-scan 可完整掃描）`);
              stopped = true;
              break;
            }
            continue;
          }
          consecutiveDups = 0; // 碰到新的就重置
        }

        newItems.push({ ...item, _type: type });
        newCount++;
      }

      console.error(` +${newCount} 新 / ${dupCount} 重複（新貼文累計 ${newItems.length}）`);

      if (stopped) break;

      if (!data.more_available || !data.next_max_id) {
        console.error('\n✅ 已到最後一頁。');
        break;
      }
      maxId = data.next_max_id;
      retryCount = 0;
      await sleep(delay + Math.random() * 1000);
    } catch (err) {
      console.error(`\n❌ 第 ${page} 頁失敗: ${err.message}`);
      retryCount++;
      if (retryCount >= MAX_RETRIES) {
        console.error(`⏸️ 連續失敗 ${MAX_RETRIES} 次。已收集 ${newItems.length} 筆新貼文。`);
        break;
      }
      const waitSec = 20 * retryCount;
      console.error(`   等待 ${waitSec} 秒後重試...（${retryCount}/${MAX_RETRIES}）`);
      await sleep(waitSec * 1000);
      page--;
    }
  }

  // ── URL only 模式 ──
  if (urlsOnly) {
    const urls = newItems.map((item) => {
      return `https://www.instagram.com/${item._type}/${item.code}/`;
    });
    const urlText = urls.join('\n');
    if (output) {
      const fs = await import('node:fs/promises');
      await fs.writeFile(output, urlText + '\n', 'utf-8');
      console.error(`\n💾 已儲存 ${urls.length} 筆到 ${output}`);
    } else {
      console.log(urlText);
      try {
        const { execSync } = await import('node:child_process');
        if (process.platform === 'darwin') execSync('pbcopy', { input: urlText });
        else if (process.platform === 'win32') execSync('clip', { input: urlText });
        console.error(`\n✅ ${urls.length} 筆 URL 已複製到剪貼簿`);
      } catch {
        console.error(`\n📊 共 ${urls.length} 筆 URL`);
      }
    }
    return;
  }

  // ── 統計 ──
  console.error(`\n📊 去重結果：`);
  console.error(`   抓到：${totalFetched} 筆`);
  console.error(`   已存在：${skipCount} 筆（跳過）`);
  console.error(`   新貼文：${newItems.length} 筆`);

  if (newItems.length === 0) {
    console.error('\n✅ 沒有新貼文需要備份！');
    return;
  }

  // 套用 limit
  const toProcess = newItems.slice(0, limit);
  if (toProcess.length < newItems.length) {
    console.error(`   本次處理：${toProcess.length} 筆（--limit ${limit}）`);
  }

  // ── dry-run 模式 ──
  if (dryRun) {
    console.error(`\n🔍 Dry run — 以下 ${toProcess.length} 筆會被新增：\n`);
    for (const item of toProcess) {
      const { date, time } = toTaiwanDateTime(item.taken_at);
      const media = extractMedia(item);
      const caption = (item.caption?.text || '').slice(0, 60);
      console.error(`  ${date} ${time}  ${item._type.padEnd(4)}  ${media.length} 媒體  ${caption || '(無文字)'}`);
    }
    return;
  }

  // ── Step 5: 逐筆上傳 + 存入 D1 ──
  console.error(`\n🚀 開始備份 ${toProcess.length} 筆新貼文...\n`);

  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const item = toProcess[i];
    const igUrl = `https://www.instagram.com/${item._type}/${item.code}/`;
    const { date, time } = toTaiwanDateTime(item.taken_at);
    const caption = item.caption?.text || '';

    process.stderr.write(`[${i + 1}/${toProcess.length}] ${date} ${item.code}...`);

    try {
      // 提取媒體
      const rawMedia = extractMedia(item);

      // 上傳媒體
      const uploadedMedia = await uploadMediaList(rawMedia, member);

      // 貼文類型
      let postType = 'post';
      if (item._type === 'reel') postType = 'reels';
      else if (item.product_type === 'igtv') postType = 'reels';

      // 建立 item（與前端 handleBatchCreate 格式一致）
      const archiveItem = {
        id: genId(),
        type: postType,
        member,
        date,
        time,
        igUrl,
        caption,
        media: uploadedMedia,
        notes: '',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };

      // 存入 D1
      await saveToD1(archiveItem);
      successCount++;
      console.error(` ✅ ${uploadedMedia.length} 媒體`);

      // 加入已存在 set 避免同批次重複
      existingUrls.add(item.code);

      // 上傳間隔（避免 ImgBB rate limit）
      if (i < toProcess.length - 1) {
        await sleep(1500);
      }
    } catch (err) {
      failCount++;
      console.error(` ❌ ${err.message}`);
    }
  }

  // ── 完成 ──
  console.error(`\n✅ 備份完成！`);
  console.error(`   成功：${successCount} 筆`);
  if (failCount > 0) console.error(`   失敗：${failCount} 筆`);
  if (skipCount > 0) console.error(`   跳過重複：${skipCount} 筆`);
}

main().catch((err) => {
  console.error(`\n💥 ${err.message}`);
  process.exit(1);
});
