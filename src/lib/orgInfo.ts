// Lightweight in-memory + localStorage cache for organization/branch info
// Source: /api/dashboard-data/ → user_info (+ branch_address anywhere in response)

import { AuthService } from "@/lib/auth";

export type OrgInfo = {
  organization: string;
  branch: string;
  organization_address: string;
  branch_address: string;
  loadedAt: number;
};

const LOCAL_STORAGE_KEY = "cp_org_info";
let cachedOrgInfo: OrgInfo | null = null;

const pickString = (...values: unknown[]): string => {
  for (const value of values) {
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return "";
};

const todayIsoDate = () => new Date().toISOString().split("T")[0];

/** Walk the API JSON tree and return the first non-empty string for a key (any depth). */
const deepFindStringByKey = (node: unknown, targetKey: string): string => {
  const wanted = targetKey.toLowerCase();
  const seen = new Set<unknown>();
  const stack: unknown[] = [node];

  while (stack.length > 0) {
    const current = stack.pop();
    if (current == null || typeof current !== "object" || seen.has(current)) continue;
    seen.add(current);

    if (Array.isArray(current)) {
      stack.push(...current);
      continue;
    }

    const record = current as Record<string, unknown>;
    for (const [key, value] of Object.entries(record)) {
      if (key.toLowerCase() === wanted) {
        const text = pickString(value);
        if (text) return text;
      }
      if (value != null && typeof value === "object") {
        stack.push(value);
      }
    }
  }

  return "";
};

const branchRecordAddress = (branch: unknown): string => {
  if (!branch || typeof branch !== "object") return "";
  const record = branch as Record<string, unknown>;
  const direct = pickString(record.address, record.branch_address, record.branchAddress);
  if (direct) return direct;

  const parts = [
    record.address_line1,
    record.address_line2,
    record.city,
    record.state,
    record.pincode,
  ]
    .map((part) => (part == null ? "" : String(part).trim()))
    .filter(Boolean);

  return parts.join(", ");
};

export const extractOrgInfoFromDashboardPayload = (
  payload: unknown,
  existing?: OrgInfo | null
): OrgInfo => {
  const envelope = (payload as Record<string, unknown>) ?? {};
  const root = (envelope.data as Record<string, unknown> | undefined) ?? {};
  const userInfo = (root.user_info as Record<string, unknown> | undefined) ?? {};
  const branchValue = userInfo.branch;

  const organization_address = pickString(
    userInfo.organization_address,
    userInfo.organizationAddress,
    root.organization_address,
    root.organizationAddress,
    envelope.organization_address,
    deepFindStringByKey(payload, "organization_address"),
    existing?.organization_address
  );

  const branch_address = pickString(
    userInfo.branch_address,
    userInfo.branchAddress,
    root.branch_address,
    root.branchAddress,
    envelope.branch_address,
    branchRecordAddress(branchValue),
    branchRecordAddress(root.branch),
    branchRecordAddress(root.branch_info),
    branchRecordAddress(root.branch_details),
    deepFindStringByKey(payload, "branch_address"),
    existing?.branch_address
  );

  return {
    organization: pickString(
      userInfo.organization,
      userInfo.organization_name,
      root.organization,
      deepFindStringByKey(payload, "organization"),
      existing?.organization
    ),
    branch: pickString(
      typeof branchValue === "string" ? branchValue : undefined,
      typeof branchValue === "object" ? (branchValue as Record<string, unknown>)?.name : undefined,
      userInfo.branch_name,
      root.branch,
      typeof root.branch === "string" ? root.branch : undefined,
      existing?.branch
    ),
    organization_address,
    branch_address,
    loadedAt: Date.now(),
  };
};

export function getOrgInfoSync(): OrgInfo | null {
  if (cachedOrgInfo) return cachedOrgInfo;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OrgInfo;
    if (parsed && typeof parsed === "object") {
      cachedOrgInfo = {
        organization: parsed.organization || "",
        branch: parsed.branch || "",
        organization_address: parsed.organization_address || "",
        branch_address: parsed.branch_address || "",
        loadedAt: parsed.loadedAt || Date.now(),
      };
      return cachedOrgInfo;
    }
  } catch (_) {}
  return null;
}

export function setOrgInfo(info: OrgInfo) {
  cachedOrgInfo = info;
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(info));
  } catch (_) {}
}

export function clearOrgInfo() {
  cachedOrgInfo = null;
  try {
    localStorage.removeItem(LOCAL_STORAGE_KEY);
  } catch (_) {}
}

export function mergeOrgInfoFromDashboardPayload(payload: unknown): OrgInfo | null {
  if (!payload || typeof payload !== "object") return getOrgInfoSync();
  const info = extractOrgInfoFromDashboardPayload(payload, getOrgInfoSync());
  setOrgInfo(info);
  return info;
}

export async function fetchOrgInfo(
  apiBaseUrl?: string,
  token?: string
): Promise<OrgInfo | null> {
  const baseUrl = apiBaseUrl || import.meta.env.VITE_BASE_URL;
  const accessToken = token || AuthService.getAccessToken();
  if (!baseUrl || !accessToken) return getOrgInfoSync();

  try {
    const res = await fetch(`${baseUrl}/api/dashboard-data/`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      credentials: "include",
      body: JSON.stringify({
        object_name: "user_info",
        date: todayIsoDate(),
      }),
    });
    if (!res.ok) return getOrgInfoSync();
    const data = await res.json();
    return mergeOrgInfoFromDashboardPayload(data);
  } catch (_) {
    return getOrgInfoSync();
  }
}
