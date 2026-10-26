import { useDashboardNavigationShortcuts } from '@/hooks/useDashboardNavigationShortcuts'
import { useSalesOrderNavigationShortcuts } from '@/hooks/useSalesOrderNavigationShortcuts'
import { usePurchaseOrderNavigationShortcuts } from '@/hooks/usePurchaseOrderNavigationShortcuts'
import { useLedgerNavigationShortcuts } from '@/hooks/useLedgerNavigationShortcuts'
import { useBasePriceNavigationShortcuts } from '@/hooks/useBasePriceNavigationShortcuts'
import { useInwardNavigationShortcuts } from '@/hooks/useInwardNavigationShortcuts'
import { useDeliveryOutwardNavigationShortcuts } from '@/hooks/useDeliveryOutwardNavigationShortcuts'
import { useOutwardNavigationShortcuts } from '@/hooks/useOutwardNavigationShortcuts'
import { useUserNavigationShortcuts } from '@/hooks/useUserNavigationShortcuts'
import { useRouteNavigationShortcuts } from '@/hooks/useRouteNavigationShortcuts'
import { useExpenseNavigationShortcuts } from '@/hooks/useExpenseNavigationShortcuts'

/**
 * Registers global page-navigation keyboard shortcuts (same chords as MWB ERP).
 * Mount only for authenticated app shell sessions.
 */
export default function AppNavigationShortcuts() {
  useDashboardNavigationShortcuts()
  useSalesOrderNavigationShortcuts()
  usePurchaseOrderNavigationShortcuts()
  useLedgerNavigationShortcuts()
  useBasePriceNavigationShortcuts()
  useInwardNavigationShortcuts()
  useExpenseNavigationShortcuts()
  useOutwardNavigationShortcuts()
  useDeliveryOutwardNavigationShortcuts()
  useUserNavigationShortcuts()
  useRouteNavigationShortcuts()
  return null
}
