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

async function parseJson(res) {
  const data = await res.json();
  if (data?.status && Number(data.status) >= 400) {
    throw new Error(data.message || data.error || "Request failed");
  }
  return data;
}

export async function fetchSalesTargets(params = {}) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/sales-targets/${buildQuery(params)}`,
  );
  return parseJson(res);
}

export async function fetchSalesTargetById(targetId) {
  const res = await apiRequest(
    "GET",
    `${API_BASE_URL}/api/sales-targets/${buildQuery({
      id: targetId,
      target_id: targetId,
    })}`,
  );
  const body = await parseJson(res);
  return body.data;
}

export async function createSalesTarget(payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales-targets/create/`,
    payload,
  );
  return parseJson(res);
}

export async function updateSalesTarget(payload) {
  const res = await apiRequest(
    "POST",
    `${API_BASE_URL}/api/sales-targets/update/`,
    payload,
  );
  return parseJson(res);
}

export async function deactivateSalesTarget(targetId) {
  return updateSalesTarget({ target_id: targetId, is_active: false });
}
