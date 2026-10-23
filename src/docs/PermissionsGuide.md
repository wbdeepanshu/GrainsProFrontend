# Centralized User Permissions System

This guide explains how to use the centralized user permissions system across all JSX screens in the application.

## Overview

The permissions system consists of:
- **`useUserPermissions` Hook**: Centralized hook for fetching user permissions
- **`permissions.ts`**: Utility functions and predefined permission constants
- **API Integration**: Automatic caching and error handling

## Quick Start

### 1. Import the Hook

```tsx
import { useUserPermissions } from '@/hooks/useUserPermissions';
import { PERMISSIONS } from '@/lib/permissions';
```

### 2. Use in Your Component

```tsx
const MyComponent = () => {
  const { 
    permissions, 
    isLoading, 
    error, 
    hasPermission, 
    hasModuleAccess 
  } = useUserPermissions();

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      {hasPermission('inward', 'create') && (
        <Button>Create Inward</Button>
      )}
    </div>
  );
};
```

## API Reference

### useUserPermissions Hook

Returns an object with the following properties:

```tsx
{
  permissions: UserPermission[];     // Array of user permissions
  isLoading: boolean;               // Loading state
  error: Error | null;              // Error state
  refetch: () => void;              // Function to refetch permissions
  hasPermission: (module: string, action: string) => boolean;
  hasModuleAccess: (module: string) => boolean;
  getPermissionsByModule: (module: string) => UserPermission[];
}
```

### Permission Methods

#### hasPermission(module, action)
Check if user has a specific permission.

```tsx
const canCreateInward = hasPermission('inward', 'create');
```

#### hasModuleAccess(module)
Check if user has access to a module.

```tsx
const hasInwardAccess = hasModuleAccess('inward');
```

#### getPermissionsByModule(module)
Get all permissions for a specific module.

```tsx
const inwardPermissions = getPermissionsByModule('inward');
```

## Predefined Permissions

Use predefined permission constants for consistency:

```tsx
import { PERMISSIONS } from '@/lib/permissions';

// Instead of strings
hasPermission('inward', 'create')

// Use constants
hasPermission(PERMISSIONS.INWARD_CREATE.module, PERMISSIONS.INWARD_CREATE.action)
```

Available permission modules:
- `dashboard`
- `inward`
- `receipt`
- `purchase_order`
- `hamali`
- `expense`
- `route`
- `user`
- `reports`

## Common Usage Patterns

### 1. Conditional Rendering

```tsx
{hasPermission('inward', 'create') && (
  <Button onClick={handleCreate}>Create Inward</Button>
)}
```

### 2. Disable Buttons

```tsx
<Button 
  disabled={!hasPermission('inward', 'edit')}
  onClick={handleEdit}
>
  Edit Inward
</Button>
```

### 3. Module Access Check

```tsx
{hasModuleAccess('inward') ? (
  <InwardModule />
) : (
  <AccessDenied />
)}
```

### 4. Multiple Permission Check

```tsx
const canManageInward = hasPermission('inward', 'create') || 
                       hasPermission('inward', 'edit') || 
                       hasPermission('inward', 'delete');
```

## Implementation in Different Screens

### Dashboard
```tsx
// Already implemented in dashboard.tsx
const { permissions, hasPermission } = useUserPermissions();
```

### Add Inward Screen
```tsx
import { useUserPermissions } from '@/hooks/useUserPermissions';

const AddInward = () => {
  const { hasPermission } = useUserPermissions();
  
  return (
    <div>
      {hasPermission('inward', 'create') ? (
        <InwardForm />
      ) : (
        <AccessDenied />
      )}
    </div>
  );
};
```

### Receipt List Screen
```tsx
import { useUserPermissions } from '@/hooks/useUserPermissions';

const ReceiptList = () => {
  const { hasPermission } = useUserPermissions();
  
  return (
    <div>
      <Button 
        disabled={!hasPermission('receipt', 'create')}
        onClick={handleCreate}
      >
        Add Receipt
      </Button>
    </div>
  );
};
```

## Benefits

1. **Centralized**: Single source of truth for permissions
2. **Cached**: Automatic caching with React Query
3. **Consistent**: Same API across all components
4. **Type Safe**: TypeScript support with proper types
5. **Performance**: Optimized with stale time and retry logic
6. **Error Handling**: Built-in error handling and retry mechanisms

## Migration Guide

To migrate existing permission checks:

### Before (Old Way)
```tsx
// Direct API calls in each component
const [permissions, setPermissions] = useState([]);
useEffect(() => {
  fetch('/api/get-user-permissions/')
    .then(res => res.json())
    .then(data => setPermissions(data));
}, []);
```

### After (New Way)
```tsx
// Use centralized hook
const { permissions, hasPermission } = useUserPermissions();
```

## Troubleshooting

### Common Issues

1. **Permissions not loading**: Check if user is authenticated
2. **Type errors**: Ensure proper TypeScript types are imported
3. **Caching issues**: Use `refetch()` to force reload permissions

### Debug Mode

Enable debug logging by checking browser console for permission data:

```tsx
console.log('User permissions:', permissions);
console.log('Has inward create:', hasPermission('inward', 'create'));
```
