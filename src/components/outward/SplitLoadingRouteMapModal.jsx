import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertTriangle,
  ArrowRightLeft,
  Check,
  Loader2,
  MapPin,
  RotateCcw,
  Truck,
  X,
} from 'lucide-react'
import { buildPathMetrics, pointAlongPath } from '@/lib/liveTrackingMapUtils'
import truckTopIcon from '@/assets/outward/truck-top.png'

const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY
const TRUCK_MARKER_SIZE = 56
/** Artwork faces opposite to map bearing — rotate 180° so cab leads travel. */
const TRUCK_HEADING_OFFSET_DEG = 180
let truckIconUrlCache = null
function getTruckIconUrl() {
  if (!truckIconUrlCache) {
    truckIconUrlCache = loadTransparentTruckIcon(truckTopIcon)
  }
  return truckIconUrlCache
}

function truckDisplayHeading(heading) {
  return ((Number(heading) || 0) + TRUCK_HEADING_OFFSET_DEG) % 360
}

/** Drop the return-to-origin leg so the truck stops at the last delivery point. */
function outboundRoutePath(path) {
  if (!Array.isArray(path) || path.length < 2) return path || []
  const start = path[0]
  if (!start) return path
  const nearStartKm = 0.08
  let leftStart = false
  for (let i = 1; i < path.length; i += 1) {
    const point = path[i]
    const dLat = ((point.lat - start.lat) * Math.PI) / 180
    const dLng = ((point.lng - start.lng) * Math.PI) / 180
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((start.lat * Math.PI) / 180) *
        Math.cos((point.lat * Math.PI) / 180) *
        Math.sin(dLng / 2) ** 2
    const km = 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
    if (km > nearStartKm) leftStart = true
    if (leftStart && km < nearStartKm) {
      return path.slice(0, Math.max(2, i))
    }
  }
  return path
}

export const VEHICLE_ROUTE_COLORS = [
  '#2563eb', // blue
  '#16a34a', // green
  '#dc2626', // red
  '#171717', // black
  '#ca8a04', // yellow
  '#7c3aed', // violet
]

const ORIGIN_COLOR = '#059669'
const ORIGIN_LABEL_COLOR = '#047857'
const UNASSIGNED_STOP_COLOR = '#f97316'
const UNASSIGNED_LABEL_COLOR = '#ea580c'
const ASSIGNED_LABEL_COLOR = '#000000'
const DUE_STOP_COLORS = {
  under_due: '#0ea5e9',
  overdue: '#f97316',
  priority: '#dc2626',
}
const DUE_LABEL_COLORS = {
  under_due: '#0369a1',
  overdue: '#c2410c',
  priority: '#991b1b',
}
const MAP_MAX_ZOOM = 11
const MAP_FIT_PADDING = 120
const COLOCATE_PRECISION = 5
const ALL_VEHICLES = 'all'
// Hide cluttered POI icons only; keep city/area/road names visible on the basemap.
const DELIVERY_MAP_STYLES = [
  { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.medical', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.school', stylers: [{ visibility: 'off' }] },
  { featureType: 'poi.sports_complex', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

function vehicleRouteColor(index) {
  return VEHICLE_ROUTE_COLORS[Math.max(0, Number(index) || 0) % VEHICLE_ROUTE_COLORS.length]
}

function parseCoordinate(value) {
  const num = Number(String(value ?? '').replace(',', '').trim())
  return Number.isFinite(num) ? num : null
}

/** Reject missing or null-island (0,0) coordinates. */
function parseLatLng(latValue, lngValue) {
  const lat = parseCoordinate(latValue)
  const lng = parseCoordinate(lngValue)
  if (lat == null || lng == null) return { lat: null, lng: null }
  if (Math.abs(lat) < 1e-8 && Math.abs(lng) < 1e-8) return { lat: null, lng: null }
  if (!(-90 <= lat && lat <= 90 && -180 <= lng && lng <= 180)) return { lat: null, lng: null }
  return { lat, lng }
}

function coordinateDistance(first, second) {
  if (!first || !second) return Number.POSITIVE_INFINITY
  const toRadians = (value) => (value * Math.PI) / 180
  const dLat = toRadians(second.lat - first.lat)
  const dLng = toRadians(second.lng - first.lng)
  const lat1 = toRadians(first.lat)
  const lat2 = toRadians(second.lat)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2
  return 6371 * 2 * Math.asin(Math.sqrt(Math.min(1, Math.max(0, a))))
}

function buildNearestStopSequence(route, origin) {
  const originLatLng = parseLatLng(origin?.lat, origin?.long ?? origin?.lng)
  const currentOrigin =
    originLatLng.lat == null || originLatLng.lng == null
      ? null
      : { lat: originLatLng.lat, lng: originLatLng.lng }
  const known = []
  const missing = []

  ;(route.stops || []).forEach((stop) => {
    const latLng = parseLatLng(stop.lat, stop.lng ?? stop.long)
    const row = {
      stop,
      point: latLng.lat == null || latLng.lng == null ? null : { lat: latLng.lat, lng: latLng.lng },
    }
    if (row.point) known.push(row)
    else missing.push(row)
  })

  const ordered = []
  let current = currentOrigin
  while (known.length) {
    const nextIndex = current
      ? known.reduce((bestIndex, candidate, index) => {
          const bestDistance = coordinateDistance(current, known[bestIndex].point)
          const candidateDistance = coordinateDistance(current, candidate.point)
          return candidateDistance < bestDistance ? index : bestIndex
        }, 0)
      : 0
    const [next] = known.splice(nextIndex, 1)
    ordered.push(next.stop)
    current = next.point
  }
  ordered.push(...missing.map((row) => row.stop))
  return ordered.map((stop) => String(stop.so_number || '').trim()).filter(Boolean)
}

function parseDueDate(value) {
  if (!value) return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate())
  }
  const text = String(value).trim()
  const iso = text.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]))
  const dmy = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (dmy) return new Date(Number(dmy[3]), Number(dmy[2]) - 1, Number(dmy[1]))
  return null
}

function computeDueFields(source = {}) {
  const existingDays = Number(source.due_days)
  const existingStatus = String(source.due_status || '').trim()
  if (Number.isFinite(existingDays) && existingStatus) {
    return {
      order_due_date: source.order_due_date || source.due_date || null,
      due_days: existingDays,
      due_status: existingStatus,
    }
  }
  const due = parseDueDate(source.order_due_date || source.due_date)
  if (!due) {
    return {
      order_due_date: source.order_due_date || source.due_date || null,
      due_days: null,
      due_status: 'under_due',
    }
  }
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due_days = Math.round((today.getTime() - due.getTime()) / 86400000)
  let due_status = 'under_due'
  if (due_days > 2) due_status = 'priority'
  else if (due_days > 0) due_status = 'overdue'
  return {
    order_due_date: due.toISOString().slice(0, 10),
    due_days,
    due_status,
  }
}

function resolveDueStatus(point) {
  const status = String(point?.due_status || '').trim()
  if (status === 'priority' || status === 'overdue' || status === 'under_due') return status
  return computeDueFields(point).due_status
}

function formatDueDaysLabel(point) {
  const status = resolveDueStatus(point)
  const days = Number(point?.due_days)
  if (status === 'priority') {
    return Number.isFinite(days) ? `P ${days}d` : 'PRIORITY'
  }
  if (status === 'overdue') {
    return Number.isFinite(days) ? `+${days}d` : 'Overdue'
  }
  if (!Number.isFinite(days)) return ''
  if (days === 0) return 'Due today'
  return `${Math.abs(days)}d`
}

function dueStopColor(point) {
  return DUE_STOP_COLORS[resolveDueStatus(point)] || UNASSIGNED_STOP_COLOR
}

function dueLabelColor(point) {
  return DUE_LABEL_COLORS[resolveDueStatus(point)] || UNASSIGNED_LABEL_COLOR
}

function formatWeight(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${num.toLocaleString('en-IN', { maximumFractionDigits: 3 })} Qtl`
}

function formatWeightCompact(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${num.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 })} Qtl`
}

function resolveVehicleAssignmentMeta(vehicleNo, vehicles = []) {
  const normalized = String(vehicleNo || '').trim()
  if (!normalized) return null
  const vehicle = vehicles.find((row) => String(row.vehicle_no || '').trim() === normalized)
  if (!vehicle) return null
  const remaining = Number(vehicle.remaining_capacity_qtl ?? 0)
  const overloaded = remaining < -1e-9
  return {
    vehicle_no: normalized,
    remaining,
    overloaded,
    mapped_weight_qtl: Number(vehicle.mapped_weight_qtl || 0),
    capacity_qtl: Number(vehicle.capacity_qtl || 0),
  }
}

function vehicleCapacityButtonLabel(meta) {
  if (!meta) return 'Click to assign'
  if (meta.overloaded) {
    return `Over ${formatWeightCompact(Math.abs(meta.remaining))}`
  }
  return `Rem ${formatWeightCompact(meta.remaining)}`
}

function formatCapacitySummary(loadedWeight, capacity, soCount) {
  return `${formatWeightCompact(loadedWeight)} / ${formatWeightCompact(capacity)} · ${soCount} SO`
}

function markerLabelText(point) {
  if (point.type === 'origin') return 'START'
  const weight = formatWeightCompact(point.weight_qtl)
  const due = formatDueDaysLabel(point)
  const withDue = due ? `${weight} · ${due}` : weight
  if (point.sequence) return `${point.sequence}-${withDue}`
  const clusterSize = Number(point.clusterSize || 0)
  if (clusterSize > 1) {
    return `${Number(point.clusterIndex || 0) + 1}-${withDue}`
  }
  return withDue
}

function clearRouteOverlays(overlays) {
  ;(overlays || []).forEach((item) => {
    if (item?.polyline) item.polyline.setMap(null)
    if (item?.directionsRenderer) item.directionsRenderer.setMap(null)
    if (item?.animationId != null) cancelAnimationFrame(item.animationId)
    if (item?.truckOverlay) item.truckOverlay.destroy()
  })
}

/** Remove near-black background from the top-down truck artwork. */
function loadTransparentTruckIcon(src) {
  return new Promise((resolve) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth || img.width
        canvas.height = img.naturalHeight || img.height
        const ctx = canvas.getContext('2d')
        if (!ctx || !canvas.width || !canvas.height) {
          resolve(src)
          return
        }
        ctx.drawImage(img, 0, 0)
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const { data } = imageData
        for (let i = 0; i < data.length; i += 4) {
          if (data[i] < 28 && data[i + 1] < 28 && data[i + 2] < 28) {
            data[i + 3] = 0
          }
        }
        ctx.putImageData(imageData, 0, 0)
        resolve(canvas.toDataURL('image/png'))
      } catch {
        resolve(src)
      }
    }
    img.onerror = () => resolve(src)
    img.src = src
  })
}

