import { useSingleKeyNavigationShortcut } from '@/hooks/useChordNavigationShortcut'
import { DASHBOARD_PATH } from '@/lib/appShortcuts'

export { DASHBOARD_PATH }

/** Ctrl+H or Shift+D → Dashboard */
export function useDashboardNavigationShortcuts({ enabled = true } = {}) {
  useSingleKeyNavigationShortcut({
    enabled,
    shortcutKey: 'h',
    path: DASHBOARD_PATH,
  })

  useSingleKeyNavigationShortcut({
    enabled,
    shortcutKey: 'd',
    path: DASHBOARD_PATH,
    requireShift: true,
    requireCtrl: false,
  })
}
