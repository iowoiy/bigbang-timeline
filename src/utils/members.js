// BIGBANG 成員列表與顏色
export const MEMBERS = [
  { name: '全員', color: '#E5A500' },
  { name: 'G-Dragon', color: '#ed609f' },
  { name: 'T.O.P', color: '#8fc126' },
  { name: '太陽', color: '#d7171e' },
  { name: '大聲', color: '#f4e727' },
  { name: '勝利', color: '#1e92c6' },
]

// 不含全員的成員列表（b.stage 用）
export const MEMBERS_NO_ALL = MEMBERS.filter(m => m.name !== '全員')

// 不含勝利的成員列表（會員備份用）
export const MEMBERS_NO_VICTORY = MEMBERS.filter(m => m.name !== '勝利')

// 成員名稱別名對應（篩選用）
export const MEMBER_ALIASES = {
  '大聲': ['Daesung'],
  '太陽': ['Taeyang'],
}

export function getMemberColor(name) {
  const alias = Object.entries(MEMBER_ALIASES).find(([, v]) => v.includes(name))
  if (alias) return MEMBERS.find(m => m.name === alias[0])?.color || '#E5A500'
  return MEMBERS.find(m => m.name === name)?.color || '#E5A500'
}

export function genId(prefix = 'item') {
  return prefix + '-' + Date.now()
}
