import { useMemo, useState } from 'react'
import { Save } from 'lucide-react'

const cardInputClass =
  'w-full h-8 px-2 py-1 border border-gray-200 rounded-md text-sm bg-white tabular-nums focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

function formatMargin(value) {
  const num = Number(value)
  if (!Number.isFinite(num)) return '0'
  return num.toFixed(Number.isInteger(num) ? 0 : 2)
}

export default function BulkMarginSection({
  title,
  description,
  rows = [],
  rowKey = 'id',
  nameKey = 'name',
  extraColumns = [],
  canUpdate = false,
  onSaveSection,
  saving = false,
}) {
  const [draft, setDraft] = useState({})

  const mergedRows = useMemo(
    () =>
      (rows || []).map((row) => {
        const key = String(row[rowKey])
        const draftRow = draft[key]
        return {
          ...row,
          margin_percent:
            draftRow?.margin_percent != null
              ? draftRow.margin_percent
              : String(row.margin_percent ?? 0),
        }
      }),
    [rows, draft, rowKey],
  )

  const dirtyCount = Object.keys(draft).length

  const updateMargin = (row, value) => {
    const key = String(row[rowKey])
    setDraft((prev) => ({
      ...prev,
      [key]: { id: row[rowKey], margin_percent: value },
    }))
  }

  const handleSave = () => {
    if (!dirtyCount) return
    const payload = Object.values(draft).map((entry) => ({
      id: entry.id,
      margin_percent: Number(entry.margin_percent || 0),
    }))
    onSaveSection?.(payload)
    setDraft({})
  }

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100 bg-slate-50/60">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-slate-200/80 text-slate-700">
              {mergedRows.length} items
            </span>
          </div>
          {description ? <p className="text-sm text-slate-500 mt-1">{description}</p> : null}
        </div>
        {canUpdate ? (
          <button
            type="button"
            onClick={handleSave}
            disabled={!dirtyCount || saving}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg btn-brand text-sm font-medium disabled:opacity-50 shrink-0"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving...' : `Save${dirtyCount ? ` (${dirtyCount})` : ''}`}
          </button>
        ) : null}
      </div>

      {!mergedRows.length ? (
        <div className="px-4 py-12 text-center text-slate-500 text-sm">No records found.</div>
      ) : (
        <div className="p-3 sm:p-4">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {mergedRows.map((row) => (
              <article
                key={row[rowKey]}
                className="rounded-lg border border-gray-200 bg-white px-3 py-2.5 shadow-sm hover:border-blue-200 hover:shadow-sm transition-all"
              >
                <h4 className="font-medium text-sm text-slate-900 leading-tight truncate" title={row[nameKey] || ''}>
                  {row[nameKey] || '—'}
                </h4>
                {extraColumns.length ? (
                  <p className="mt-0.5 text-[11px] text-slate-500 truncate">
                    {extraColumns
                      .map((col) => (col.render ? col.render(row) : row[col.key] || ''))
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                ) : null}
                <div className="mt-2 flex items-center gap-2">
                  <label className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 shrink-0">
                    Margin %
                  </label>
                  {canUpdate ? (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={row.margin_percent}
                      onChange={(e) => updateMargin(row, e.target.value)}
                      className={cardInputClass}
                    />
                  ) : (
                    <div className="inline-flex items-center px-2 py-1 rounded-md bg-emerald-50 border border-emerald-100 text-emerald-800 font-semibold text-sm">
                      {formatMargin(row.margin_percent)}%
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
