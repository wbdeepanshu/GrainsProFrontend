import { UserPermission } from "@/hooks/useUserPermissions";

/**
 * Permission utility functions for centralized permission management
 */

export interface PermissionConfig {
  module: string;
  action: string;
  description?: string;
}

// Define all available permissions in your system
export const PERMISSIONS = {
  // Dashboard permissions
  DASHBOARD_VIEW: { module: 'dashboard', action: 'view' },
  DASHBOARD_EDIT: { module: 'dashboard', action: 'edit' },
  
  // Inward permissions
  INWARD_VIEW: { module: 'inward', action: 'view' },
  INWARD_CREATE: { module: 'inward', action: 'create' },
  INWARD_EDIT: { module: 'inward', action: 'edit' },
  INWARD_DELETE: { module: 'inward', action: 'delete' },
  
  // Receipt permissions
  RECEIPT_VIEW: { module: 'receipt', action: 'view' },
  RECEIPT_CREATE: { module: 'receipt', action: 'create' },
  RECEIPT_EDIT: { module: 'receipt', action: 'edit' },
  RECEIPT_DELETE: { module: 'receipt', action: 'delete' },
  
  // Purchase Order permissions
  PURCHASE_ORDER_VIEW: { module: 'purchase_order', action: 'view' },
  PURCHASE_ORDER_CREATE: { module: 'purchase_order', action: 'create' },
  PURCHASE_ORDER_EDIT: { module: 'purchase_order', action: 'edit' },
  PURCHASE_ORDER_DELETE: { module: 'purchase_order', action: 'delete' },
  
  // Hamali permissions
  HAMALI_VIEW: { module: 'hamali', action: 'view' },
  HAMALI_CREATE: { module: 'hamali', action: 'create' },
  HAMALI_EDIT: { module: 'hamali', action: 'edit' },
  HAMALI_DELETE: { module: 'hamali', action: 'delete' },
  
  // Expense permissions
  EXPENSE_VIEW: { module: 'expense', action: 'view' },
  EXPENSE_CREATE: { module: 'expense', action: 'create' },
  EXPENSE_EDIT: { module: 'expense', action: 'edit' },
  EXPENSE_DELETE: { module: 'expense', action: 'delete' },
  
  // Route permissions
  ROUTE_VIEW: { module: 'route', action: 'view' },
  ROUTE_CREATE: { module: 'route', action: 'create' },
  ROUTE_EDIT: { module: 'route', action: 'edit' },
  ROUTE_DELETE: { module: 'route', action: 'delete' },
  
  // User permissions
  USER_VIEW: { module: 'user', action: 'view' },
  USER_CREATE: { module: 'user', action: 'create' },
  USER_EDIT: { module: 'user', action: 'edit' },
  USER_DELETE: { module: 'user', action: 'delete' },
  
  // Reports permissions
  REPORTS_VIEW: { module: 'reports', action: 'view' },
  REPORTS_EXPORT: { module: 'reports', action: 'export' },
} as const;

/**
 * Check if user has specific permission
 */
export const hasPermission = (
  userPermissions: UserPermission[],
  module: string,
  action: string
): boolean => {
  return userPermissions.some(permission => 
    permission.module === module && permission.action === action
  );
};

/**
 * Check if user has access to a specific module
 */
export const hasModuleAccess = (
  userPermissions: UserPermission[],
  module: string
): boolean => {
  return userPermissions.some(permission => permission.module === module);
};

/**
 * Get all permissions for a specific module
 */
export const getPermissionsByModule = (
  userPermissions: UserPermission[],
  module: string
): UserPermission[] => {
  return userPermissions.filter(permission => permission.module === module);
};

/**
 * Check if user has any of the specified permissions
 */
export const hasAnyPermission = (
  userPermissions: UserPermission[],
  permissions: PermissionConfig[]
): boolean => {
  return permissions.some(permission => 
    hasPermission(userPermissions, permission.module, permission.action)
  );
};

/**
 * Check if user has all of the specified permissions
 */
export const hasAllPermissions = (
  userPermissions: UserPermission[],
  permissions: PermissionConfig[]
): boolean => {
  return permissions.every(permission => 
    hasPermission(userPermissions, permission.module, permission.action)
  );
};

/**
 * Get user's role-based permissions
 */
export const getRolePermissions = (userPermissions: UserPermission[]): string[] => {
  const modules = [...new Set(userPermissions.map(p => p.module))];
  return modules;
};

export default {
  PERMISSIONS,
  hasPermission,
  hasModuleAccess,
  getPermissionsByModule,
  hasAnyPermission,
  hasAllPermissions,
  getRolePermissions,
};
