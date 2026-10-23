import { useQuery } from "@tanstack/react-query";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

const API_BASE_URL = (import.meta as any).env.VITE_BASE_URL;

interface UserPermission {
  id: number;
  module_name: string;
  alias: string;
  permission_summary: string[];
}

interface UserInfo {
  name: string;
  mobile: string;
  email: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  branch: string;
  password: string;
  role_id: number;
}

interface UserPermissionsResponse {
  status: number;
  message: string;
  data: UserPermission[];
  module_mappings: any[];
  user_info: UserInfo;
}

/**
 * Centralized hook for fetching user permissions
 * Can be used across all components and screens
 */


export const useUserPermissions = () => {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ['user-permissions'],
    queryFn: async (): Promise<UserPermissionsResponse> => {
      // const response = await apiRequest('GET', 'http://192.168.1.193:8096/api/get-user-permissions/');
      const response = await apiRequest(
        'GET',
        `${API_BASE_URL}/api/get-user-permissions/`
      );
     
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 3,
    retryDelay: 1000,
  });

  // Debug: Log permissions data
  if (data?.data) {
    // console.log("User permissions data:", data.data);
  }

  return {
    permissions: data?.data || [],
    userInfo: data?.user_info || null,
    isLoading,
    error,
    refetch,
    hasPermission: (module: string, action: string) => {
      if (!data?.data) return false;
      
      const searchModule = module.toLowerCase();
      const modulePermission = data.data.find(permission => {
        const alias = (permission.alias || "").toString().toLowerCase();
        const moduleName = (permission.module_name || "").toString().toLowerCase();
        return alias === searchModule || moduleName === searchModule;
      });
      
      if (!modulePermission) {
        // console.log(`No permission found for module: ${module}, action: ${action}`);
        return false;
      }
      
      // Map action strings to permission codes
      const actionMap: { [key: string]: string } = {
        'create': 'c',
        'read': 'r', 
        'update': 'u',
        'delete': 'd'
      };
      
      const permissionCode = actionMap[action.toLowerCase()];
      const summary = Array.isArray(modulePermission.permission_summary)
        ? modulePermission.permission_summary.map((p: string) => String(p).toLowerCase())
        : [];
      const hasPermission = summary.includes(permissionCode);
      // console.log(`Permission check for ${module}:${action}:`, { 
      //   modulePermission, 
      //   permissionCode, 
      //   hasPermission,
      //   permissionSummary: modulePermission.permission_summary 
      // });
      return hasPermission;
    },
    hasModuleAccess: (module: string) => {
      if (!data?.data) return false;
      const hasAccess = data.data.some(permission => {
        const alias = permission.alias.toLowerCase();
        const searchModule = module.toLowerCase();
        
        // Only exact match
        return alias === searchModule;
      });
      // console.log(`Module access check for ${module}:`, { hasAccess, module });
      return hasAccess;
    },
    getPermissionsByModule: (module: string) => {
      if (!data?.data) return [];
      return data.data.filter(permission => permission.alias === module);
    },
    hasCreatePermission: (module: string) => {
      if (!data?.data) return false;
      const modulePermission = data.data.find(permission => {
        const alias = permission.alias.toLowerCase();
        const searchModule = module.toLowerCase();
        
        // Only exact match
        return alias === searchModule;
      });
      return modulePermission?.permission_summary.includes('c') || false;
    },
    hasReadPermission: (module: string) => {
      if (!data?.data) return false;
      const modulePermission = data.data.find(permission => {
        const alias = permission.alias.toLowerCase();
        const searchModule = module.toLowerCase();
        
        // Only exact match
        return alias === searchModule;
      });
      return modulePermission?.permission_summary.includes('r') || false;
    },
    hasUpdatePermission: (module: string) => {
      if (!data?.data) return false;
      const modulePermission = data.data.find(permission => {
        const alias = permission.alias.toLowerCase();
        const searchModule = module.toLowerCase();
        
        // Only exact match
        return alias === searchModule;
      });
      return modulePermission?.permission_summary.includes('u') || false;
    },
    hasDeletePermission: (module: string) => {
      if (!data?.data) return false;
      const modulePermission = data.data.find(permission => {
        const alias = permission.alias.toLowerCase();
        const searchModule = module.toLowerCase();
        
        // Only exact match
        return alias === searchModule;
      });
      return modulePermission?.permission_summary.includes('d') || false;
    }
  };
};

export default useUserPermissions;
