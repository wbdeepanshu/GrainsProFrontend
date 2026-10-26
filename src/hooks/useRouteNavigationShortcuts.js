import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'
import {
  CREATE_ROUTE_PATH,
  ROUTE_ASSIGNMENT_PATH,
} from '@/lib/appShortcuts'

/**
 * - Ctrl+R → Route assignment
 * - Ctrl+R, C → Create route
 */
export function useRouteNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'r',
    listPath: ROUTE_ASSIGNMENT_PATH,
    createPath: CREATE_ROUTE_PATH,
  })
}
