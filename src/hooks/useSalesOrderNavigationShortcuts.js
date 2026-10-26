import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'

export const SALES_ORDER_LIST_PATH = '/reports/sales-order-list'
export const CREATE_SALES_ORDER_PATH = '/create-sales-order'
export const ITEM_MASTERS_PATH = '/item-masters'

const SALES_ORDER_CHORD_PATHS = {
  c: CREATE_SALES_ORDER_PATH,
  i: ITEM_MASTERS_PATH,
}

/**
 * - Ctrl+S → Sales order list
 * - Ctrl+S, C → Create sales order
 * - Ctrl+S, I → Item masters
 */
export function useSalesOrderNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 's',
    listPath: SALES_ORDER_LIST_PATH,
    chordPaths: SALES_ORDER_CHORD_PATHS,
  })
}
