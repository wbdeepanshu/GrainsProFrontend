import { apiRequest } from "@/lib/queryClient";
import { apiUrl, parseJsonResponse } from "@/lib/api";

export function getUserId(user) {
  return user?.user_id || user?.id || user?.userid || "";
}

export function getUserDisplayName(user) {
  return user?.name || user?.full_name || user?.username || getUserId(user) || "User";
}

export function extractUsersList(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.users)) return payload.users;
  return [];
}

export async function fetchUsersForFilter() {
  try {
    const res = await apiRequest("GET", apiUrl("/api/get-users/"));
    const data = await parseJsonResponse(res);
    return extractUsersList(data);
  } catch {
    return [];
  }
}

export async function fetchUsers(params = {}) {
  return fetchUsersForFilter(params);
}

export async function fetchBranches() {
  const res = await apiRequest("GET", apiUrl("/api/get-branches/"));
  const data = await parseJsonResponse(res);
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || "Failed to load branches");
  }
  const rows = data.data ?? data.results ?? [];
  return Array.isArray(rows) ? rows : [];
}
