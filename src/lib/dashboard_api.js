import { format } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { apiUrl, parseJsonResponse } from "@/lib/api";
import { AuthService } from "@/lib/auth";
import { fetchBranchSettings } from "@/lib/branches_api";

/**
 * Same POST /api/dashboard-data/ used on the dashboard screen.
 */
export async function fetchDashboardData(objectName, options = {}) {
  const payload = {
    object_name: objectName,
    date: options.date || format(new Date(), "yyyy-MM-dd"),
  };
  if (options.fromDate && options.toDate && options.fromDate !== options.toDate) {
    payload.from_date = options.fromDate;
    payload.to_date = options.toDate;
  }
  if (options.branchId) {
    payload.branch = options.branchId;
    payload.branch_id = options.branchId;
  }

  const res = await apiRequest("POST", apiUrl("/api/dashboard-data/"), payload);
  const data = await parseJsonResponse(res);
  if (data.status && Number(data.status) >= 400) {
    throw new Error(data.message || "Failed to load dashboard data");
  }
  return data;
}

function pickLogoUrl(...candidates) {
  for (const value of candidates) {
    if (value == null || value === "") continue;
    const text = String(value).trim();
    if (text && text !== "-" && text.toLowerCase() !== "null") return text;
  }
  return "";
}

function pickText(...candidates) {
  for (const value of candidates) {
    if (value == null || value === "") continue;
    if (typeof value === "object") {
      const nested =
        value.organization_name ||
        value.organization ||
        value.branch_name ||
        value.branch ||
        value.name ||
        value.org_name;
      if (nested != null && String(nested).trim()) return String(nested).trim();
      continue;
    }
    const text = String(value).trim();
    if (text && text !== "-" && text.toLowerCase() !== "null") return text;
  }
  return "";
}

export function extractOrganizationLogoUrl(payload) {
  if (!payload || typeof payload !== "object") return "";
  const data = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const userInfo = data.user_info || data.user || {};
  const organization = data.organization || userInfo.organization || {};

  const direct = pickLogoUrl(
    data.organization_logo,
    userInfo.organization_logo,
    organization.organization_logo,
    organization.logo,
    userInfo.logo,
    data.logo,
  );
  if (direct) return direct;

  for (const value of Object.values(data)) {
    if (!value || typeof value !== "object" || Array.isArray(value)) continue;
    const nested = pickLogoUrl(value.organization_logo, value.logo);
    if (nested) return nested;
  }

  return "";
}

export async function fetchOrganizationLogo(branchId) {
  try {
    const response = await fetchDashboardData("user_info", {
      branchId: branchId || undefined,
    });
    return extractOrganizationLogoUrl(response);
  } catch {
    return null;
  }
}

export function saveOrganizationInfo(info) {
  if (!info || typeof info !== "object") return;
  try {
    const orgName = pickText(
      info.organizationName,
      info.organization_name,
      info.organization,
      info.name,
    );
    const orgAddress = pickText(
      info.address,
      info.organization_address,
      info.full_address,
      [info.address, info.city, info.state, info.pincode].filter(Boolean).join(", "),
    );
    const gstin = pickText(info.gstin, info.gst_number, info.gst);
    const logo = pickLogoUrl(info.logo, info.organization_logo);
    const branchName = pickText(info.branchName, info.branch_name, info.branch);
    const branchAddress = pickText(info.branchAddress, info.branch_address);

    if (!orgName && !orgAddress) return;

    let existing = {};
    try {
      const raw = localStorage.getItem("cp_org_info");
      if (raw) existing = JSON.parse(raw);
    } catch {
      /* ignore */
    }

    const merged = {
      ...existing,
      organization_name: orgName || existing.organization_name || "",
      name: orgName || existing.name || "",
      organization: orgName || existing.organization || "",
      address: orgAddress || existing.address || "",
      organization_address: orgAddress || existing.organization_address || "",
      branch_address: branchAddress || orgAddress || existing.branch_address || "",
      branch_name: branchName || existing.branch_name || "",
      branch: branchName || existing.branch || "",
      gst_number: gstin || existing.gst_number || "",
      gstin: gstin || existing.gstin || "",
      organization_logo: logo || existing.organization_logo || "",
    };

    localStorage.setItem("cp_org_info", JSON.stringify(merged));

    const currentAuth = AuthService.getUserData() || {};
    AuthService.setUserData({
      ...currentAuth,
      user_info: {
        ...(currentAuth.user_info || {}),
        organization: orgName || currentAuth.user_info?.organization,
        organization_name: orgName || currentAuth.user_info?.organization_name,
        organization_address: orgAddress || currentAuth.user_info?.organization_address,
        address: orgAddress || currentAuth.user_info?.address,
        branch: branchName || currentAuth.user_info?.branch,
        branch_name: branchName || currentAuth.user_info?.branch_name,
        gst_number: gstin || currentAuth.user_info?.gst_number,
        organization_logo: logo || currentAuth.user_info?.organization_logo,
      },
      organization: orgName || currentAuth.organization,
      organization_name: orgName || currentAuth.organization_name,
      organization_address: orgAddress || currentAuth.organization_address,
      address: orgAddress || currentAuth.address,
    });
  } catch (e) {
    console.error("Failed to save organization info:", e);
  }
}

