const STORAGE_KEY = 'price_master_convert_v1'

/** Survives React Strict Mode remount after sessionStorage is cleared. */
let priceMasterConvertPayloadMemory = null

export function storePriceMasterConvertPayload(payload) {
  const next = payload && typeof payload === 'object' ? payload : {}
  priceMasterConvertPayloadMemory = next
  if (typeof window === 'undefined') return
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore quota / private mode failures
  }
}

export function peekPriceMasterConvertPayload() {
  if (priceMasterConvertPayloadMemory && typeof priceMasterConvertPayloadMemory === 'object') {
    return priceMasterConvertPayloadMemory
  }
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed && typeof parsed === 'object') {
      priceMasterConvertPayloadMemory = parsed
      return parsed
    }
    return null
  } catch {
    return null
  }
}

export function clearPriceMasterConvertPayload() {
  priceMasterConvertPayloadMemory = null
  if (typeof window === 'undefined') return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function consumePriceMasterConvertPayload() {
  const payload = peekPriceMasterConvertPayload()
  clearPriceMasterConvertPayload()
  return payload
}
