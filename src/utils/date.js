// 格式化日期字串為 YYYY/M/D
export function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
}

// 格式化日期+時間
export function formatDateTime(dateStr, timeStr) {
  const datePart = formatDate(dateStr)
  if (!datePart) return ''
  if (!timeStr) return datePart
  return `${datePart} ${timeStr}`
}

// 格式化 timestamp 為 M/D HH:MM
export function formatTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
