/**
 * SPA deploy path (e.g. `/GrainPro/` on some hosts, `/` on Linux server).
 * Set VITE_APP_BASE in .env - must match `base` in vite.config.ts.
 */

const DEFAULT_APP_BASE = '/'

export function getViteBaseUrl() {
  const envBase = import.meta.env.VITE_APP_BASE
  const viteBase = import.meta.env.BASE_URL
  const raw = envBase || viteBase || DEFAULT_APP_BASE
  return raw.endsWith('/') ? raw : `${raw}/`
}

/** Router basename without trailing slash (`/GrainPro`, or `` at root). */
export function getRouterBasename() {
  return getViteBaseUrl().replace(/\/$/, '')
}

/**
 * Prefix an in-app path for full-page navigation (window.location).
 * wouter / Link already use app-relative paths — do not use this there.
 */
export function withAppBase(path) {
  if (path == null || path === '') return getViteBaseUrl()
  if (/^https?:\/\//i.test(path)) return path

  const base = getRouterBasename()
  const normalized = path.startsWith('/') ? path : `/${path}`

  if (!base) return normalized
  if (normalized === base || normalized.startsWith(`${base}/`)) return normalized
  return `${base}${normalized}`
}

/** Hard navigation that always keeps the Vite base path. */
export function assignAppPath(path) {
  window.location.assign(withAppBase(path))
}

/**
 * If the browser URL is missing the deploy base, redirect before React mounts.
 * Skips Vite internals and static assets.
 */
export function ensureAppBasePath() {
  const base = getRouterBasename()
  if (!base) return

  const { pathname, search, hash } = window.location
  if (pathname === base || pathname.startsWith(`${base}/`)) return

  const skipPrefixes = ['/@', '/node_modules', '/src', '/assets']
  if (skipPrefixes.some((p) => pathname.startsWith(p))) return
  if (/\.[a-z0-9]+$/i.test(pathname)) return

  const appPath = pathname.startsWith('/') ? pathname : `/${pathname}`
  window.location.replace(`${base}${appPath}${search}${hash}`)
}
