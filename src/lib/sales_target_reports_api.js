import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

async function parseReportJson(res, fallbackMessage) {
  const data = await res.json();
  if (data?.status && Number(data.status) >= 400) {
    throw new Error(data.message || fallbackMessage);
  }
  return data;
}

export async function fetchUserSalesOrderSummary(params = {}) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/report/user-sales-order-summary/${buildQuery(params)}`,
  );
  return parseReportJson(res, "Failed to load salesman sales order summary");
}

export async function fetchUserSalesOrderDetails(params = {}) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/report/user-sales-order-details/${buildQuery(params)}`,
  );
  return parseReportJson(res, "Failed to load salesman sales order details");
}

/** Maps MWB `user-sales-order-items` → GrainsPRO item-target report URL */
export async function fetchUserSalesOrderItems(params = {}) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/report/user-sales-item-target-report/${buildQuery(params)}`,
  );
  return parseReportJson(res, "Failed to load salesman item-wise details");
}
