/**
 * Outward / split-loading API helpers for GrainsPRO.
 * Uses existing salesApp endpoints under /api/sales/ (not outwardApp).
 */
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

async function parseJsonResponse(res) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.message || data.error || data.detail || "Request failed");
    err.status = res.status;
    err.data = data;
    throw err;
  }
  return data;
}

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export async function fetchOutwardEntries(params = {}) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/sales/outward-entries/${buildQuery(params)}`,
  );
  return parseJsonResponse(res);
}

export async function fetchOutwardEntryDetail(outwardEntryId) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/sales/outward-entries/${outwardEntryId}/`,
  );
  const data = await parseJsonResponse(res);
  return data.data;
}

export async function createOutwardEntry(payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales/add-outward-entry/`,
    payload,
  );
  return parseJsonResponse(res);
}

export async function updateOutwardEntry(outwardId, payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales/update-outward-entry/${outwardId}/`,
    payload,
  );
  return parseJsonResponse(res);
}

export async function fetchCustomerDistanceFromOrg(payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales/customer-distance-from-org/`,
    payload,
  );
  const data = await parseJsonResponse(res);
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || "Failed to calculate customer distances");
  }
  return data;
}

export async function suggestVehicleLoadingPlan(payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales/suggest-vehicle-loading-plan/`,
    payload,
  );
  const data = await parseJsonResponse(res);
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || "Failed to suggest vehicle loading plan");
  }
  return data;
}

export async function fetchDeliveryNotes(params = {}) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/sales/delivery-notes/${buildQuery(params)}`,
  );
  return parseJsonResponse(res);
}

export async function fetchDeliveryNoteDetail(outwardSalesOrderId) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/sales/delivery-notes/${outwardSalesOrderId}/`,
  );
  const data = await parseJsonResponse(res);
  return data.data;
}

export async function updateOutwardLoading(payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales/update-outward/`,
    payload,
  );
  return parseJsonResponse(res);
}

export async function convertDeliveryNoteToInvoice(outwardSalesOrderId, payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales/convert-to-invoice/${outwardSalesOrderId}/`,
    payload,
  );
  return parseJsonResponse(res);
}

export async function syncDeliveryNoteToTally(payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales/sync-delivery-note/`,
    payload,
  );
  return parseJsonResponse(res);
}
