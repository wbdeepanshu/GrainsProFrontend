import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'

export const INWARD_LIST_PATH = '/reports/inward-list'
export const ADD_INWARD_PATH = '/add-inward'

/**
 * - Ctrl+I → Inward entry list
 * - Ctrl+I, C → Add inward entry
 */
export function useInwardNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'i',
    listPath: INWARD_LIST_PATH,
    createPath: ADD_INWARD_PATH,
  })
}
