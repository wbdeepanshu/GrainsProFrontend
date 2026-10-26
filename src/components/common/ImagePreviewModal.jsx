import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Minus, Plus, RotateCcw, X } from 'lucide-react'

const MIN_ZOOM = 0.5
const MAX_ZOOM = 3
const ZOOM_STEP = 0.25

function clampZoom(value) {
  return Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value))
}

export default function ImagePreviewModal({ image, images, onClose, onNavigate, zIndex = 70 }) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef(null)
  const viewportRef = useRef(null)

  const currentIndex = images.findIndex((item) => item.id === image.id)
  const hasPrev = currentIndex > 0
  const hasNext = currentIndex < images.length - 1

  const resetView = useCallback(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    resetView()
  }, [image.id, resetView])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = ''
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        onClose()
        return
      }
      if (event.key === '+' || event.key === '=') {
        setZoom((prev) => clampZoom(prev + ZOOM_STEP))
      }
      if (event.key === '-') {
        setZoom((prev) => clampZoom(prev - ZOOM_STEP))
      }
      if (event.key === 'ArrowLeft' && hasPrev) {
        onNavigate(images[currentIndex - 1])
      }
      if (event.key === 'ArrowRight' && hasNext) {
        onNavigate(images[currentIndex + 1])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [currentIndex, hasNext, hasPrev, images, onClose, onNavigate])

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return

    const handleWheel = (event) => {
      event.preventDefault()
      const delta = event.deltaY > 0 ? -0.1 : 0.1
      setZoom((prev) => clampZoom(prev + delta))
    }

    viewport.addEventListener('wheel', handleWheel, { passive: false })
    return () => viewport.removeEventListener('wheel', handleWheel)
  }, [])

  const handlePointerDown = (event) => {
    if (event.button !== 0) return
    setIsDragging(true)
    dragStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      posX: position.x,
      posY: position.y,
    }
  }

  const handlePointerMove = (event) => {
    if (!isDragging || !dragStartRef.current) return
    setPosition({
      x: dragStartRef.current.posX + (event.clientX - dragStartRef.current.x),
      y: dragStartRef.current.posY + (event.clientY - dragStartRef.current.y),
    })
  }

  const stopDragging = () => {
    setIsDragging(false)
    dragStartRef.current = null
  }

  return createPortal(
    <div
      className="fixed inset-0 flex flex-col bg-black/85"
      style={{ zIndex }}
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 text-white"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{image.title}</p>
          {images.length > 1 ? (
            <p className="text-xs text-white/70">
              {currentIndex + 1} of {images.length}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close preview"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 min-h-0 flex items-center justify-center px-4">
        {hasPrev ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onNavigate(images[currentIndex - 1])
            }}
            className="absolute left-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Previous image"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        ) : null}

        <div
          ref={viewportRef}
          className="w-full h-full flex items-center justify-center overflow-hidden"
          onClick={(event) => event.stopPropagation()}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={stopDragging}
          onPointerLeave={stopDragging}
          onPointerCancel={stopDragging}
        >
          <div
            className="inline-block select-none"
            style={{
              transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
              transformOrigin: 'center center',
              transition: isDragging ? 'none' : 'transform 0.1s ease-out',
              cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
            }}
          >
            <img
              src={image.src}
              alt={image.title}
              draggable={false}
              className="max-w-[min(90vw,960px)] max-h-[calc(100vh-140px)] object-contain"
            />
          </div>
        </div>

        {hasNext ? (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation()
              onNavigate(images[currentIndex + 1])
            }}
            className="absolute right-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70"
            aria-label="Next image"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        ) : null}
      </div>

      <div
        className="flex flex-wrap items-center justify-center gap-2 px-4 py-3 border-t border-white/10 bg-black/40"
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => setZoom((prev) => clampZoom(prev - ZOOM_STEP))}
          disabled={zoom <= MIN_ZOOM}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/20 text-sm text-white hover:bg-white/10 disabled:opacity-40"
        >
          <Minus className="h-4 w-4" />
          Zoom out
        </button>
        <span className="text-sm text-white/80 min-w-[3.5rem] text-center">
          {Math.round(zoom * 100)}%
        </span>
        <button
          type="button"
          onClick={() => setZoom((prev) => clampZoom(prev + ZOOM_STEP))}
          disabled={zoom >= MAX_ZOOM}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/20 text-sm text-white hover:bg-white/10 disabled:opacity-40"
        >
          <Plus className="h-4 w-4" />
          Zoom in
        </button>
        <button
          type="button"
          onClick={resetView}
          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-white/20 text-sm text-white hover:bg-white/10"
        >
          <RotateCcw className="h-4 w-4" />
          Reset
        </button>
      </div>
    </div>,
    document.body,
  )
}
