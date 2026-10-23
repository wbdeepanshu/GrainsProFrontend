// Admin settings cache from /api/superadmin/get-admin-settings/
// Stored in localStorage keyed by setting key for use across the app.

import { AuthService } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SETTINGS_PAYLOAD_KEY = "cp_admin_settings_payload";
const SETTINGS_KEY_PREFIX = "cp_admin_setting_";

export type AdminSettingItem = {
  id: number;
  key: string;
  key_name?: string;
  name: string;
  module_name: string | null;
  module_id?: number | null;
  description?: string | null;
  is_live?: boolean;
  is_disabled: boolean;
  is_enabled?: boolean;
};

export type AdminSettingsUserInfo = {
  user_id: string;
  user_name: string;
  role_id: number | null;
  organization_id: string;
  organization_name: string;
};

export type AdminSettingsCache = {
  settings: Record<string, AdminSettingItem>;
  user_info: AdminSettingsUserInfo | null;
  loadedAt: number;
};

let cachedSettings: AdminSettingsCache | null = null;

function clearAdminSettingKeys(): void {
  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key === SETTINGS_PAYLOAD_KEY || key.startsWith(SETTINGS_KEY_PREFIX))) {
      keysToRemove.push(key);
    }
  }
  keysToRemove.forEach((key) => localStorage.removeItem(key));
}

export function storeAdminSettings(
  data: AdminSettingItem[],
  userInfo: AdminSettingsUserInfo | null = null
): AdminSettingsCache {
  clearAdminSettingKeys();

  const settings: Record<string, AdminSettingItem> = {};
  for (const item of data) {
    const key = item?.key || item?.key_name;
    if (!key) continue;
    const normalized = { ...item, key };
    settings[key] = normalized;
    try {
      localStorage.setItem(`${SETTINGS_KEY_PREFIX}${key}`, JSON.stringify(normalized));
    } catch (_) {}
  }

  const cache: AdminSettingsCache = {
    settings,
    user_info: userInfo,
    loadedAt: Date.now(),
  };

  cachedSettings = cache;
  try {
    localStorage.setItem(SETTINGS_PAYLOAD_KEY, JSON.stringify(cache));
  } catch (_) {}

  return cache;
}

export function clearAdminSettings(): void {
  cachedSettings = null;
  clearAdminSettingKeys();
}

export function getAdminSettingsSync(): AdminSettingsCache | null {
  if (cachedSettings) return cachedSettings;

  try {
    const raw = localStorage.getItem(SETTINGS_PAYLOAD_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AdminSettingsCache;
    if (parsed && typeof parsed === "object" && parsed.settings) {
      cachedSettings = parsed;
      return cachedSettings;
    }
  } catch (_) {}

  return null;
}

export function getAdminSetting(key: string): AdminSettingItem | null {
  const fromCache = getAdminSettingsSync()?.settings?.[key];
  if (fromCache) return fromCache;

  try {
    const raw = localStorage.getItem(`${SETTINGS_KEY_PREFIX}${key}`);
    if (!raw) return null;
    return JSON.parse(raw) as AdminSettingItem;
  } catch (_) {}

  return null;
}

export function isAdminSettingDisabled(key: string): boolean {
  return getAdminSetting(key)?.is_disabled === true;
}

export function isAdminSettingEnabled(key: string): boolean {
  const setting = getAdminSetting(key);
  if (!setting) return false;
  if (setting.is_enabled !== undefined && setting.is_enabled !== null) {
    return Boolean(setting.is_enabled);
  }
  return !setting.is_disabled;
}

export function getAllAdminSettingsFromStorage(): AdminSettingItem[] {
  const fromCache = getAdminSettingsSync()?.settings;
  if (fromCache) return Object.values(fromCache);

  const items: AdminSettingItem[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const storageKey = localStorage.key(i);
    if (!storageKey?.startsWith(SETTINGS_KEY_PREFIX)) continue;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) items.push(JSON.parse(raw) as AdminSettingItem);
    } catch (_) {}
  }
  return items;
}

export function getAdminSettingByName(name: string): AdminSettingItem | null {
  const normalized = name.trim().toLowerCase();
  if (!normalized) return null;

  return (
    getAllAdminSettingsFromStorage().find(
      (setting) => (setting.name || "").trim().toLowerCase() === normalized
    ) ?? null
  );
}

/** When setting is missing, defaults to enabled (show / allow). */
export function isAdminSettingEnabledByName(name: string): boolean {
  const setting = getAdminSettingByName(name);
  if (!setting) return true;
  if (setting.is_enabled !== undefined && setting.is_enabled !== null) {
    return Boolean(setting.is_enabled);
  }
  return !setting.is_disabled;
}

export async function fetchAndStoreAdminSettings(
  token?: string | null
): Promise<AdminSettingsCache | null> {
  const authToken = token ?? AuthService.getAccessToken();
  if (!authToken) return null;

  try {
    const response = await fetch(`${API_BASE_URL}/api/superadmin/get-admin-settings/`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      return getAdminSettingsSync();
    }

    const data = await response.json();
    if (data?.status === 200 && Array.isArray(data.data)) {
      return storeAdminSettings(data.data, data.user_info ?? null);
    }
  } catch (error) {
    console.error("Error fetching admin settings:", error);
  }

  return getAdminSettingsSync();
}
