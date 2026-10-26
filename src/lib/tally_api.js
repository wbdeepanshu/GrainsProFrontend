import { apiRequest } from "@/lib/queryClient";
import { apiUrl, parseJsonResponse } from "@/lib/api";

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    if (Array.isArray(value)) {
      value.forEach((v) => q.append(key, String(v)));
    } else {
      q.set(key, String(value));
    }
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

/** GrainPro parties live under /api/report/get-ledgers/ */
export async function fetchLedgers(params = {}) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/report/get-ledgers/${buildQuery(params)}`),
  );
  const data = await parseJsonResponse(res);
  return {
    data: data.data ?? [],
    summary: data.summary ?? null,
    pagination: data.pagination ?? {
      current_page: 1,
      total_count: Array.isArray(data.data) ? data.data.length : 0,
      total_pages: 1,
      has_next: false,
      has_previous: false,
      per_page: params.per_page ?? 50,
    },
    status: data.status,
    message: data.message,
  };
}

export async function fetchLedgersBreakdown(params = {}) {
  return fetchLedgers(params);
}

export async function fetchLedgerDetail(partyId) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/report/get-ledgers/${encodeURIComponent(partyId)}/`),
  );
  const data = await parseJsonResponse(res);
  return data.data ?? data ?? null;
}

export async function fetchLedgerGroups(params = {}) {
  try {
    const res = await apiRequest(
      "GET",
      apiUrl(`/api/report/get-ledgers-groups/${buildQuery(params)}`),
    );
    const data = await parseJsonResponse(res);
    return data.data ?? [];
  } catch {
    return [];
  }
}

export async function fetchLedgerAreaGroups(params = {}) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/report/get-ledger-area-groups/${buildQuery(params)}`),
  );
  const data = await parseJsonResponse(res);
  if (!Array.isArray(data?.data)) {
    throw new Error("The area group response is invalid.");
  }
  return data;
}

export async function createLedgerAreaGroup(values) {
  const res = await apiRequest(
    "POST",
    apiUrl("/api/report/create-ledger-area-group/"),
    values,
  );
  return parseJsonResponse(res);
}

export async function updateLedgerAreaGroup(areaId, values) {
  const res = await apiRequest(
    "PATCH",
    apiUrl(`/api/report/update-ledger-area-group/${areaId}/`),
    values,
  );
  return parseJsonResponse(res);
}