function extractDirectionsPath(result) {
  const path = []
  const legs = result?.routes?.[0]?.legs || []
  legs.forEach((leg) => {
    ;(leg.steps || []).forEach((step) => {
      const stepPath = step.path || []
      stepPath.forEach((latLng, index) => {
        const lat = typeof latLng.lat === 'function' ? latLng.lat() : Number(latLng.lat)
        const lng = typeof latLng.lng === 'function' ? latLng.lng() : Number(latLng.lng)
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return
        if (
          index === 0 &&
          path.length &&
          Math.abs(path[path.length - 1].lat - lat) < 1e-7 &&
          Math.abs(path[path.length - 1].lng - lng) < 1e-7
        ) {
          return
        }
        path.push({ lat, lng })
      })
    })
  })
  return path
}

function createTruckOverlayClass(maps) {
  return class TruckOverlay extends maps.OverlayView {
    constructor({ position, heading = 0, vehicleNo = '', color = '#2563eb', iconUrl }) {
      super()
      this.position = position
      this.heading = heading
      this.vehicleNo = vehicleNo
      this.color = color
      this.iconUrl = iconUrl || truckTopIcon
      this.div = null
    }

    onAdd() {
      const div = document.createElement('div')
      div.style.position = 'absolute'
      div.style.width = `${TRUCK_MARKER_SIZE}px`
      div.style.height = `${TRUCK_MARKER_SIZE}px`
      div.style.pointerEvents = 'none'
      div.style.transform = 'translate(-50%, -50%)'
      div.style.zIndex = '2600'
      div.title = this.vehicleNo ? `Vehicle ${this.vehicleNo}` : 'Vehicle'
      div.innerHTML = `
        <div style="position:relative;width:100%;height:100%;">
          <div data-truck-rotator="1" style="
            width:100%;height:100%;
            display:flex;align-items:center;justify-content:center;
            transform:rotate(${truckDisplayHeading(this.heading)}deg);
            filter:drop-shadow(0 2px 4px rgba(15,23,42,.45));
          ">
            <img
              src="${this.iconUrl}"
              alt=""
              style="display:block;width:100%;height:100%;object-fit:contain;pointer-events:none;"
            />
          </div>
          <span style="
            position:absolute;bottom:-4px;left:50%;transform:translateX(-50%);
            max-width:${TRUCK_MARKER_SIZE + 28}px;
            padding:1px 5px;border-radius:999px;
            background:${this.color};color:#fff;
            font:700 9px/1.2 system-ui,sans-serif;
            white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
            box-shadow:0 1px 2px rgba(0,0,0,.25);
          ">${String(this.vehicleNo || '').slice(0, 12)}</span>
        </div>
      `
      this.div = div
      this.getPanes()?.overlayMouseTarget?.appendChild(div)
    }

    draw() {
      if (!this.div || !this.position) return
      const projection = this.getProjection()
      if (!projection) return
      const point = projection.fromLatLngToDivPixel(
        new maps.LatLng(this.position.lat, this.position.lng),
      )
      if (!point) return
      this.div.style.left = `${point.x}px`
      this.div.style.top = `${point.y}px`
      const rotator = this.div.querySelector('[data-truck-rotator="1"]')
      if (rotator) {
        rotator.style.transform = `rotate(${truckDisplayHeading(this.heading)}deg)`
      }
    }

    setPose(position, heading) {
      if (position) this.position = position
      if (heading != null) this.heading = heading
      this.draw()
    }

    onRemove() {
      this.div?.parentNode?.removeChild(this.div)
      this.div = null
    }

    destroy() {
      this.setMap(null)
    }
  }
}

function animateTruckAlongPath({
  maps,
  map,
  path,
  vehicleNo,
  color,
  iconUrl,
  store,
  staggerMs = 0,
}) {
  if (!maps || !map || !path || path.length < 2) return null

  const travelPath = outboundRoutePath(path)
  const metrics = buildPathMetrics(travelPath)
  if (!metrics?.total || metrics.total <= 0) return null

  const TruckOverlay = createTruckOverlayClass(maps)
  const startPose = pointAlongPath(travelPath, metrics, 0)
  if (!startPose?.point) return null

  const overlay = new TruckOverlay({
    position: startPose.point,
    heading: startPose.heading,
    vehicleNo,
    color,
    iconUrl,
  })
  overlay.setMap(map)

  const durationMs = Math.min(28000, Math.max(7000, Math.round(metrics.total * 2200)))
  const record = { truckOverlay: overlay, animationId: null }
  store.push(record)

  const beginAt = performance.now() + Math.max(0, Number(staggerMs) || 0)
  let startedAt = null
  const tick = (now) => {
    if (!record.truckOverlay) return
    if (startedAt == null) {
      if (now < beginAt) {
        record.animationId = requestAnimationFrame(tick)
        return
      }
      startedAt = now
    }
    const progress = Math.min(1, (now - startedAt) / durationMs)
    const pose = pointAlongPath(travelPath, metrics, metrics.total * progress)
    if (pose?.point) {
      record.truckOverlay.setPose(pose.point, pose.heading)
    }
    if (progress >= 1) {
      record.animationId = null
      return
    }
    record.animationId = requestAnimationFrame(tick)
  }
  record.animationId = requestAnimationFrame(tick)
  return record
}

function clusterLabelOrigin(iconSize, clusterIndex, clusterSize) {
  if (!clusterSize || clusterSize <= 1) {
    return { x: iconSize / 2, y: -14 }
  }
  const angle = (2 * Math.PI * clusterIndex) / clusterSize - Math.PI / 2
  const radius = 20 + Math.min(clusterSize, 10) * 2.5
  return {
    x: iconSize / 2 + radius * Math.cos(angle),
    y: -14 + radius * Math.sin(angle) * 0.6,
  }
}

function pointLatLng(point) {
  const latLng = parseLatLng(point?.lat, point?.lng ?? point?.long)
  if (latLng.lat == null || latLng.lng == null) return null
  return { lat: latLng.lat, lng: latLng.lng }
}

/** Open route: origin → each stop → return to origin (km, haversine). */
function computeRoundTripDistanceKm(routePoints) {
  if (!routePoints || routePoints.length <= 1) return 0
  let total = 0
  let current = routePoints[0]
  for (let index = 1; index < routePoints.length; index += 1) {
    total += coordinateDistance(current, routePoints[index])
    current = routePoints[index]
  }
  total += coordinateDistance(current, routePoints[0])
  return total
}

function buildRouteRenderKey(routes, allRoutes, showAllStops, allStops) {
  const source = showAllStops ? allStops : (routes || []).flatMap((route) => route.points || [])
  return source
    .map((point) => {
      if (point.type === 'origin') return 'O'
      return [
        point.so_number || '',
        point.sequence || '',
        point.lat,
        point.lng ?? point.long,
        point.color || '',
        point.is_assigned ? '1' : '0',
      ].join(':')
    })
    .join('|')
}

function buildPolylineRenderKey(allRoutes, selectedVehicleKeys) {
  return (allRoutes || [])
    .map((route) => {
      const pts = (route.points || [])
        .map((point) => {
          const pos = pointLatLng(point)
          return pos ? `${pos.lat.toFixed(5)},${pos.lng.toFixed(5)}` : ''
        })
        .join(';')
      return `${route.vehicle_no}:${route.color}:${pts}`
    })
    .join('||')
}

function locationGroupKey(lat, lng) {
  return `${lat.toFixed(COLOCATE_PRECISION)},${lng.toFixed(COLOCATE_PRECISION)}`
}

function spreadColocatedPosition(lat, lng, index, total, { compact = false } = {}) {
  if (total <= 1) return { lat, lng }
  const angle = (2 * Math.PI * index) / total - Math.PI / 2
  const baseRadius = compact ? 0.00012 : 0.00034
  const radius = baseRadius * (1 + Math.floor(total / 5) * 0.45)
  const latRad = (lat * Math.PI) / 180
  return {
    lat: lat + radius * Math.sin(angle),
    lng: lng + (radius * Math.cos(angle)) / Math.max(0.35, Math.cos(latRad)),
  }
}

/** Offset markers that share the same coordinates so pins and labels stay readable. */
function spreadColocatedMarkers(points) {
  const origins = (points || []).filter((point) => point.type === 'origin')
  const stops = (points || []).filter((point) => point.type !== 'origin')

  const groups = new Map()
  stops.forEach((point) => {
    const lat = parseCoordinate(point.lat)
    const lng = parseCoordinate(point.lng ?? point.long)
    if (lat == null || lng == null) return
    const key = locationGroupKey(lat, lng)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ point, lat, lng })
  })

  const spreadStops = []
  groups.forEach((members) => {
    const total = members.length
    members.sort((left, right) =>
      String(left.point.so_number || '').localeCompare(String(right.point.so_number || '')),
    )
    const clusterMembers = members
      .map(({ point }) => String(point.so_number || '').trim())
      .filter(Boolean)
    members.forEach(({ point, lat, lng }, index) => {
      const spread = spreadColocatedPosition(lat, lng, index, total)
      spreadStops.push({
        ...point,
        lat: spread.lat,
        lng: spread.lng,
        long: spread.lng,
        clusterIndex: index,
        clusterSize: total,
        clusterMembers,
        clusterLat: lat,
        clusterLng: lng,
      })
    })
  })

  return [...origins, ...spreadStops]
}

/** Stable small offsets for duplicate stops on the same route (route view only). */
function applyRouteViewStopOffsets(points) {
  const origins = (points || []).filter((point) => point.type === 'origin')
  const stops = (points || []).filter((point) => point.type !== 'origin')

  const groups = new Map()
  stops.forEach((point) => {
    const lat = parseCoordinate(point.lat)
    const lng = parseCoordinate(point.lng ?? point.long)
    if (lat == null || lng == null) return
    const key = locationGroupKey(lat, lng)
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push({ point, lat, lng })
  })

  const offsetStops = []
  groups.forEach((members) => {
    const total = members.length
    members.sort((left, right) =>
      String(left.point.so_number || '').localeCompare(String(right.point.so_number || '')),
    )
    members.forEach(({ point, lat, lng }, index) => {
      const spread =
        total > 1
          ? spreadColocatedPosition(lat, lng, index, total, { compact: true })
          : { lat, lng }
      offsetStops.push({
        ...point,
        lat: spread.lat,
        lng: spread.lng,
        long: spread.lng,
        clusterIndex: index,
        clusterSize: total,
      })
    })
  })

  return [...origins, ...offsetStops]
}

