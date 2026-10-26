import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { History, Loader2, Search, X } from 'lucide-react'
import Pagination from '@/components/common/Pagination'
import SearchSelectDropdown from '@/components/common/SearchSelectDropdown'
import { fetchItemPriceMarginLogs } from '@/lib/margin_settings_api'
import { fetchStockItemsList } from '@/lib/stocks_api'
import { fetchUsersForFilter, getUserDisplayName, getUserId } from '@/lib/users_api'

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

const SOURCE_OPTIONS = [
  { value: '', label: 'All sources' },
  { value: 'api_save', label: 'API Save' },
  { value: 'excel_upload', label: 'Excel Upload' },
]

/** User filter in Item Price Margin Logs shows only these roles. */
const LOGS_USER_ROLE_IDS = new Set([1, 6])

function getUserRoleId(user) {
  if (!user || typeof user !== 'object') return null
  const raw =
    user.role_id ??
    user.roleId ??
    user.role?.id ??
    user.user_info?.role_id ??
    user.user_info?.role?.id
  if (raw != null && typeof raw === 'object') {
    const nested = raw.id ?? raw.role_id
    const n = Number(nested)
    return Number.isFinite(n) ? n : null
  }
  const n = Number(raw)
  return Number.isFinite(n) ? n : null
}

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

function parseChangeLine(line) {
  const raw = String(line || '').trim()
  if (!raw) return null
  const arrow = raw.includes('→') ? '→' : raw.includes('->') ? '->' : null
  if (!arrow) return { field: null, old: null, new: null, raw }
  const idx = raw.lastIndexOf(arrow)
  const left = raw.slice(0, idx).trim()
  const newValue = raw.slice(idx + arrow.length).trim()
  const colonIdx = left.lastIndexOf(':')
  if (colonIdx >= 0) {
    return {
      field: left.slice(0, colonIdx).trim() || null,
      old: left.slice(colonIdx + 1).trim(),
      new: newValue,
      raw,
    }
  }
  return { field: left || null, old: null, new: newValue, raw }
}

function getChangeEntries(log) {
  if (Array.isArray(log?.changes_entries) && log.changes_entries.length) {
    return log.changes_entries
  }
  const lines = Array.isArray(log?.changes_lines) ? log.changes_lines : []
  if (lines.length) {
    return lines.map(parseChangeLine).filter(Boolean)
  }
  const made = String(log?.changes_made || '').trim()
  if (!made) return []
  return made
    .split(/\r?\n/)
    .map((line) => parseChangeLine(line))
    .filter(Boolean)
}