export function getSavedOrganizationInfo() {
  try {
    const raw = localStorage.getItem("cp_org_info");
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object") {
        const organizationName = pickText(
          parsed.organization_name,
          parsed.name,
          parsed.organization,
        );
        const address = pickText(
          parsed.organization_address,
          parsed.address,
          parsed.branch_address,
        );
        const gstin = pickText(parsed.gst_number, parsed.gstin);
        if (organizationName || address) {
          return { organizationName, address, gstin };
        }
      }
    }
  } catch {
    /* ignore */
  }

  const userData = AuthService.getUserData() || {};
  const userInfo = userData.user_info || {};
  const org = userData.organization || {};
  const organizationName = pickText(
    userInfo.organization_name,
    userInfo.organization,
    userData.organization_name,
    userData.organization,
    typeof org === "string" ? org : org.name,
  );
  const address = pickText(
    userInfo.organization_address,
    userInfo.address,
    userData.organization_address,
    userData.address,
    typeof org === "object" ? org.address : "",
    typeof org === "object"
      ? [org.address, org.city, org.state, org.pincode].filter(Boolean).join(", ")
      : "",
  );
  const gstin = pickText(
    userInfo.gst_number,
    userData.gst_number,
    typeof org === "object" ? org.gst_number : "",
  );

  return { organizationName, address, gstin };
}

export function extractOrganizationInfo(payload) {
  if (!payload || typeof payload !== "object") {
    return {
      organizationName: "",
      address: "",
      branchName: "",
      branchAddress: "",
      gstin: "",
      logo: "",
    };
  }
  const data = payload.data && typeof payload.data === "object" ? payload.data : payload;
  const userInfo = data.user_info || data.user || {};
  const orgDetails =
    userInfo.organization_details || data.organization_details || data.organization || {};

  const organizationName = pickText(
    userInfo.organization_name,
    userInfo.organization,
    data.organization_name,
    data.organization,
    orgDetails.organization_name,
    orgDetails.name,
  );

  const address = pickText(
    userInfo.organization_address,
    userInfo.address,
    orgDetails.full_address,
    orgDetails.organization_address,
    orgDetails.address,
    [orgDetails.address, orgDetails.city, orgDetails.state, orgDetails.pincode]
      .filter(Boolean)
      .join(", "),
    [userInfo.address, userInfo.city, userInfo.state, userInfo.pincode]
      .filter(Boolean)
      .join(", "),
    data.organization_address,
    data.address,
  );

  const branchName = pickText(
    userInfo.branch_name,
    userInfo.branch,
    data.branch_name,
    data.branch,
  );

  const branchAddress = pickText(userInfo.branch_address, data.branch_address);

  const gstin = pickText(
    userInfo.gst_number,
    orgDetails.gst_number,
    data.gst_number,
    userInfo.gst,
    userInfo.gstin,
  );

  const logo = extractOrganizationLogoUrl(payload);

  const result = {
    organizationName,
    address,
    branchName,
    branchAddress,
    gstin,
    logo,
  };

  saveOrganizationInfo(result);

  return result;
}

export async function fetchOrganizationInfo(branchId) {
  let result = {
    organizationName: "",
    address: "",
    branchName: "",
    branchAddress: "",
    gstin: "",
    logo: "",
  };

  try {
    const response = await fetchDashboardData("user_info", {
      branchId: branchId || undefined,
    });
    result = extractOrganizationInfo(response);
  } catch (e) {
    console.warn("Failed to fetch dashboard user_info:", e);
  }

  if (!result.address || !result.gstin) {
    try {
      const branches = await fetchBranchSettings();
      if (Array.isArray(branches) && branches.length > 0) {
        const targetBranch =
          (branchId ? branches.find((b) => String(b.id) === String(branchId)) : null) ||
          branches.find((b) => b.is_main) ||
          branches[0];

        if (targetBranch) {
          const addrParts = [
            targetBranch.address,
            targetBranch.city,
            targetBranch.state,
            targetBranch.pincode,
          ].filter(Boolean);
          const bAddress = addrParts.join(", ");
          if (!result.address && bAddress) {
            result.address = bAddress;
          }
          if (!result.gstin && targetBranch.gst_number) {
            result.gstin = targetBranch.gst_number;
          }
          if (!result.branchName && targetBranch.name) {
            result.branchName = targetBranch.name;
          }
          saveOrganizationInfo(result);
        }
      }
    } catch (e) {
      console.warn("Failed to enrich organization info from branch settings:", e);
    }
  }

  return result;
}

export async function fetchSalesOrderDetail(orderId) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/sales/get-sales-order-details/${encodeURIComponent(orderId)}/`),
  );
  return parseJsonResponse(res);
}

export async function fetchPurchaseOrderDetail(orderId) {
  const res = await apiRequest(
    "GET",
    apiUrl(`/api/report/get-purchase-order-details/${encodeURIComponent(orderId)}/`),
  );
  return parseJsonResponse(res);
}
