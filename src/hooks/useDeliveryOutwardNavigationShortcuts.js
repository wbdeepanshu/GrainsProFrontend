import { useChordNavigationShortcut } from '@/hooks/useChordNavigationShortcut'
import { ADD_OUTWARD_PATH } from '@/lib/appShortcuts'

export const DELIVERY_NOTES_PATH = '/outward/delivery-notes'

// N is kept as an alias, but Chrome reserves Ctrl+N (opens a new window) and a
// page cannot cancel it, so C is the combo that works with Ctrl still held.
const DELIVERY_CHORD_PATHS = {
  n: ADD_OUTWARD_PATH,
}

/** Ctrl+D → Delivery notes (sales order invoices); Ctrl+D, C → Add outward */
export function useDeliveryOutwardNavigationShortcuts({ enabled = true } = {}) {
  useChordNavigationShortcut({
    enabled,
    prefixKey: 'd',
    listPath: DELIVERY_NOTES_PATH,
    createPath: ADD_OUTWARD_PATH,
    chordPaths: DELIVERY_CHORD_PATHS,
  })
}