function formatDistance(value) {
  if (value == null || value === '') return '—'
  const num = Number(value)
  if (!Number.isFinite(num)) return '—'
  return `${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })} km`
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function loadGoogleMapsScript() {
  if (!GOOGLE_API_KEY) return Promise.reject(new Error('Google Maps API key not configured'))
  if (window.google?.maps) return Promise.resolve(window.google.maps)

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]')
    if (existing) {
      if (window.google?.maps) {
        resolve(window.google.maps)
        return
      }
      existing.addEventListener('load', () => resolve(window.google.maps), { once: true })
      existing.addEventListener('error', () => reject(new Error('Failed to load Google Maps')), {
        once: true,
      })
      return
    }

    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}`
    script.async = true
    script.defer = true
    script.onload = () => resolve(window.google.maps)
    script.onerror = () => reject(new Error('Failed to load Google Maps'))
    document.head.appendChild(script)
  })
}

function locationPinIcon(color, { label = '', size = 36 } = {}) {
  const fill = color || '#1e40af'
  const safeLabel = escapeHtml(String(label).slice(0, 3))
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
      <path fill="${fill}" stroke="#ffffff" stroke-width="1.4"
        d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/>
      <circle cx="12" cy="9" r="3.2" fill="#ffffff"/>
      <text x="12" y="10.2" text-anchor="middle" font-size="5.5" font-weight="700"
        font-family="Arial,sans-serif" fill="${fill}">${safeLabel}</text>
    </svg>
  `.trim()
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  }
}

/** Warehouse-style marker for the delivery starting point. */
function originPinIcon({ size = 46 } = {}) {
  const fill = ORIGIN_COLOR
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
      <path fill="${fill}" stroke="#ffffff" stroke-width="1.5"
        d="M12 3L4 10v11h16V10L12 3z"/>
      <rect x="9" y="13" width="6" height="8" fill="#ffffff" rx="0.6"/>
      <rect x="10.5" y="15" width="3" height="3" fill="${fill}" rx="0.3"/>
    </svg>
  `.trim()
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  }
}

/** Distinct circle marker for stops not yet assigned to any vehicle. */
function locationPinIconUnassigned({ size = 34, color = UNASSIGNED_STOP_COLOR, priority = false } = {}) {
  const fill = color || UNASSIGNED_STOP_COLOR
  const badge = priority
    ? `<text x="12" y="13.6" text-anchor="middle" font-size="8" font-weight="800"
        font-family="Arial,sans-serif" fill="${fill}">P</text>`
    : `<circle cx="12" cy="12" r="4" fill="#ffffff"/>`
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="10" fill="${fill}" stroke="#ffffff" stroke-width="2.2"/>
      ${priority ? '<circle cx="12" cy="12" r="6.2" fill="#ffffff"/>' : ''}
      ${badge}
    </svg>
  `.trim()
  return {
    url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
  }
}

function applyWideMapViewport(map, maps, bounds, hasSinglePoint) {
  if (hasSinglePoint) {
    map.setCenter(bounds.getCenter())
    map.setZoom(MAP_MAX_ZOOM)
    return
  }
  map.fitBounds(bounds, MAP_FIT_PADDING)
  maps.event.addListenerOnce(map, 'idle', () => {
    const zoom = map.getZoom()
    if (zoom != null && zoom > MAP_MAX_ZOOM) {
      map.setZoom(MAP_MAX_ZOOM)
    }
  })
}

function infoContent(point) {
  if (point.type === 'origin') {
    const title = escapeHtml(point.title || 'Organization')
    const address = escapeHtml(point.address || '')
    return `
      <div style="max-width:260px;padding:2px 0;font-family:inherit;">
        <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:4px;">${title}</div>
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">Starting point</div>
        ${address ? `<div style="font-size:12px;line-height:1.4;color:#475569;">${address}</div>` : ''}
      </div>
    `
  }

  const party = escapeHtml(point.customer_name || point.subtitle || '—')
  const qty = escapeHtml(formatWeight(point.weight_qtl))
  const dueLabel = escapeHtml(formatDueDaysLabel(point) || '—')
  const dueStatus = resolveDueStatus(point)
  const dueStatusLabel =
    dueStatus === 'priority' ? 'Priority' : dueStatus === 'overdue' ? 'Overdue' : 'On time'
  const area = escapeHtml(point.area_group || '—')
  const soNumber = escapeHtml(point.so_number || point.title || '—')
  const clusterNote =
    Number(point.clusterSize) > 1
      ? `<div style="font-size:11px;color:#64748b;margin-bottom:6px;">${
          point.clusterSize
        } stops share this location · #${Number(point.clusterIndex || 0) + 1}</div>`
      : ''

  return `
    <div style="max-width:280px;padding:2px 0;font-family:inherit;">
      ${clusterNote}
      <div style="display:grid;grid-template-columns:auto 1fr;gap:4px 10px;font-size:12px;line-height:1.35;">
        <span style="color:#64748b;">SO</span>
        <span style="font-weight:600;color:#0f172a;">${soNumber}</span>
        <span style="color:#64748b;">Weight</span>
        <span style="font-weight:600;color:#0f172a;">${qty}</span>
        <span style="color:#64748b;">Due days</span>
        <span style="font-weight:600;color:${dueStopColor(point)};">${dueLabel} · ${escapeHtml(dueStatusLabel)}</span>
        <span style="color:#64748b;">Party</span>
        <span style="font-weight:600;color:#0f172a;">${party}</span>
        <span style="color:#64748b;">Area</span>
        <span style="font-weight:600;color:#0f172a;">${area}</span>
      </div>
    </div>
  `
}

