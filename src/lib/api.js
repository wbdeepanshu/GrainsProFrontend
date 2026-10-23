/** Shared API helpers (compat with MWB promotional screens). */

export function getApiBaseUrl() {
  return import.meta.env.VITE_BASE_URL || "";
}

export function apiUrl(path) {
  const base = getApiBaseUrl().replace(/\/$/, "");
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const message = data.message || data.error || data.detail || `Request failed (${res.status})`;
    const err = new Error(message);
    err.status = res.status;
    err.data = data;
    throw err;
  }
  if (data.status && Number(data.status) >= 400) {
    const err = new Error(data.message || "Request failed");
    err.status = Number(data.status);
    err.data = data;
    throw err;
  }
  return data;
}
