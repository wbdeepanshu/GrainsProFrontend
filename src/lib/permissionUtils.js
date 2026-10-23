import { AuthService } from './auth';

// Cache for user permissions
let userPermissions = null;
let permissionsLoaded = false;

/**
 * Fetch user permissions from API
 */
export const fetchUserPermissions = async () => {
  try {
    const token = AuthService.getAccessToken();
    if (!token) {
      throw new Error('No authentication token found');
    }

    const API_BASE_URL = import.meta.env.VITE_BASE_URL;
    const response = await fetch(`${API_BASE_URL}/api/get-user-permissions/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch permissions: ${response.status}`);
    }

    const data = await response.json();
    userPermissions = data.data || [];
    permissionsLoaded = true;
    return userPermissions;
  } catch (error) {
    console.error('Error fetching user permissions:', error);
    userPermissions = [];
    permissionsLoaded = true;
    return [];
  }
};

/**
 * Check if user has specific permission for a module
 * @param {string} moduleName - The module name (e.g., 'inward', 'user_management')
 * @param {string} permission - The permission letter ('c', 'r', 'u', 'd')
 * @returns {boolean}
 */
export const hasPermission = (moduleName, permission) => {
  if (!permissionsLoaded || !userPermissions) {
    return false;
  }

  const modulePermission = userPermissions.find(p => 
    p.module_name.toLowerCase() === moduleName.toLowerCase() || 
    p.alias === moduleName
  );
  
  return modulePermission?.permission_summary?.includes(permission) || false;
};

/**
 * Check if user can read (list) a module
 */
export const canRead = (moduleName) => hasPermission(moduleName, 'r');

/**
 * Check if user can create (add) in a module
 */
export const canCreate = (moduleName) => hasPermission(moduleName, 'c');

/**
 * Check if user can update (edit) a module
 */
export const canUpdate = (moduleName) => hasPermission(moduleName, 'u');

/**
 * Check if user can delete in a module
 */
export const canDelete = (moduleName) => hasPermission(moduleName, 'd');

/**
 * Initialize permissions - call this when app starts or user logs in
 */
export const initializePermissions = async () => {
  await fetchUserPermissions();
};

/**
 * Clear permissions - call this when user logs out
 */
export const clearPermissions = () => {
  userPermissions = null;
  permissionsLoaded = false;
};

/**
 * Get all permissions for a module in a simple object
 * @param {string} moduleName - The module name
 * @returns {object} - Object with canRead, canCreate, canUpdate, canDelete
 */
export const getModulePermissions = (moduleName) => {
  // If permissions are not loaded, return all false to prevent access
  if (!permissionsLoaded) {
    return {
      canRead: false,
      canCreate: false,
      canUpdate: false,
      canDelete: false
    };
  }
  
  return {
    canRead: canRead(moduleName),
    canCreate: canCreate(moduleName),
    canUpdate: canUpdate(moduleName),
    canDelete: canDelete(moduleName)
  };
};

/**
 * Check if permissions are loaded
 * @returns {boolean}
 */
export const arePermissionsLoaded = () => {
  return permissionsLoaded;
};
