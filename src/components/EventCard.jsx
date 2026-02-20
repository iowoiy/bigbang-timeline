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
        <div className="flex-1 min-w-0" onClick={() => onView(ev)}>
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {(ev.cats || [ev.cat]).filter(Boolean).map(c => (
              <span key={c} className="cat-tag" style={{ background: catBg(c), color: catColor(c) }}>{catLabel(c)}</span>
            ))}
            {hasExtra(ev) && <span className="text-[9px] text-teal inline-flex items-center gap-0.5"><Paperclip size={9} />已補充</span>}
            {(ev.media?.length > 0) && <span className="text-[9px] text-gold-accent inline-flex items-center gap-0.5"><Image size={9} />{ev.media.length}</span>}
            {lastEditor(ev) && (
              <span className="text-[9px] text-text-dim">·
                <span className="abadge sm" style={badgeStyle(lastEditor(ev))}>{authorEmoji(lastEditor(ev))} {authorName(lastEditor(ev))}</span>
              </span>
            )}
          </div>
          <div className="font-bold text-sm mb-0.5 leading-snug">{ev.title}</div>
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
            <div className="mt-1.5 flex gap-1.5 flex-wrap">
              {ev.links.map((lk, i) => (
                <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer" className="link-tag inline-flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  <Link size={10} />{lk.label}
                </a>
              ))}
            </div>
          )}
          {ev.members && ev.members.length > 0 && (
            <div className="mt-1.5 flex gap-1 flex-wrap">
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
