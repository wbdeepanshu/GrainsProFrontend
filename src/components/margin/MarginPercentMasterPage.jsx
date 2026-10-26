import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Edit3, Plus, RefreshCw, Search, X } from 'lucide-react'
import Loader from '@/components/common/Loader'
import Pagination from '@/components/common/Pagination'
import PageHeader from '@/components/layout/PageHeader'
import { usePermissions } from '@/hooks/usePermissions'
import { useSuccessPopup, getApiSuccessMessage } from '@/hooks/useSuccessPopup'
import { useUserPermissions } from '@/hooks/useUserPermissions'

const ITEMS_PER_PAGE = 20

const inputClass =
  'w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800'

function MarginBadge({ value }) {
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
      {Number(value ?? 0).toFixed(Number(value ?? 0) % 1 === 0 ? 0 : 2)}%
    </span>
  )
}

function StatusPill({ active }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
        active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
      }`}
    >
      {active ? 'Active' : 'Inactive'}
    </span>
  )
}

export default function MarginPercentMasterPage({
  title,
  subtitle,
  icon: Icon,
  permissionModule = 'margin_settings',
  queryKey,
  fetchList,
  saveItem,
  emptyForm,
  mapRowToForm,
  buildPayload,
  validateForm,
  extraColumns = [],
  renderFormExtra,
  getSearchText,
  nameLabel = 'Name',
  getRowName = (row) => row.name || row.pincode || '—',
}) {
  const queryClient = useQueryClient()
  const { showSuccess } = useSuccessPopup()
  const permissionsLoaded = usePermissions()
  const { hasReadPermission, hasCreatePermission, hasUpdatePermission } = useUserPermissions()

  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [formError, setFormError] = useState(null)

  const canRead = hasReadPermission(permissionModule)

  const { data: rows = [], isLoading, isFetching, error, refetch } = useQuery({
    queryKey: [queryKey],
    queryFn: fetchList,
    enabled: permissionsLoaded && canRead,
  })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return rows
    return rows.filter((row) => {
      const text = getSearchText ? getSearchText(row) : `${row.name || ''} ${row.margin_percent ?? ''}`
      return text.toLowerCase().includes(q)
    })
  }, [rows, search, getSearchText])

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE))
  const safePage = Math.min(page, totalPages)
  const pageRows = filtered.slice((safePage - 1) * ITEMS_PER_PAGE, safePage * ITEMS_PER_PAGE)

  const saveMutation = useMutation({
    mutationFn: saveItem,
    onSuccess: (result) => {
      showSuccess(getApiSuccessMessage(result, 'Saved successfully.'))
      setDialogOpen(false)
      setForm(emptyForm())
      setFormError(null)
      queryClient.invalidateQueries({ queryKey: [queryKey] })
    },
    onError: (err) => setFormError(err.message || 'Failed to save.'),
  })

  const openCreate = () => {
    setForm(emptyForm())
    setFormError(null)
    setDialogOpen(true)
  }

  const openEdit = (row) => {
    setForm(mapRowToForm(row))
    setFormError(null)
    setDialogOpen(true)
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name?.trim?.()) {
      setFormError(`${nameLabel} is required.`)
      return
    }
    if (validateForm) {
      const validationError = validateForm(form)
      if (validationError) {
        setFormError(validationError)
        return
      }
    }
    saveMutation.mutate(buildPayload(form))
  }

  if (!permissionsLoaded) return <Loader isLoading text="Loading permissions..." />
  if (!canRead) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <p className="text-gray-600">You do not have permission to view {title}.</p>
      </div>
    )
  }
  if (isLoading) return <Loader isLoading text={`Loading ${title.toLowerCase()}...`} />

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-slate-100/80">
      <PageHeader title={title}>
        {hasCreatePermission(permissionModule) ? (
          <button type="button" onClick={openCreate} className="inline-flex items-center cursor-pointer gap-2 px-4 py-2 rounded-lg btn-brand text-sm font-medium">
            <Plus className="h-4 w-4" />
            Add
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </PageHeader>

      <main className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1400px] mx-auto space-y-5">
          <div className="flex items-center gap-3">
            {Icon ? (
              <div className="h-11 w-11 rounded-xl bg-brand-gradient flex items-center justify-center shrink-0 shadow-sm">
                <Icon className="h-5 w-5 text-white" />
              </div>
            ) : null}
            <div>
              <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
              {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
            </div>
          </div>

          {error ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
              {error.message}
            </div>
          ) : null}

          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-5 py-4 border-b border-gray-100">
              <h3 className="text-base font-semibold text-slate-900">
                {title} ({filtered.length})
              </h3>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value)
                    setPage(1)
                  }}
                  placeholder="Search..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-800/20"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-gray-200">
                    <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {nameLabel}
                    </th>
                    {extraColumns.map((col) => (
                      <th
                        key={col.key}
                        className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-600"
                      >
                        {col.label}
                      </th>
                    ))}
                    <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Margin
                    </th>
                    <th className="text-left px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      Status
                    </th>
                    <th className="text-right px-4 py-3.5 text-xs font-semibold uppercase tracking-wide text-slate-600 w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pageRows.length === 0 ? (
                    <tr>
                      <td colSpan={4 + extraColumns.length} className="px-4 py-14 text-center text-slate-500">
                        No records found.
                      </td>
                    </tr>
                  ) : (
                    pageRows.map((row) => (
                      <tr key={row.id} className="hover:bg-blue-50/40 transition-colors even:bg-slate-50/50">
                        <td className="px-4 py-4 font-medium text-slate-900">{getRowName(row)}</td>
                        {extraColumns.map((col) => (
                          <td key={col.key} className="px-4 py-4 text-slate-600">
                            {col.render ? col.render(row) : row[col.key] || '—'}
                          </td>
                        ))}
                        <td className="px-4 py-4">
                          <MarginBadge value={row.margin_percent} />
                        </td>
                        <td className="px-4 py-4">
                          <StatusPill active={row.is_active} />
                        </td>
                        <td className="px-4 py-4 text-right">
                          {hasUpdatePermission(permissionModule) ? (
                            <button
                              type="button"
                              onClick={() => openEdit(row)}
                              className="p-2 rounded-lg border border-blue-200 text-blue-600 hover:bg-blue-50 cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="h-4 w-4" />
                            </button>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {filtered.length > ITEMS_PER_PAGE ? (
              <div className="px-4 py-3 border-t border-gray-100">
                <Pagination currentPage={safePage} totalPages={totalPages} onPageChange={setPage} />
              </div>
            ) : null}
          </div>
        </div>
      </main>

      {dialogOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100">
              <h3 className="font-semibold text-lg text-slate-900">
                {form.id ? `Edit ${title}` : `Add ${title}`}
              </h3>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 cursor-pointer hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 px-5 py-4 space-y-4">
              {formError ? (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {formError}
                </div>
              ) : null}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  {nameLabel} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  className={inputClass}
                  inputMode={nameLabel === 'Pincode' ? 'numeric' : undefined}
                  required
                />
              </div>
              {renderFormExtra ? renderFormExtra(form, (patch) => setForm((prev) => ({ ...prev, ...patch }))) : null}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Margin %</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.margin_percent}
                  onChange={(e) => setForm((prev) => ({ ...prev, margin_percent: e.target.value }))}
                  className={inputClass}
                />
              </div>
              <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.checked }))}
                  className="h-4 w-4 rounded border-gray-300 text-blue-800 focus:ring-blue-800"
                />
                Active
              </label>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setDialogOpen(false)}
                  className="px-4 py-2 rounded-lg border cursor-pointer border-gray-200 text-sm text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saveMutation.isPending}
                  className="px-4 py-2 rounded-lg btn-brand cursor-pointer text-sm font-medium disabled:opacity-60"
                >
                  {saveMutation.isPending ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  )
}
