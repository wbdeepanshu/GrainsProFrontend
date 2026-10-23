import { useCallback, useEffect, useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'

/** Visible thin scrollbar for dropdown option lists (replaces hide-scrollbar). */
export const DROPDOWN_LIST_SCROLL_CLASS =
  'overflow-y-auto py-1 overscroll-contain [scrollbar-width:thin] [scrollbar-color:#94a3b8_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300/90 [&::-webkit-scrollbar-track]:bg-transparent'

export function useDropdownScrollState(listRef, refreshDeps = []) {
  const [state, setState] = useState({
    canScrollUp: false,
    canScrollDown: false,
    isScrollable: false,
  })

  const updateScrollState = useCallback(() => {
    const el = listRef.current
    if (!el) return
    const { scrollTop, scrollHeight, clientHeight } = el
    const isScrollable = scrollHeight > clientHeight + 2
    setState({
      canScrollUp: scrollTop > 2,
      canScrollDown: scrollTop + clientHeight < scrollHeight - 2,
      isScrollable,
    })
  }, [listRef])

  useEffect(() => {
    updateScrollState()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [updateScrollState, ...refreshDeps])

  return { ...state, updateScrollState }
}

export function DropdownScrollIndicators({ canScrollUp, canScrollDown }) {
  return (
    <>
      {canScrollUp ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 z-10 h-6 bg-gradient-to-b from-white via-white/95 to-transparent"
          aria-hidden
        >
          <ChevronUp className="absolute left-1/2 top-0.5 h-3.5 w-3.5 -translate-x-1/2 text-slate-400" />
        </div>
      ) : null}
      {canScrollDown ? (
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-7 bg-gradient-to-t from-white via-white/95 to-transparent"
          aria-hidden
        >
          <ChevronDown className="absolute bottom-1 left-1/2 h-3.5 w-3.5 -translate-x-1/2 text-slate-400" />
        </div>
      ) : null}
    </>
  )
}

export function DropdownScrollFooter({ isScrollable, canScrollDown, itemCount }) {
  if (!isScrollable || itemCount <= 0) return null
  return (
    <div className="border-t border-slate-100 bg-slate-50 px-3 py-1.5 text-center text-[11px] text-slate-500">
      {canScrollDown ? `Scroll for more · ${itemCount} items` : `${itemCount} items shown`}
    </div>
  )
}