function VehicleRouteMap({
  routes,
  allRoutes = routes,
  allStops = [],
  showAllStops = false,
  focusKey,
  mapOpen = false,
  adjustMode = false,
  manualAssignMode = false,
  activeVehicleNo = '',
  onSelectStop = null,
  onManualAssignStop = null,
  onManualUnassignStop = null,
  onRouteDistances = null,
}) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const mapsApiRef = useRef(null)
  const overlaysRef = useRef([])
  const infoWindowRef = useRef(null)
  const viewportSetRef = useRef(false)
  const prevMapOpenRef = useRef(false)
  const onSelectStopRef = useRef(onSelectStop)
  const onManualAssignStopRef = useRef(onManualAssignStop)
  const onManualUnassignStopRef = useRef(onManualUnassignStop)
  const onRouteDistancesRef = useRef(onRouteDistances)
  const routeOverlayRef = useRef([])
  const [mapsReady, setMapsReady] = useState(false)
  const [mapError, setMapError] = useState('')

  onSelectStopRef.current = onSelectStop
  onManualAssignStopRef.current = onManualAssignStop
  onManualUnassignStopRef.current = onManualUnassignStop
  onRouteDistancesRef.current = onRouteDistances

  const useSpreadMarkers = manualAssignMode || showAllStops
  const markerRenderKey = buildRouteRenderKey(routes, allRoutes, showAllStops, allStops)
  const polylineRenderKey = buildPolylineRenderKey(allRoutes, routes)

  useEffect(() => {
    if (mapOpen && !prevMapOpenRef.current) {
      viewportSetRef.current = false
    }
    prevMapOpenRef.current = mapOpen
  }, [mapOpen])

  useEffect(() => {
    let cancelled = false

    async function initMap() {
      if (!containerRef.current) return
      try {
        const maps = await loadGoogleMapsScript()
        if (cancelled) return
        mapsApiRef.current = maps
        if (!mapRef.current) {
          mapRef.current = new maps.Map(containerRef.current, {
            zoom: 12,
            center: { lat: 15.35, lng: 75.08 },
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            styles: DELIVERY_MAP_STYLES,
          })
        } else {
          mapRef.current.setOptions({ styles: DELIVERY_MAP_STYLES })
        }
        if (!infoWindowRef.current) {
          infoWindowRef.current = new maps.InfoWindow({
            disableAutoPan: true,
            maxWidth: 300,
          })
        }
        setMapsReady(true)
        setMapError('')
      } catch (err) {
        if (!cancelled) setMapError(err.message || 'Unable to load map')
      }
    }

    initMap()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !mapsApiRef.current) return

    const maps = mapsApiRef.current

    overlaysRef.current.forEach((item) => {
      if (item.marker) {
        maps.event.clearInstanceListeners(item.marker)
        item.marker.setMap(null)
      }
    })
    overlaysRef.current = overlaysRef.current.filter((item) => !item.marker)
    infoWindowRef.current?.close()
    mapRef.current.setOptions({ disableDoubleClickZoom: manualAssignMode })

    const bounds = new maps.LatLngBounds()
    let hasPoint = false
    let originDrawn = false

    const rawPoints = useSpreadMarkers
      ? allStops
      : routes.flatMap((route) => route.points || [])
    const renderPoints = useSpreadMarkers
      ? spreadColocatedMarkers(rawPoints)
      : applyRouteViewStopOffsets(rawPoints)
    const useHoverInfo = useSpreadMarkers

    renderPoints.forEach((point) => {
      const lat = parseCoordinate(point.lat)
      const lng = parseCoordinate(point.lng ?? point.long)
      if (lat == null || lng == null) return

      const position = { lat, lng }
      bounds.extend(position)
      hasPoint = true

      if (point.type === 'origin') {
        if (originDrawn) return
        originDrawn = true
      }

      const isUnassignedStop =
        point.type === 'sales_order' && !point.is_assigned && !point.sequence

      const pinSequenceLabel =
        point.type === 'origin' ? 'O' : point.sequence ? String(point.sequence) : ''

      let icon
      let iconSize = 36
      if (point.type === 'origin') {
        iconSize = 46
        icon = originPinIcon({ size: iconSize })
      } else if (isUnassignedStop) {
        iconSize = resolveDueStatus(point) === 'priority' ? 38 : 34
        icon = locationPinIconUnassigned({
          size: iconSize,
          color: dueStopColor(point),
          priority: resolveDueStatus(point) === 'priority',
        })
      } else {
        icon = locationPinIcon(point.color || UNASSIGNED_STOP_COLOR, {
          label: pinSequenceLabel,
          size: iconSize,
        })
      }
      icon.scaledSize = new maps.Size(iconSize, iconSize)
      icon.anchor = new maps.Point(iconSize / 2, iconSize)
      const clusterIndex = Number(point.clusterIndex || 0)
      const clusterSize = Number(point.clusterSize || 0)
      const labelOrigin = clusterLabelOrigin(iconSize, clusterIndex, clusterSize)
      icon.labelOrigin = new maps.Point(
        labelOrigin.x,
        point.type === 'origin' ? iconSize + 2 : labelOrigin.y,
      )

      const labelText = markerLabelText(point)
      let labelColor = ASSIGNED_LABEL_COLOR
      if (point.type === 'origin') labelColor = ORIGIN_LABEL_COLOR
      else if (isUnassignedStop) labelColor = dueLabelColor(point)

      const marker = new maps.Marker({
        position,
        map: mapRef.current,
        title:
          point.type === 'origin'
            ? point.title || 'Starting point'
            : `${point.customer_name || ''} · ${point.so_number || ''}`.trim(),
        icon,
        label: !labelText
          ? undefined
          : {
              text: labelText.slice(0, point.type === 'origin' ? 8 : 24),
              color: labelColor,
              fontSize: point.type === 'origin' ? '12px' : '11px',
              fontWeight: '800',
            },
        zIndex:
          point.type === 'origin'
            ? 2000
            : isUnassignedStop
              ? (resolveDueStatus(point) === 'priority' ? 1980 : 1900) + clusterIndex * 12
              : point.sequence
                ? 1500 + Number(point.sequence || 0) + clusterIndex * 8
                : 1400 + clusterIndex * 8,
        optimized: false,
      })

      const openInfo = () => {
        infoWindowRef.current.setContent(infoContent(point))
        infoWindowRef.current.open({ map: mapRef.current, anchor: marker })
      }

      if (useHoverInfo) {
        marker.addListener('mouseover', openInfo)
        marker.addListener('mouseout', () => {
          infoWindowRef.current.close()
        })
      }
      marker.addListener('click', () => {
        if (manualAssignMode && point.type === 'sales_order') {
          infoWindowRef.current.close()
          onManualAssignStopRef.current?.(point)
          return
        }
        if (adjustMode && point.type === 'sales_order') {
          infoWindowRef.current.close()
          onSelectStopRef.current?.(point)
          return
        }
        if (!useHoverInfo) openInfo()
      })
      marker.addListener('dblclick', (event) => {
        if (event?.domEvent) {
          event.domEvent.preventDefault()
          event.domEvent.stopPropagation()
        }
        if (manualAssignMode && point.type === 'sales_order' && point.is_assigned) {
          infoWindowRef.current.close()
          onManualUnassignStopRef.current?.(point)
        }
      })

      overlaysRef.current.push({ marker })
    })

    if (!hasPoint) {
      setMapError('No delivery coordinates available. Load party distances or run Auto Suggest first.')
      return
    }

    if (!viewportSetRef.current) {
      const singlePoint = bounds.getNorthEast().equals(bounds.getSouthWest())
      applyWideMapViewport(mapRef.current, maps, bounds, singlePoint)
      viewportSetRef.current = true
    }
    setMapError('')
  }, [
    mapsReady,
    markerRenderKey,
    useSpreadMarkers,
    adjustMode,
    manualAssignMode,
    mapOpen,
  ])

  useEffect(() => {
    if (!mapsReady || !mapRef.current || !mapsApiRef.current) return
    if (adjustMode || manualAssignMode || showAllStops) {
      clearRouteOverlays(routeOverlayRef.current)
      routeOverlayRef.current = []
      onRouteDistancesRef.current?.({})
      return
    }

    const maps = mapsApiRef.current
    let cancelled = false
    clearRouteOverlays(routeOverlayRef.current)
    routeOverlayRef.current = []

    const visibleVehicleNumbers = new Set((routes || []).map((route) => route.vehicle_no))
    const directionsService = new maps.DirectionsService()
    const routeDistances = {}
    let pending = 0
    let truckStagger = 0

    const publishDistances = () => {
      if (!cancelled) onRouteDistancesRef.current?.({ ...routeDistances })
    }

    const startTruckForPath = (path, route) => {
      if (cancelled || !path || path.length < 2) return
      const staggerMs = truckStagger
      truckStagger += 900
      getTruckIconUrl().then((iconUrl) => {
        if (cancelled) return
        animateTruckAlongPath({
          maps,
          map: mapRef.current,
          path,
          vehicleNo: route.vehicle_no,
          color: route.color || '#2563eb',
          iconUrl,
          store: routeOverlayRef.current,
          staggerMs,
        })
      })
    }

    ;(allRoutes || []).forEach((route) => {
      const routePoints = (route.points || []).map(pointLatLng).filter(Boolean)
      if (routePoints.length <= 1) {
        routeDistances[route.vehicle_no] = 0
        return
      }

      const fallbackDistance = computeRoundTripDistanceKm(routePoints)
      const showOnMap = visibleVehicleNumbers.has(route.vehicle_no)

      const drawFallbackPolyline = () => {
        if (!showOnMap || cancelled) return
        const closedPath = [...routePoints, routePoints[0]]
        const polyline = new maps.Polyline({
          path: closedPath,
          geodesic: true,
          strokeColor: route.color || '#2563eb',
          strokeOpacity: 0.75,
          strokeWeight: 4,
          map: mapRef.current,
          zIndex: 100 + Number(route.vehicle_index || 0),
        })
        routeOverlayRef.current.push({ polyline })
        // Truck travels outbound only (START → last stop), then stops.
        if (showOnMap) startTruckForPath(routePoints, route)
      }

      const origin = routePoints[0]
      const stopPoints = routePoints.slice(1)
      if (!stopPoints.length) {
        routeDistances[route.vehicle_no] = 0
        return
      }

      if (stopPoints.length > 23) {
        routeDistances[route.vehicle_no] = fallbackDistance
        drawFallbackPolyline()
        return
      }

      pending += 1
      directionsService.route(
        {
          origin,
          destination: origin,
          waypoints: stopPoints.map((location) => ({ location, stopover: true })),
          optimizeWaypoints: false,
          travelMode: maps.TravelMode.DRIVING,
        },
        (result, directionStatus) => {
          if (cancelled) {
            pending -= 1
            if (pending <= 0) publishDistances()
            return
          }

          if (directionStatus === maps.DirectionsStatus.OK && result?.routes?.[0]) {
            if (showOnMap) {
              const renderer = new maps.DirectionsRenderer({
                map: mapRef.current,
                directions: result,
                suppressMarkers: true,
                preserveViewport: true,
                polylineOptions: {
                  strokeColor: route.color || '#2563eb',
                  strokeOpacity: 0.88,
                  strokeWeight: 4,
                },
              })
              routeOverlayRef.current.push({ directionsRenderer: renderer })
              const drivePath = extractDirectionsPath(result)
              startTruckForPath(drivePath.length > 1 ? drivePath : [...routePoints, routePoints[0]], route)
            }
            const metres = (result.routes[0].legs || []).reduce(
              (sum, leg) => sum + Number(leg.distance?.value || 0),
              0,
            )
            routeDistances[route.vehicle_no] = metres / 1000
          } else {
            routeDistances[route.vehicle_no] = fallbackDistance
            drawFallbackPolyline()
          }

          pending -= 1
          if (pending <= 0) publishDistances()
        },
      )
    })

    if (pending === 0) publishDistances()

    return () => {
      cancelled = true
      clearRouteOverlays(routeOverlayRef.current)
      routeOverlayRef.current = []
    }
  }, [mapsReady, polylineRenderKey, adjustMode, manualAssignMode, showAllStops, routes, allRoutes])

  if (!GOOGLE_API_KEY) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center bg-slate-50">
        <MapPin className="h-10 w-10 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">Google Maps API key is not configured.</p>
      </div>
    )
  }

  if (mapError) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center bg-slate-50">
        <MapPin className="h-10 w-10 text-slate-300 mb-2" />
        <p className="text-sm text-slate-500">{mapError}</p>
      </div>
    )
  }

  return <div ref={containerRef} className="absolute inset-0 h-full w-full" />
}

/**
 * Build vehicle-wise map routes from current assignment + coordinate cache.
 * Sequence: organization/branch origin → assigned SO locations (in list order).
 */
export function buildSplitVehicleMapRoutes({
  origin,
  vehicles = [],
  soCoordById = {},
  partyCoordByCustomerId = {},
}) {
  const originLatLng = parseLatLng(origin?.lat, origin?.long ?? origin?.lng)
  const originLat = originLatLng.lat
  const originLng = originLatLng.lng
  if (originLat == null || originLng == null) return []

  const originPoint = {
    type: 'origin',
    sequence: 0,
    lat: originLat,
    lng: originLng,
    long: originLng,
    color: ORIGIN_COLOR,
    markerLabel: 'START',
    title: origin?.branch_name || origin?.organization_name || origin?.label || 'Organization',
    subtitle: 'Starting point',
    address: origin?.address || '',
  }

  return (vehicles || [])
    .map((vehicle, index) => {
      const color = vehicleRouteColor(index)
      const points = [{ ...originPoint }]
      const stops = []
      let sequence = 1

      ;(vehicle.mapped_sales_orders || vehicle.sales_orders || []).forEach((so) => {
        const soNumber = String(so?.so_number || so?.order_id || '').trim()
        const cached = soCoordById[soNumber] || {}
        const partyKey = so?.customer_id != null ? String(so.customer_id) : null
        const partyCached = partyKey ? partyCoordByCustomerId[partyKey] || {} : {}

        const latLng = parseLatLng(
          cached.lat ?? so?.lat ?? partyCached.lat,
          cached.long ?? cached.lng ?? so?.long ?? so?.lng ?? partyCached.long ?? partyCached.lng,
        )
        const lat = latLng.lat
        const lng = latLng.lng

        const stop = {
          type: 'sales_order',
          sequence,
          so_number: soNumber,
          customer_name: so?.customer_name || cached.customer_name || partyCached.customer_name || '',
          area_group:
            so?.area_group ||
            cached.area_group ||
            partyCached.area_group ||
            '',
          weight_qtl: so?.weight_qtl ?? cached.weight_qtl ?? null,
          ...computeDueFields({ ...cached, ...so }),
          distance_km: cached.distance_km ?? so?.distance_km ?? partyCached.distance_km ?? null,
          address: cached.address || so?.address || partyCached.address || '',
          lat,
          lng,
          long: lng,
          color,
          markerLabel: String(sequence),
          title: soNumber || `Stop ${sequence}`,
          subtitle: so?.customer_name || cached.customer_name || partyCached.customer_name || '',
          vehicle_no: vehicle.vehicle_no,
          has_coordinates: lat != null && lng != null,
        }

        stops.push(stop)
        if (lat != null && lng != null) {
          points.push(stop)
        }
        sequence += 1
      })

      return {
        vehicle_key: vehicle.key,
        vehicle_index: vehicle.vehicle_index ?? index + 1,
        vehicle_no: vehicle.vehicle_no,
        capacity_qtl: vehicle.capacity_qtl,
        mapped_weight_qtl: vehicle.mapped_weight_qtl,
        color,
        points,
        stops,
      }
    })
    .filter((route) => route.stops.length > 0 || route.points.length > 1)
}

/**
 * Build map stops for manual assignment: every SO label is visible; assigned
 * stops use the vehicle color + sequence, unassigned stops stay neutral gray.
 */
