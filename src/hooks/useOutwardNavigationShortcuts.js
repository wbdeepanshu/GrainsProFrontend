import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'

export const OUTWARD_LIST_PATH = '/outward/outward-list'
export const ADD_OUTWARD_PATH = '/outward/add-outward'

/**
 * - Ctrl+G → Outward / delivery note list
 * - Ctrl+G, C → Add outward (gate pass)
 */
export function useOutwardNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'g',
    listPath: OUTWARD_LIST_PATH,
    createPath: ADD_OUTWARD_PATH,
  })
}
