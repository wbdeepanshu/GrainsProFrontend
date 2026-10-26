/** Central registry for in-app keyboard shortcuts and the shortcuts help page. */

export const KEYBOARD_SHORTCUTS_PATH = '/keyboard-shortcuts'

export const DASHBOARD_PATH = '/dashboard'
export const ROUTE_MANAGEMENT_PATH = '/route-management'
export const ROUTE_ASSIGNMENT_PATH = '/route-assignment'
export const CREATE_ROUTE_PATH = '/route-management?create=1'
export const EXPENSE_LIST_PATH = '/reports/expense-list'
export const ADD_EXPENSE_PATH = '/add-expense'
export const OUTWARD_LIST_PATH = '/outward/outward-list'
export const ADD_OUTWARD_PATH = '/outward/add-outward'
export const DELIVERY_NOTES_PATH = '/outward/delivery-notes'

export const APP_SHORTCUT_GROUPS = [
  {
    id: 'general',
    title: 'General',
    shortcuts: [
      {
        id: 'dashboard',
        label: 'Dashboard',
        keys: ['Ctrl', 'H'],
        path: DASHBOARD_PATH,
      },
      {
        id: 'dashboard-shift',
        label: 'Dashboard',
        keys: ['Shift', 'D'],
        path: DASHBOARD_PATH,
      },
    ],
  },
  {
    id: 'sales',
    title: 'Sales',
    shortcuts: [
      {
        id: 'sales-list',
        label: 'Sales order list',
        keys: ['Ctrl', 'S'],
        path: '/reports/sales-order-list',
      },
      {
        id: 'sales-create',
        label: 'Create sales order',
        keys: ['Ctrl', 'S', 'C'],
        path: '/create-sales-order',
      },
      {
        id: 'item-masters',
        label: 'Item masters',
        keys: ['Ctrl', 'S', 'I'],
        path: '/item-masters',
      },
    ],
  },
  {
    id: 'purchase',
    title: 'Purchase',
    shortcuts: [
      {
        id: 'purchase-list',
        label: 'Purchase order list',
        keys: ['Ctrl', 'P'],
        path: '/reports/purchaseorders-reports',
      },
      {
        id: 'purchase-create',
        label: 'Create purchase order',
        keys: ['Ctrl', 'P', 'C'],
        path: '/add-purchase-order',
      },
    ],
  },
  {
    id: 'masters',
    title: 'Masters',
    shortcuts: [
      {
        id: 'ledger-masters',
        label: 'Ledger masters',
        keys: ['Ctrl', 'L'],
        path: '/ledger-masters',
      },
      {
        id: 'base-price',
        label: 'Base price master',
        keys: ['Ctrl', 'B', 'P'],
        path: '/item-listing',
      },
    ],
  },
  {
    id: 'inward-outward',
    title: 'Inward & outward',
    shortcuts: [
      {
        id: 'inward-list',
        label: 'Inward entry',
        keys: ['Ctrl', 'I'],
        path: '/reports/inward-list',
      },
      {
        id: 'inward-create',
        label: 'Add inward entry',
        keys: ['Ctrl', 'I', 'C'],
        path: '/add-inward',
      },
      {
        id: 'outward-list',
        label: 'Outward list (delivery notes)',
        keys: ['Ctrl', 'G'],
        path: OUTWARD_LIST_PATH,
      },
      {
        id: 'outward-create',
        label: 'Add outward (gate pass)',
        keys: ['Ctrl', 'G', 'C'],
        path: ADD_OUTWARD_PATH,
      },
      {
        id: 'delivery-notes',
        label: 'Delivery notes (sales order invoices)',
        keys: ['Ctrl', 'D'],
        path: DELIVERY_NOTES_PATH,
      },
      {
        id: 'delivery-notes-add-outward',
        label: 'Add outward (gate pass)',
        keys: ['Ctrl', 'D', 'C'],
        path: ADD_OUTWARD_PATH,
      },
    ],
  },
  {
    id: 'users-routes',
    title: 'Users & routes',
    shortcuts: [
      {
        id: 'user-list',
        label: 'User list',
        keys: ['Ctrl', 'U'],
        path: '/users',
      },
      {
        id: 'user-create',
        label: 'Add user',
        keys: ['Ctrl', 'U', 'C'],
        path: '/add-user',
      },
      {
        id: 'route-assignment',
        label: 'Route assignment',
        keys: ['Ctrl', 'R'],
        path: ROUTE_ASSIGNMENT_PATH,
      },
      {
        id: 'route-create',
        label: 'Create route',
        keys: ['Ctrl', 'R', 'C'],
        path: CREATE_ROUTE_PATH,
      },
    ],
  },
  {
    id: 'expense',
    title: 'Expense',
    shortcuts: [
      {
        id: 'expense-list',
        label: 'Expense list',
        keys: ['Ctrl', 'E'],
        path: EXPENSE_LIST_PATH,
      },
      {
        id: 'expense-create',
        label: 'Add expense',
        keys: ['Ctrl', 'E', 'C'],
        path: ADD_EXPENSE_PATH,
      },
    ],
  },
]

export const APP_SHORTCUTS = APP_SHORTCUT_GROUPS.flatMap((group) =>
  group.shortcuts.map((shortcut) => ({ ...shortcut, group: group.title })),
)
