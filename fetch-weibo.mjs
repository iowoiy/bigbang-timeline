/**
 * 微博貼文抓取腳本 — 半年分檔版
 * 使用方式：node fetch-weibo.mjs
 *
 * 會抓取所有貼文，然後自動依半年區間分別存成 JSON：
 *   weibo_5317843356_2015-H1.json
 *   weibo_5317843356_2015-H2.json
 *   ...
 */

const UID = "5317843356";
const OUTPUT_DIR = "./weibo-data";
const BATCH_SIZE = 20;

// ====== 把你的 cookie 貼在這裡 ======
const COOKIE = `XSRF-TOKEN=eDyZfncc1t__vQ6n9D8U681x; SCF=AiJTmB2lmLvc5H9DU1vUbq4d0TmgOInho4eSN30j-KJhrDYoQEZg9mDGaWBeHGHG0HuNOQx55aXnMgsU0Ibz9WY.; SUB=_2A25EnDbtDeRhGeFL61ES8CfMzjyIHXVn0DYlrDV8PUNbmtANLRjNkW9NQrTIiSV099FCMY-1aBRD8u75M7HvkDOZ; SUBP=0033WrSXqPxfM725Ws9jqgMF55529P9D9WhUT.AV0nq9ZhsPE4o2xbr85JpX5KzhUgL.FoMfehe0eh.7SK52dJLoIp7LxKML1KBLBKnLxKqL1hnLBoMNSK50e054eh-7; ALF=02_1774179261; WBPSESS=E9zwnk2YT_zjKmv5Z_sUBEAVWFEshJiR7t5sY777aNyDu4S14hm4NNJUU8bXBGSCk94YaNkvr1QErWq7loXygS5hYTKCjBLDw5RONJtQDqJU2EcH8iAq8UbBJFisBFanc_mxcHTb4Y10yfniQNb7-w==; _s_tentry=weibo.com; Apache=6631591743141.437.1771587592980; SINAGLOBAL=6631591743141.437.1771587592980; ULV=1771587592981:1:1:1:6631591743141.437.1771587592980:`;

// 從 cookie 中提取 XSRF-TOKEN
const xsrfToken = COOKIE.match(/XSRF-TOKEN=([^;]+)/)?.[1] ?? "";

