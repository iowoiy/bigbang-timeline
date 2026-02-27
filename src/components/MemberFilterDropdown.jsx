import { useState, useEffect } from 'react'
import { MEMBERS } from '../utils/members'

/**
 * 成員篩選下拉選單（多選）
 * 手機版使用原生下拉，桌面版使用自訂下拉
 */
export default function MemberFilterDropdown({
  selectedMembers,
  onChange,
  isOpen,
  onToggle,
}) {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    // 偵測觸控裝置
    const checkMobile = () => {
      setIsMobile(
        'ontouchstart' in window ||
        window.matchMedia('(pointer: coarse)').matches ||
        window.innerWidth < 768
      )
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  const handleToggleMember = (memberName) => {
    if (selectedMembers.includes(memberName)) {
      onChange(selectedMembers.filter(x => x !== memberName))
    } else {
      onChange([...selectedMembers, memberName])
    }
  }

  const filteredMembers = MEMBERS.filter(m => m.name !== '全員')

  // 手機版：原生 select（選擇後 toggle 該成員）
  if (isMobile) {
    return (
      <select
        className="filter-select"
        value=""
        onChange={(e) => {
          const val = e.target.value
          if (val === 'all') {
            onChange([])
          } else if (val) {
            handleToggleMember(val)
          }
        }}
      >
        <option value="" disabled>
          {selectedMembers.length === 0 ? '成員' : `成員(${selectedMembers.length})`}
        </option>
        <option value="all">全部</option>
        {filteredMembers.map(m => (
          <option key={m.name} value={m.name}>
            {selectedMembers.includes(m.name) ? `✓ ${m.name}` : m.name}
          </option>
        ))}
      </select>
    )
  }

  // 桌面版：自訂下拉選單
  return (
    <div className="filter-dropdown">
      <button
        className={`filter-btn dropdown-toggle ${selectedMembers.length > 0 ? 'active' : ''}`}
        onClick={onToggle}
      >
        {selectedMembers.length === 0 ? '成員' : `成員(${selectedMembers.length})`}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="filter-dropdown-list">
          <button
            className={`filter-dropdown-item ${selectedMembers.length === 0 ? 'active' : ''}`}
            onClick={() => onChange([])}
          >
            全部
          </button>
          {filteredMembers.map(m => (
            <button
              key={m.name}
              className={`filter-dropdown-item ${selectedMembers.includes(m.name) ? 'active' : ''}`}
              style={{
                color: selectedMembers.includes(m.name) ? m.color : undefined,
                borderColor: selectedMembers.includes(m.name) ? m.color : undefined
              }}
              onClick={() => handleToggleMember(m.name)}
            >
              {m.name}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