export function buildManualAssignMapDisplay({
  origin,
  vehicles = [],
  allSalesOrders = [],
  soCoordById = {},
  partyCoordByCustomerId = {},
  assignmentBySoNumber = {},
  routeOrderByVehicle = {},
  vehicleKeyByNo = {},
}) {
  const originLatLng = parseLatLng(origin?.lat, origin?.long ?? origin?.lng)
  const originLat = originLatLng.lat
  const originLng = originLatLng.lng
  if (originLat == null || originLng == null) {
    return { routes: [], allStops: [], originPoint: null }
  }

  const originPoint = {
    type: 'origin',
    sequence: 0,
    lat: originLat,
    lng: originLng,
    long: originLng,
    color: ORIGIN_COLOR,
    markerLabel: 'START',
    title: origin?.branch_name || origin?.organization_name || origin?.label || 'Organization',
    subtitle: 'Starting point',
    address: origin?.address || '',
  }

  const vehicleColorByNo = {}
  ;(vehicles || []).forEach((vehicle, index) => {
    const vehicleNo = String(vehicle.vehicle_no || '').trim()
    if (!vehicleNo) return
    vehicleColorByNo[vehicleNo] = vehicleRouteColor(index)
  })

  const sequenceBySo = {}
  Object.entries(routeOrderByVehicle || {}).forEach(([vehicleKey, soIds]) => {
    ;(soIds || []).forEach((soId, index) => {
      const soNumber = String(soId || '').trim()
      if (soNumber) sequenceBySo[soNumber] = index + 1
    })
  })

  const allStops = []
  ;(allSalesOrders || []).forEach((so) => {
    const soNumber = String(so?.so_number || so?.order_id || '').trim()
    if (!soNumber) return

    const cached = soCoordById[soNumber] || {}
    const partyKey = so?.customer_id != null ? String(so.customer_id) : null
    const partyCached = partyKey ? partyCoordByCustomerId[partyKey] || {} : {}

    const latLng = parseLatLng(
      cached.lat ?? so?.lat ?? partyCached.lat,
      cached.long ?? cached.lng ?? so?.long ?? so?.lng ?? partyCached.long ?? partyCached.lng,
    )
    const lat = latLng.lat
    const lng = latLng.lng
    if (lat == null || lng == null) return

    const assignedVehicleNo = String(assignmentBySoNumber[soNumber] || '').trim()
    const sequence = assignedVehicleNo ? sequenceBySo[soNumber] || null : null
    const due = computeDueFields({ ...cached, ...so })
    const color = assignedVehicleNo
      ? vehicleColorByNo[assignedVehicleNo] || UNASSIGNED_STOP_COLOR
      : DUE_STOP_COLORS[due.due_status] || UNASSIGNED_STOP_COLOR

    allStops.push({
      type: 'sales_order',
      sequence,
      so_number: soNumber,
      customer_name: so?.customer_name || cached.customer_name || partyCached.customer_name || '',
      area_group: so?.area_group || cached.area_group || partyCached.area_group || '',
      weight_qtl: so?.weight_qtl ?? cached.weight_qtl ?? null,
      ...due,
      distance_km: cached.distance_km ?? so?.distance_km ?? partyCached.distance_km ?? null,
      address: cached.address || so?.address || partyCached.address || '',
      lat,
      lng,
      long: lng,
      color,
      markerLabel: sequence ? String(sequence) : '',
      title: soNumber,
      subtitle: so?.customer_name || cached.customer_name || partyCached.customer_name || '',
      vehicle_no: assignedVehicleNo || null,
      is_assigned: Boolean(assignedVehicleNo),
      has_coordinates: true,
    })
  })

  const routes = (vehicles || [])
    .map((vehicle, index) => {
      const vehicleNo = String(vehicle.vehicle_no || '').trim()
      const color = vehicleRouteColor(index)
      const vehicleKey = vehicle.key || vehicleKeyByNo[vehicleNo]
      const orderedIds = routeOrderByVehicle?.[vehicleKey] || []
      const stopBySo = new Map(allStops.map((stop) => [stop.so_number, stop]))
      const stops = orderedIds
        .map((soId) => stopBySo.get(String(soId || '').trim()))
        .filter(Boolean)
        .map((stop, stopIndex) => ({
          ...stop,
          color,
          sequence: stopIndex + 1,
          markerLabel: String(stopIndex + 1),
          vehicle_no: vehicleNo,
        }))

      const points = [{ ...originPoint }, ...stops]
      const mappedWeight = stops.reduce(
        (sum, stop) => sum + (Number(stop.weight_qtl) || 0),
        0,
      )

      return {
        vehicle_key: vehicleKey,
        vehicle_index: vehicle.vehicle_index ?? index + 1,
        vehicle_no: vehicleNo,
        capacity_qtl: vehicle.capacity_qtl,
        mapped_weight_qtl: mappedWeight,
        color,
        points,
        stops,
      }
    })

  return {
    routes,
    allStops,
    originPoint,
  }
}