const HEADERS = {
  Cookie: COOKIE,
  "X-XSRF-TOKEN": xsrfToken,
  Referer: "https://weibo.com",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ===== 斷點續抓設定 =====
const PROGRESS_FILE = `./weibo-data/.progress_${UID}.json`;

async function loadProgress() {
  const fs = await import("node:fs/promises");
  try {
    const raw = await fs.readFile(PROGRESS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { lastPage: 0, posts: [] };
  }
}

async function saveProgress(lastPage, posts) {
  const fs = await import("node:fs/promises");
  await fs.mkdir("./weibo-data", { recursive: true });
  await fs.writeFile(
    PROGRESS_FILE,
    JSON.stringify({ lastPage, postsCount: posts.length, savedAt: new Date().toISOString() }),
    "utf-8"
  );
}

async function fetchPage(page) {
  const url = `https://weibo.com/ajax/statuses/mymblog?uid=${UID}&page=${page}&feature=0`;
  const res = await fetch(url, { headers: HEADERS });
  if (!res.ok) throw new Error(`HTTP ${res.status} on page ${page}`);
  return res.json();
}

function extractPost(status) {
  return {
    id: status.id,
    mid: status.mid,
    created_at: status.created_at,
    text_raw: status.text_raw ?? "",
    text_html: status.text ?? "",
    reposts_count: status.reposts_count,
    comments_count: status.comments_count,
    attitudes_count: status.attitudes_count,
    source: status.source ?? "",
    pics: (status.pic_ids ?? []).map((pid) => {
      const info = status.pic_infos?.[pid];
      return {
        pid,
        url: info?.original?.url ?? info?.large?.url ?? "",
      };
    }),
    retweeted: status.retweeted_status
      ? {
          id: status.retweeted_status.id,
          user: status.retweeted_status.user?.screen_name ?? "",
          text_raw: status.retweeted_status.text_raw ?? "",
        }
      : null,
  };
}

/**
 * 根據 created_at 取得半年區間 key，例如 "2025-H1" 或 "2025-H2"
 */
function getHalfYearKey(createdAt) {
  const d = new Date(createdAt);
  const year = d.getFullYear();
  const half = d.getMonth() < 6 ? "H1" : "H2";
  return `${year}-${half}`;
}

async function writeGroupedFiles(fs, path, posts, reason = "") {
  if (posts.length === 0) return;

  const title = reason
    ? `\n📦 ${reason}：共 ${posts.length} 條貼文，開始依半年分檔...\n`
    : `\n📦 共 ${posts.length} 條貼文，開始依半年分檔...\n`;
  console.log(title);

  const groups = {};
  for (const post of posts) {
    const key = getHalfYearKey(post.created_at);
    if (!groups[key]) groups[key] = [];
    groups[key].push(post);
  }

  const sortedKeys = Object.keys(groups).sort();

  for (const key of sortedKeys) {
    const groupPosts = groups[key];
    groupPosts.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

    const filename = `weibo_${UID}_${key}.json`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const output = {
      uid: UID,
      period: key,
      fetched_at: new Date().toISOString(),
      total: groupPosts.length,
      posts: groupPosts,
    };

    await fs.writeFile(filepath, JSON.stringify(output, null, 2), "utf-8");
    console.log(
      `  💾 ${filename}  — ${groupPosts.length} 條（${groupPosts[0].created_at.slice(4, 15)} ~ ${groupPosts[groupPosts.length - 1].created_at.slice(4, 15)}）`
    );
  }

  console.log(`\n✅ 已更新 ${sortedKeys.length} 個檔案，存放於 ${OUTPUT_DIR}/`);
}

async function main() {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");

  // 確保輸出資料夾存在
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  const allPosts = [];
  let page = 1;
  let fetchedPagesInRun = 0;

  console.log(`🚀 開始抓取 UID: ${UID} 的所有微博貼文...\n`);

  // ===== Phase 1: 載入已有進度 =====
  const progress = await loadProgress();
  if (progress.lastPage > 0) {
    console.log(`📌 偵測到上次進度：已抓到第 ${progress.lastPage} 頁（${progress.postsCount} 條）`);
    console.log(`   從第 ${progress.lastPage + 1} 頁繼續...
`);
    page = progress.lastPage + 1;

    // 載入已存的半年分檔，合併回 allPosts
    const dataDir = await fs.readdir(OUTPUT_DIR).catch(() => []);
    for (const f of dataDir) {
      if (f.startsWith(`weibo_${UID}_`) && f.endsWith(".json") && !f.includes(".progress")) {
        const raw = await fs.readFile(path.join(OUTPUT_DIR, f), "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.posts) allPosts.push(...parsed.posts);
      }
    }
    console.log(`   已載入 ${allPosts.length} 條歷史貼文\n`);
  }

  // ===== Phase 2: 抓取貼文（帶重試 + 自動降速）=====
  let retryCount = 0;
  const MAX_RETRIES = 3;

  while (true) {
    try {
      process.stdout.write(`📄 第 ${page} 頁...`);
      const data = await fetchPage(page);

      const list = data?.data?.list;
      if (!list || list.length === 0) {
        console.log(" ✅ 沒有更多貼文了。");
        break;
      }

      const posts = list.map(extractPost);
      allPosts.push(...posts);
      console.log(` ${posts.length} 條（累計 ${allPosts.length}）`);
      fetchedPagesInRun++;

      // 每抓 20 頁就先整理資料並存一次進度
      if (fetchedPagesInRun % BATCH_SIZE === 0) {
        console.log(`\n🧹 已抓滿 ${BATCH_SIZE} 頁，先整理資料並存檔...`);
        await saveProgress(page, allPosts);
        await writeGroupedFiles(fs, path, allPosts, `已抓 ${fetchedPagesInRun} 頁`);
      }

      retryCount = 0;
      page++;
      // 延遲 2~5 秒（比之前更保守）
      const delay = 2000 + Math.random() * 3000;
      await sleep(delay);
    } catch (err) {
      console.error(`\n❌ 第 ${page} 頁失敗: ${err.message}`);
      retryCount++;

      if (retryCount >= MAX_RETRIES) {
        console.log(`\n⏸️  連續失敗 ${MAX_RETRIES} 次，儲存進度後暫停。`);
        console.log(`   等幾分鐘後重新執行 node fetch-weibo.mjs 即可從第 ${page} 頁繼續。`);
        await saveProgress(page - 1, allPosts);
        break;
      }

      // 被擋住就等久一點再重試
      const waitSec = 30 * retryCount;
      console.log(`   等待 ${waitSec} 秒後重試...（第 ${retryCount}/${MAX_RETRIES} 次）`);
      await sleep(waitSec * 1000);
    }
  }

  if (allPosts.length === 0) {
    console.log("⚠️ 沒有抓到任何貼文，請檢查 cookie 是否過期。");
    return;
  }

  // ===== Final: 最終整理並存檔 =====
  await writeGroupedFiles(fs, path, allPosts, "最終整理");
}

main().catch(console.error);
