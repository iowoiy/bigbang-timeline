import config from '../config'

const { API_URL, API_KEY } = config

// 通用 API 請求
async function request(endpoint, options = {}) {
  const res = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': API_KEY,
      ...options.headers,
    },
    ...options,
  })
  if (!res.ok) throw new Error(`API ${res.status}`)
  return res.json()
}

// 建立指定 endpoint 的 CRUD 函式
export function createApi(basePath) {
  return {
    load:   ()     => request(basePath, { headers: {} }).catch(() => []),
    create: (item) => request(basePath, { method: 'POST', body: JSON.stringify(item) }),
    update: (item) => request(`${basePath}/${item.id}`, { method: 'PUT', body: JSON.stringify(item) }),
    delete: (id)   => request(`${basePath}/${id}`, { method: 'DELETE' }),
  }
}

export const eventsApi     = createApi('/events')
export const socialApi     = createApi('/social')
export const membershipApi = createApi('/membership')
export const bstageApi     = createApi('/bstage')

// 訪客記錄（無需 API Key）
export function logVisitor(authorId) {
  fetch(`${API_URL}/visitors`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      userAgent: navigator.userAgent,
      referrer: document.referrer,
      authorId,
    }),
  }).catch(() => {})
}
