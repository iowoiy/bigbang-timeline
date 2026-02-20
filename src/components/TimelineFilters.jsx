import { useState } from 'react'
import { ArrowUpDown } from 'lucide-react'
import { CATEGORIES } from '../data/categories'
import { MEMBERS } from '../utils/members'

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

  return (
    <div className="filters">
      {/* 第一排：分類篩選 */}
      <div className="filter-row">
        <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>
          全部 <span style={{ opacity: 0.6, fontSize: 10 }}>{events.length}</span>
        </button>
        {Object.entries(CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            className={`filter-btn ${filter === key ? 'active' : ''}`}
            onClick={() => setFilter(key)}
          >
            {cat.label} <span style={{ opacity: 0.6, fontSize: 10 }}>{events.filter(e => (e.cats && e.cats.includes(key)) || e.cat === key).length}</span>
          </button>
        ))}
      </div>

      {/* 第二排：年份 + 成員 */}
      <div className="filter-row">
        {/* 年份篩選 */}
        <div className="filter-dropdown">
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

        {/* 年份排序切換 */}
        <button
          className="year-sort-btn"
          onClick={() => setYearSortDesc(!yearSortDesc)}
          title={yearSortDesc ? '目前：新 → 舊' : '目前：舊 → 新'}
        >
          <ArrowUpDown size={12} />
        </button>

        {/* 成員篩選（多選） */}
        <div className="filter-dropdown">
          <button
            className={`filter-btn dropdown-toggle member-toggle ${memberFilter.length > 0 ? 'active' : ''}`}
            onClick={() => { setMemberNavOpen(!memberNavOpen); setYearNavOpen(false) }}
          >
            {memberFilter.length === 0 ? '成員' : `成員(${memberFilter.length})`} <span className="dropdown-arrow">{memberNavOpen ? '▲' : '▼'}</span>
          </button>
          {memberNavOpen && (
            <div className="filter-dropdown-list">
              <button
                className={`filter-dropdown-item ${memberFilter.length === 0 ? 'active' : ''}`}
                onClick={() => setMemberFilter([])}
              >
                全部
              </button>
              {MEMBERS.filter(m => m.name !== '全員').map(m => (
                <button
                  key={m.name}
                  className={`filter-dropdown-item ${memberFilter.includes(m.name) ? 'active' : ''}`}
                  style={{
                    color: memberFilter.includes(m.name) ? m.color : undefined,
                    borderColor: memberFilter.includes(m.name) ? m.color : undefined
                  }}
                  onClick={() => {
                    if (memberFilter.includes(m.name)) {
                      setMemberFilter(memberFilter.filter(x => x !== m.name))
                    } else {
                      setMemberFilter([...memberFilter, m.name])
                    }
                  }}
                >
                  {m.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
