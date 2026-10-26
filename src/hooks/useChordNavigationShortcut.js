import { useEffect, useRef } from 'react'
import { assignAppPath, withAppBase } from '@/lib/basePath'

/** Delay before prefix key navigates to list (allows chord keys after prefix). */
const LIST_NAV_DELAY_MS = 450

/**
 * Full page load, same as sidebar navigation: soft navigate() from heavy forms
 * (e.g. Add Gate Pass) can update the URL while leaving the old screen mounted.
 */
function navigateToShortcutPath(path) {
  if (!path) return
  const current = `${window.location.pathname}${window.location.search}`
  if (current === withAppBase(path)) return
  assignAppPath(path)
}

/** Physical key codes for A–Z shortcuts (Ctrl+M reports key "Enter", not "m"). */
export function shortcutKeyCode(shortcutKey) {
  const key = String(shortcutKey || '').toLowerCase()
  if (!/^[a-z]$/.test(key)) return null
  return `Key${key.toUpperCase()}`
}

/** Match shortcut letter by physical key code first, then event.key. */
export function matchesShortcutKey(event, shortcutKey) {
  const key = String(shortcutKey || '').toLowerCase()
  if (!key || !event) return false

  const code = shortcutKeyCode(key)
  if (code && event.code === code) return true

  const eventKey = String(event.key || '').toLowerCase()
  return eventKey === key
}

function findChordTarget(event, routes) {
  for (const [chordKey, path] of Object.entries(routes)) {
    if (matchesShortcutKey(event, chordKey) && path) return path
  }
  return null
}

function isEditableTarget(target) {
  if (!target || typeof target !== 'object') return false
  const tag = String(target.tagName || '').toLowerCase()
  if (tag === 'input' || tag === 'textarea' || tag === 'select') return true
  if (target.isContentEditable) return true
  return Boolean(target.closest?.('input, textarea, select, [contenteditable="true"]'))
}

/**
 * Pending chord state is shared by every registered prefix so that a second key
 * which is itself a prefix elsewhere (Ctrl+B then P, while Ctrl+P opens purchase
 * orders) resolves as the chord instead of starting a new one.
 */
const chordState = {
  prefix: null,
  routes: {},
  listPath: null,
  pending: false,
  chordDone: false,
  listTimer: null,
}

function clearChordTimer() {
  if (chordState.listTimer) {
    clearTimeout(chordState.listTimer)
    chordState.listTimer = null
  }
}

function resetChordState() {
  clearChordTimer()
  chordState.prefix = null
  chordState.routes = {}
  chordState.listPath = null
  chordState.pending = false
  chordState.chordDone = false
}

/**
 * Chord navigation:
 * - Ctrl+{prefixKey} → listPath (if provided, after brief delay on key release)
 * - Ctrl+{prefixKey}, {chordKey} → matching path from chordPaths
 */
export function useChordNavigationShortcut({
  enabled = true,
  prefixKey,
  listPath = null,
  createPath = null,
  chordPaths = {},
}) {
  const routesRef = useRef({})
  const listPathRef = useRef(listPath)

  useEffect(() => {
    const routes = { ...(chordPaths || {}) }
    if (createPath) routes.c = createPath
    routesRef.current = routes
    listPathRef.current = listPath
  }, [chordPaths, createPath, listPath])

  useEffect(() => {
    if (!enabled) return undefined

    const prefix = String(prefixKey || '').toLowerCase()
    if (!prefix) return undefined

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return
      if (isEditableTarget(event.target)) return

      // Resolve an in-flight chord before claiming a prefix, so the pending
      // shortcut keeps ownership of the next key.
      const chordReady = chordState.pending || Boolean(chordState.listTimer)
      if (chordReady && !event.altKey && !event.shiftKey) {
        const chordTarget = findChordTarget(event, chordState.routes)
        if (chordTarget) {
          // Chord second key: allow with or without Ctrl still held
          event.preventDefault()
          event.stopPropagation()
          clearChordTimer()
          chordState.pending = false
          chordState.chordDone = true
          navigateToShortcutPath(chordTarget)
          return
        }
      }

      const modifier = event.ctrlKey || event.metaKey
      if (modifier && matchesShortcutKey(event, prefix) && !event.altKey && !event.shiftKey) {
        event.preventDefault()
        event.stopPropagation()
        clearChordTimer()
        chordState.prefix = prefix
        chordState.routes = routesRef.current
        chordState.listPath = listPathRef.current
        chordState.pending = true
        chordState.chordDone = false
      }
    }

    const handleKeyUp = (event) => {
      if (
        chordState.prefix !== prefix ||
        !matchesShortcutKey(event, prefix) ||
        event.shiftKey ||
        !chordState.pending ||
        chordState.chordDone
      ) {
        return
      }

      clearChordTimer()
      chordState.listTimer = setTimeout(() => {
        chordState.listTimer = null
        chordState.pending = false
        navigateToShortcutPath(chordState.listPath)
      }, LIST_NAV_DELAY_MS)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      if (chordState.prefix === prefix) resetChordState()
    }
  }, [enabled, prefixKey])
}

/**
 * Single-key navigation: Ctrl+{key} → path (e.g. Ctrl+L → ledger masters).
 * Set requireShift: true for Ctrl+Shift+{key} (e.g. Ctrl+Shift+D → dashboard).
 * Set requireCtrl: false with requireShift for Shift-only (e.g. Shift+D → dashboard).
 */
export function useSingleKeyNavigationShortcut({
  enabled = true,
  shortcutKey,
  path,
  requireShift = false,
  requireCtrl = true,
}) {
  useEffect(() => {
    if (!enabled) return undefined

    const key = String(shortcutKey || '').toLowerCase()
    if (!key || !path) return undefined

    const handleKeyDown = (event) => {
      if (event.defaultPrevented) return
      if (isEditableTarget(event.target)) return

      const modifier = event.ctrlKey || event.metaKey
      const ctrlMatches = requireCtrl ? modifier : !modifier
      const shiftMatches = requireShift ? event.shiftKey : !event.shiftKey
      if (ctrlMatches && matchesShortcutKey(event, key) && !event.altKey && shiftMatches) {
        event.preventDefault()
        event.stopImmediatePropagation()
        navigateToShortcutPath(path)
      }
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [enabled, shortcutKey, path, requireShift, requireCtrl])
}
