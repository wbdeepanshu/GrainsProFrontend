import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Download, Eye, FileText, Menu, Pencil, Plus, Printer, RefreshCw, Search, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Loader from '@/components/common/loader'
import MobileSidebar from '@/components/layout/mobile-sidebar'
import Sidebar from '@/components/layout/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useUserPermissions } from '@/hooks/useUserPermissions'
import { useToast } from '@/hooks/use-toast'
import { deleteSoQuotation, fetchSoQuotationDetail, fetchSoQuotations } from '@/lib/sales_quotation_api'
import { createSoQuotationPdfBlob } from '@/utils/salesQuotationPdfGenerator'

const PAGE_SIZE = 20

function amount(value) {
  return Number(value || 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function dateLabel(value) {
  if (!value) return '-'
  const [year, month, day] = String(value).slice(0, 10).split('-')
  return year && month && day ? `${day}-${month}-${year}` : value
}

export default function SoQuotations() {
  const isMobile = useIsMobile()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [, navigate] = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isLoading: permissionsLoading, hasReadPermission, hasCreatePermission, hasUpdatePermission, hasDeletePermission } =
    useUserPermissions()
  const canRead = hasReadPermission('sales_order')
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)
  const [viewId, setViewId] = useState(null)
  const [pdfBlobUrl, setPdfBlobUrl] = useState('')
  const [pdfError, setPdfError] = useState('')
  const [printWhenReady, setPrintWhenReady] = useState(false)
  const iframeRef = useRef(null)

  const query = useQuery({
    queryKey: ['so-quotations', search, statusFilter, page],
    queryFn: () => fetchSoQuotations({ search, status: statusFilter, page, per_page: PAGE_SIZE }),
    enabled: !permissionsLoading && canRead,
  })
  const detailQuery = useQuery({
    queryKey: ['so-quotation-detail', viewId],
    queryFn: () => fetchSoQuotationDetail(viewId),
    enabled: Boolean(viewId),
  })
  const deleteMutation = useMutation({
    mutationFn: deleteSoQuotation,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['so-quotations'] })
      toast({ title: 'Success', description: result.message || 'Quotation deleted.' })
    },
    onError: (error) => toast({ title: 'Error', description: error.message, variant: 'destructive' }),
  })

  const rows = query.data?.data || []
  const pagination = query.data?.pagination || {}
  const totalPages = Number(pagination.total_pages) || 0
  const typeLabel = (row) =>
    [row.business_type_name, row.credit_type_name].filter(Boolean).join(' / ') || '-'

  const handlePrint = async (id) => {
    try {
      const quotation = await fetchSoQuotationDetail(id)
      queryClient.setQueryData(['so-quotation-detail', id], quotation)
      setPrintWhenReady(true)
      setViewId(id)
    } catch (error) {
      toast({ title: 'Unable to load quotation', description: error.message, variant: 'destructive' })
    }
  }

  const viewRow = detailQuery.data

  useEffect(() => {
    if (!viewId || !viewRow) {
      setPdfBlobUrl('')
      setPdfError('')
      return undefined
    }

    let active = true
    let generatedUrl = ''
    setPdfBlobUrl('')
    setPdfError('')
    createSoQuotationPdfBlob(viewRow)
      .then(({ blobUrl }) => {
        generatedUrl = blobUrl
        if (active) setPdfBlobUrl(blobUrl)
        else URL.revokeObjectURL(blobUrl)
      })
      .catch((error) => {
        if (active) setPdfError(error.message || 'Unable to generate quotation PDF.')
      })

    return () => {
      active = false
      if (generatedUrl) URL.revokeObjectURL(generatedUrl)
    }
  }, [viewId, viewRow])

  const printPdf = () => {
    const frame = iframeRef.current
    if (!frame?.contentWindow) return
    frame.contentWindow.focus()
    frame.contentWindow.print()
  }

  const handlePdfLoad = () => {
    if (!printWhenReady) return
    setPrintWhenReady(false)
    window.setTimeout(printPdf, 100)
  }

  if (permissionsLoading) return <Loader isLoading text="Loading permissions..." />
  if (!canRead) {
    return <div className="p-8 text-center text-gray-600">You do not have permission to view quotations.</div>
  }

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />}
      <div className="app-main-content">
        <header className="app-header border-b border-gray-200 bg-white px-4 py-4 shadow-sm sm:px-6">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {isMobile && <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>}
              <FileText className="h-6 w-6 text-gray-600" />
              <div>
                <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Sales Quotations</h1>
                <p className="text-sm text-gray-500">Create and manage customer quotations</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => query.refetch()} disabled={query.isFetching}>
                <RefreshCw className={`mr-2 h-4 w-4 ${query.isFetching ? 'animate-spin' : ''}`} /> Refresh
              </Button>
              {hasCreatePermission('sales_order') && (
                <Button onClick={() => navigate('/sales/create-so-quotation')}>
                  <Plus className="mr-2 h-4 w-4" /> New Quotation
                </Button>
              )}
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1) }} placeholder="Search number, party or mobile" className="h-10 w-full rounded-lg border border-gray-200 pl-9 pr-3 text-sm outline-none focus:border-blue-500" />
              </div>
              <select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1) }} className="h-10 rounded-lg border border-gray-200 bg-white px-3 text-sm">
                <option value="">All statuses</option><option value="active">Active</option><option value="expired">Expired</option><option value="converted">Converted</option>
              </select>
            </div>
            {query.isLoading ? <Loader isLoading text="Loading quotations..." /> : null}
            {query.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{query.error.message}</p> : null}
            {!query.isLoading && !query.error && (
              <>
                <div className="overflow-x-auto rounded-xl border border-gray-100">
                  <table className="w-full min-w-[900px] text-sm">
                    <thead><tr className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-3 py-3">Quotation No</th><th className="px-3 py-3">Party</th><th className="px-3 py-3">Date</th><th className="px-3 py-3">Valid Till</th><th className="px-3 py-3">Business / Credit Type</th><th className="px-3 py-3 text-right">Items</th><th className="px-3 py-3 text-right">Amount</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th>
                    </tr></thead>
                    <tbody className="divide-y divide-gray-100">
                      {rows.length ? rows.map((row) => (
                        <tr key={row.id} className="hover:bg-slate-50">
                          <td className="px-3 py-3 font-semibold text-slate-900">{row.quotation_number || '-'}</td>
                          <td className="px-3 py-3"><div className="font-medium">{row.customer || '-'}</div><div className="text-xs text-gray-500">{row.customer_mobile}</div></td>
                          <td className="px-3 py-3">{dateLabel(row.order_date)}</td><td className="px-3 py-3">{dateLabel(row.valid_till)}</td><td className="px-3 py-3">{typeLabel(row)}</td>
                          <td className="px-3 py-3 text-right">{row.total_item || 0}</td><td className="px-3 py-3 text-right font-semibold">{amount(row.total_amount)}</td>
                          <td className="px-3 py-3"><span className={`rounded-full border px-2.5 py-1 text-xs capitalize ${String(row.status || '').toLowerCase() === 'active' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{row.status || 'inactive'}</span></td>
                          <td className="px-3 py-3"><div className="flex justify-end gap-1">
                            <button title="View" onClick={() => setViewId(row.id)} className="rounded-lg border p-2 text-slate-600 hover:bg-blue-50"><Eye className="h-4 w-4" /></button>
                            <button title="Print" onClick={() => handlePrint(row.id)} className="rounded-lg border p-2 text-emerald-700 hover:bg-emerald-50"><Printer className="h-4 w-4" /></button>
                            {hasUpdatePermission('sales_order') && !row.is_so_converted && <button title="Edit" onClick={() => navigate(`/sales/create-so-quotation?id=${row.id}`)} className="rounded-lg border p-2 text-blue-700 hover:bg-blue-50"><Pencil className="h-4 w-4" /></button>}
                            {hasDeletePermission('sales_order') && !row.is_so_converted && <button title="Delete" disabled={deleteMutation.isPending} onClick={() => { if (window.confirm(`Delete quotation ${row.quotation_number || row.id}?`)) deleteMutation.mutate(row.id) }} className="rounded-lg border p-2 text-red-600 hover:bg-red-50 disabled:opacity-50"><Trash2 className="h-4 w-4" /></button>}
                          </div></td>
                        </tr>
                      )) : (
                        <tr>
                          <td colSpan={9} className="h-28 px-3 text-center text-sm text-gray-500">
                            No quotations found.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                {totalPages > 1 && <div className="mt-4 flex items-center justify-between text-sm">
                  <span className="text-gray-500">{pagination.total_count} quotations</span>
                  <div className="flex items-center gap-2"><Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}>Previous</Button><span>Page {page} of {totalPages}</span><Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((value) => value + 1)}>Next</Button></div>
                </div>}
              </>
            )}
          </section>
        </main>
      </div>

      {viewId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3">
          <div className="flex h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-xl bg-white shadow-xl">
            <div className="flex items-center justify-between gap-3 border-b px-5 py-4">
              <div className="min-w-0"><h2 className="truncate font-semibold">{viewRow?.quotation_number || 'Quotation'}</h2><p className="truncate text-xs text-gray-500">{viewRow?.customer || ''}</p></div>
              <div className="flex shrink-0 items-center gap-2">
                <Button variant="outline" onClick={printPdf} disabled={!pdfBlobUrl}><Printer className="mr-2 h-4 w-4" /> Print</Button>
                <Button variant="outline" asChild>
                  <a
                    href={pdfBlobUrl || undefined}
                    download={`${viewRow?.quotation_number || 'quotation'}.pdf`}
                    aria-disabled={!pdfBlobUrl}
                    tabIndex={pdfBlobUrl ? 0 : -1}
                    onClick={(event) => { if (!pdfBlobUrl) event.preventDefault() }}
                    className={!pdfBlobUrl ? 'pointer-events-none opacity-50' : ''}
                  >
                    <Download className="mr-2 h-4 w-4" /> Download
                  </a>
                </Button>
                <button onClick={() => { setViewId(null); setPrintWhenReady(false) }} aria-label="Close"><X className="h-5 w-5 text-gray-500" /></button>
              </div>
            </div>
            <div className="min-h-0 flex-1 bg-slate-100">
              {detailQuery.isLoading || (!pdfBlobUrl && !pdfError) ? <Loader isLoading text="Preparing quotation PDF..." /> : null}
              {pdfError ? <p className="m-6 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{pdfError}</p> : null}
              {pdfBlobUrl && <iframe ref={iframeRef} onLoad={handlePdfLoad} title={`Quotation ${viewRow?.quotation_number || ''}`} src={pdfBlobUrl} className="h-full w-full border-0 bg-white" />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
