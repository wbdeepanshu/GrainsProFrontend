import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'

export const PURCHASE_ORDER_LIST_PATH = '/reports/purchaseorders-reports'
export const CREATE_PURCHASE_ORDER_PATH = '/add-purchase-order'

/**
 * - Ctrl+P → Purchase order list
 * - Ctrl+P, C → Create purchase order
 */
export function usePurchaseOrderNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'p',
    listPath: PURCHASE_ORDER_LIST_PATH,
    createPath: CREATE_PURCHASE_ORDER_PATH,
  })
}
