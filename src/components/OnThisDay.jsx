import { useState, useEffect, useMemo } from 'react'
import { ChevronLeft, ChevronRight, CalendarX, Check, AlertCircle, X, Play } from 'lucide-react'
import NavMenu from './NavMenu'
import EventCard from './EventCard'
import EventModal from './EventModal'
import ImageCarousel from './ImageCarousel'
import { eventsApi, socialApi, membershipApi } from '../utils/api'
import { getMemberColor } from '../utils/members'
import { getThumbUrl, getViewUrl, isImageUrl, getVideoThumbnail, isYouTubeUrl, getYouTubeId, getYouTubeThumbnail } from '../utils/media'
import { formatDate } from '../utils/date'
import './OnThisDay.css'

// 月份天數（非閏年）
const DAYS_IN_MONTH = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

function prevDay(m, d) {
  let nm = m, nd = d - 1
  if (nd < 1) {
    nm = m === 1 ? 12 : m - 1
    nd = DAYS_IN_MONTH[nm]
  }
  return [nm, nd]
}

function nextDay(m, d) {
  let nm = m, nd = d + 1
  if (nd > DAYS_IN_MONTH[m]) {
    nm = m === 12 ? 1 : m + 1
    nd = 1
  }
  return [nm, nd]
}

function yearsAgo(year) {
  const now = new Date().getFullYear()
  const diff = now - year
  if (diff === 0) return '今年'
  return `${diff} 年前`
}

