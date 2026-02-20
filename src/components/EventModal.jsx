import { useState, useRef } from 'react'
import { Plus, X, Pencil, Image, Link, Camera, Trash2, Calendar, Save, History, Check, AlertCircle, Play, Film } from 'lucide-react'
import { authorName, authorEmoji, badgeStyle } from '../data/authors'
import { CATEGORIES, catColor, catBg, catLabel } from '../data/categories'
import { MEMBERS, getMemberColor, genId } from '../utils/members'
import { parseVideoUrl, isImageUrl, getVideoThumbnail } from '../utils/media'
import { formatTime } from '../utils/date'
import { uploadWithBackup } from '../utils/upload'

// 內嵌的 MediaPreview（來自 App.jsx）
function MediaPreview({ url }) {
  const video = parseVideoUrl(url)
  if (video?.type === 'youtube') {
    return (
      <div className="media-embed">
        <iframe
          src={`https://www.youtube.com/embed/${video.id}`}
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="YouTube video"
        />
      </div>
    )
  }
  if (video?.type === 'instagram') {
    return (
      <div className="media-embed media-embed-ig">
        <iframe
          src={`https://www.instagram.com/p/${video.id}/embed/captioned`}
          frameBorder="0"
          scrolling="no"
          allowTransparency="true"
          allowFullScreen
          title="Instagram post"
        />
      </div>
    )
  }
  if (video?.type === 'twitter') {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="media-link-card">
        <span className="media-icon">𝕏</span>
        <span>X (Twitter) 貼文</span>
        <span className="media-arrow">→</span>
      </a>
    )
  }
  if (isImageUrl(url)) {
    return (
      <div className="media-image">
        <img src={url} alt="uploaded" loading="lazy" />
      </div>
    )
  }
  return null
}

function initForm(event, mode) {
  if (mode === 'new') {
    const today = new Date()
    return {
      id: genId('e'), year: today.getFullYear(), month: today.getMonth() + 1, day: today.getDate(), time: '', cats: ['music'],
      title: '', desc: '', members: ['全員'],
      links: [], notes: [], media: [], editLog: []
    }
  }
  const cats = event.cats ? [...event.cats] : (event.cat ? [event.cat] : ['music'])
  return {
    id: event.id,
    year: event.year,
    month: event.month,
    day: event.day || 1,
    time: event.time || '',
    cats,
    title: event.title,
    desc: event.desc,
    members: [...(event.members || [])],
    links: JSON.parse(JSON.stringify(event.links || [])),
    notes: JSON.parse(JSON.stringify(event.notes || [])),
    media: JSON.parse(JSON.stringify(event.media || [])),
    editLog: JSON.parse(JSON.stringify(event.editLog || []))
  }
}

