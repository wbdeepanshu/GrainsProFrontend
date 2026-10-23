import { Package, Pencil, Plus, Trash2, Truck } from 'lucide-react'
import SearchSelectDropdown from '@/components/common/SearchSelectDropdown'
import {
  formatLoadingDuration,
  formatStartTimeDisplay,
  getItemLoadingStatus,
  itemHasLoadingStarted,
  loadingStatusBadgeClass,
  loadingStatusLabel,
} from '@/lib/outward_delivery_helpers'

const smallInputClass =
  'w-full px-2.5 py-2 border border-slate-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-600'

const iconActionPrimaryClass =
  'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-indigo-700 text-white hover:bg-indigo-800 disabled:opacity-50 disabled:cursor-not-allowed'

const iconActionGhostClass =
  'h-9 w-9 inline-flex items-center justify-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed'

function rowGridClass(actionSlots) {
  if (actionSlots <= 0) {
    return 'grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(72px,0.55fr)_minmax(88px,0.7fr)_minmax(150px,1fr)]'
  }
  if (actionSlots === 1) {
    return 'grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(72px,0.55fr)_minmax(88px,0.7fr)_minmax(150px,1fr)_40px]'
  }
  return 'grid-cols-1 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1.4fr)_minmax(72px,0.55fr)_minmax(88px,0.7fr)_minmax(150px,1fr)_84px]'
}

