import { MEMBERS } from '../utils/members'

/**
 * 成員篩選下拉選單（多選）
 * @param {Object} props
 * @param {string[]} props.selectedMembers - 已選成員名稱陣列
 * @param {(members: string[]) => void} props.onChange - 選擇變更回調
 * @param {boolean} props.isOpen - 下拉選單是否開啟
 * @param {() => void} props.onToggle - 切換開啟/關閉
 */
export default function MemberFilterDropdown({
  selectedMembers,
  onChange,
  isOpen,
  onToggle,
}) {
  const handleSelectAll = () => {
    onChange([])
  }

  const handleToggleMember = (memberName) => {
    if (selectedMembers.includes(memberName)) {
      onChange(selectedMembers.filter(x => x !== memberName))
    } else {
      onChange([...selectedMembers, memberName])
    }
  }

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
            onClick={handleSelectAll}
          >
            全部
          </button>
          {MEMBERS.filter(m => m.name !== '全員').map(m => (
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
