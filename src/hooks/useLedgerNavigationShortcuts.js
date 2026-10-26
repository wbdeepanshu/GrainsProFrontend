import { useSingleKeyNavigationShortcut } from '@/hooks/useChordNavigationShortcut'

export const LEDGER_MASTERS_PATH = '/ledger-masters'

/** Ctrl+L → Ledger masters */
export function useLedgerNavigationShortcuts({ enabled = true } = {}) {
  useSingleKeyNavigationShortcut({
    enabled,
    shortcutKey: 'l',
    path: LEDGER_MASTERS_PATH,
  })
}
