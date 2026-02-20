import { Pencil, Image, Link, Paperclip } from 'lucide-react'
import { authorName, authorEmoji, badgeStyle } from '../data/authors'
import { catColor, catBg, catLabel, dateLabel } from '../data/categories'
import { getMemberColor } from '../utils/members'
import { getThumbUrl, isImageUrl, getVideoThumbnail } from '../utils/media'

function hasExtra(ev) {
  return (ev.links?.length || 0) + (ev.notes?.length || 0) + (ev.media?.length || 0) > 0
}

function lastEditor(ev) {
  return ev.editLog?.length ? ev.editLog[ev.editLog.length - 1].author : null
}

export default function EventCard({ event: ev, onView, onEdit }) {
  const primaryCat = (ev.cats && ev.cats[0]) || ev.cat || 'music'

  return (
    <div>
      <div
        className="event-card"
        style={{ borderLeft: '3px solid ' + catColor(primaryCat) }}
      >
        <div className="month-col" style={{ color: catColor(primaryCat) }}>{dateLabel(ev.month, ev.day)}</div>
        <div style={{ flex: 1, minWidth: 0 }} onClick={() => onView(ev)}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 4 }}>
            {(ev.cats || [ev.cat]).filter(Boolean).map(c => (
              <span key={c} className="cat-tag" style={{ background: catBg(c), color: catColor(c) }}>{catLabel(c)}</span>
            ))}
            {hasExtra(ev) && <span style={{ fontSize: 9, color: '#2A9D8F', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Paperclip size={9} />已補充</span>}
            {(ev.media?.length > 0) && <span style={{ fontSize: 9, color: '#D4AF37', display: 'inline-flex', alignItems: 'center', gap: 2 }}><Image size={9} />{ev.media.length}</span>}
            {lastEditor(ev) && (
              <span style={{ fontSize: 9, color: '#555' }}>·
                <span className="abadge sm" style={badgeStyle(lastEditor(ev))}>{authorEmoji(lastEditor(ev))} {authorName(lastEditor(ev))}</span>
              </span>
            )}
          </div>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, lineHeight: 1.4 }}>{ev.title}</div>
          <div className="event-desc">{ev.desc}</div>

          {ev.media?.length > 0 && (() => {
            const firstImg = ev.media.find(m => isImageUrl(m.url))
            const firstVid = !firstImg ? ev.media.find(m => getVideoThumbnail(m.url)) : null
            const thumbUrl = firstImg
              ? getThumbUrl(firstImg)
              : firstVid ? getVideoThumbnail(firstVid.url) : null
            if (!thumbUrl) return null
            return (
              <div className="card-thumbnail">
                <img src={thumbUrl} alt="" loading="lazy" width={400} height={225} />
                {firstVid && <div className="card-thumbnail-play">▶</div>}
              </div>
            )
          })()}

          {ev.links && ev.links.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {ev.links.map((lk, i) => (
                <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer" className="link-tag" onClick={e => e.stopPropagation()} style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                  <Link size={10} />{lk.label}
                </a>
              ))}
            </div>
          )}
          {ev.members && ev.members.length > 0 && (
            <div style={{ marginTop: 6, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {ev.members.map(m => <span key={m} className="member-tag" style={{ borderColor: getMemberColor(m), color: getMemberColor(m) }}>{m}</span>)}
            </div>
          )}
        </div>
        <div className="card-actions">
          <button
            className="card-icon-btn"
            onClick={(e) => { e.stopPropagation(); onEdit(ev) }}
            title="編輯"
          >
            <Pencil size={14} />
          </button>
        </div>
      </div>
    </div>
  )
}