export default function OnThisDay({ currentPage, setCurrentPage, isAdmin }) {
  const today = new Date()
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [day, setDay] = useState(today.getDate())
  const [activeTab, setActiveTab] = useState('timeline') // timeline | social | membership

  // 資料
  const [events, setEvents] = useState([])
  const [socialPosts, setSocialPosts] = useState([])
  const [membershipPosts, setMembershipPosts] = useState([])
  const [loading, setLoading] = useState(true)

  // Modal
  const [modal, setModal] = useState(null)
  const [viewingItem, setViewingItem] = useState(null) // 社群/會員詳情
  const [viewingMediaIndex, setViewingMediaIndex] = useState(0)
  const [imageSlider, setImageSlider] = useState({ open: false, images: [], index: 0 })
  const [toast, setToast] = useState(null)

  const flash = (msg, type = 'info') => {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  // 載入所有資料
  useEffect(() => {
    setLoading(true)
    Promise.all([
      eventsApi.load(),
      socialApi.load(),
      membershipApi.load(),
    ]).then(([ev, soc, mem]) => {
      setEvents(Array.isArray(ev) ? ev : [])
      setSocialPosts(Array.isArray(soc) ? soc : [])
      setMembershipPosts(Array.isArray(mem) ? mem : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  // 篩選出符合月/日的資料
  const filteredEvents = useMemo(() => {
    return events.filter(e => e.month === month && e.day === day)
  }, [events, month, day])

  const filteredSocial = useMemo(() => {
    return socialPosts.filter(p => {
      if (!p.date) return false
      const d = new Date(p.date)
      return d.getMonth() + 1 === month && d.getDate() === day
    })
  }, [socialPosts, month, day])

  const filteredMembership = useMemo(() => {
    return membershipPosts.filter(p => {
      if (!p.date) return false
      const d = new Date(p.date)
      return d.getMonth() + 1 === month && d.getDate() === day
    })
  }, [membershipPosts, month, day])

  // 按年份分組（新→舊）
  const groupByYear = (items, getYear) => {
    const map = {}
    items.forEach(item => {
      const y = getYear(item)
      if (y) (map[y] ??= []).push(item)
    })
    return Object.keys(map)
      .sort((a, b) => b - a)
      .map(y => ({ year: Number(y), items: map[y] }))
  }

  const eventGroups = useMemo(() =>
    groupByYear(filteredEvents, e => e.year),
  [filteredEvents])

  const socialGroups = useMemo(() =>
    groupByYear(filteredSocial, p => new Date(p.date).getFullYear()),
  [filteredSocial])

  const membershipGroups = useMemo(() =>
    groupByYear(filteredMembership, p => new Date(p.date).getFullYear()),
  [filteredMembership])

  const counts = {
    timeline: filteredEvents.length,
    social: filteredSocial.length,
    membership: filteredMembership.length,
  }

  // 日期切換
  const goPrev = () => {
    const [nm, nd] = prevDay(month, day)
    setMonth(nm); setDay(nd)
  }
  const goNext = () => {
    const [nm, nd] = nextDay(month, day)
    setMonth(nm); setDay(nd)
  }

  // Event modal
  const viewEvent = useMemo(() =>
    modal?.eventId ? events.find(e => e.id === modal.eventId) : null,
  [modal, events])

  const openView = (ev) => setModal({ mode: 'view', eventId: ev.id })
  const openEdit = (ev) => setModal({ mode: 'edit', eventId: ev.id })
  const closeModal = () => setModal(null)

  // Modal 鎖定滾動
  useEffect(() => {
    if (modal || viewingItem) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [modal, viewingItem])

  // Tab 定義
  const TABS = [
    { id: 'timeline', label: '時間軸' },
    { id: 'social', label: '社群備份' },
    { id: 'membership', label: '會員備份' },
  ]

  // 開啟詳情
  const openArchiveView = (item, type) => {
    setViewingItem({ ...item, _type: type })
    setViewingMediaIndex(0)
  }

  // 渲染社群卡片
  const renderSocialCard = (item) => {
    const firstMedia = item.media?.[0]
    const thumbUrl = firstMedia
      ? (isYouTubeUrl?.(firstMedia.url) ? getYouTubeThumbnail?.(firstMedia.url) : (firstMedia.backupUrl || firstMedia.url))
      : null

    return (
      <div key={item.id} className="otd-archive-card" onClick={() => openArchiveView(item, 'social')}>
        {thumbUrl && (
          <div className="otd-archive-thumb">
            <img src={thumbUrl} alt="" loading="lazy" />
            {item.media?.length > 1 && <span className="otd-media-count">+{item.media.length - 1}</span>}
          </div>
        )}
        <div className="otd-archive-info">
          <div className="otd-archive-meta">
            <span className="otd-member-tag" style={{ borderColor: getMemberColor(item.member), color: getMemberColor(item.member) }}>
              {item.member}
            </span>
            <span className="otd-archive-date">{formatDate(item.date)}</span>
          </div>
          {item.caption && <p className="otd-archive-caption">{item.caption}</p>}
          {item.description && !item.caption && <p className="otd-archive-caption">{item.description}</p>}
        </div>
      </div>
    )
  }

  // 渲染會員卡片
  const renderMembershipCard = (item) => {
    const firstMedia = item.media?.find(m => !m.url?.includes('.m3u8'))
    const thumbUrl = firstMedia
      ? (isYouTubeUrl?.(firstMedia.url) ? getYouTubeThumbnail?.(firstMedia.url) : (firstMedia.backupUrl || firstMedia.url))
      : null

    return (
      <div key={item.id} className="otd-archive-card" onClick={() => openArchiveView(item, 'membership')}>
        {thumbUrl && (
          <div className="otd-archive-thumb">
            <img src={thumbUrl} alt="" loading="lazy" />
            {item.media?.length > 1 && <span className="otd-media-count">+{item.media.length - 1}</span>}
          </div>
        )}
        <div className="otd-archive-info">
          <div className="otd-archive-meta">
            <span className="otd-member-tag" style={{ borderColor: getMemberColor(item.member), color: getMemberColor(item.member) }}>
              {item.member}
            </span>
            <span className="otd-archive-date">{formatDate(item.date)}</span>
          </div>
          {item.content && <p className="otd-archive-caption">{item.content}</p>}
        </div>
      </div>
    )
  }

  // 渲染年份分組
  const renderYearGroup = (group, renderCard) => (
    <div key={group.year} className="otd-year-group">
      <div className="otd-year-header">
        <span className="otd-year-num">{group.year}</span>
        <span className="otd-years-ago">{yearsAgo(group.year)}</span>
        <span className="otd-year-count">{group.items.length} 則</span>
      </div>
      {group.items.map(renderCard)}
    </div>
  )

  // 空狀態
  const renderEmpty = (label) => (
    <div className="otd-empty">
      <CalendarX size={40} strokeWidth={1} />
      <p>這一天還沒有{label}</p>
    </div>
  )

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="brand text-[3rem] tracking-[0.3em]">BIGBANG</div>
        <div className="text-text-secondary mt-3 text-sm">載入中...</div>
      </div>
    )
  }

  return (
    <div className="otd-page">
      {/* Toast */}
      {toast && (
        <div className={`toast toast-${toast.type}`}>
          {toast.type === 'success' && <Check size={14} />}
          {toast.type === 'error' && <AlertCircle size={14} />}
          {toast.msg}
        </div>
      )}

      {/* Top bar */}
      <div className="top-bar">
        <div className="top-bar-left">
          <span className="top-bar-logo">BIGBANG</span>
        </div>
        <div className="top-bar-right">
          <NavMenu currentPage={currentPage} setCurrentPage={setCurrentPage} />
        </div>
      </div>

      {/* Hero */}
      <div className="otd-hero">
        <div className="otd-date-nav">
          <button className="otd-arrow-btn" onClick={goPrev} title="前一天">
            <ChevronLeft size={20} />
          </button>
          <div className="otd-date-display">
            <div className="otd-date-main">{month}月{day}日</div>
            <div className="otd-date-sub">歷年的今天</div>
          </div>
          <button className="otd-arrow-btn" onClick={goNext} title="後一天">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="otd-stats">
          <div className="otd-stat">
            <span className="otd-stat-num">{counts.timeline}</span>
            <span className="otd-stat-label">事件</span>
          </div>
          <div className="otd-stat">
            <span className="otd-stat-num">{counts.social}</span>
            <span className="otd-stat-label">社群</span>
          </div>
          <div className="otd-stat">
            <span className="otd-stat-num">{counts.membership}</span>
            <span className="otd-stat-label">會員</span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="otd-tabs-sticky">
        <div className="otd-tabs">
          {TABS.map(tab => (
            <button
              key={tab.id}
              className={`otd-tab ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
              {counts[tab.id] > 0 && (
                <span className={`otd-tab-badge ${activeTab === tab.id ? 'active' : ''}`}>
                  {counts[tab.id]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="otd-content">
        {/* 時間軸 Tab */}
        {activeTab === 'timeline' && (
          <div className="otd-tab-content">
            {eventGroups.length > 0 ? (
              eventGroups.map(group => (
                <div key={group.year} className="otd-year-group">
                  <div className="otd-year-header">
                    <span className="otd-year-num">{group.year}</span>
                    <span className="otd-years-ago">{yearsAgo(group.year)}</span>
                    <span className="otd-year-count">{group.items.length} 項</span>
                  </div>
                  {group.items.map(ev => (
                    <EventCard key={ev.id} event={ev} onView={openView} onEdit={openEdit} />
                  ))}
                </div>
              ))
            ) : renderEmpty('時間軸事件')}
          </div>
        )}

        {/* 社群備份 Tab */}
        {activeTab === 'social' && (
          <div className="otd-tab-content">
            {socialGroups.length > 0 ? (
              socialGroups.map(group => renderYearGroup(group, renderSocialCard))
            ) : renderEmpty('社群備份')}
          </div>
        )}

        {/* 會員備份 Tab */}
        {activeTab === 'membership' && (
          <div className="otd-tab-content">
            {membershipGroups.length > 0 ? (
              membershipGroups.map(group => renderYearGroup(group, renderMembershipCard))
            ) : renderEmpty('會員備份')}
          </div>
        )}
      </div>

      {/* 社群/會員 View Modal */}
      {viewingItem && (
        <div className="otd-view-overlay" onClick={() => setViewingItem(null)}>
          <div className="otd-view-modal" onClick={e => e.stopPropagation()}>
            {/* 媒體區域 */}
            <div className="otd-view-media">
              <button className="otd-view-close" onClick={() => setViewingItem(null)}>
                <X size={20} />
              </button>
              {viewingItem.media?.length > 0 ? (
                <>
                  {(() => {
                    const media = viewingItem.media[viewingMediaIndex]
                    if (!media) return null
                    if (media.type === 'youtube' || isYouTubeUrl(media.url)) {
                      return (
                        <iframe
                          src={`https://www.youtube.com/embed/${getYouTubeId(media.url)}?autoplay=1`}
                          allow="autoplay; encrypted-media"
                          allowFullScreen
                          className="otd-view-media-item otd-view-youtube"
                        />
                      )
                    }
                    if (media.type === 'video' || media.url?.includes('.m3u8') || media.url?.includes('.mp4')) {
                      return (
                        <video
                          key={`${viewingItem.id}-${viewingMediaIndex}`}
                          src={media.backupUrl || media.url}
                          controls
                          autoPlay
                          className="otd-view-media-item"
                        />
                      )
                    }
                    return (
                      <img
                        key={`${viewingItem.id}-${viewingMediaIndex}`}
                        src={getViewUrl(media)}
                        alt=""
                        className="otd-view-media-item"
                      />
                    )
                  })()}

                  {viewingItem.media.length > 1 && (
                    <>
                      <button
                        className="otd-media-nav prev"
                        onClick={() => setViewingMediaIndex(i => (i - 1 + viewingItem.media.length) % viewingItem.media.length)}
                      >
                        <ChevronLeft size={24} />
                      </button>
                      <button
                        className="otd-media-nav next"
                        onClick={() => setViewingMediaIndex(i => (i + 1) % viewingItem.media.length)}
                      >
                        <ChevronRight size={24} />
                      </button>
                      <div className="otd-media-dots">
                        {viewingItem.media.map((_, i) => (
                          <span
                            key={i}
                            className={`otd-dot ${i === viewingMediaIndex ? 'active' : ''}`}
                            onClick={() => setViewingMediaIndex(i)}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="otd-view-no-media">
                  <span style={{ fontSize: 48, opacity: 0.3 }}>📷</span>
                </div>
              )}
            </div>

            {/* 資訊區域 */}
            <div className="otd-view-info">
              <div className="otd-view-header">
                <span
                  className="otd-member-tag"
                  style={{ background: getMemberColor(viewingItem.member) + '30', color: getMemberColor(viewingItem.member) }}
                >
                  {viewingItem.member}
                </span>
                <span className="otd-view-date">{formatDate(viewingItem.date)}</span>
              </div>
              {(viewingItem.caption || viewingItem.content || viewingItem.description) && (
                <div className="otd-view-caption">
                  <p>{viewingItem.caption || viewingItem.content || viewingItem.description}</p>
                </div>
              )}
              {viewingItem.notes && (
                <div className="otd-view-notes">
                  <strong>備註：</strong>
                  <p>{viewingItem.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="footer">
        <div className="font-display text-base tracking-[0.3em] text-gold-accent/25">BIGBANG · V.I.P</div>
        <p className="text-[10px] text-[#444] mt-1.5">共筆年表 · Since 2006</p>
      </div>

      {/* Event Modal */}
      {modal && (
        <EventModal
          mode={modal.mode}
          event={viewEvent}
          me={null}
          saving={false}
          onSave={() => {}}
          onDelete={() => {}}
          onClose={closeModal}
          onEdit={openEdit}
          onOpenCarousel={(images, index) => setImageSlider({ open: true, images, index })}
          flash={flash}
        />
      )}

      {/* 圖片輪播 */}
      {imageSlider.open && (
        <ImageCarousel
          images={imageSlider.images}
          initialIndex={imageSlider.index}
          onClose={() => setImageSlider({ open: false, images: [], index: 0 })}
        />
      )}
    </div>
  )
}
