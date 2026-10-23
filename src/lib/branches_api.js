import { apiRequest } from "@/lib/queryClient";
import { apiUrl, parseJsonResponse } from "@/lib/api";
import { AuthService } from "@/lib/auth";

function buildQuery(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    q.set(key, String(value));
  });
  const s = q.toString();
  return s ? `?${s}` : "";
}

export function getDashboardSelectedBranchId() {
  try {
    return localStorage.getItem("dashboard_selected_branch_id") || "";
  } catch {
    return "";
  }
}

export function setDashboardSelectedBranchId(branchId) {
  try {
    if (branchId) localStorage.setItem("dashboard_selected_branch_id", String(branchId));
    else localStorage.removeItem("dashboard_selected_branch_id");
  } catch {
    /* ignore */
  }
}

export function getBranchFromSettingsList(branches, branchId) {
  if (!branchId || !Array.isArray(branches)) return null;
  return branches.find((b) => String(b.id) === String(branchId)) || null;
}

/** Map GrainPro branch list into MWB-style branch settings rows. */
export async function fetchBranchSettings() {
  const user = AuthService.getUserData?.() || {};
  const orgBranch = user?.branch || user?.user_info?.branch;
  // Prefer dedicated endpoint when present
  try {
    const res = await apiRequest("GET", apiUrl("/api/get-branches/"));
    const data = await parseJsonResponse(res);
    const rows = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    if (rows.length) {
      return rows.map((b) => ({
        id: b.id || b.branch_id,
        name: b.name || b.branch_name || String(b.id),
        ...b,
      }));
    }
  } catch {
    /* fall through */
  }

  if (orgBranch) {
    return [
      {
        id: orgBranch.id || orgBranch,
        name: orgBranch.name || String(orgBranch.id || orgBranch),
      },
    ];
  }
  return [];
}

export async function fetchBranchDetail(branchId) {
  const list = await fetchBranchSettings();
  return getBranchFromSettingsList(list, branchId);
}
