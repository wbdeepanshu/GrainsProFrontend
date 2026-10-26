import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Loader2, Search, X } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import { fetchSalesOfferLogs } from '@/lib/offers_api'

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const ACTION_OPTIONS = [
  { value: '', label: 'All actions' },
  { value: 'create', label: 'Create' },
  { value: 'update', label: 'Update' },
  { value: 'delete', label: 'Delete' },
]

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

export default function OffersMasterLogsDialog({ open, onClose, title = 'Offers Master Logs' }) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [actionType, setActionType] = useState('')

  useEffect(() => {
    if (!open) return
    setPage(1)
    setSearch('')
    setSearchInput('')
    setActionType('')
  }, [open])

  const { data, isLoading, error } = useQuery({
    queryKey: ['sales-offer-logs', page, search, actionType],
    queryFn: () =>
      fetchSalesOfferLogs({
        page,
        page_size: 15,
        search: search || undefined,
        action_type: actionType || undefined,
      }),
    enabled: open,
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
              <p className="text-sm text-slate-500">Create / update history for Offers Master.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-5 py-4 border-b border-slate-100 grid grid-cols-1 md:grid-cols-[180px_1fr_auto] gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Action</label>
            <select
              value={actionType}
              onChange={(e) => {
                setActionType(e.target.value)
                setPage(1)
              }}
              className={inputClass}
            >
              {ACTION_OPTIONS.map((opt) => (
                <option key={opt.value || 'all'} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1.5">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') applySearch()
                }}
                placeholder="Search offer / changes / user..."
                className={`${inputClass} pl-10`}
              />
            </div>
          </div>
          <div className="flex items-end">
            <button type="button" onClick={applySearch} className="px-4 py-2.5 rounded-lg btn-brand text-sm font-medium">
              Search
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-700">{error.message}</div>
          ) : isLoading ? (
            <div className="flex items-center justify-center py-16 text-slate-500 gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading logs...
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-500 text-sm">No offer logs found.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Date &amp; Time
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Offer
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Action
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Changes
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {log.action_time || formatLogDate(log.action_time_raw)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium min-w-[160px]">
                        {log.offer_name || '—'}
                        <div className="text-xs font-normal text-slate-500">
                          {log.offer_type_label || log.offer_type || ''}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {log.action_type_label || log.action_type}
                      </td>
                      <td className="px-4 py-3 text-slate-700 min-w-[240px]">
                        {(log.changes_lines || []).length ? (
                          <ul className="space-y-0.5 list-disc pl-4">
                            {log.changes_lines.map((line) => (
                              <li key={line}>{line}</li>
                            ))}
                          </ul>
                        ) : (
                          log.changes_made || '—'
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">{log.action_by || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {pagination.total_pages > 1 ? (
          <div className="px-5 py-3 border-t border-slate-100">
            <Pagination
              currentPage={page}
              totalPages={pagination.total_pages || 1}
              totalCount={pagination.total_count || 0}
              pageSize={pagination.page_size || 15}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </div>
    </div>
  )
}
