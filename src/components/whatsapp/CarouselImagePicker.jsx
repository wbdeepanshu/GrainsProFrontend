import { useEffect, useRef, useState } from 'react'
import { AlertCircle, Check, ImagePlus, Loader2, Trash2 } from 'lucide-react'
import { uploadMediaFile } from '@/lib/media_upload_api'

const ACCEPTED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
/** WhatsApp rejects card images above 5 MB. */
const MAX_CARD_BYTES = 5 * 1024 * 1024

let nextItemId = 0

/**
 * Pick several images, push each to Cloudinary, and choose which of the resulting
 * URLs become carousel cards. Reports the selected URLs (in order) to the parent.
 */
export default function CarouselImagePicker({
  onChange,
  onNotice,
  disabled = false,
  minCards = 2,
  maxCards = 10,
}) {
  const [items, setItems] = useState([])
  const onChangeRef = useRef(onChange)
  const onNoticeRef = useRef(onNotice)
  const itemsRef = useRef(items)

  onChangeRef.current = onChange
  onNoticeRef.current = onNotice
  itemsRef.current = items

  useEffect(() => {
    onChangeRef.current?.(
      items.filter((item) => item.selected && item.url).map((item) => item.url),
    )
  }, [items])

  useEffect(
    () => () => {
      itemsRef.current.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl)
      })
    },
    [],
  )

  const patchItem = (id, patch) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)))
  }

  const uploadOne = async (id, file) => {
    try {
      const url = await uploadMediaFile(file, 'promotional_whatsapp')
      patchItem(id, { url, status: 'done', error: '' })
    } catch (error) {
      patchItem(id, { status: 'error', error: error.message || 'Upload failed' })
    }
  }

  const handleFiles = (event) => {
    const picked = Array.from(event.target.files || [])
    event.target.value = ''
    if (!picked.length) return

    const valid = []
    const problems = []
    for (const file of picked) {
      const type = String(file.type || '').toLowerCase()
      if (!ACCEPTED_IMAGE_TYPES.includes(type) && !type.startsWith('image/')) {
        problems.push(`${file.name}: not a JPG, PNG, or WEBP image`)
        continue
      }
      if (file.size > MAX_CARD_BYTES) {
        problems.push(`${file.name}: larger than 5 MB`)
        continue
      }
      valid.push(file)
    }

    const room = Math.max(0, maxCards - items.length)
    const accepted = valid.slice(0, room)
    if (valid.length > accepted.length) {
      problems.push(`A carousel holds at most ${maxCards} cards; extra images were ignored`)
    }
    if (problems.length) onNoticeRef.current?.(problems.join('. '))
    if (!accepted.length) return

    const newItems = accepted.map((file) => ({
      id: (nextItemId += 1),
      name: file.name,
      previewUrl: URL.createObjectURL(file),
      url: '',
      status: 'uploading',
      selected: true,
      error: '',
    }))

    setItems((prev) => [...prev, ...newItems])
    newItems.forEach((item, index) => uploadOne(item.id, accepted[index]))
  }

  const removeItem = (id) => {
    setItems((prev) => {
      const target = prev.find((item) => item.id === id)
      if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl)
      return prev.filter((item) => item.id !== id)
    })
  }

  const toggleItem = (id) => {
    setItems((prev) =>
      prev.map((item) => (item.id === id ? { ...item, selected: !item.selected } : item)),
    )
  }

  const retryItem = (id) => {
    onNoticeRef.current?.('Re-add the image to retry the upload.')
    removeItem(id)
  }

  const uploading = items.filter((item) => item.status === 'uploading').length
  const selectedCount = items.filter((item) => item.selected && item.url).length

  return (
    <div className="space-y-3">
      <label
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-slate-300 bg-slate-50 px-3 py-4 text-sm text-slate-600 hover:border-blue-400 hover:bg-blue-50/40 ${
          disabled || items.length >= maxCards ? 'pointer-events-none opacity-60' : ''
        }`}
      >
        <ImagePlus className="h-4 w-4 text-blue-800" />
        {items.length ? 'Add more images' : 'Select images for the carousel'}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,image/jpg"
          multiple
          className="hidden"
          onChange={handleFiles}
          disabled={disabled || items.length >= maxCards}
        />
      </label>

      <p className="text-xs text-slate-500">
        {`Pick ${minCards}–${maxCards} images (JPG, PNG, or WEBP, max 5 MB each). Each becomes one swipeable card.`}
      </p>

      {items.length ? (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {items.map((item, index) => (
            <div
              key={item.id}
              className={`relative overflow-hidden rounded-lg border ${
                item.selected && item.url
                  ? 'border-blue-500 ring-1 ring-blue-500/30'
                  : 'border-slate-200'
              }`}
            >
              <button
                type="button"
                onClick={() => toggleItem(item.id)}
                disabled={disabled || item.status !== 'done'}
                className="block w-full text-left disabled:cursor-not-allowed"
              >
                <img
                  src={item.previewUrl}
                  alt={item.name}
                  className="h-20 w-full bg-slate-100 object-cover"
                />
              </button>

              <div className="flex items-center justify-between gap-1 px-2 py-1.5">
                <span className="truncate text-[11px] text-slate-600" title={item.url || item.name}>
                  {item.status === 'uploading' ? 'Uploading…' : `Card ${index + 1}`}
                </span>
                <div className="flex shrink-0 items-center gap-1">
                  {item.status === 'uploading' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-blue-800" />
                  ) : null}
                  {item.status === 'done' && item.selected ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : null}
                  {item.status === 'error' ? (
                    <button
                      type="button"
                      onClick={() => retryItem(item.id)}
                      title={item.error}
                      className="text-rose-600"
                    >
                      <AlertCircle className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    disabled={disabled}
                    className="text-slate-400 hover:text-rose-600 disabled:opacity-50"
                    aria-label={`Remove ${item.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {items.length ? (
        <p className="text-xs text-slate-500">
          {selectedCount} of {items.length} selected as cards
          {uploading ? ` · ${uploading} still uploading` : ''}
          {selectedCount && selectedCount < minCards
            ? ` · select at least ${minCards}`
            : ''}
        </p>
      ) : null}
    </div>
  )
}
