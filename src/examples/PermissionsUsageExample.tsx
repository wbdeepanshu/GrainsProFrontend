import React from 'react';
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { PERMISSIONS } from '@/lib/permissions';
import { Button } from '@/components/ui/button';

/**
 * Example component showing how to use the centralized permissions hook
 * This can be used as a reference for implementing permissions in other components
 */
const PermissionsUsageExample: React.FC = () => {
  const { 
    permissions, 
    isLoading, 
    error, 
    hasPermission, 
    hasModuleAccess,
    getPermissionsByModule 
  } = useUserPermissions();

  if (isLoading) {
    return <div>Loading permissions...</div>;
  }

  if (error) {
    return <div>Error loading permissions: {error.message}</div>;
  }

  return (
    <div className="p-4 space-y-4">
      <h2 className="text-xl font-bold">Permissions Example</h2>
      
      {/* Example 1: Check specific permission */}
      <div>
        <h3 className="font-semibold">Dashboard Access:</h3>
        {hasPermission('dashboard', 'view') ? (
          <Button>Dashboard View Allowed</Button>
        ) : (
          <Button disabled>Dashboard View Denied</Button>
        )}
      </div>

      {/* Example 2: Check module access */}
      <div>
        <h3 className="font-semibold">Inward Module Access:</h3>
        {hasModuleAccess('inward') ? (
          <div className="space-x-2">
            <Button disabled={!hasPermission('inward', 'create')}>
              Create Inward
            </Button>
            <Button disabled={!hasPermission('inward', 'edit')}>
              Edit Inward
            </Button>
            <Button disabled={!hasPermission('inward', 'delete')}>
              Delete Inward
            </Button>
          </div>
        ) : (
          <p>No access to Inward module</p>
        )}
      </div>

      {/* Example 3: Using predefined permissions */}
      <div>
        <h3 className="font-semibold">Using Predefined Permissions:</h3>
        <div className="space-x-2">
          <Button 
            disabled={!hasPermission(PERMISSIONS.RECEIPT_CREATE.module, PERMISSIONS.RECEIPT_CREATE.action)}
          >
            Create Receipt
          </Button>
          <Button 
            disabled={!hasPermission(PERMISSIONS.HAMALI_VIEW.module, PERMISSIONS.HAMALI_VIEW.action)}
          >
            View Hamali
          </Button>
        </div>
      </div>

      {/* Example 4: Get permissions by module */}
      <div>
        <h3 className="font-semibold">Inward Module Permissions:</h3>
        <ul className="list-disc list-inside">
          {getPermissionsByModule('inward').map((permission, index) => (
            <li key={index}>
              {permission.name} - {permission.action}
            </li>
          ))}
        </ul>
      </div>

      {/* Example 5: Show all permissions */}
      <div>
        <h3 className="font-semibold">All User Permissions:</h3>
        <div className="max-h-40 overflow-y-auto">
          {permissions.map((permission, index) => (
            <div key={index} className="text-sm p-2 border-b">
              <strong>{permission.module}</strong> - {permission.action}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default PermissionsUsageExample;
