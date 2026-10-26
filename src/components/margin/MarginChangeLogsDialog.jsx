import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Loader2, Search, X } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import { fetchMarginChangeLogs } from '@/lib/margin_settings_api'

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

function formatLogDate(value) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function formatMargin(value) {
  if (value == null || value === '') return '—'
  const num = Number(value)
  if (Number.isNaN(num)) return '—'
  return `${num.toFixed(num % 1 === 0 ? 0 : 2)}%`
}

const FREIGHT_ENTITY_OPTIONS = [
  { value: '', label: 'All sections' },
  { value: 'state', label: 'State' },
  { value: 'city', label: 'City' },
  { value: 'pincode', label: 'Pincode' },
]

const CUSTOMER_ENTITY_OPTIONS = [
  { value: '', label: 'All sections' },
  { value: 'business_type', label: 'Customer Type' },
  { value: 'category_type', label: 'Category Type' },
  { value: 'credit_type', label: 'Credit Type' },
  { value: 'religion', label: 'Religion' },
  { value: 'party', label: 'Party' },
]

export default function MarginChangeLogsDialog({ open, onClose, pageType, title = 'Change Logs' }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [entityType, setEntityType] = useState('')
  const [searchInput, setSearchInput] = useState('')

  const entityOptions = useMemo(
    () => (pageType === 'freight_margin' ? FREIGHT_ENTITY_OPTIONS : CUSTOMER_ENTITY_OPTIONS),
    [pageType],
  )

  useEffect(() => {
    if (!open) return
    setPage(1)
    setSearch('')
    setSearchInput('')
    setEntityType('')
  }, [open, pageType])

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['margin-change-logs', pageType, page, search, entityType],
    queryFn: () =>
      fetchMarginChangeLogs({
        page_type: pageType,
        page,
        page_size: 15,
        search: search || undefined,
        entity_type: entityType || undefined,
      }),
    enabled: open && Boolean(pageType),
  })

  const logs = data?.logs || []
  const pagination = data?.pagination || {}

  const applySearch = () => {
    setSearch(searchInput.trim())
    setPage(1)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-6xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <History className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500">Margin update history for this page.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 cursor-pointer hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Section</label>
            <select
              value={entityType}
              onChange={(e) => {
                setEntityType(e.target.value)
                setPage(1)
              }}
              className={inputClass}
            >
              {entityOptions.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Search name</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch()
                }}
                placeholder="Search entity name..."
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div className="flex items-end">
            <button
              type="button"
              onClick={applySearch}
              className="px-4 py-2.5 rounded-lg btn-brand text-sm font-medium"
            >
              Search
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">
              {error.message}
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">No margin change logs found.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Date &amp; Time
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Section
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Name
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Old Margin
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      New Margin
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Changed By
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Source
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((row) => (
                    <tr key={row.id} className="hover:bg-blue-50/40 even:bg-slate-50/50">
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{formatLogDate(row.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.entity_type_label || row.entity_type}</td>
                      <td className="px-4 py-3 font-medium text-slate-900">{row.entity_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{formatMargin(row.old_margin_percent)}</td>
                      <td className="px-4 py-3 text-emerald-700 font-medium">{formatMargin(row.new_margin_percent)}</td>
                      <td className="px-4 py-3 text-slate-700">{row.changed_by_name || '—'}</td>
                      <td className="px-4 py-3 text-slate-600">{row.change_source_label || row.change_source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="px-5 py-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          {pagination.total_pages > 1 ? (
            <Pagination
              currentPage={pagination.current_page || page}
              totalPages={pagination.total_pages || 1}
              onPageChange={setPage}
              totalCount={pagination.total_count}
              pageSize={pagination.page_size}
            />
          ) : (
            <span className="text-sm text-slate-500">
              {pagination.total_count != null ? `${pagination.total_count} log(s)` : ''}
            </span>
          )}
          <div className="flex items-center gap-2">
            {isFetching && !isLoading ? (
              <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Updating...
              </span>
            ) : null}
            <button
              type="button"
              onClick={() => refetch()}
              className="px-4 py-2 rounded-lg border border-gray-200 text-sm text-slate-700 hover:bg-slate-50"
            >
              Refresh
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg btn-brand text-sm font-medium"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
