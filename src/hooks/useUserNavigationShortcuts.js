import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'

export const USER_LIST_PATH = '/users'
export const ADD_USER_PATH = '/add-user'

const USER_CHORD_PATHS = {
  c: ADD_USER_PATH,
}

/** Ctrl+U → User list; Ctrl+U, C → Add user */
export function useUserNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'u',
    listPath: USER_LIST_PATH,
    chordPaths: USER_CHORD_PATHS,
  })
}
