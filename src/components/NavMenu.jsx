import { useState } from 'react'
import { Menu } from 'lucide-react'

const PAGES = [
  { id: 'timeline', icon: '📅', label: '時間軸' },
  { id: 'social', icon: '📷', label: '社群備份' },
  { id: 'membership', icon: '🔒', label: '會員備份' },
  { id: 'onthisday', icon: '📆', label: '查看這一天', adminOnly: true },
]

export default function NavMenu({ currentPage, setCurrentPage }) {
  const isAdmin = localStorage.getItem('isAdmin') === 'true' || new URLSearchParams(window.location.search).has('admin')
  const [open, setOpen] = useState(false)

  return (
    <div className="nav-menu-wrapper">
      <button onClick={() => setOpen(!open)} className="hamburger-btn" title="選單">
        <Menu size={18} />
      </button>
      {open && (
        <>
          <div className="nav-menu-overlay" onClick={() => setOpen(false)} />
          <div className="nav-menu">
            {PAGES.filter(p => !p.adminOnly || isAdmin).map(p => (
              <button
                key={p.id}
                className={`nav-menu-item ${currentPage === p.id ? 'active' : ''}`}
                onClick={() => { setCurrentPage(p.id); setOpen(false) }}
              >
                <span>{p.icon}</span> {p.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