export default function EventModal({ mode, event, me, saving, onSave, onDelete, onClose, onEdit, onOpenCarousel, flash }) {
  const [form, setForm] = useState(() => initForm(event, mode))
  const [linkUrl, setLinkUrl] = useState('')
  const [linkLabel, setLinkLabel] = useState('')
  const [noteInput, setNoteInput] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [uploading, setUploading] = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)
  const [showLog, setShowLog] = useState(false)
  const fileInputRef = useRef(null)

  const isEditing = mode === 'edit' || mode === 'new'

  // Save
  const saveEvent = () => {
    let newEditLog
    if (mode === 'new') {
      newEditLog = [{ author: me, action: '新增', ts: Date.now() }]
    } else {
      const createLog = form.editLog.find(log => log.action === '新增')
      newEditLog = createLog
        ? [createLog, { author: me, action: '編輯', ts: Date.now() }]
        : [{ author: me, action: '編輯', ts: Date.now() }]
    }
    const parsed = {
      id: form.id,
      year: parseInt(form.year) || 2025,
      month: parseInt(form.month) || 1,
      day: parseInt(form.day) || 1,
      time: form.time || '',
      cats: form.cats,
      cat: form.cats[0] || 'music',
      title: form.title,
      desc: form.desc,
      members: form.members,
      links: form.links,
      notes: form.notes,
      media: form.media,
      editLog: newEditLog
    }
    onSave(parsed, mode === 'new')
  }

  // Links
  const addLink = () => {
    if (!linkUrl.trim()) return
    let u = linkUrl.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    setForm(f => ({ ...f, links: [...f.links, { url: u, label: linkLabel.trim() || u, author: me, ts: Date.now() }] }))
    setLinkUrl(''); setLinkLabel('')
  }
  const removeLink = (i) => setForm(f => ({ ...f, links: f.links.filter((_, idx) => idx !== i) }))

  // Notes
  const addNote = () => {
    if (!noteInput.trim()) return
    setForm(f => ({ ...f, notes: [...f.notes, { text: noteInput.trim(), author: me, ts: Date.now() }] }))
    setNoteInput('')
  }
  const removeNote = (i) => setForm(f => ({ ...f, notes: f.notes.filter((_, idx) => idx !== i) }))

  // Media
  const addMediaUrl = () => {
    if (!mediaUrl.trim()) return
    let u = mediaUrl.trim()
    if (!u.startsWith('http')) u = 'https://' + u
    setForm(f => ({ ...f, media: [...f.media, { url: u, author: me, ts: Date.now() }] }))
    setMediaUrl('')
  }
  const removeMedia = (i) => setForm(f => ({ ...f, media: f.media.filter((_, idx) => idx !== i) }))

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const validFiles = files.filter(file => {
      if (file.size > 32 * 1024 * 1024) { flash(`${file.name} 太大，最大 32MB`, 'error'); return false }
      if (!file.type.startsWith('image/')) { flash(`${file.name} 不是圖片檔案`, 'error'); return false }
      return true
    })
    if (validFiles.length === 0) return
    setUploading(true)
    let successCount = 0
    for (const file of validFiles) {
      try {
        const { url, backupUrl } = await uploadWithBackup(file)
        setForm(f => ({ ...f, media: [...f.media, { url, backupUrl, author: me, ts: Date.now() }] }))
        successCount++
      } catch { flash(`${file.name} 上傳失敗`, 'error') }
    }
    if (successCount > 0) flash(`已上傳 ${successCount} 張圖片`, 'success')
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handlePaste = async (e) => {
    const items = e.clipboardData?.items
    if (!items) return
    const imageFiles = []
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile()
        if (file) imageFiles.push(file)
      }
    }
    if (imageFiles.length === 0) return
    e.preventDefault()
    setUploading(true)
    let successCount = 0
    for (const file of imageFiles) {
      if (file.size > 32 * 1024 * 1024) { flash('圖片太大，最大 32MB', 'error'); continue }
      try {
        const { url, backupUrl } = await uploadWithBackup(file)
        setForm(f => ({ ...f, media: [...f.media, { url, backupUrl, author: me, ts: Date.now() }] }))
        successCount++
      } catch { flash('圖片上傳失敗', 'error') }
    }
    if (successCount > 0) flash(`已貼上 ${successCount} 張圖片`, 'success')
    setUploading(false)
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        {/* Header */}
        <div className="flex justify-between items-start mb-4">
          <div className="text-[15px] font-bold text-gold-accent">
            {mode === 'new' ? <><Plus size={14} className="inline align-middle" /> 新增事件</> : mode === 'edit' ? <><Pencil size={14} className="inline align-middle" /> 編輯事件</> : <><Calendar size={14} className="inline align-middle" /> 事件詳情</>}
          </div>
          <button onClick={onClose} className="modal-close-btn"><X size={16} /></button>
        </div>

        {/* Edit / New Form */}
        {isEditing && (
          <div>
            <label className="form-label">標題</label>
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="事件標題" className="form-input" />
            <label className="form-label">描述</label>
            <textarea value={form.desc} onChange={e => setForm(f => ({ ...f, desc: e.target.value }))} placeholder="事件描述" rows={3} className="form-input" />
            <div className="mb-3">
              <label className="form-label">日期</label>
              <div className="flex gap-2">
                <input
                  type="date"
                  value={`${form.year}-${String(form.month).padStart(2, '0')}-${String(form.day || 1).padStart(2, '0')}`}
                  onChange={e => {
                    const [y, m, d] = e.target.value.split('-').map(Number)
                    setForm(f => ({ ...f, year: y, month: m, day: d }))
                  }}
                  className="form-input flex-1"
                />
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm(f => ({ ...f, time: e.target.value }))}
                  className="form-input w-[120px]"
                  placeholder="時間（選填）"
                />
              </div>
            </div>
            <div className="mb-3">
              <label className="form-label">分類（可多選）</label>
                <div className="member-select category-select">
                  {Object.entries(CATEGORIES).map(([k, v]) => {
                    const isSelected = form.cats.includes(k)
                    return (
                      <button
                        key={k}
                        type="button"
                        className={`member-chip ${isSelected ? 'selected' : ''}`}
                        style={isSelected ? { background: v.bg, borderColor: v.color, color: v.color } : {}}
                        onClick={() => {
                          setForm(f => {
                            if (isSelected) {
                              const newCats = f.cats.filter(c => c !== k)
                              return { ...f, cats: newCats.length > 0 ? newCats : f.cats }
                            } else {
                              return { ...f, cats: [...f.cats, k] }
                            }
                          })
                        }}
                      >
                        {v.label}
                      </button>
                    )
                  })}
                </div>
            </div>
            <label className="form-label">成員</label>
            <div className="member-select">
              {MEMBERS.map(member => {
                const isSelected = form.members.includes(member.name)
                const isAll = member.name === '全員'
                return (
                  <button
                    key={member.name}
                    type="button"
                    className={`member-chip ${isSelected ? 'selected' : ''}`}
                    style={isSelected ? { background: member.color + '22', borderColor: member.color, color: member.color } : {}}
                    onClick={() => {
                      if (isAll) {
                        setForm(f => ({ ...f, members: isSelected ? [] : ['全員'] }))
                      } else {
                        setForm(f => {
                          let newMembers = f.members.filter(x => x !== '全員')
                          if (isSelected) {
                            newMembers = newMembers.filter(x => x !== member.name)
                          } else {
                            newMembers = [...newMembers, member.name]
                          }
                          return { ...f, members: newMembers }
                        })
                      }
                    }}
                  >
                    {member.name}
                  </button>
                )
              })}
            </div>

            <div className="divider" />

            {/* Media */}
            <label className="form-label"><Image size={12} className="inline align-middle mr-1" />圖片 / 影片</label>
            <div className="media-grid">
              {form.media.map((m, i) => {
                const thumbnail = getVideoThumbnail(m.url)
                const video = parseVideoUrl(m.url)
                return (
                  <div key={i} className="media-grid-item">
                    {isImageUrl(m.url) ? (
                      <img src={m.backupUrl || m.url} alt="" />
                    ) : thumbnail ? (
                      <div className="media-grid-video-thumb">
                        <img src={thumbnail} alt="" />
                        <div className="media-grid-play"><Play size={20} /></div>
                      </div>
                    ) : (
                      <div className={`media-grid-video ${video?.type === 'instagram' ? 'ig-video' : ''}`}>
                        {video?.type === 'instagram' ? <Camera size={24} /> : <Film size={24} />}
                        <span>{video?.type === 'instagram' ? 'IG' : video?.type === 'twitter' ? 'X' : '影片'}</span>
                      </div>
                    )}
                    <button onClick={() => removeMedia(i)} className="media-grid-delete"><X size={12} /></button>
                  </div>
                )
              })}
            </div>
            <div className="flex gap-1.5 mt-1.5 flex-wrap items-center">
              <input
                value={mediaUrl}
                onChange={e => setMediaUrl(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addMediaUrl()}
                onPaste={handlePaste}
                placeholder="貼上圖片或 YouTube / IG / X 連結"
                className="form-input flex-[1_1_200px] !mb-0"
              />
              <button onClick={addMediaUrl} className="gold-btn">+</button>
              <span className="text-text-dim text-[11px]">或</span>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp,.jpg,.jpeg,.png,.gif,.webp"
                multiple
                onChange={handleFileUpload}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="upload-btn"
              >
                {uploading ? '上傳中...' : <><Camera size={14} className="inline align-middle mr-1" />上傳圖片</>}
              </button>
            </div>

            <div className="divider" />

            {/* Links */}
            <label className="form-label"><Link size={12} className="inline align-middle mr-1" />相關連結</label>
            {form.links.map((lk, i) => (
              <div key={i} className="flex items-center gap-1.5 py-1 px-2 bg-white/[0.03] rounded-md mb-1">
                <span className="flex-1 text-[11px] text-teal overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1"><Link size={10} />{lk.label}</span>
                {lk.author && <span className="abadge sm" style={badgeStyle(lk.author)}>{authorEmoji(lk.author)} {authorName(lk.author)}</span>}
                <button onClick={() => removeLink(i)} className="bg-transparent border-none text-red text-xs flex items-center"><X size={12} /></button>
              </div>
            ))}
            <div className="link-input-group">
              <input value={linkLabel} onChange={e => setLinkLabel(e.target.value)} placeholder="名稱（可選）" className="form-input" />
              <div className="flex gap-1.5">
                <input value={linkUrl} onChange={e => setLinkUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && addLink()} placeholder="貼上網址" className="form-input flex-1 !mb-0" />
                <button onClick={addLink} className="gold-btn">+ 新增</button>
              </div>
            </div>

            <div className="divider" />

            <div className="form-actions">
              <button onClick={onClose} className="cancel-btn">取消</button>
              <button onClick={saveEvent} disabled={saving || !form.title?.trim()} className="gold-btn save-btn">{saving ? '儲存中...' : <><Save size={14} className="inline align-middle mr-1" />儲存</>}</button>
            </div>
            {mode === 'edit' && (
              confirmDel ? (
                <div className="form-actions mt-2">
                  <button onClick={() => setConfirmDel(false)} className="cancel-btn">取消刪除</button>
                  <button onClick={() => onDelete(form.id)} className="flex-1 py-3 px-4 bg-red text-white border-none rounded-lg text-sm font-semibold">確定刪除</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(true)} className="del-btn w-full mt-2 py-3 px-4 text-sm flex items-center justify-center gap-1"><Trash2 size={14} />刪除事件</button>
              )
            )}
          </div>
        )}

        {/* View Mode */}
        {mode === 'view' && event && (
          <div>
            <div className="flex gap-1.5 items-center flex-wrap mb-2">
              {(event.cats || [event.cat]).filter(Boolean).map(c => (
                <span key={c} className="cat-tag" style={{ background: catBg(c), color: catColor(c) }}>{catLabel(c)}</span>
              ))}
              <span className="text-[11px] text-text-secondary">{event.year}/{event.month}{event.day ? `/${event.day}` : ''}</span>
            </div>
            <h3 className="text-lg font-bold leading-snug mb-1.5">{event.title}</h3>
            <p className="text-[13px] text-[#999] leading-relaxed mb-2 whitespace-pre-line">{event.desc}</p>
            {event.members?.length > 0 && (
              <div className="flex gap-1 flex-wrap mb-3">
                {event.members.map(m => <span key={m} className="member-tag text-[10px] py-0.5 px-[7px]" style={{ borderColor: getMemberColor(m), color: getMemberColor(m) }}>{m}</span>)}
              </div>
            )}

            {/* Media in view */}
            {event.media?.length > 0 && (() => {
              const videos = event.media.filter(m => parseVideoUrl(m.url))
              const images = event.media.filter(m => isImageUrl(m.url))
              return (
                <>
                  {videos.length > 0 && (
                    <>
                      <div className="divider !mt-0" />
                      <h4 className="text-xs font-semibold text-gold-accent mb-2 flex items-center gap-1"><Film size={12} />影片</h4>
                      {videos.map((m, i) => (
                        <div key={i} className="mb-3">
                          <MediaPreview url={m.url} />
                          <div className="text-[10px] text-text-dim mt-1">
                            {m.author && <span className="abadge sm" style={badgeStyle(m.author)}>{authorEmoji(m.author)} {authorName(m.author)}</span>}
                            {' '}{formatTime(m.ts)}
                          </div>
                        </div>
                      ))}
                    </>
                  )}
                  {images.length > 0 && (
                    <>
                      <div className="divider !mt-0" />
                      <h4 className="text-xs font-semibold text-gold-accent mb-2 flex items-center gap-1"><Image size={12} />圖片 ({images.length})</h4>
                      <div className="image-list">
                        {images.map((m, i) => (
                          <div
                            key={i}
                            className="image-list-item"
                            onClick={() => onOpenCarousel(images, i)}
                          >
                            <img src={m.backupUrl || m.url} alt="" />
                            <div className="image-list-overlay">
                              <span>{i + 1}/{images.length}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </>
              )
            })()}

            {/* Links in view */}
            {event.links?.length > 0 && (
              <>
                <div className="divider !mt-0" />
                <h4 className="text-xs font-semibold text-gold-accent mb-2 flex items-center gap-1"><Link size={12} />相關連結</h4>
                {event.links.map((lk, i) => (
                  <a key={i} href={lk.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 py-2 px-2.5 bg-white/[0.03] rounded-md mb-1 no-underline">
                    <span className="flex-1 text-xs text-teal overflow-hidden text-ellipsis whitespace-nowrap flex items-center gap-1"><Link size={10} />{lk.label}</span>
                    {lk.author && <span className="abadge sm" style={badgeStyle(lk.author)}>{authorEmoji(lk.author)}</span>}
                  </a>
                ))}
              </>
            )}

            {/* Notes in view */}
            {event.notes?.length > 0 && (
              <>
                <div className="divider !mt-0" />
                <h4 className="text-xs font-semibold text-gold-accent mb-2">💬 留言</h4>
                {event.notes.map((n, i) => (
                  <div key={i} className="py-1.5 border-b border-white/5">
                    <div className="text-xs text-[#aaa] mb-0.5">{n.text}</div>
                    <div className="text-[10px] text-text-dim">
                      <span className="abadge sm" style={badgeStyle(n.author)}>{authorEmoji(n.author)} {authorName(n.author)}</span>
                      {' '}{formatTime(n.ts)}
                    </div>
                  </div>
                ))}
              </>
            )}

            <div className="divider" />

            <div className="form-actions">
              <button onClick={() => setShowLog(!showLog)} className="cancel-btn">{showLog ? '收起紀錄' : <><History size={14} className="inline align-middle mr-1" />編輯紀錄</>}</button>
              <button onClick={() => onEdit(event)} className="gold-btn save-btn flex items-center gap-1 justify-center"><Pencil size={14} />編輯</button>
            </div>

            {showLog && (
              <div className="mt-3 p-3 bg-white/[0.02] rounded-lg">
                <div className="text-[11px] text-text-secondary mb-1.5">編輯紀錄（最新在前）</div>
                {event.editLog?.length > 0 ? (
                  [...event.editLog].reverse().map((log, i) => (
                    <div key={i} className="text-[11px] text-text-muted py-0.5 flex items-center gap-1.5">
                      <span className="abadge sm" style={badgeStyle(log.author)}>{authorEmoji(log.author)} {authorName(log.author)}</span>
                      <span>{log.action}</span>
                      <span className="text-[#444]">{formatTime(log.ts)}</span>
                    </div>
                  ))
                ) : (
                  <div className="text-[11px] text-[#444]">尚無紀錄</div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