export default function SplitLoadingRouteMapModal({
  open,
  onClose,
  loading = false,
  routes = [],
  origin = null,
  allSalesOrders = [],
  soCoordById = {},
  partyCoordByCustomerId = {},
  assignmentBySoNumber = {},
  routeOrderByVehicle = {},
  vehicles = [],
  onMoveSalesOrder = null,
  onRouteSequenceChange = null,
  onResetAssignments = null,
  onManualAssignSalesOrder = null,
  onManualUnassignSalesOrder = null,
  readOnly = false,
}) {
  const [selectedVehicle, setSelectedVehicle] = useState(ALL_VEHICLES)
  const [adjustMode, setAdjustMode] = useState(false)
  const [manualAssignMode, setManualAssignMode] = useState(false)
  const [selectedMapStop, setSelectedMapStop] = useState(null)
  const [moveFeedback, setMoveFeedback] = useState(null)
  const [manualFeedback, setManualFeedback] = useState(null)
  const [routeDistances, setRouteDistances] = useState({})
  const singleVehicleSelected = selectedVehicle !== ALL_VEHICLES
  const mapSessionInitializedRef = useRef(false)

  useEffect(() => {
    if (!open) {
      mapSessionInitializedRef.current = false
      return
    }
    if (mapSessionInitializedRef.current) return
    mapSessionInitializedRef.current = true

    setSelectedVehicle(ALL_VEHICLES)
    setAdjustMode(false)
    setSelectedMapStop(null)
    setMoveFeedback(null)
    setManualFeedback(null)
    setRouteDistances({})
    if (readOnly) {
      setManualAssignMode(false)
      return
    }
    const assignedCount = Object.values(assignmentBySoNumber || {}).filter(
      (vehicleNo) => String(vehicleNo || '').trim(),
    ).length
    setManualAssignMode(assignedCount === 0 && Boolean(onManualAssignSalesOrder))
  }, [open, assignmentBySoNumber, onManualAssignSalesOrder, readOnly])

  const vehicleKeyByNo = useMemo(() => {
    const map = {}
    ;(vehicles || []).forEach((vehicle) => {
      const vehicleNo = String(vehicle.vehicle_no || '').trim()
      if (vehicleNo) map[vehicleNo] = vehicle.key
    })
    return map
  }, [vehicles])

  const manualDisplay = useMemo(
    () =>
      buildManualAssignMapDisplay({
        origin,
        vehicles,
        allSalesOrders,
        soCoordById,
        partyCoordByCustomerId,
        assignmentBySoNumber,
        routeOrderByVehicle,
        vehicleKeyByNo,
      }),
    [
      origin,
      vehicles,
      allSalesOrders,
      soCoordById,
      partyCoordByCustomerId,
      assignmentBySoNumber,
      routeOrderByVehicle,
      vehicleKeyByNo,
    ],
  )

  const allPreviewStops = useMemo(
    () => [
      ...(manualDisplay.originPoint ? [manualDisplay.originPoint] : []),
      ...manualDisplay.allStops,
    ],
    [manualDisplay.originPoint, manualDisplay.allStops],
  )

  const hasAssignedStops = useMemo(
    () =>
      routes.some((route) =>
        (route.stops || []).some((stop) => stop.type === 'sales_order'),
      ),
    [routes],
  )

  const showAllLocationLabels = manualAssignMode || !hasAssignedStops

  const mapStopsForRender = showAllLocationLabels ? allPreviewStops : []

  const mapFocusKey = useMemo(
    () =>
      [
        selectedVehicle,
        manualAssignMode ? 'manual' : 'view',
        showAllLocationLabels ? 'all-labels' : 'routes',
        mapStopsForRender.length,
        Object.keys(assignmentBySoNumber || {}).length,
      ].join(':'),
    [
      assignmentBySoNumber,
      manualAssignMode,
      mapStopsForRender.length,
      selectedVehicle,
      showAllLocationLabels,
    ],
  )

  const assignmentSummary = useMemo(() => {
    const total = manualDisplay.allStops.length || (allSalesOrders || []).length
    const assigned = Object.values(assignmentBySoNumber || {}).filter(
      (vehicleNo) => String(vehicleNo || '').trim(),
    ).length
    return {
      total,
      assigned,
      remaining: Math.max(0, total - assigned),
    }
  }, [allSalesOrders, assignmentBySoNumber, manualDisplay.allStops.length])

  const activeRoutes = useMemo(() => {
    if (!manualAssignMode) return routes
    const assignedByVehicle = new Map(
      (manualDisplay.routes || []).map((route) => [String(route.vehicle_no), route]),
    )
    return (vehicles || []).map((vehicle, index) => {
      const vehicleNo = String(vehicle.vehicle_no || '').trim()
      const existing = assignedByVehicle.get(vehicleNo)
      if (existing) return existing
      return {
        vehicle_key: vehicle.key,
        vehicle_index: vehicle.vehicle_index ?? index + 1,
        vehicle_no: vehicleNo,
        capacity_qtl: vehicle.capacity_qtl,
        mapped_weight_qtl: 0,
        color: vehicleRouteColor(index),
        points: manualDisplay.originPoint ? [manualDisplay.originPoint] : [],
        stops: [],
      }
    })
  }, [manualAssignMode, manualDisplay.originPoint, manualDisplay.routes, routes, vehicles])

  const vehicleTabs = useMemo(
    () =>
      (activeRoutes || []).map((route, index) => ({
        ...route,
        color: route.color || vehicleRouteColor(index),
      })),
    [activeRoutes],
  )

  useEffect(() => {
    if (selectedVehicle === ALL_VEHICLES) return
    const stillExists = activeRoutes.some(
      (route) => String(route.vehicle_no) === String(selectedVehicle),
    )
    if (!stillExists && !manualAssignMode) setSelectedVehicle(ALL_VEHICLES)
  }, [activeRoutes, selectedVehicle, manualAssignMode])

  const manualMapStops = useMemo(() => {
    const stops = [...manualDisplay.allStops]
    return manualDisplay.originPoint ? [manualDisplay.originPoint, ...stops] : stops
  }, [manualDisplay.allStops, manualDisplay.originPoint])

  const filteredRoutes = useMemo(() => {
    if (manualAssignMode) {
      if (selectedVehicle === ALL_VEHICLES) {
        return [
          {
            vehicle_no: 'all',
            points: manualMapStops,
            stops: manualDisplay.allStops,
            color: UNASSIGNED_STOP_COLOR,
          },
        ]
      }
      const route =
        activeRoutes.find((row) => String(row.vehicle_no) === String(selectedVehicle)) || null
      return route
        ? [{ ...route, points: manualMapStops, stops: manualDisplay.allStops }]
        : []
    }
    if (selectedVehicle === ALL_VEHICLES) return activeRoutes
    return activeRoutes.filter((route) => route.vehicle_no === selectedVehicle)
  }, [activeRoutes, manualAssignMode, manualDisplay.allStops, manualMapStops, selectedVehicle])

  const selectedRoute = singleVehicleSelected
    ? activeRoutes.find((route) => route.vehicle_no === selectedVehicle) || filteredRoutes[0] || null
    : null

  const salesOrderCards = useMemo(() => {
    const vehicleColorByNo = {}
    vehicleTabs.forEach((route, index) => {
      const vehicleNo = String(route.vehicle_no || '').trim()
      if (vehicleNo) vehicleColorByNo[vehicleNo] = route.color || vehicleRouteColor(index)
    })

    return (allSalesOrders || [])
      .map((so) => {
        const soNumber = String(so?.so_number || so?.order_id || '').trim()
        if (!soNumber) return null

        const cached = soCoordById[soNumber] || {}
        const partyKey = so?.customer_id != null ? String(so.customer_id) : null
        const partyCached = partyKey ? partyCoordByCustomerId[partyKey] || {} : {}
        const due = computeDueFields({ ...cached, ...so })
        const vehicleNo = String(
          assignmentBySoNumber[soNumber] || so?.vehicle_no || cached.vehicle_no || '',
        ).trim()

        const latLng = parseLatLng(
          cached.lat ?? so?.lat ?? partyCached.lat,
          cached.long ?? cached.lng ?? so?.long ?? so?.lng ?? partyCached.long ?? partyCached.lng,
        )

        return {
          so_number: soNumber,
          customer_name:
            so?.customer_name || cached.customer_name || partyCached.customer_name || '—',
          distance_km: cached.distance_km ?? so?.distance_km ?? partyCached.distance_km ?? null,
          weight_qtl: so?.weight_qtl ?? cached.weight_qtl ?? null,
          has_coordinates: latLng.lat != null && latLng.lng != null,
          ...due,
          vehicle_no: vehicleNo || null,
          vehicle_color: vehicleNo ? vehicleColorByNo[vehicleNo] || UNASSIGNED_STOP_COLOR : null,
        }
      })
      .filter(Boolean)
  }, [
    allSalesOrders,
    assignmentBySoNumber,
    partyCoordByCustomerId,
    soCoordById,
    vehicleTabs,
  ])

  const missingLocationCount = useMemo(
    () => salesOrderCards.filter((card) => !card.has_coordinates).length,
    [salesOrderCards],
  )

  const visibleSalesOrderCards = useMemo(() => {
    if (selectedVehicle === ALL_VEHICLES) return salesOrderCards
    return salesOrderCards.filter(
      (card) => String(card.vehicle_no || '') === String(selectedVehicle),
    )
  }, [salesOrderCards, selectedVehicle])

  const cycleVehicleNumbers = useMemo(
    () =>
      (vehicles || [])
        .map((row) => String(row.vehicle_no || '').trim())
        .filter(Boolean),
    [vehicles],
  )

  const handleCycleSoVehicle = useCallback(
    (card) => {
      if (!cycleVehicleNumbers.length || !onMoveSalesOrder) return

      const soNumber = String(card?.so_number || '').trim()
      if (!soNumber) return

      const currentNo = String(card?.vehicle_no || '').trim()
      let nextNo = cycleVehicleNumbers[0]
      if (currentNo) {
        const currentIndex = cycleVehicleNumbers.indexOf(currentNo)
        const baseIndex = currentIndex >= 0 ? currentIndex : -1
        nextNo = cycleVehicleNumbers[(baseIndex + 1) % cycleVehicleNumbers.length]
        if (nextNo === currentNo) return
      }

      const result = onMoveSalesOrder(soNumber, nextNo)
      if (result?.ok) {
        setMoveFeedback({
          type: result.capacityExceeded ? 'warning' : 'success',
          message: result.message || `${soNumber} assigned to ${nextNo}.`,
        })
        setSelectedMapStop(null)
      } else if (result?.message) {
        setMoveFeedback({
          type: 'warning',
          message: result.message,
        })
      }
    },
    [cycleVehicleNumbers, onMoveSalesOrder],
  )

  const toggleAdjustMode = () => {
    const nextMode = !adjustMode
    if (nextMode) {
      setManualAssignMode(false)
      setManualFeedback(null)
    }
    if (!nextMode && onRouteSequenceChange) {
      const routeOrderByVehicle = {}
      activeRoutes.forEach((route) => {
        const vehicleKey = route.vehicle_key || route.vehicle_no
        routeOrderByVehicle[vehicleKey] = buildNearestStopSequence(route, origin)
      })
      onRouteSequenceChange(routeOrderByVehicle)
    }
    setAdjustMode(nextMode)
    setSelectedMapStop(null)
    setMoveFeedback(null)
  }

  const handleSubmitManualAssignments = () => {
    if (!manualAssignMode) return
    if (assignmentSummary.assigned <= 0) {
      setManualFeedback({
        type: 'warning',
        message: 'Assign at least one sales order before submitting.',
      })
      return
    }

    if (onRouteSequenceChange) {
      const routeOrderByVehicle = {}
      ;(manualDisplay.routes.length ? manualDisplay.routes : activeRoutes).forEach((route) => {
        const vehicleKey = route.vehicle_key || vehicleKeyByNo[route.vehicle_no] || route.vehicle_no
        if (!vehicleKey || !(route.stops || []).length) return
        routeOrderByVehicle[vehicleKey] = buildNearestStopSequence(route, origin)
      })
      if (Object.keys(routeOrderByVehicle).length) {
        onRouteSequenceChange(routeOrderByVehicle)
      }
    }

    setManualAssignMode(false)
    setSelectedVehicle(ALL_VEHICLES)
    setManualFeedback({
      type: 'success',
      message: `${assignmentSummary.assigned} assigned stop${assignmentSummary.assigned === 1 ? '' : 's'} — driving routes loaded.`,
    })
  }

  const handleResetAssignments = () => {
    if (onResetAssignments) onResetAssignments()
    setManualAssignMode(true)
    setAdjustMode(false)
    const firstVehicle = (vehicles || []).find((row) => String(row.vehicle_no || '').trim())
    setSelectedVehicle(firstVehicle ? String(firstVehicle.vehicle_no) : ALL_VEHICLES)
    setSelectedMapStop(null)
    setMoveFeedback(null)
    setManualFeedback({
      type: 'success',
      message: firstVehicle
        ? `Assignments cleared. Click party labels to assign to ${firstVehicle.vehicle_no} in delivery order.`
        : 'Assignments cleared. Select a vehicle, then click party labels in delivery order.',
    })
    setRouteDistances({})
  }

  const handleManualAssignStop = useCallback(
    (stop) => {
      if (!manualAssignMode || !onManualAssignSalesOrder) return
      if (selectedVehicle === ALL_VEHICLES) {
        setManualFeedback({
          type: 'warning',
          message: 'Select a vehicle above before clicking party labels.',
        })
        return
      }
      const soNumber = String(stop?.so_number || '').trim()
      if (!soNumber) return

      if (stop.is_assigned && String(stop.vehicle_no || '') !== String(selectedVehicle)) {
        setManualFeedback({
          type: 'warning',
          message: `${soNumber} is already assigned to ${stop.vehicle_no}. Reset or use Adjust assignments to move it.`,
        })
        return
      }
      if (stop.is_assigned && String(stop.vehicle_no || '') === String(selectedVehicle)) {
        setManualFeedback({
          type: 'warning',
          message: `${soNumber} is already on ${selectedVehicle}.`,
        })
        return
      }

      const result = onManualAssignSalesOrder(soNumber, selectedVehicle)
      if (result?.ok) {
        setManualFeedback({
          type: result.capacityExceeded ? 'warning' : 'success',
          message:
            result.message ||
            `${soNumber} added to ${selectedVehicle} as stop ${result.sequence || ''}.`.trim(),
        })
      } else {
        setManualFeedback({
          type: 'error',
          message: result?.message || `Unable to assign ${soNumber}.`,
        })
      }
    },
    [manualAssignMode, onManualAssignSalesOrder, selectedVehicle],
  )

  const handleManualUnassignStop = useCallback(
    (stop) => {
      if (!manualAssignMode || !onManualUnassignSalesOrder) return
      const soNumber = String(stop?.so_number || '').trim()
      if (!soNumber || !stop.is_assigned) return

      const result = onManualUnassignSalesOrder(soNumber)
      if (result?.ok) {
        setManualFeedback({
          type: 'success',
          message: result.message || `${soNumber} removed from assignment.`,
        })
      } else {
        setManualFeedback({
          type: 'warning',
          message: result?.message || `Unable to remove ${soNumber}.`,
        })
      }
    },
    [manualAssignMode, onManualUnassignSalesOrder],
  )

  const selectMapStopForAdjustment = useCallback((stop) => {
    setSelectedMapStop(stop)
    setMoveFeedback(null)
  }, [])

  const updateRouteDistances = useCallback((distances) => {
    setRouteDistances((prev) => {
      const next = distances || {}
      const prevKeys = Object.keys(prev)
      const nextKeys = Object.keys(next)
      if (
        prevKeys.length === nextKeys.length &&
        nextKeys.every((key) => Number(prev[key]) === Number(next[key]))
      ) {
        return prev
      }
      return next
    })
  }, [])

  const moveSelectedStop = (targetRoute) => {
    if (!selectedMapStop || !targetRoute || !onMoveSalesOrder) return
    const result = onMoveSalesOrder(selectedMapStop.so_number, targetRoute.vehicle_no)
    if (result?.ok) {
      setMoveFeedback({
        type: result.capacityExceeded ? 'warning' : 'success',
        message: result.message || 'Assignment updated.',
      })
      setSelectedMapStop(null)
    } else {
      setMoveFeedback({
        type: 'error',
        message: result?.message || 'Unable to update this assignment.',
      })
    }
  }

  const showAssignmentSidebar =
    manualAssignMode && selectedVehicle !== ALL_VEHICLES
      ? true
      : singleVehicleSelected && !manualAssignMode

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-[90] flex bg-slate-900/50">
      <div className="w-full h-full bg-white flex flex-col overflow-hidden">
        <div className="px-3 sm:px-4 py-2.5 bg-slate-900 text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h3 className="text-sm sm:text-base font-semibold flex items-center gap-2">
                <MapPin className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 opacity-95" />
                {readOnly ? 'Assigned delivery map' : 'Vehicle-wise delivery map'}
              </h3>
              <p className="text-[11px] text-white/80 mt-0.5 hidden sm:block">
                {readOnly
                  ? 'View this gate pass vehicle route, sales-order stops, and truck path.'
                  : manualAssignMode
                  ? 'Manual assign: select a vehicle, click labels to assign in order, double-click to remove.'
                  : adjustMode
                    ? 'Click a party label on the map, then click a vehicle number to reassign it.'
                    : 'Select a vehicle to view its weight, capacity, and round-trip distance.'}
              </p>
              {(origin?.address || origin?.branch_name || origin?.organization_name) && (
                <p className="text-[11px] text-white/90 mt-1 truncate hidden md:block">
                  <span className="font-medium">
                    {origin?.branch_name || origin?.organization_name || 'Organization'}
                  </span>
                  {origin?.address ? ` · ${origin.address}` : ''}
                </p>
              )}
            </div>
            <div className="flex flex-wrap items-center justify-end gap-1.5 sm:gap-2 shrink-0">
              <div className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2 py-1 text-[10px] sm:text-[11px] font-medium">
                <span className="text-white/75">Total SO</span>
                <span className="font-bold">{assignmentSummary.total}</span>
                <span className="text-white/40">|</span>
                <span className="text-white/75">Assigned</span>
                <span className="font-bold text-emerald-200">{assignmentSummary.assigned}</span>
                <span className="text-white/40">|</span>
                <span className="text-white/75">Remaining</span>
                <span className="font-bold text-amber-200">{assignmentSummary.remaining}</span>
              </div>
              {manualAssignMode && !readOnly ? (
                <button
                  type="button"
                  onClick={handleSubmitManualAssignments}
                  className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors bg-emerald-500 hover:bg-emerald-600 text-white shadow-sm"
                  title="Finish manual assignment and show driving routes"
                >
                  <Check className="h-3.5 w-3.5" />
                  Submit assignment
                </button>
              ) : null}
              {onResetAssignments && !readOnly ? (
                <button
                  type="button"
                  onClick={handleResetAssignments}
                  className="h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors bg-white/15 hover:bg-white/25 text-white"
                  title="Clear all vehicle assignments and assign manually"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Reset
                </button>
              ) : null}
              {onMoveSalesOrder && activeRoutes.length > 1 && !manualAssignMode && !readOnly ? (
                <button
                  type="button"
                  onClick={toggleAdjustMode}
                  className={`h-9 inline-flex items-center gap-1.5 px-3 rounded-lg text-xs font-semibold cursor-pointer transition-colors ${
                    adjustMode
                      ? 'bg-white text-blue-950 shadow-sm'
                      : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  <ArrowRightLeft className="h-3.5 w-3.5" />
                  {adjustMode ? 'Done adjusting' : 'Adjust assignments'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="h-9 w-9 inline-flex items-center justify-center rounded-lg bg-white/15 hover:bg-white/25 text-white cursor-pointer transition-colors"
                aria-label="Close map"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-1.5 sm:gap-2 max-h-[88px] sm:max-h-none overflow-y-auto">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-white/70 mr-0.5">
              Vehicle
            </span>
            <button
              type="button"
              onClick={() => {
                setSelectedVehicle(ALL_VEHICLES)
                setManualFeedback(null)
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                selectedVehicle === ALL_VEHICLES
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'bg-white/15 text-white hover:bg-white/25'
              }`}
            >
              <Truck className="h-3.5 w-3.5" />
              All vehicles
              <span className="opacity-70">
                (
                {formatWeight(
                  activeRoutes.reduce((sum, route) => sum + Number(route.mapped_weight_qtl || 0), 0),
                )}
                {Object.values(routeDistances).some((distance) => Number.isFinite(distance))
                  ? ` · ${formatDistance(
                      Object.values(routeDistances).reduce(
                        (sum, distance) =>
                          sum + (Number.isFinite(distance) ? Number(distance) : 0),
                        0,
                      ),
                    )}`
                  : ''}
                )
              </span>
            </button>
            {vehicleTabs.map((route) => {
              const count = (route.stops || []).filter((s) => s.type === 'sales_order').length
              const active = selectedVehicle === route.vehicle_no
              const vehicleMeta =
                vehicles.find((row) => String(row.vehicle_no) === String(route.vehicle_no)) || route
              const loadedWeight = Number(vehicleMeta.mapped_weight_qtl || 0)
              const capacity = Number(vehicleMeta.capacity_qtl || 0)
              const capacityExceeded = loadedWeight > capacity + 1e-9
              const displayCount = manualAssignMode
                ? (vehicleMeta.mapped_sales_orders || route.stops || []).length
                : count
              return (
                <button
                  key={route.vehicle_no}
                  type="button"
                  onClick={() => {
                    setSelectedVehicle(String(route.vehicle_no || '').trim())
                    setManualFeedback(null)
                  }}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                    capacityExceeded
                      ? active
                        ? 'bg-red-50 text-red-800 ring-2 ring-red-300 shadow-sm'
                        : 'bg-red-500/25 text-red-50 ring-1 ring-red-300/70 hover:bg-red-500/35'
                      : active
                        ? 'bg-white text-slate-900 shadow-sm'
                      : 'bg-white/15 text-white hover:bg-white/25'
                  }`}
                >
                  <span
                    className="inline-block h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: route.color }}
                  />
                  {route.vehicle_no}
                  <span className="opacity-90 whitespace-nowrap">
                    {formatCapacitySummary(loadedWeight, capacity, displayCount)}
                    {!manualAssignMode && Number.isFinite(routeDistances[route.vehicle_no])
                      ? ` · ${formatDistance(routeDistances[route.vehicle_no])}`
                      : ''}
                  </span>
                  {capacityExceeded ? <AlertTriangle className="h-3.5 w-3.5" /> : null}
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex-1 min-h-0 flex flex-row">
          <aside className="w-[220px] sm:w-[260px] lg:w-[280px] border-r border-blue-100 bg-gradient-to-b from-blue-50/30 to-slate-50 flex flex-col min-h-0 shrink-0">
            <div className="px-3 py-2.5 border-b border-blue-100 bg-gradient-to-r from-white via-blue-50/60 to-white shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white shadow-sm">
                  <Truck className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-slate-900 truncate">Sales orders</p>
                  <p className="text-[10px] text-slate-500 truncate">
                    {visibleSalesOrderCards.length} order
                    {visibleSalesOrderCards.length === 1 ? '' : 's'}
                    {selectedVehicle !== ALL_VEHICLES ? ` · ${selectedVehicle}` : ''}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto p-2.5">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin text-slate-600" />
                  <p className="text-xs">Loading…</p>
                </div>
              ) : visibleSalesOrderCards.length ? (
                <div className="flex flex-col gap-2">
                  {visibleSalesOrderCards.map((card) => {
                    const dueStatus = resolveDueStatus(card)
                    const dueAccent =
                      dueStatus === 'priority'
                        ? 'border-red-200 bg-red-50/40 hover:border-red-300'
                        : dueStatus === 'overdue'
                          ? 'border-amber-200 bg-amber-50/40 hover:border-amber-300'
                          : 'border-blue-100 bg-white hover:border-blue-200'
                    const dueDaysLabel = formatDueDaysLabel(card) || '—'
                    const vehicleMeta = resolveVehicleAssignmentMeta(card.vehicle_no, vehicles)
                    const vehicleOverloaded = Boolean(vehicleMeta?.overloaded)
                    const nextVehicleNo = (() => {
                      if (!cycleVehicleNumbers.length) return ''
                      if (!card.vehicle_no) return cycleVehicleNumbers[0]
                      const currentIndex = cycleVehicleNumbers.indexOf(String(card.vehicle_no))
                      if (currentIndex < 0) return cycleVehicleNumbers[0]
                      return cycleVehicleNumbers[(currentIndex + 1) % cycleVehicleNumbers.length]
                    })()
                    return (
                      <div
                        key={card.so_number}
                        className={`w-full rounded-xl border p-2.5 shadow-sm transition-colors ${dueAccent}`}
                        style={{
                          borderLeftWidth: 3,
                          borderLeftColor:
                            dueStatus === 'priority'
                              ? dueStopColor(card)
                              : card.vehicle_color || dueStopColor(card),
                        }}
                      >
                        <p className="text-xs font-semibold text-slate-900 leading-snug">
                          <span className="break-words">{card.customer_name}</span>{' '}
                          <span className="font-normal text-slate-500 whitespace-nowrap">
                            ({card.has_coordinates ? formatDistance(card.distance_km) : 'no location'})
                          </span>
                        </p>
                        <div className="mt-1.5 flex items-center justify-between gap-2 min-w-0 text-[11px] leading-snug">
                          <p className="min-w-0 truncate text-slate-600">
                            <span className="font-medium text-blue-900">{card.so_number}</span>
                            <span className="text-slate-300 mx-1">·</span>
                            <span className="font-medium text-slate-800">
                              {formatWeightCompact(card.weight_qtl)}
                            </span>
                          </p>
                          <span
                            className="shrink-0 font-bold tabular-nums"
                            style={{ color: dueLabelColor(card) }}
                          >
                            {dueDaysLabel}
                          </span>
                        </div>
                        {cycleVehicleNumbers.length && onMoveSalesOrder ? (
                          <button
                            type="button"
                            onClick={() => handleCycleSoVehicle(card)}
                            disabled={loading}
                            title={
                              card.vehicle_no
                                ? `Click to move to ${nextVehicleNo}`
                                : `Click to assign to ${nextVehicleNo}`
                            }
                            className={`mt-2 w-full inline-flex items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold cursor-pointer transition-colors disabled:opacity-60 ${
                              vehicleOverloaded
                                ? 'border-red-300 bg-red-50 text-red-800 hover:bg-red-100'
                                : card.vehicle_no
                                  ? 'border-blue-200 bg-blue-50/80 text-blue-950 hover:bg-blue-100'
                                  : 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                            }`}
                          >
                            <span className="inline-flex items-center gap-1.5 min-w-0 truncate">
                              <Truck className="h-3 w-3 shrink-0 opacity-80" />
                              {card.vehicle_no ? (
                                <>
                                  <span
                                    className="h-2 w-2 rounded-full shrink-0"
                                    style={{ backgroundColor: card.vehicle_color || '#2563eb' }}
                                  />
                                  <span className="truncate">{card.vehicle_no}</span>
                                </>
                              ) : (
                                <span className="truncate">Unassigned</span>
                              )}
                            </span>
                            <span className="shrink-0 tabular-nums">
                              {vehicleCapacityButtonLabel(vehicleMeta)}
                            </span>
                          </button>
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 px-2 text-center text-slate-400">
                  <Truck className="h-5 w-5 mb-1.5 opacity-50" />
                  <p className="text-xs">No sales orders to show</p>
                </div>
              )}
            </div>
          </aside>

          {showAssignmentSidebar ? (
            <aside className="w-[210px] sm:w-[230px] lg:w-[250px] border-r border-slate-200 bg-slate-50 flex flex-col min-h-0 shrink-0">
              <div className="px-3 py-2 border-b border-slate-200 bg-white shrink-0">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                  {manualAssignMode ? 'Manual assignment' : 'Vehicle details'}
                </p>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-8 gap-2 text-slate-500">
                    <Loader2 className="h-5 w-5 animate-spin text-slate-600" />
                    <p className="text-xs">Loading…</p>
                  </div>
                ) : selectedRoute || selectedVehicle !== ALL_VEHICLES ? (
                  <>
                    {(() => {
                      const vehicleMeta =
                        vehicles.find((row) => String(row.vehicle_no) === String(selectedVehicle)) ||
                        {}
                      const vehicleRow = selectedRoute || vehicleMeta
                      const loadedWeight = Number(vehicleRow.mapped_weight_qtl || 0)
                      const capacity = Number(vehicleRow.capacity_qtl || 0)
                      const stopCount = manualAssignMode
                        ? (vehicleMeta.mapped_sales_orders || []).length
                        : (vehicleRow.stops || []).filter(
                            (stop) => stop.type === 'sales_order',
                          ).length
                      const excessWeight = Math.max(0, loadedWeight - capacity)
                      const availableWeight = Math.max(0, capacity - loadedWeight)
                      const routeColor =
                        vehicleRow.color ||
                        vehicleRouteColor(
                          Math.max(
                            0,
                            vehicleTabs.findIndex(
                              (route) => route.vehicle_no === selectedVehicle,
                            ),
                          ),
                        )

                      return (
                        <>
                          <div
                            className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm"
                            style={{ borderTopWidth: 4, borderTopColor: routeColor }}
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className="h-3 w-3 rounded-full shrink-0"
                                style={{ backgroundColor: routeColor }}
                              />
                              <p className="text-sm font-bold text-slate-900 truncate">
                                {selectedVehicle}
                              </p>
                            </div>
                            <p className="mt-1 text-[11px] text-slate-500">
                              {stopCount} sales order{stopCount === 1 ? '' : 's'} assigned
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div className="rounded-lg border border-blue-100 bg-blue-50 p-2.5">
                              <p className="text-[9px] uppercase tracking-wide font-semibold text-blue-700">
                                Selected weight
                              </p>
                              <p className="mt-1 text-sm font-bold text-blue-950">
                                {formatWeight(loadedWeight)}
                              </p>
                            </div>
                            <div className="rounded-lg border border-slate-200 bg-white p-2.5">
                              <p className="text-[9px] uppercase tracking-wide font-semibold text-slate-500">
                                Capacity
                              </p>
                              <p className="mt-1 text-sm font-bold text-slate-900">
                                {formatWeight(capacity)}
                              </p>
                            </div>
                          </div>

                          <div
                            className={`rounded-lg border p-2.5 ${
                              excessWeight > 1e-9
                                ? 'border-red-300 bg-red-50'
                                : 'border-emerald-200 bg-emerald-50'
                            }`}
                          >
                            <p
                              className={`text-[9px] uppercase tracking-wide font-semibold ${
                                excessWeight > 1e-9 ? 'text-red-700' : 'text-emerald-700'
                              }`}
                            >
                              {excessWeight > 1e-9 ? 'Over capacity' : 'Remaining capacity'}
                            </p>
                            <p
                              className={`mt-1 text-sm font-bold ${
                                excessWeight > 1e-9 ? 'text-red-800' : 'text-emerald-800'
                              }`}
                            >
                              {formatWeight(excessWeight > 1e-9 ? excessWeight : availableWeight)}
                            </p>
                          </div>

                          {!manualAssignMode ? (
                            <div className="rounded-lg border border-violet-200 bg-violet-50 p-2.5">
                              <p className="text-[9px] uppercase tracking-wide font-semibold text-violet-700">
                                Organization round trip
                              </p>
                              <p className="mt-1 text-lg font-bold text-violet-950">
                                {Number.isFinite(routeDistances[selectedVehicle])
                                  ? formatDistance(routeDistances[selectedVehicle])
                                  : 'Calculating…'}
                              </p>
                              <p className="mt-1 text-[10px] text-violet-700">
                                Start → stops in sequence → return to start (Google driving route)
                              </p>
                            </div>
                          ) : (
                            <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-2.5">
                              <p className="text-[9px] uppercase tracking-wide font-semibold text-indigo-700">
                                Next sequence
                              </p>
                              <p className="mt-1 text-lg font-bold text-indigo-950">
                                {stopCount + 1}
                              </p>
                              <p className="mt-1 text-[10px] text-indigo-700">
                                Click unassigned labels to add stops. When done, click{' '}
                                <span className="font-semibold">Submit assignment</span> to view driving
                                routes.
                              </p>
                            </div>
                          )}
                        </>
                      )
                    })()}
                  </>
                ) : null}
              </div>
            </aside>
          ) : null}

          <div className="flex-1 min-h-0 min-w-0 relative bg-slate-100">
            {!singleVehicleSelected && !loading ? (
              <div className="absolute top-2 left-2 z-10 max-w-[min(420px,calc(100%-16px))] rounded-lg border border-slate-200 bg-white/95 backdrop-blur px-2.5 py-2 shadow-sm">
                <p className="text-[11px] text-slate-600">
                  {manualAssignMode
                    ? 'Green START = warehouse. Sky = on time · Orange = overdue · Red P = priority (>2 days overdue). Click to assign.'
                    : showAllLocationLabels && !hasAssignedStops
                      ? 'Hover a weight label for party and area details. Use Reset to assign manually.'
                      : adjustMode
                        ? 'Adjustment is active. Click a weight label to change its vehicle.'
                        : 'Click markers for details. Colored lines show Google driving routes.'}
                </p>
                {manualAssignMode && selectedVehicle === ALL_VEHICLES ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    {assignmentSummary.remaining} SO remaining · select a vehicle tab to start assigning.
                  </p>
                ) : null}
                {missingLocationCount > 0 ? (
                  <p className="mt-1 text-[11px] font-medium text-amber-800">
                    {missingLocationCount} SO{missingLocationCount === 1 ? '' : 's'} have no customer
                    location — only START is plotted. Add party/SO lat-long or a full address.
                  </p>
                ) : null}
              </div>
            ) : null}
            {manualFeedback ? (
              <div
                className={`absolute right-3 top-3 z-20 max-w-sm rounded-lg border px-3 py-2 shadow-lg text-xs ${
                  manualFeedback.type === 'warning'
                    ? 'border-amber-300 bg-amber-50 text-amber-900'
                    : manualFeedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-300 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {manualFeedback.type === 'success' ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{manualFeedback.message}</span>
                </div>
              </div>
            ) : null}
            {adjustMode && selectedMapStop ? (
              <div className="absolute right-3 bottom-3 z-20 w-[min(430px,calc(100%-24px))] rounded-xl border border-slate-200 bg-white/95 backdrop-blur p-2.5 shadow-xl">
                <div className="flex items-center justify-between gap-2">
                  <p className="min-w-0 text-xs text-slate-800 truncate">
                    <span className="font-semibold">
                      {selectedMapStop.customer_name || selectedMapStop.so_number}
                    </span>
                    <span className="text-slate-500">
                      {' '}
                      · {selectedMapStop.so_number} · {formatWeight(selectedMapStop.weight_qtl)}
                      {formatDueDaysLabel(selectedMapStop)
                        ? ` · ${formatDueDaysLabel(selectedMapStop)}`
                        : ''}
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setSelectedMapStop(null)}
                    className="h-6 w-6 inline-flex items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 cursor-pointer"
                    aria-label="Close vehicle choices"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {routes
                    .filter((route) => route.vehicle_no !== selectedMapStop.vehicle_no)
                    .map((route) => {
                      const loadedWeight = Number(route.mapped_weight_qtl || 0)
                      const capacity = Number(route.capacity_qtl || 0)
                      const projectedWeight =
                        loadedWeight + Number(selectedMapStop.weight_qtl || 0)
                      const projectedExcess = Math.max(0, projectedWeight - capacity)
                      return (
                        <button
                          key={route.vehicle_no}
                          type="button"
                          onClick={() => moveSelectedStop(route)}
                          className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 text-left cursor-pointer transition-colors ${
                            projectedExcess > 1e-9
                              ? 'border-red-300 bg-red-50 hover:bg-red-100'
                              : 'border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-200'
                          }`}
                        >
                          <span
                            className="h-2.5 w-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: route.color }}
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={`block text-xs font-semibold ${
                                projectedExcess > 1e-9 ? 'text-red-800' : 'text-slate-900'
                              }`}
                            >
                              {route.vehicle_no}
                            </span>
                            <span className="block text-[10px] text-slate-600">
                              {formatWeight(projectedWeight)} / {formatWeight(capacity)}
                            </span>
                          </span>
                          {projectedExcess > 1e-9 ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-700">
                              <AlertTriangle className="h-3.5 w-3.5" />
                              +{formatWeight(projectedExcess)}
                            </span>
                          ) : (
                            <Check className="h-4 w-4 text-emerald-600" />
                          )}
                        </button>
                      )
                    })}
                </div>
              </div>
            ) : null}
            {moveFeedback && !selectedMapStop ? (
              <div
                className={`absolute right-3 bottom-3 z-20 max-w-sm rounded-lg border px-3 py-2 shadow-lg text-xs ${
                  moveFeedback.type === 'warning'
                    ? 'border-red-300 bg-red-50 text-red-800'
                    : moveFeedback.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-red-300 bg-red-50 text-red-800'
                }`}
              >
                <div className="flex items-start gap-1.5">
                  {moveFeedback.type === 'success' ? (
                    <Check className="h-4 w-4 shrink-0" />
                  ) : (
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                  )}
                  <span>{moveFeedback.message}</span>
                </div>
              </div>
            ) : null}
            {loading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-50">
                <Loader2 className="h-6 w-6 animate-spin text-slate-600" />
                <p className="text-sm text-slate-500">Loading route coordinates…</p>
              </div>
            ) : (
              <VehicleRouteMap
                routes={filteredRoutes}
                allRoutes={activeRoutes}
                allStops={mapStopsForRender}
                showAllStops={showAllLocationLabels}
                focusKey={mapFocusKey}
                mapOpen={open}
                adjustMode={readOnly ? false : adjustMode}
                manualAssignMode={readOnly ? false : manualAssignMode}
                activeVehicleNo={selectedVehicle === ALL_VEHICLES ? '' : selectedVehicle}
                onSelectStop={selectMapStopForAdjustment}
                onManualAssignStop={handleManualAssignStop}
                onManualUnassignStop={handleManualUnassignStop}
                onRouteDistances={updateRouteDistances}
              />
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
