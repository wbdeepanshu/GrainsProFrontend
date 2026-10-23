import { Loader2, Save, X } from 'lucide-react'
import GatePassGodownItemCard from '@/components/outward/GatePassGodownItemCard'

export default function UpdateLoadingQtyModal({
  open,
  item,
  onClose,
  onSave,
  isSaving = false,
  error = null,
  godownOptions = [],
  supervisorOptions = [],
  onUpdateLoadedQty,
  onUpdateGodownRow,
}) {
  if (!open || !item) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 bg-brand-gradient text-white shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="font-semibold text-lg leading-snug">Update loading qty</h2>
              <p className="text-sm text-white/80 mt-0.5 truncate">{item.stock_item_name}</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 shrink-0"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5 overflow-y-auto flex-1 bg-slate-50/50 space-y-4">
          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}
          <GatePassGodownItemCard
            item={item}
            readOnly={false}
            lockStartTime
            allowInlineLoadedEdit
            godownOptions={godownOptions}
            supervisorOptions={supervisorOptions}
            onUpdateLoadedQty={onUpdateLoadedQty}
            onUpdateGodownRow={onUpdateGodownRow}
          />
        </div>

        <div className="px-5 py-4 border-t border-slate-100 bg-white flex justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-brand text-sm font-semibold disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
          >
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Loading
          </button>
        </div>
      </div>
    </div>
  )
}
