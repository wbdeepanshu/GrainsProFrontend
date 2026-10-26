import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'

export const BASE_PRICE_MASTER_PATH = '/item-listing'

const BASE_PRICE_CHORD_PATHS = {
  p: BASE_PRICE_MASTER_PATH,
}

/** Ctrl+B, P → Base price master (item listing) */
export function useBasePriceNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'b',
    chordPaths: BASE_PRICE_CHORD_PATHS,
  })
}
