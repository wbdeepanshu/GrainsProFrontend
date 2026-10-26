import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'
import { ADD_EXPENSE_PATH, EXPENSE_LIST_PATH } from '@/lib/appShortcuts'

const EXPENSE_CHORD_PATHS = {
  c: ADD_EXPENSE_PATH,
}

/** Ctrl+E → Expense list; Ctrl+E, C → Add expense */
export function useExpenseNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'e',
    listPath: EXPENSE_LIST_PATH,
    chordPaths: EXPENSE_CHORD_PATHS,
  })
}
