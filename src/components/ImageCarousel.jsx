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
    <div className="fixed inset-0 bg-black/95 z-[9500] flex flex-col items-center justify-center animate-fade-in" onClick={onClose}>
      <button className="absolute top-4 right-4 bg-transparent border-none text-text-secondary cursor-pointer p-2 z-10 transition-colors hover:text-white">
        <X size={24} />
      </button>
      <div
        className="flex items-center justify-center gap-4 max-w-[90vw] max-h-[70vh] touch-pan-y max-md:max-w-[100vw] max-md:gap-2"
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
        <button
          className="bg-white/10 border-none text-text-secondary w-12 h-12 rounded-full cursor-pointer flex items-center justify-center transition-all shrink-0 hover:not-disabled:bg-white/20 hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-default max-md:hidden"
          onClick={prev}
          disabled={images.length <= 1}
        >
          <ChevronLeft size={28} />
        </button>
        <div className="flex flex-col items-center gap-3">
          <img
            src={current?.backupUrl || current?.url}
            alt=""
            draggable={false}
            className="max-w-[70vw] max-h-[60vh] object-contain rounded-lg animate-fade-in-scale select-none touch-pan-y max-md:max-w-[90vw]"
            style={{ WebkitUserDrag: 'none' }}
          />
          <div className="flex items-center gap-3 text-text-secondary text-xs">
            <span>{index + 1} / {images.length}</span>
            {current?.author && (
              <span className="abadge sm" style={badgeStyle(current.author)}>
                {authorEmoji(current.author)} {authorName(current.author)}
              </span>
            )}
          </div>
        </div>
        <button
          className="bg-white/10 border-none text-text-secondary w-12 h-12 rounded-full cursor-pointer flex items-center justify-center transition-all shrink-0 hover:not-disabled:bg-white/20 hover:not-disabled:text-white disabled:opacity-30 disabled:cursor-default max-md:hidden"
          onClick={next}
          disabled={images.length <= 1}
        >
          <ChevronRight size={28} />
        </button>
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 mt-5 p-3 overflow-x-auto max-w-[90vw] max-md:gap-1.5 max-md:p-2">
          {images.map((img, i) => (
            <div
              key={i}
              className={`w-[60px] h-[60px] rounded-md overflow-hidden cursor-pointer opacity-50 transition-all shrink-0 border-2 border-transparent hover:opacity-80 max-md:w-[50px] max-md:h-[50px] ${i === index ? '!opacity-100 !border-gold' : ''}`}
              onClick={e => { e.stopPropagation(); setIndex(i) }}
            >
              <img src={img.backupUrl || img.url} alt="" className="w-full h-full object-cover" />
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