function ChangeEntries({ log }) {
  const entries = getChangeEntries(log)
  if (!entries.length) {
    return <span className="text-slate-400">—</span>
  }

  return (
    <div className="space-y-1.5 min-w-[16rem] max-w-md">
      {entries.map((entry, index) => {
        const key = `${entry.raw || entry.field || 'change'}-${index}`
        if (!entry.field && entry.old == null && entry.new == null) {
          return (
            <p key={key} className="text-sm text-slate-700 leading-snug">
              {entry.raw}
            </p>
          )
        }
        return (
          <div
            key={key}
            className="rounded-lg border border-slate-100 bg-slate-50/80 px-2.5 py-1.5"
          >
            {entry.field ? (
              <p className="text-xs font-medium text-slate-600 leading-snug mb-0.5">{entry.field}</p>
            ) : null}
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm">
              {entry.old != null && entry.old !== '' ? (
                <span className="text-slate-400 line-through tabular-nums">{entry.old}</span>
              ) : (
                <span className="text-slate-400">—</span>
              )}
              <span className="text-slate-300" aria-hidden>
                →
              </span>
              <span className="font-semibold text-slate-900 tabular-nums">
                {entry.new != null && entry.new !== '' ? entry.new : '—'}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default function ItemPriceMarginLogsDialog({
  open,
  onClose,
  title = 'Item Price Margin Logs',
}) {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [changeSource, setChangeSource] = useState('')
  const [stockItemId, setStockItemId] = useState('')
  const [stockItemLabel, setStockItemLabel] = useState('')
  const [itemSearch, setItemSearch] = useState('')
  const [debouncedItemSearch, setDebouncedItemSearch] = useState('')
  const [actionById, setActionById] = useState('')

  useEffect(() => {
    if (!open) return
    setPage(1)
    setSearch('')
    setSearchInput('')
    setChangeSource('')
    setStockItemId('')
    setStockItemLabel('')
    setItemSearch('')
    setDebouncedItemSearch('')
    setActionById('')
  }, [open])

  useEffect(() => {
    if (!open) return
    const timer = setTimeout(() => setDebouncedItemSearch(itemSearch.trim()), 300)
    return () => clearTimeout(timer)
  }, [itemSearch, open])

  const { data: usersList = [], isLoading: usersLoading } = useQuery({
    queryKey: ['users-list-item-price-margin-logs-filter'],
    queryFn: fetchUsersForFilter,
    enabled: open,
    staleTime: 60_000,
  })

  const { data: stockItemsResult, isLoading: itemsLoading } = useQuery({
    queryKey: ['stock-items-item-price-margin-logs-filter', debouncedItemSearch],
    queryFn: () =>
      fetchStockItemsList({
        page: 1,
        per_page: 50,
        search: debouncedItemSearch || undefined,
        is_active: true,
        omit_godown: true,
      }),
    enabled: open,
    staleTime: 30_000,
  })

  const userOptions = useMemo(() => {
    const byId = new Map()
    for (const user of usersList) {
      const roleId = getUserRoleId(user)
      if (!LOGS_USER_ROLE_IDS.has(roleId)) continue
      const id = getUserId(user)
      const label = getUserDisplayName(user)
      if (!id || !label) continue
      byId.set(id, {
        value: id,
        label,
        searchText: [label, user.mobile, user.role_name, id].filter(Boolean).join(' '),
        hint: user.is_active === false || user.is_active === 0 ? 'Inactive' : undefined,
        hintClassName: 'text-amber-600',
      })
    }
    return [
      { value: '', label: 'All users' },
      ...[...byId.values()].sort((a, b) => a.label.localeCompare(b.label)),
    ]
  }, [usersList])

  const itemOptions = useMemo(() => {
    const rows = Array.isArray(stockItemsResult?.items) ? stockItemsResult.items : []
    const options = rows
      .map((item) => {
        const id = item?.id ?? item?.stock_item_id
        if (id == null || id === '') return null
        const label = item.name || item.stock_item_name || String(id)
        return {
          value: String(id),
          label,
          searchText: label,
        }
      })
      .filter(Boolean)

    if (
      stockItemId &&
      stockItemLabel &&
      !options.some((opt) => String(opt.value) === String(stockItemId))
    ) {
      options.unshift({ value: String(stockItemId), label: stockItemLabel, searchText: stockItemLabel })
    }

    return [{ value: '', label: 'All items' }, ...options]
  }, [stockItemsResult?.items, stockItemId, stockItemLabel])

  const { data, isLoading, error } = useQuery({
    queryKey: [
      'item-price-margin-logs',
      page,
      search,
      changeSource,
      stockItemId,
      actionById,
    ],
    queryFn: () =>
      fetchItemPriceMarginLogs({
        page,
        page_size: 15,
        search: search || undefined,
        change_source: changeSource || undefined,
        stock_item_id: stockItemId || undefined,
        action_by_id: actionById || undefined,
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
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-7xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-100 flex items-center justify-center">
              <History className="h-5 w-5 text-slate-700" />
            </div>
            <div>
              <h3 className="font-semibold text-lg text-slate-900">{title}</h3>
              <p className="text-sm text-slate-500">Change history for Item Price Margin.</p>
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

        <div className="px-5 py-4 border-b border-slate-100 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Source</label>
              <select
                value={changeSource}
                onChange={(e) => {
                  setChangeSource(e.target.value)
                  setPage(1)
                }}
                className={inputClass}
              >
                {SOURCE_OPTIONS.map((opt) => (
                  <option key={opt.value || 'all'} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Item</label>
              <SearchSelectDropdown
                value={stockItemId}
                options={itemOptions}
                selectedLabel={stockItemLabel || undefined}
                onChange={(value) => {
                  const next = value == null ? '' : String(value)
                  setStockItemId(next)
                  const match = itemOptions.find((opt) => String(opt.value) === next)
                  setStockItemLabel(next && match && match.value ? match.label : '')
                  setPage(1)
                }}
                placeholder="All items"
                searchPlaceholder="Search items..."
                emptyText="No items found"
                loading={itemsLoading}
                filterLocally={false}
                onSearchChange={setItemSearch}
                clearable
                useFixedMenu
                wrapLabel
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">User</label>
              <SearchSelectDropdown
                value={actionById}
                options={userOptions}
                onChange={(value) => {
                  setActionById(value == null ? '' : String(value))
                  setPage(1)
                }}
                placeholder="All users"
                searchPlaceholder="Search users..."
                emptyText="No users found"
                loading={usersLoading}
                clearable
                useFixedMenu
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600 mb-1.5">Search</label>
              <div className="flex gap-2">
                <div className="relative flex-1 min-w-0">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') applySearch()
                    }}
                    placeholder="Search changes / ref..."
                    className={`${inputClass} pl-10`}
                  />
                </div>
                <button
                  type="button"
                  onClick={applySearch}
                  className="px-4 py-2.5 rounded-lg btn-brand text-sm font-medium shrink-0"
                >
                  Search
                </button>
              </div>
            </div>
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
            <div className="text-center py-16 text-slate-500 text-sm">No change logs found.</div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Date &amp; Time
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Item
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Action
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Source
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Changes
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Changed By
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="align-top hover:bg-blue-50/30 even:bg-slate-50/40">
                      <td className="px-4 py-3 whitespace-nowrap text-slate-700">
                        {log.action_time || formatLogDate(log.action_time_raw)}
                      </td>
                      <td className="px-4 py-3 text-slate-800 font-medium min-w-[160px] max-w-[220px]">
                        <span className="leading-snug">{log.stock_item_name || '—'}</span>
                        {log.reference_number ? (
                          <div className="text-xs font-normal text-slate-500 mt-0.5">
                            Ref: {log.reference_number}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {log.action_type_label || log.action_type}
                        <div className="text-xs text-slate-500">{log.scope_label || log.scope}</div>
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {log.change_source_label || log.change_source}
                      </td>
                      <td className="px-4 py-3 text-slate-700">
                        <ChangeEntries log={log} />
                      </td>
                      <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                        {log.action_by || '—'}
                      </td>
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
