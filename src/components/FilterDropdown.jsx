import { useState, useEffect, useRef } from 'react'

/**
 * 通用篩選下拉選單
 * 手機版使用原生下拉，桌面版使用自訂下拉
 *
 * @param {Object} props
 * @param {string} props.label - 預設顯示的標籤（如「年份」「類型」）
 * @param {Array<{value: string, label: string, color?: string}>} props.options - 選項列表
 * @param {string} props.value - 目前選中的值
 * @param {(value: string) => void} props.onChange - 選擇變更回調
 * @param {boolean} props.isOpen - 下拉選單是否開啟（桌面版用）
 * @param {() => void} props.onToggle - 切換開啟/關閉（桌面版用）
 * @param {string} props.allLabel - 「全部」選項的顯示文字，預設「全部」
 * @param {string} props.allValue - 「全部」選項的值，預設 'all'
 * @param {string} props.className - 額外的 CSS class
 */
export default function FilterDropdown({
  label,
  options,
  value,
  onChange,
  isOpen,
  onToggle,
  allLabel = '全部',
  allValue = 'all',
  className = '',
}) {
  const [isMobile, setIsMobile] = useState(false)
  const dropdownRef = useRef(null)

  useEffect(() => {
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

  // 點擊外部關閉下拉
  useEffect(() => {
    if (!isOpen) return
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        onToggle()
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen, onToggle])

  // 取得目前選項的顯示文字
  const currentOption = options.find(opt => opt.value === value)
  const displayLabel = value === allValue ? label : (currentOption?.label || value)

  // 手機版：原生 select
  if (isMobile) {
    return (
      <select
        className="filter-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value={allValue}>{allLabel}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    )
  }

  // 桌面版：自訂下拉選單
  return (
    <div ref={dropdownRef} className={`filter-dropdown ${className}`}>
      <button
        className={`filter-btn dropdown-toggle ${value !== allValue ? 'active' : ''}`}
        onClick={onToggle}
      >
        {displayLabel}
        <span className="dropdown-arrow">{isOpen ? '▲' : '▼'}</span>
      </button>
      {isOpen && (
        <div className="filter-dropdown-list">
          <button
            className={`filter-dropdown-item ${value === allValue ? 'active' : ''}`}
            onClick={() => onChange(allValue)}
          >
            {allLabel}
          </button>
          {options.map(opt => (
            <button
              key={opt.value}
              className={`filter-dropdown-item ${value === opt.value ? 'active' : ''}`}
              style={{ color: value === opt.value ? opt.color : undefined }}
              onClick={() => onChange(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
