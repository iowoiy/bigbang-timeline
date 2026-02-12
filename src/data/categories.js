export const CATEGORIES = {
  milestone: { label: '里程碑', color: '#7B2D8E', bg: 'rgba(123,45,142,0.15)' },
  music:     { label: '音樂',   color: '#D4AF37', bg: 'rgba(212,175,55,0.15)' },
  tv:        { label: '電視劇', color: '#E63946', bg: 'rgba(230,57,70,0.15)' },
  film:      { label: '電影',   color: '#457B9D', bg: 'rgba(69,123,157,0.15)' },
  variety:   { label: '綜藝',   color: '#2A9D8F', bg: 'rgba(42,157,143,0.15)' },
  concert:   { label: '演唱會', color: '#F4A261', bg: 'rgba(244,162,97,0.15)' },
  volume:    { label: '體積',   color: '#6B8E23', bg: 'rgba(107,142,35,0.15)' },
}

export const MONTHS = [
  '', '1月', '2月', '3月', '4月', '5月', '6月',
  '7月', '8月', '9月', '10月', '11月', '12月',
]

export function catColor(cat) {
  return CATEGORIES[cat]?.color || '#888'
}

export function catBg(cat) {
  return CATEGORIES[cat]?.bg || 'rgba(136,136,136,0.15)'
}

export function catLabel(cat) {
  return CATEGORIES[cat]?.label || cat
}

export function monthLabel(m) {
  return MONTHS[m] || ''
}