export default function GatePassGodownItemCard({
  item,
  readOnly = false,
  lockStartTime = false,
  allowInlineLoadedEdit = false,
  godownOptions = [],
  supervisorOptions = [],
  onUpdateLoadedQty,
  onUpdateGodownRow,
  onRemoveGodownRow,
  onAddGodownRow,
  onStartLoading,
  onUpdateLoading,
}) {
  const visibleGodowns = (item.godown_quantities || []).filter((gq) => !gq.remove)
  const hasStarted = itemHasLoadingStarted(item)
  const loadingStatus = getItemLoadingStatus(item)
  const firstGq = visibleGodowns[0]
  const duration = formatLoadingDuration(
    firstGq?.start_time || firstGq?.start_time_raw,
    firstGq?.completed_at,
    { useNowIfOpen: loadingStatus === 'loading' || loadingStatus === 'partial' },
  )

  const showStartIcon = Boolean(onStartLoading) && !hasStarted && !readOnly
  const showUpdateIcon = Boolean(onUpdateLoading) && hasStarted && !readOnly
  const canInlineEditLoaded =
    !readOnly && Boolean(onUpdateLoadedQty) && (allowInlineLoadedEdit || !onUpdateLoading)
  const showRemove = Boolean(onRemoveGodownRow) && !readOnly
  const showActions = showUpdateIcon || showRemove
  const actionSlots = (showUpdateIcon ? 1 : 0) + (showRemove ? 1 : 0)
  const canManageRows = !readOnly && (onUpdateLoadedQty || onUpdateGodownRow || onAddGodownRow)

  return (
    <article className="rounded-xl border border-slate-200 bg-white overflow-hidden shadow-sm">
      <div className="px-3 py-2.5 sm:px-4 border-b border-slate-100 bg-gradient-to-r from-white to-indigo-50/30">
        <div className="flex items-start gap-2.5 min-w-0">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-100 text-indigo-700">
            <Package className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <h3 className="text-sm font-semibold text-slate-900 leading-snug truncate">
                  {item.stock_item_name}
                </h3>
                {item.sales_order_sequence != null && item.sales_order_sequence !== '' ? (
                  <span
                    className="shrink-0 inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700"
                    title={`Delivery sequence ${item.sales_order_sequence}`}
                  >
                    Seq {item.sales_order_sequence}
                  </span>
                ) : null}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {duration ? (
                  <span className="text-xs font-medium text-slate-600 tabular-nums" title="Loading duration">
                    {duration}
                  </span>
                ) : null}
                <span
                  className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold border ${loadingStatusBadgeClass(loadingStatus)}`}
                >
                  {loadingStatusLabel(loadingStatus)}
                </span>
              </div>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5">
              {item.sales_order_id ? <span>SO: {item.sales_order_id}</span> : null}
              {item.voucher_number ? <span>PR: {item.voucher_number}</span> : null}
              <span>
                Dispatch:{' '}
                <span className="font-semibold text-slate-800">
                  {item.dispatch_quantity}
                  {item.base_unit_name ? ` ${item.base_unit_name}` : ''}
                </span>
              </span>
            </p>
          </div>
        </div>
      </div>

      <div className="px-3 py-2.5 sm:px-4 space-y-3">
        {visibleGodowns.length > 0 && (
          <div
            className={`hidden sm:grid gap-2 mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500 ${rowGridClass(actionSlots)}`}
          >
            <span>Godown</span>
            <span>Supervisor</span>
            <span>Alloc.</span>
            <span>Loaded</span>
            <span>Completed</span>
            {showActions ? <span /> : null}
          </div>
        )}

        {visibleGodowns.length === 0 ? (
          <p className="text-xs text-slate-500 py-1">No godown allocation.</p>
        ) : (
          <div className="space-y-2">
            {visibleGodowns.map((gq) => {
              const actualIndex = item.godown_quantities.indexOf(gq)
              const allocated =
                gq.allocated_qty && parseFloat(gq.allocated_qty) > 0
                  ? gq.allocated_qty
                  : gq.quantity || '—'
              const loadedDisplay =
                gq.loaded_qty && parseFloat(gq.loaded_qty) > 0 ? gq.loaded_qty : '—'
              const completedDisplay = formatStartTimeDisplay(gq.completed_at)
              const rowStarted = Boolean(gq.start_time || gq.start_time_raw)
              const startLocked = lockStartTime || rowStarted
              const showRowUpdate =
                showUpdateIcon && actualIndex === item.godown_quantities.indexOf(visibleGodowns[0])

              const canInlineEditThisRow =
                canInlineEditLoaded ||
                (!readOnly && Boolean(onUpdateLoadedQty) && Boolean(gq.isNew) && Boolean(onUpdateLoading))

              return (
                <div
                  key={gq.id || `new-${actualIndex}`}
                  className={`grid gap-2 items-start ${rowGridClass(actionSlots)}`}
                >
                  <div className="min-w-0">
                    <p className="sm:hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Godown
                    </p>
                    {readOnly || (gq.id && !gq.isNew) ? (
                      <div className="h-9 px-2.5 flex items-center rounded-lg border border-slate-200 bg-slate-50 text-sm truncate">
                        {gq.godown_name ||
                          godownOptions.find((o) => o.value === gq.godown_id)?.label ||
                          '—'}
                      </div>
                    ) : (
                      <SearchSelectDropdown
                        compact
                        value={gq.godown_id}
                        options={godownOptions}
                        onChange={(value) => onUpdateGodownRow(item.id, actualIndex, 'godown_id', value)}
                        placeholder="Godown"
                        searchPlaceholder="Search..."
                        emptyText="No godowns"
                      />
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="sm:hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Supervisor
                    </p>
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1">
                        {readOnly || (gq.id && !gq.isNew) ? (
                          <div className="h-9 px-2.5 flex items-center rounded-lg border border-slate-200 bg-slate-50 text-sm truncate">
                            {gq.supervisor_name ||
                              supervisorOptions.find((o) => o.value === gq.supervisor_id)?.label ||
                              '—'}
                          </div>
                        ) : (
                          <SearchSelectDropdown
                            compact
                            value={gq.supervisor_id}
                            options={supervisorOptions}
                            onChange={(value) =>
                              onUpdateGodownRow(item.id, actualIndex, 'supervisor_id', value)
                            }
                            placeholder="Supervisor"
                            searchPlaceholder="Search..."
                            emptyText="No users"
                          />
                        )}
                      </div>
                      {showStartIcon && actualIndex === item.godown_quantities.indexOf(visibleGodowns[0]) ? (
                        <button
                          type="button"
                          title="Start loading"
                          aria-label="Start loading"
                          onClick={() => onStartLoading(item)}
                          className={iconActionPrimaryClass}
                        >
                          <Truck className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="sm:hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Alloc.
                    </p>
                    <div className="h-9 px-2.5 flex items-center justify-end sm:justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-medium tabular-nums">
                      {allocated}
                    </div>
                  </div>

                  <div className="min-w-0">
                    <p className="sm:hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Loaded
                    </p>
                    {canInlineEditThisRow ? (
                      <input
                        type="number"
                        min="0"
                        step="any"
                        value={gq.loaded_qty}
                        onChange={(e) => onUpdateLoadedQty(item.id, actualIndex, e.target.value)}
                        className={`${smallInputClass} h-9 py-1.5 text-sm text-center tabular-nums`}
                        placeholder="Qty"
                      />
                    ) : (
                      <div className="h-9 px-2.5 flex items-center justify-end sm:justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-semibold tabular-nums text-indigo-700">
                        {loadedDisplay}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className="sm:hidden text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-1">
                      Completed
                    </p>
                    <div className="h-9 px-2.5 flex items-center rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-700 truncate">
                      <span className="truncate">{completedDisplay || '—'}</span>
                    </div>
                    {canManageRows && !startLocked && !hasStarted && !onStartLoading ? (
                      <input
                        type="datetime-local"
                        value={gq.start_time || ''}
                        onChange={(e) =>
                          onUpdateGodownRow(item.id, actualIndex, 'start_time', e.target.value)
                        }
                        className={`${smallInputClass} h-9 py-1.5 text-sm mt-1`}
                      />
                    ) : null}
                  </div>

                  {showActions ? (
                    <div className="flex items-center justify-end sm:justify-center gap-1 pt-1 sm:pt-0">
                      {showRowUpdate ? (
                        <button
                          type="button"
                          title="Update loading qty"
                          aria-label="Update loading qty"
                          onClick={() => onUpdateLoading(item)}
                          className={iconActionPrimaryClass}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      ) : showUpdateIcon ? (
                        <span className="h-9 w-9 shrink-0" aria-hidden />
                      ) : null}
                      {showRemove ? (
                        <button
                          type="button"
                          onClick={() => onRemoveGodownRow(item.id, actualIndex)}
                          className={iconActionGhostClass}
                          aria-label="Remove godown row"
                          title="Remove godown row"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}

        {canManageRows && onAddGodownRow ? (
          <button
            type="button"
            onClick={() => onAddGodownRow(item.id)}
            className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-indigo-700 hover:text-indigo-900"
          >
            <Plus className="h-3.5 w-3.5" />
            Add godown
          </button>
        ) : null}
      </div>
    </article>
  )
}
