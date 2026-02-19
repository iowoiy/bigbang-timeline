/**
 * BIGBANG Timeline API Worker
 * 使用 Cloudflare D1 作為資料庫
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url)
    const path = url.pathname
    const method = request.method

    // CORS 處理
    const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',')
    const origin = request.headers.get('Origin') || ''
    const isAllowed = allowedOrigins.some(o => origin.includes(o.trim()))

    // CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, X-API-Key',
      'Access-Control-Max-Age': '86400',
    }

    // Preflight request
    if (method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders })
    }

    // API Key 驗證（除了 GET 請求和 POST /api/visitors 外都需要）
    const isVisitorLog = path === '/api/visitors' && method === 'POST'
    if (method !== 'GET' && !isVisitorLog) {
      const apiKey = request.headers.get('X-API-Key')
      if (!apiKey || apiKey !== env.API_KEY) {
        return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
      }
    }

    try {
      // 路由
      // === Events API ===
      if (path === '/api/events' && method === 'GET') {
        return await getEvents(env.DB, url.searchParams, corsHeaders)
      }
      if (path === '/api/events' && method === 'POST') {
        const body = await request.json()
        return await createEvent(env.DB, body, corsHeaders)
      }
      if (path.match(/^\/api\/events\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()
        const body = await request.json()
        return await updateEvent(env.DB, id, body, corsHeaders)
      }
      if (path.match(/^\/api\/events\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()
        return await deleteEvent(env.DB, id, corsHeaders)
      }

      // === Social Archive API ===
      if (path === '/api/social' && method === 'GET') {
        return await getSocialArchives(env.DB, url.searchParams, corsHeaders)
      }
      if (path === '/api/social' && method === 'POST') {
        const body = await request.json()
        return await createSocialArchive(env.DB, body, corsHeaders)
      }
      if (path.match(/^\/api\/social\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()
        const body = await request.json()
        return await updateSocialArchive(env.DB, id, body, corsHeaders)
      }
      if (path.match(/^\/api\/social\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()
        return await deleteSocialArchive(env.DB, id, corsHeaders)
      }

      // === Migration API (一次性使用) ===
      if (path === '/api/migrate/events' && method === 'POST') {
        const body = await request.json()
        return await migrateEvents(env.DB, body, corsHeaders)
      }
      if (path === '/api/migrate/social' && method === 'POST') {
        const body = await request.json()
        return await migrateSocialArchives(env.DB, body, corsHeaders)
      }

      // === Membership Archive API ===
      if (path === '/api/membership' && method === 'GET') {
        return await getMembershipArchives(env.DB, url.searchParams, corsHeaders)
      }
      if (path === '/api/membership' && method === 'POST') {
        const body = await request.json()
        return await createMembershipArchive(env.DB, body, corsHeaders)
      }
      if (path.match(/^\/api\/membership\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()
        const body = await request.json()
        return await updateMembershipArchive(env.DB, id, body, corsHeaders)
      }
      if (path.match(/^\/api\/membership\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()
        return await deleteMembershipArchive(env.DB, id, corsHeaders)
      }

      // === b.stage Archive API ===
      if (path === '/api/bstage' && method === 'GET') {
        return await getBstageArchives(env.DB, url.searchParams, corsHeaders)
      }
      if (path === '/api/bstage' && method === 'POST') {
        const body = await request.json()
        return await createBstageArchive(env.DB, body, corsHeaders)
      }
      if (path.match(/^\/api\/bstage\/[\w-]+$/) && method === 'PUT') {
        const id = path.split('/').pop()
        const body = await request.json()
        return await updateBstageArchive(env.DB, id, body, corsHeaders)
      }
      if (path.match(/^\/api\/bstage\/[\w-]+$/) && method === 'DELETE') {
        const id = path.split('/').pop()
        return await deleteBstageArchive(env.DB, id, corsHeaders)
      }

      // === Visitors API ===
      if (path === '/api/visitors' && method === 'POST') {
        const body = await request.json()
        return await logVisitor(env.DB, request, body, corsHeaders)
      }
      if (path === '/api/visitors' && method === 'GET') {
        // GET 需要 API Key
        const apiKey = request.headers.get('X-API-Key')
        if (!apiKey || apiKey !== env.API_KEY) {
          return jsonResponse({ error: 'Unauthorized' }, 401, corsHeaders)
        }
        return await getVisitors(env.DB, url.searchParams, corsHeaders)
      }

      // 404
      return jsonResponse({ error: 'Not Found' }, 404, corsHeaders)

    } catch (error) {
      console.error('Error:', error)
      return jsonResponse({ error: error.message }, 500, corsHeaders)
    }
  }
}

// =====================================================
// Helper Functions
// =====================================================

function jsonResponse(data, status = 200, corsHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      ...corsHeaders
    }
  })
}

// =====================================================
// Events API
// =====================================================

async function getEvents(db, params, corsHeaders) {
  const year = params.get('year')
  const member = params.get('member')
  const category = params.get('category')

  let query = 'SELECT * FROM events'
  const conditions = []
  const bindings = []

  if (year) {
    conditions.push('year = ?')
    bindings.push(parseInt(year))
  }
  if (member) {
    conditions.push("json_extract(members, '$') LIKE ?")
    bindings.push(`%${member}%`)
  }
  if (category) {
    conditions.push("json_extract(categories, '$') LIKE ?")
    bindings.push(`%${category}%`)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY year ASC, month ASC, day ASC'

  const stmt = db.prepare(query)
  const result = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all()

  // 轉換成前端需要的格式
  const events = result.results.map(row => ({
    id: row.id,
    year: row.year,
    month: row.month,
    day: row.day,
    title: row.title,
    desc: row.description,
    cats: JSON.parse(row.categories || '[]'),
    cat: JSON.parse(row.categories || '[]')[0] || null,
    members: JSON.parse(row.members || '[]'),
    links: JSON.parse(row.links || '[]'),
    notes: JSON.parse(row.notes || '[]'),
    media: JSON.parse(row.media || '[]'),
    editLog: JSON.parse(row.edit_log || '[]'),
  }))

  return jsonResponse(events, 200, corsHeaders)
}

async function createEvent(db, data, corsHeaders) {
  const now = Date.now()
  const id = data.id || 'e-' + now

  await db.prepare(`
    INSERT INTO events (id, year, month, day, title, description, categories, members, links, notes, media, edit_log, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.year,
    data.month,
    data.day || 1,
    data.title,
    data.desc || '',
    JSON.stringify(data.cats || []),
    JSON.stringify(data.members || []),
    JSON.stringify(data.links || []),
    JSON.stringify(data.notes || []),
    JSON.stringify(data.media || []),
    JSON.stringify(data.editLog || [{ author: '', action: '新增', ts: now }]),
    now,
    now
  ).run()

  return jsonResponse({ success: true, id }, 201, corsHeaders)
}

async function updateEvent(db, id, data, corsHeaders) {
  const now = Date.now()

  // 取得現有的 edit_log
  const existing = await db.prepare('SELECT edit_log FROM events WHERE id = ?').bind(id).first()
  let editLog = existing ? JSON.parse(existing.edit_log || '[]') : []

  // 只保留「新增」紀錄 + 加上新的編輯紀錄
  const createLog = editLog.find(e => e.action === '新增')
  editLog = createLog ? [createLog] : []

  if (data.editLog && data.editLog.length > 0) {
    const lastLog = data.editLog[data.editLog.length - 1]
    editLog.push({ ...lastLog, ts: now })
  } else {
    editLog.push({ author: '', action: '編輯', ts: now })
  }

  await db.prepare(`
    UPDATE events SET
      year = ?, month = ?, day = ?, title = ?, description = ?,
      categories = ?, members = ?, links = ?, notes = ?, media = ?,
      edit_log = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    data.year,
    data.month,
    data.day || 1,
    data.title,
    data.desc || '',
    JSON.stringify(data.cats || []),
    JSON.stringify(data.members || []),
    JSON.stringify(data.links || []),
    JSON.stringify(data.notes || []),
    JSON.stringify(data.media || []),
    JSON.stringify(editLog),
    now,
    id
  ).run()

  return jsonResponse({ success: true }, 200, corsHeaders)
}

async function deleteEvent(db, id, corsHeaders) {
  await db.prepare('DELETE FROM events WHERE id = ?').bind(id).run()
  return jsonResponse({ success: true }, 200, corsHeaders)
}

// =====================================================
// Social Archive API
// =====================================================

async function getSocialArchives(db, params, corsHeaders) {
  const member = params.get('member')
  const type = params.get('type')

  let query = 'SELECT * FROM social_archives'
  const conditions = []
  const bindings = []

  if (member && member !== 'all') {
    conditions.push('member = ?')
    bindings.push(member)
  }
  if (type && type !== 'all') {
    conditions.push('type = ?')
    bindings.push(type)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY updated_at DESC'

  const stmt = db.prepare(query)
  const result = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all()

  // 轉換成前端需要的格式
  const archives = result.results.map(row => ({
    id: row.id,
    type: row.type,
    member: row.member,
    date: row.date,
    time: row.time,
    igUrl: row.ig_url,
    caption: row.caption,
    media: JSON.parse(row.media || '[]'),
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return jsonResponse(archives, 200, corsHeaders)
}

async function createSocialArchive(db, data, corsHeaders) {
  const now = Date.now()
  const id = data.id || 's-' + now

  await db.prepare(`
    INSERT INTO social_archives (id, type, member, date, time, ig_url, caption, media, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.type,
    data.member,
    data.date,
    data.time || null,
    data.igUrl || null,
    data.caption || null,
    JSON.stringify(data.media || []),
    data.notes || null,
    data.createdAt || now,
    data.updatedAt || now
  ).run()

  return jsonResponse({ success: true, id }, 201, corsHeaders)
}

async function updateSocialArchive(db, id, data, corsHeaders) {
  const now = Date.now()

  await db.prepare(`
    UPDATE social_archives SET
      type = ?, member = ?, date = ?, time = ?, ig_url = ?,
      caption = ?, media = ?, notes = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    data.type,
    data.member,
    data.date,
    data.time || null,
    data.igUrl || null,
    data.caption || null,
    JSON.stringify(data.media || []),
    data.notes || null,
    now,
    id
  ).run()

  return jsonResponse({ success: true }, 200, corsHeaders)
}

async function deleteSocialArchive(db, id, corsHeaders) {
  await db.prepare('DELETE FROM social_archives WHERE id = ?').bind(id).run()
  return jsonResponse({ success: true }, 200, corsHeaders)
}

// =====================================================
// Migration API (一次性使用)
// =====================================================

async function migrateEvents(db, data, corsHeaders) {
  const events = Array.isArray(data) ? data : data.events || []
  let migrated = 0

  for (const event of events) {
    try {
      const now = Date.now()
      await db.prepare(`
        INSERT OR REPLACE INTO events (id, year, month, day, title, description, categories, members, links, notes, media, edit_log, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        event.id,
        event.year,
        event.month,
        event.day || 1,
        event.title,
        event.desc || '',
        JSON.stringify(event.cats || (event.cat ? [event.cat] : [])),
        JSON.stringify(event.members || []),
        JSON.stringify(event.links || []),
        JSON.stringify(event.notes || []),
        JSON.stringify(event.media || []),
        JSON.stringify(event.editLog || []),
        event.editLog?.[0]?.ts || now,
        event.editLog?.slice(-1)[0]?.ts || now
      ).run()
      migrated++
    } catch (err) {
      console.error(`Failed to migrate event ${event.id}:`, err)
    }
  }

  return jsonResponse({ success: true, migrated, total: events.length }, 200, corsHeaders)
}

async function migrateSocialArchives(db, data, corsHeaders) {
  const archives = Array.isArray(data) ? data : data.archives || []
  let migrated = 0

  for (const archive of archives) {
    try {
      await db.prepare(`
        INSERT OR REPLACE INTO social_archives (id, type, member, date, time, ig_url, caption, media, notes, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).bind(
        archive.id,
        archive.type,
        archive.member,
        archive.date,
        archive.time || null,
        archive.igUrl || null,
        archive.caption || null,
        JSON.stringify(archive.media || []),
        archive.notes || null,
        archive.createdAt || Date.now(),
        archive.updatedAt || Date.now()
      ).run()
      migrated++
    } catch (err) {
      console.error(`Failed to migrate archive ${archive.id}:`, err)
    }
  }

  return jsonResponse({ success: true, migrated, total: archives.length }, 200, corsHeaders)
}

// =====================================================
// Membership Archive API（會員備份）
// =====================================================

async function getMembershipArchives(db, params, corsHeaders) {
  const member = params.get('member')

  let query = 'SELECT * FROM membership_archives'
  const conditions = []
  const bindings = []

  if (member && member !== 'all') {
    conditions.push('member = ?')
    bindings.push(member)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY date DESC, updated_at DESC'

  const stmt = db.prepare(query)
  const result = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all()

  const archives = result.results.map(row => ({
    id: row.id,
    member: row.member,
    date: row.date,
    time: row.time,
    caption: row.caption,
    media: JSON.parse(row.media || '[]'),
    sourceUrl: row.source_url,
    notes: row.notes,
    paid: row.paid ? true : false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return jsonResponse(archives, 200, corsHeaders)
}

async function createMembershipArchive(db, data, corsHeaders) {
  const now = Date.now()
  const id = data.id || 'mb-' + now

  await db.prepare(`
    INSERT INTO membership_archives (id, member, date, time, caption, media, source_url, notes, paid, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.member,
    data.date,
    data.time || null,
    data.caption || null,
    JSON.stringify(data.media || []),
    data.sourceUrl || null,
    data.notes || null,
    data.paid ? 1 : 0,
    data.createdAt || now,
    data.updatedAt || now
  ).run()

  return jsonResponse({ success: true, id }, 201, corsHeaders)
}

async function updateMembershipArchive(db, id, data, corsHeaders) {
  const now = Date.now()

  await db.prepare(`
    UPDATE membership_archives SET
      member = ?, date = ?, time = ?, caption = ?,
      media = ?, source_url = ?, notes = ?, paid = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    data.member,
    data.date,
    data.time || null,
    data.caption || null,
    JSON.stringify(data.media || []),
    data.sourceUrl || null,
    data.notes || null,
    data.paid ? 1 : 0,
    now,
    id
  ).run()

  return jsonResponse({ success: true }, 200, corsHeaders)
}

async function deleteMembershipArchive(db, id, corsHeaders) {
  await db.prepare('DELETE FROM membership_archives WHERE id = ?').bind(id).run()
  return jsonResponse({ success: true }, 200, corsHeaders)
}

// =====================================================
// b.stage Archive API
// =====================================================

async function getBstageArchives(db, params, corsHeaders) {
  const member = params.get('member')

  let query = 'SELECT * FROM bstage_archives'
  const conditions = []
  const bindings = []

  if (member && member !== 'all') {
    conditions.push('member = ?')
    bindings.push(member)
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ')
  }
  query += ' ORDER BY date DESC, updated_at DESC'

  const stmt = db.prepare(query)
  const result = bindings.length > 0 ? await stmt.bind(...bindings).all() : await stmt.all()

  const archives = result.results.map(row => ({
    id: row.id,
    member: row.member,
    date: row.date,
    time: row.time,
    caption: row.caption,
    media: JSON.parse(row.media || '[]'),
    likes: row.likes,
    comments: row.comments,
    sourceUrl: row.source_url,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }))

  return jsonResponse(archives, 200, corsHeaders)
}

async function createBstageArchive(db, data, corsHeaders) {
  const now = Date.now()
  const id = data.id || 'b-' + now

  await db.prepare(`
    INSERT INTO bstage_archives (id, member, date, time, caption, media, likes, comments, source_url, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id,
    data.member,
    data.date,
    data.time || null,
    data.caption || null,
    JSON.stringify(data.media || []),
    data.likes || 0,
    data.comments || 0,
    data.sourceUrl || null,
    data.notes || null,
    data.createdAt || now,
    data.updatedAt || now
  ).run()

  return jsonResponse({ success: true, id }, 201, corsHeaders)
}

async function updateBstageArchive(db, id, data, corsHeaders) {
  const now = Date.now()

  await db.prepare(`
    UPDATE bstage_archives SET
      member = ?, date = ?, time = ?, caption = ?,
      media = ?, likes = ?, comments = ?, source_url = ?,
      notes = ?, updated_at = ?
    WHERE id = ?
  `).bind(
    data.member,
    data.date,
    data.time || null,
    data.caption || null,
    JSON.stringify(data.media || []),
    data.likes || 0,
    data.comments || 0,
    data.sourceUrl || null,
    data.notes || null,
    now,
    id
  ).run()

  return jsonResponse({ success: true }, 200, corsHeaders)
}

async function deleteBstageArchive(db, id, corsHeaders) {
  await db.prepare('DELETE FROM bstage_archives WHERE id = ?').bind(id).run()
  return jsonResponse({ success: true }, 200, corsHeaders)
}

// =====================================================
// Visitors API
// =====================================================

function parseUserAgent(ua) {
  if (!ua) return { device: 'Unknown', browser: 'Unknown' }

  // 裝置判斷
  let device = 'Desktop'
  if (/iPhone/i.test(ua)) device = 'iPhone'
  else if (/iPad/i.test(ua)) device = 'iPad'
  else if (/Android/i.test(ua)) device = /Mobile/i.test(ua) ? 'Android Phone' : 'Android Tablet'
  else if (/Macintosh/i.test(ua)) device = 'Mac'
  else if (/Windows/i.test(ua)) device = 'Windows'
  else if (/Linux/i.test(ua)) device = 'Linux'

  // 瀏覽器判斷
  let browser = 'Unknown'
  if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome'
  else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari'
  else if (/Firefox/i.test(ua)) browser = 'Firefox'
  else if (/Edg/i.test(ua)) browser = 'Edge'
  else if (/Opera|OPR/i.test(ua)) browser = 'Opera'

  return { device, browser }
}

async function logVisitor(db, request, body, corsHeaders) {
  const now = Date.now()

  // 從 Cloudflare headers 取得 IP 和地理資訊
  const ip = request.headers.get('CF-Connecting-IP') || 'Unknown'
  const country = request.headers.get('CF-IPCountry') || null

  // 解析 User-Agent
  const userAgent = body.userAgent || request.headers.get('User-Agent') || ''
  const { device, browser } = parseUserAgent(userAgent)

  await db.prepare(`
    INSERT INTO visitors (ip, country, user_agent, device, browser, referrer, author_id, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    ip,
    country,
    userAgent,
    device,
    browser,
    body.referrer || null,
    body.authorId || null,
    now
  ).run()

  return jsonResponse({ success: true }, 201, corsHeaders)
}

async function getVisitors(db, params, corsHeaders) {
  const limit = parseInt(params.get('limit')) || 50
  const offset = parseInt(params.get('offset')) || 0

  const result = await db.prepare(`
    SELECT * FROM visitors ORDER BY timestamp DESC LIMIT ? OFFSET ?
  `).bind(limit, offset).all()

  const count = await db.prepare('SELECT COUNT(*) as total FROM visitors').first()

  return jsonResponse({
    visitors: result.results,
    total: count.total,
    limit,
    offset
  }, 200, corsHeaders)
}
