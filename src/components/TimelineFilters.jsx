import { useState, useEffect, useRef } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import MemberFilterDropdown from './MemberFilterDropdown'

export default function TimelineFilters({
  filter, setFilter,
  events,
  years,
  selectedYear, setSelectedYear,
  yearSortDesc, setYearSortDesc,
  memberFilter, setMemberFilter,
}) {
  const [yearNavOpen, setYearNavOpen] = useState(false)
  const [memberNavOpen, setMemberNavOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const yearDropdownRef = useRef(null)

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

  // 點擊外部關閉年份下拉
  useEffect(() => {
    if (!yearNavOpen) return
    const handleClickOutside = (e) => {
      if (yearDropdownRef.current && !yearDropdownRef.current.contains(e.target)) {
        setYearNavOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [yearNavOpen])

  return (
    <div className="filters">
      {/* 第一排：分類篩選 */}
      <div className="filter-row">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          全部 <span className="opacity-60 text-[10px]">{events.length}</span>
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`filter-btn ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {cat.label} <span className="opacity-60 text-[10px]">{events.filter(e => (e.cats && e.cats.includes(key)) || e.cat === key).length}</span>
          </button>
        ))}
      </div>

      {/* 第二排：年份 + 成員 */}
      <div className="filter-row">
        {/* 年份篩選 */}
        {isMobile ? (
          <select
            className="filter-select"
            value={selectedYear || ''}
            onChange={(e) => {
              const year = e.target.value
              setSelectedYear(year)
              const el = document.getElementById(`year-${year}`)
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
            }}
          >
            <option value="" disabled>年份</option>
            {years.map(year => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
        ) : (
          <div ref={yearDropdownRef} className="filter-dropdown">
            <button
              className="filter-btn dropdown-toggle"
              onClick={() => { setYearNavOpen(!yearNavOpen); setMemberNavOpen(false) }}
            >
              年份 <span className="dropdown-arrow">{yearNavOpen ? '▲' : '▼'}</span>
            </button>
            {yearNavOpen && (
              <div className="filter-dropdown-list">
                {years.map(year => (
                  <button
                    key={year}
                    className={`filter-dropdown-item ${selectedYear === year ? 'active' : ''}`}
                    onClick={() => {
                      setSelectedYear(year)
                      const el = document.getElementById(`year-${year}`)
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
                      setYearNavOpen(false)
                    }}
                  >
                    {year}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 年份排序切換 */}
        <button
          className="year-sort-btn"
          onClick={() => setYearSortDesc(!yearSortDesc)}
          title={yearSortDesc ? '目前：新 → 舊' : '目前：舊 → 新'}
        >
          <ArrowUpDown size={12} />
        </button>

        {/* 成員篩選（多選） */}
        <MemberFilterDropdown
          selectedMembers={memberFilter}
          onChange={setMemberFilter}
          isOpen={memberNavOpen}
          onToggle={() => { setMemberNavOpen(!memberNavOpen); setYearNavOpen(false) }}
        />
      </div>
    </div>
  )
}
