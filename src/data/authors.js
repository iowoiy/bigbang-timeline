export const AUTHORS = [
  { id: 'apollo',  name: '阿波', color: '#E63946', emoji: '🌙' },
  { id: 'martin',  name: '馬丁', color: '#457B9D', emoji: '✈️' },
  { id: 'fancy',   name: 'Fancy', color: '#D4AF37', emoji: '✨' },
  { id: 'cynical', name: '存疑', color: '#2A9D8F', emoji: '🤔' },
  { id: 'tooth',   name: '🦷寶', color: '#F4A261', emoji: '🦷' },
  { id: 'cedric',  name: '西追', color: '#7B2D8E', emoji: '🧙' },
]

export const FAN_SINCE = {
  2008: ['apollo', 'martin'],
  2009: ['fancy'],
  2011: ['cynical'],
  2012: ['tooth'],
  2014: ['cedric'],
}

export function findAuthor(id) {
  return AUTHORS.find(a => a.id === id)
}

export function authorName(id) {
  return findAuthor(id)?.name || ''
}

export function authorEmoji(id) {
  return findAuthor(id)?.emoji || ''
}

export function authorColor(id) {
  return findAuthor(id)?.color || '#888'
}

export function badgeStyle(id) {
  const c = authorColor(id)
  return { background: c + '22', color: c }
}
