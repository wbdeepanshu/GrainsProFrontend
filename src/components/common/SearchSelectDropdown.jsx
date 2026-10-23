import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Loader2, Search, X } from 'lucide-react'
import {
  DROPDOWN_LIST_SCROLL_CLASS,
  DropdownScrollFooter,
  DropdownScrollIndicators,
  useDropdownScrollState,
} from '@/components/common/dropdownScrollHints'

function cn(...classes) {
  return classes.filter(Boolean).join(' ')
}

const MENU_SEARCH_HEIGHT = 56
const MENU_MIN_LIST_HEIGHT = 120
const MENU_PREFERRED_LIST_HEIGHT = 208

const SearchSelectDropdown = forwardRef(function SearchSelectDropdown(
  {
    value,
    options = [],
    onChange,
    placeholder = 'Select option',
    searchPlaceholder = 'Search...',
    emptyText = 'No options found',
    disabled = false,
    loading = false,
    selectedLabel,
    filterLocally = true,
    onSearchChange,
    onOpenChange,
    onLoadMore,
    hasMore = false,
    loadingMore = false,
    clearable = false,
    id,
    compact = false,
    wrapLabel = false,
    useFixedMenu = false,
    onAfterSelect,
    onTabForward,
    endAction = null,
  },
  ref,
) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightedIndex, setHighlightedIndex] = useState(0)
  const [menuStyle, setMenuStyle] = useState({})
  const [listMaxHeight, setListMaxHeight] = useState(MENU_PREFERRED_LIST_HEIGHT)
  const containerRef = useRef(null)
  const menuRef = useRef(null)
  const listRef = useRef(null)
  const searchInputRef = useRef(null)
  const triggerRef = useRef(null)
  const pointerDownRef = useRef(false)
  const suppressOpenOnFocusRef = useRef(false)
  const optionRefs = useRef([])
  const loadMoreLockRef = useRef(false)
  const highlightFromKeyboardRef = useRef(false)

  const selectedOption = useMemo(
    () => options.find((option) => String(option.value) === String(value)),
    [options, value],
  )

  const filteredOptions = useMemo(() => {
    if (!filterLocally) return options
    const query = search.trim().toLowerCase()
    if (!query) return options
    return options.filter((option) => {
      const label = String(option.label || '').toLowerCase()
      const hint = String(option.hint || '').toLowerCase()
      const subLabel = String(option.subLabel || '').toLowerCase()
      const searchText = String(option.searchText || '').toLowerCase()
      return (
        label.includes(query)
        || hint.includes(query)
        || subLabel.includes(query)
        || searchText.includes(query)
      )
    })
  }, [filterLocally, options, search])

  const setOpenState = (next) => {
    setOpen(next)
    onOpenChange?.(next)
  }

  const getInitialHighlightIndex = (list) => {
    if (list.length === 0) return 0
    const selectedIdx = list.findIndex((option) => String(option.value) === String(value))
    return selectedIdx >= 0 ? selectedIdx : 0
  }

  const moveHighlight = (delta) => {
    if (loading || filteredOptions.length === 0) return
    highlightFromKeyboardRef.current = true
    setHighlightedIndex((prev) => {
      const next = prev + delta
      if (next < 0) return 0
      if (next >= filteredOptions.length) return filteredOptions.length - 1
      return next
    })
  }

  const selectHighlighted = () => {
    const option = filteredOptions[highlightedIndex]
    if (option) handleSelect(option.value)
  }

  const focusNextTabbable = useCallback(() => {
    const selector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled]):not([type="hidden"])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',')
    const nodes = Array.from(document.querySelectorAll(selector)).filter((el) => {
      if (el.getAttribute('aria-hidden') === 'true') return false
      const style = window.getComputedStyle(el)
      if (style.visibility === 'hidden' || style.display === 'none') return false
      return el.getClientRects().length > 0
    })
    const trigger = triggerRef.current
    let index = trigger ? nodes.indexOf(trigger) : -1
    if (index < 0) {
      const active = document.activeElement
      index = active ? nodes.indexOf(active) : -1
    }
    const next = nodes[index + 1]
    if (next) {
      next.focus({ preventScroll: true })
      return
    }
    trigger?.focus({ preventScroll: true })
  }, [])

  const selectHighlightedOnTab = useCallback(
    (event) => {
      event.preventDefault()
      const option = filteredOptions[highlightedIndex]
      if (!event.shiftKey && option) {
        onChange(option.value)
        if (onAfterSelect) {
          requestAnimationFrame(() => onAfterSelect(option.value))
        }
      }
      suppressOpenOnFocusRef.current = true
      setOpenState(false)
      window.setTimeout(() => {
        suppressOpenOnFocusRef.current = false
      }, 0)

      if (event.shiftKey) {
        requestAnimationFrame(() => triggerRef.current?.focus({ preventScroll: true }))
        return
      }

      if (onTabForward) {
        requestAnimationFrame(() => onTabForward())
        return
      }

      requestAnimationFrame(() => focusNextTabbable())
    },
    [
      filteredOptions,
      highlightedIndex,
      onChange,
      onAfterSelect,
      onTabForward,
      focusNextTabbable,
      setOpenState,
    ],
  )

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current?.contains(event.target)) return
      if (menuRef.current?.contains(event.target)) return
      setOpenState(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const updateMenuPosition = useCallback(() => {
    const anchor = containerRef.current || triggerRef.current
    if (!anchor) return
    const rect = anchor.getBoundingClientRect()
    const viewportPadding = 12
    const spaceBelow = window.innerHeight - rect.bottom - viewportPadding
    const spaceAbove = rect.top - viewportPadding
    const preferredHeight = MENU_SEARCH_HEIGHT + MENU_PREFERRED_LIST_HEIGHT
    const openUpward = spaceBelow < preferredHeight && spaceAbove > spaceBelow
    const availableSpace = openUpward ? spaceAbove : spaceBelow
    const nextListHeight = Math.max(
      MENU_MIN_LIST_HEIGHT,
      Math.min(MENU_PREFERRED_LIST_HEIGHT, availableSpace - MENU_SEARCH_HEIGHT),
    )
    const maxMenuWidth = window.innerWidth - viewportPadding * 2
    const minPreferredWidth = wrapLabel ? 420 : 200
    const menuWidth = Math.min(Math.max(rect.width, minPreferredWidth), maxMenuWidth)
    const left = Math.min(
      Math.max(rect.left, viewportPadding),
      window.innerWidth - menuWidth - viewportPadding,
    )

    setListMaxHeight(nextListHeight)
    setMenuStyle({
      position: 'fixed',
      ...(openUpward
        ? { bottom: window.innerHeight - rect.top + 6 }
        : { top: rect.bottom + 6 }),
      left,
      width: menuWidth,
      zIndex: 9999,
      maxHeight: nextListHeight + MENU_SEARCH_HEIGHT,
    })
  }, [wrapLabel])

  useEffect(() => {
    if (!open || !useFixedMenu) return
    updateMenuPosition()
    window.addEventListener('scroll', updateMenuPosition, true)
    window.addEventListener('resize', updateMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateMenuPosition, true)
      window.removeEventListener('resize', updateMenuPosition)
    }
  }, [open, useFixedMenu, updateMenuPosition, filteredOptions.length, loading])

  const focusAndOpen = useCallback(() => {
    if (disabled) return
    suppressOpenOnFocusRef.current = false
    setOpenState(true)
    requestAnimationFrame(() => {
      triggerRef.current?.focus({ preventScroll: true })
      if (useFixedMenu) {
        updateMenuPosition()
      }
      searchInputRef.current?.focus({ preventScroll: true })
    })
  }, [disabled, useFixedMenu, updateMenuPosition])

  useImperativeHandle(
    ref,
    () => ({
      focus: () => triggerRef.current?.focus({ preventScroll: true }),
      open: () => setOpenState(true),
      focusAndOpen,
    }),
    [focusAndOpen],
  )

  useEffect(() => {
    if (!open) {
      setSearch('')
      onSearchChange?.('')
      setHighlightedIndex(0)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    setHighlightedIndex(getInitialHighlightIndex(filteredOptions))
    requestAnimationFrame(() => searchInputRef.current?.focus({ preventScroll: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => {
    if (!open) return
    setHighlightedIndex((prev) => {
      if (filteredOptions.length === 0) return 0
      return Math.min(prev, filteredOptions.length - 1)
    })
  }, [filteredOptions.length, open])

  useEffect(() => {
    if (!open || loading || filteredOptions.length === 0) return
    // Only auto-scroll for keyboard navigation — mouse hover should not scroll the list.
    if (!highlightFromKeyboardRef.current) return
    highlightFromKeyboardRef.current = false
    const option = optionRefs.current[highlightedIndex]
    const list = listRef.current
    if (!option || !list) return
    const optionTop = option.offsetTop
    const optionBottom = optionTop + option.offsetHeight
    if (optionTop < list.scrollTop) {
      list.scrollTop = optionTop
    } else if (optionBottom > list.scrollTop + list.clientHeight) {
      list.scrollTop = optionBottom - list.clientHeight
    }
  }, [highlightedIndex, open, loading, filteredOptions.length])

  const handleSelect = (optionValue) => {
    onChange(optionValue)
    suppressOpenOnFocusRef.current = true
    setOpenState(false)
    if (onAfterSelect) {
      requestAnimationFrame(() => onAfterSelect(optionValue))
      window.setTimeout(() => {
        suppressOpenOnFocusRef.current = false
      }, 0)
      return
    }
    requestAnimationFrame(() => {
      triggerRef.current?.focus({ preventScroll: true })
      window.setTimeout(() => {
        suppressOpenOnFocusRef.current = false
      }, 0)
    })
  }

  const handleSearchChange = (next) => {
    setSearch(next)
    onSearchChange?.(next)
    setHighlightedIndex(0)
  }

  const { canScrollUp, canScrollDown, isScrollable, updateScrollState } = useDropdownScrollState(
    listRef,
    [open, filteredOptions.length, loading, listMaxHeight],
  )

  const handleListScroll = useCallback(() => {
    updateScrollState()
    const el = listRef.current
    if (!el || !onLoadMore || !hasMore || loadingMore || loading) return
    const threshold = 48
    const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - threshold
    if (!nearBottom) {
      loadMoreLockRef.current = false
      return
    }
    if (loadMoreLockRef.current) return
    loadMoreLockRef.current = true
    onLoadMore()
  }, [hasMore, loading, loadingMore, onLoadMore, updateScrollState])

  useEffect(() => {
    if (!loadingMore) {
      loadMoreLockRef.current = false
    }
  }, [loadingMore])

  useEffect(() => {
    if (!open || loading || loadingMore || !hasMore || !onLoadMore) return
    const el = listRef.current
    if (!el) return
    if (el.scrollHeight <= el.clientHeight + 1) {
      onLoadMore()
    }
  }, [open, loading, loadingMore, hasMore, onLoadMore, filteredOptions.length])

  const handleTriggerFocus = () => {
    if (suppressOpenOnFocusRef.current) return
    if (!disabled && !open && !pointerDownRef.current) {
      setOpenState(true)
    }
  }

  const handleTriggerPointerDown = () => {
    pointerDownRef.current = true
  }

  const handleTriggerPointerUp = () => {
    window.setTimeout(() => {
      pointerDownRef.current = false
    }, 0)
  }

  const handleContainerBlur = (event) => {
    if (useFixedMenu) return
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setOpenState(false)
    }
  }

  const handleMenuKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpenState(false)
      triggerRef.current?.focus({ preventScroll: true })
      return
    }

    if (event.key === 'Tab') {
      selectHighlightedOnTab(event)
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      moveHighlight(1)
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      moveHighlight(-1)
      return
    }

    if (event.key === 'Home') {
      event.preventDefault()
      highlightFromKeyboardRef.current = true
      setHighlightedIndex(0)
      return
    }

    if (event.key === 'End') {
      event.preventDefault()
      highlightFromKeyboardRef.current = true
      if (filteredOptions.length > 0) {
        setHighlightedIndex(filteredOptions.length - 1)
      }
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      selectHighlighted()
    }
  }

  const handleTriggerKeyDown = (event) => {
    if (event.key === 'Tab' && open) {
      selectHighlightedOnTab(event)
      return
    }

    if (event.key === 'Tab' && !event.shiftKey && !open && onTabForward) {
      event.preventDefault()
      onTabForward()
      return
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (!open) {
        setOpenState(true)
      } else {
        selectHighlighted()
      }
      return
    }

    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (!open) {
        setOpenState(true)
      } else {
        searchInputRef.current?.focus()
        moveHighlight(1)
      }
      return
    }

    if (event.key === 'ArrowUp' && open) {
      event.preventDefault()
      searchInputRef.current?.focus()
      moveHighlight(-1)
    }
  }

  const handleClear = (event) => {
    event.preventDefault()
    event.stopPropagation()
    onChange('')
    setOpenState(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }

  const resolvedLabel =
    selectedOption?.label || (value && selectedLabel ? selectedLabel : null) || placeholder

  const hasValue = Boolean(selectedOption || (value && selectedLabel))

  const activeOptionId =
    open && filteredOptions[highlightedIndex]
      ? `${id || 'search-select'}-option-${highlightedIndex}`
      : undefined

  const menuPanel = (
    <div
      ref={menuRef}
      className={cn(
        'rounded-lg border border-gray-200 bg-white shadow-lg shadow-slate-900/10 overflow-hidden',
        !useFixedMenu &&
          (wrapLabel
            ? 'absolute z-30 mt-1.5 left-0 min-w-full w-max max-w-[min(36rem,calc(100vw-1.5rem))]'
            : 'absolute z-30 mt-1.5 w-full min-w-[200px]'),
      )}
      style={useFixedMenu ? menuStyle : undefined}
    >
      <div className="p-2 border-b border-gray-100">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            role="combobox"
            aria-expanded={open}
            aria-controls={`${id || 'search-select'}-listbox`}
            aria-activedescendant={activeOptionId}
            onChange={(e) => handleSearchChange(e.target.value)}
            onKeyDown={handleMenuKeyDown}
            placeholder={searchPlaceholder}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
          />
        </div>
      </div>

      <div className="relative">
        <DropdownScrollIndicators canScrollUp={canScrollUp} canScrollDown={canScrollDown} />
        <ul
          ref={listRef}
          id={`${id || 'search-select'}-listbox`}
          className={cn(DROPDOWN_LIST_SCROLL_CLASS, !useFixedMenu && 'max-h-52')}
          style={useFixedMenu ? { maxHeight: listMaxHeight } : undefined}
          role="listbox"
          onScroll={handleListScroll}
        >
        {loading ? (
          <li className="px-3 py-6 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading...
          </li>
        ) : filteredOptions.length === 0 ? (
          <li className="px-3 py-6 text-center text-sm text-slate-400">{emptyText}</li>
        ) : (
          <>
            {filteredOptions.map((option, index) => {
              const isSelected = String(option.value) === String(value)
              const isHighlighted = index === highlightedIndex
              return (
                <li key={`${option.value}-${index}`}>
                  <button
                    ref={(el) => {
                      optionRefs.current[index] = el
                    }}
                    id={`${id || 'search-select'}-option-${index}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => {
                      highlightFromKeyboardRef.current = false
                      setHighlightedIndex(index)
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      handleSelect(option.value)
                    }}
                    className={cn(
                      'w-full px-3 py-2.5 text-left text-sm transition-colors cursor-pointer flex items-center justify-between gap-2',
                      isHighlighted && 'bg-blue-50 text-blue-900',
                      isSelected && !isHighlighted && 'bg-slate-100 text-slate-900 font-semibold',
                      isSelected && isHighlighted && 'bg-blue-100 text-blue-900 font-semibold',
                      !isHighlighted && !isSelected && 'text-slate-700 hover:bg-slate-50',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span
                        className={cn(
                          'block',
                          wrapLabel ? 'whitespace-normal break-words leading-snug' : 'truncate',
                        )}
                        title={option.label}
                      >
                        {option.label}
                      </span>
                      {option.subLabel ? (
                        <span
                          className={cn(
                            'block text-[11px] text-slate-500',
                            wrapLabel ? 'whitespace-normal break-words leading-snug' : 'truncate',
                          )}
                          title={option.subLabel}
                        >
                          {option.subLabel}
                        </span>
                      ) : null}
                    </span>
                    {!option.subLabel && option.hint ? (
                      <span
                        className={cn(
                          'text-xs font-medium whitespace-nowrap shrink-0',
                          option.hintClassName || 'text-slate-500',
                        )}
                      >
                        {option.hint}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })}
            {loadingMore && (
              <li className="px-3 py-3 text-center text-sm text-slate-400 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading more...
              </li>
            )}
          </>
        )}
      </ul>
      </div>
      <DropdownScrollFooter
        isScrollable={isScrollable}
        canScrollDown={canScrollDown}
        itemCount={filteredOptions.length}
      />
    </div>
  )

  return (
    <div ref={containerRef} className="relative w-full" onBlur={handleContainerBlur}>
      <div
        className={cn(
          'w-full px-3 border border-gray-200 rounded-lg text-sm bg-white',
          compact
            ? wrapLabel
              ? 'min-h-9 py-1.5'
              : 'min-h-9 h-9 py-1.5'
            : wrapLabel
              ? 'min-h-[42px] py-2'
              : 'min-h-[42px] py-2.5',
          'flex items-center gap-1.5 transition-colors',
          'focus-within:outline-none focus-within:ring-2 focus-within:ring-blue-800/20 focus-within:border-blue-800',
          disabled && 'opacity-60 cursor-not-allowed bg-slate-50',
          open && 'border-blue-800 ring-2 ring-blue-800/20',
        )}
      >
        <button
          ref={triggerRef}
          id={id}
          type="button"
          disabled={disabled}
          onClick={() => setOpenState(!open)}
          onFocus={handleTriggerFocus}
          onPointerDown={handleTriggerPointerDown}
          onPointerUp={handleTriggerPointerUp}
          onKeyDown={handleTriggerKeyDown}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? `${id || 'search-select'}-listbox` : undefined}
          title={hasValue ? String(resolvedLabel) : undefined}
          className={cn(
            'flex-1 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer',
            wrapLabel ? 'whitespace-normal break-words leading-snug' : 'truncate',
            'focus:outline-none disabled:cursor-not-allowed',
            hasValue ? 'text-slate-900' : 'text-slate-400',
          )}
        >
          {resolvedLabel}
        </button>
        {endAction ? (
          <div
            className="shrink-0 flex items-center"
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          >
            {endAction}
          </div>
        ) : null}
        {clearable && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="shrink-0 p-0.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-800/20"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpenState(!open)}
          className="shrink-0 p-0 border-0 bg-transparent cursor-pointer disabled:cursor-not-allowed focus:outline-none"
          aria-label={open ? 'Close dropdown' : 'Open dropdown'}
          tabIndex={-1}
        >
          <ChevronDown
            className={cn('h-4 w-4 text-slate-400 transition-transform', open && 'rotate-180')}
          />
        </button>
      </div>

      {open && (useFixedMenu ? createPortal(menuPanel, document.body) : menuPanel)}
    </div>
  )
})

export default SearchSelectDropdown
