import { useState } from 'react'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { authorName, authorEmoji, badgeStyle } from '../data/authors'

export default function ImageCarousel({ images, initialIndex = 0, onClose }) {
  const [index, setIndex] = useState(initialIndex)
  const [touchStart, setTouchStart] = useState(null)

  const prev = () => setIndex(i => (i - 1 + images.length) % images.length)
  const next = () => setIndex(i => (i + 1) % images.length)
  const current = images[index]

  return (
    <div className="image-slider-overlay" onClick={onClose}>
      <button className="image-slider-close"><X size={24} /></button>
      <div
        className="image-slider-container"
        onClick={e => e.stopPropagation()}
        onTouchStart={e => setTouchStart(e.touches[0].clientX)}
        onTouchEnd={e => {
          if (touchStart === null) return
          const diff = touchStart - e.changedTouches[0].clientX
          if (Math.abs(diff) > 50) {
            diff > 0 ? next() : prev()
          }
          setTouchStart(null)
        }}
      >
        <button className="image-slider-nav prev" onClick={prev} disabled={images.length <= 1}>
          <ChevronLeft size={28} />
        </button>
        <div className="image-slider-main">
          <img src={current?.backupUrl || current?.url} alt="" draggable={false} />
          <div className="image-slider-info">
            <span>{index + 1} / {images.length}</span>
            {current?.author && (
              <span className="abadge sm" style={badgeStyle(current.author)}>
                {authorEmoji(current.author)} {authorName(current.author)}
              </span>
            )}
          </div>
        </div>
        <button className="image-slider-nav next" onClick={next} disabled={images.length <= 1}>
          <ChevronRight size={28} />
        </button>
      </div>
      {images.length > 1 && (
        <div className="image-slider-thumbs">
          {images.map((img, i) => (
            <div
              key={i}
              className={`image-slider-thumb ${i === index ? 'active' : ''}`}
              onClick={e => { e.stopPropagation(); setIndex(i) }}
            >
              <img src={img.backupUrl || img.url} alt="" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
