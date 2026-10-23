import { useEffect, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Download, GripVertical, Menu, Package, RefreshCw, Search, Settings, Warehouse, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import Loader from '@/components/common/loader'
import MobileSidebar from '@/components/layout/mobile-sidebar'
import Sidebar from '@/components/layout/sidebar'
import { useIsMobile } from '@/hooks/use-mobile'
import { useToast } from '@/hooks/use-toast'
import {
  fetchStockSummary,
  fetchStockSummaryBranches,
  fetchStockSummaryCategories,
  fetchStockSummaryItemVouchers,
} from '@/lib/stock_summary_api'

const firstDayOfMonth = () => {
  const value = new Date()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-01`
}

const lastDayOfMonth = () => {
  const value = new Date()
  const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate()
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
}
const PAGE_SIZE = 25

const quantity = (value) => {
  const number = Number(value)
  if (!Number.isFinite(number)) return '0'
  return number.toLocaleString('en-IN', { maximumFractionDigits: 3 })
}

const amount = (value) => {
  const number = Number(value)
  return (Number.isFinite(number) ? number : 0).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

const columns = [
  { key: 'serial_no', label: 'S.No.', serial: true },
  { key: 'item_name', label: 'Item Name' },
  { key: 'category_name', label: 'Category' },
  { key: 'opening_stock', label: 'Opening Stock' },
  { key: 'opening_stock_value', label: 'Opening Stock Value', money: true },
  { key: 'inward_qty', label: 'Inward Qty' },
  { key: 'inward_stock_value', label: 'Inward Stock Value', money: true },
  { key: 'outward_qty', label: 'Outward Qty' },
  { key: 'outward_stock_value', label: 'Outward Stock Value', money: true },
  { key: 'closing_balance', label: 'Closing Balance' },
  { key: 'selling_balance', label: 'Selling Balance' },
  { key: 'selling_stock_value', label: 'Selling Stock Value', money: true },
]

function metric(label, value, Icon, formatted = quantity) {
  return (
    <div key={label} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{label}</span><Icon className="h-4 w-4 text-blue-700" />
      </div>
      <div className="mt-2 text-xl font-semibold text-slate-900">{formatted(value)}</div>
    </div>
  )
}

export default function StockSummaryReport() {
  const isMobile = useIsMobile()
  const { toast } = useToast()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [fromDate, setFromDate] = useState(firstDayOfMonth)
  const [toDate, setToDate] = useState(lastDayOfMonth)
  const [branchId, setBranchId] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [search, setSearch] = useState('')
  const [inStockOnly, setInStockOnly] = useState(false)
  const [selectedItem, setSelectedItem] = useState(null)
  const [sort, setSort] = useState({ key: 'item_name', direction: 'asc' })
  const [currentPage, setCurrentPage] = useState(1)
  const [visibleColumns, setVisibleColumns] = useState(() => Object.fromEntries(columns.map((column) => [column.key, true])))
  const [columnOrder, setColumnOrder] = useState(() => columns.map((column) => column.key))
  const [draggedColumnKey, setDraggedColumnKey] = useState(null)

  const filters = useMemo(() => ({
    from_date: fromDate,
    to_date: toDate,
    ...(branchId ? { branch_id: branchId } : {}),
    ...(categoryId ? { category_id: categoryId } : {}),
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(inStockOnly ? { in_stock_only: 'true' } : {}),
  }), [fromDate, toDate, branchId, categoryId, search, inStockOnly])

  const branchesQuery = useQuery({
    queryKey: ['stock-summary-branches'],
    queryFn: fetchStockSummaryBranches,
  })
  const categoriesQuery = useQuery({
    queryKey: ['stock-summary-categories'],
    queryFn: fetchStockSummaryCategories,
  })
  const reportQuery = useQuery({
    queryKey: ['stock-summary-report', filters],
    queryFn: () => fetchStockSummary(filters),
    enabled: Boolean(fromDate && toDate),
    refetchOnWindowFocus: false,
  })

  const voucherParams = selectedItem ? {
    stock_item_id: selectedItem.stock_item_id,
    from_date: fromDate,
    to_date: toDate,
    ...(branchId ? { branch_id: branchId } : {}),
  } : null
  const vouchersQuery = useQuery({
    queryKey: ['stock-summary-vouchers', voucherParams],
    queryFn: () => fetchStockSummaryItemVouchers(voucherParams),
    enabled: Boolean(voucherParams),
    refetchOnWindowFocus: false,
  })

  const rows = reportQuery.data?.data || []
  const totals = reportQuery.data?.totals || {}
  const sortedRows = useMemo(() => {
    if (!sort.key) return rows
    const multiplier = sort.direction === 'asc' ? 1 : -1
    return [...rows].sort((left, right) => {
      const a = left[sort.key]
      const b = right[sort.key]
      const comparison = Number.isFinite(Number(a)) && Number.isFinite(Number(b))
        ? Number(a) - Number(b)
        : String(a ?? '').localeCompare(String(b ?? ''), undefined, { sensitivity: 'base' })
      return comparison * multiplier
    })
  }, [rows, sort])
  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE))
  const pageRows = useMemo(
    () => sortedRows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [sortedRows, currentPage],
  )

  useEffect(() => {
    setCurrentPage(1)
  }, [filters, sort])

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages)
  }, [currentPage, totalPages])

  const toggleSort = (key) => setSort((current) => ({
    key,
    direction: current.key === key && current.direction === 'asc' ? 'desc' : 'asc',
  }))

  const selectedColumns = useMemo(() => {
    const byKey = new Map(columns.map((column) => [column.key, column]))
    return columnOrder
      .filter((key) => visibleColumns[key] && byKey.has(key))
      .map((key) => byKey.get(key))
  }, [columnOrder, visibleColumns])

  const toggleColumn = (key) => {
    setVisibleColumns((current) => {
      const shown = Object.values(current).filter(Boolean).length
      if (current[key] && shown === 1) return current
      return { ...current, [key]: !current[key] }
    })
  }

  const moveColumn = (fromKey, toKey) => {
    if (!fromKey || !toKey || fromKey === toKey) return
    setColumnOrder((current) => {
      const next = [...current]
      const fromIndex = next.indexOf(fromKey)
      const toIndex = next.indexOf(toKey)
      if (fromIndex === -1 || toIndex === -1) return current
      const [moved] = next.splice(fromIndex, 1)
      next.splice(toIndex, 0, moved)
      return next
    })
  }

  const totalCell = (column) => {
    if (column.serial) return ''
    if (column.money) return amount(totals[`total_${column.key}`])
    if (isQuantityColumn(column.key)) return quantity(totals[`total_${column.key}`])
    const labelColumn = selectedColumns.find((item) => !item.serial && !item.money && !isQuantityColumn(item.key))
    return column.key === labelColumn?.key ? 'Total' : ''
  }

  const downloadExcel = async () => {
    if (!sortedRows.length) return
    try {
      const { utils, writeFile } = await import('xlsx')
      const data = sortedRows.map((row, index) => Object.fromEntries(
        selectedColumns.map((column) => [
          column.label,
          column.serial ? index + 1 : row[column.key] ?? '',
        ]),
      ))
      data.push(Object.fromEntries(selectedColumns.map((column) => [
        column.label,
        column.serial || !isQuantityColumn(column.key) && !column.money
          ? totalCell(column)
          : totals[`total_${column.key}`] ?? 0,
      ])))
      const sheet = utils.json_to_sheet(data)
      const workbook = utils.book_new()
      utils.book_append_sheet(workbook, sheet, 'Stock Summary')
      writeFile(workbook, `stock-summary-${fromDate}-${toDate}.xlsx`)
    } catch (error) {
      toast({ title: 'Excel export failed', description: error.message, variant: 'destructive' })
    }
  }

  const downloadPdf = async () => {
    if (!sortedRows.length) return
    try {
      const [{ jsPDF }, autoTableModule] = await Promise.all([
        import('jspdf'),
        import('jspdf-autotable'),
      ])
      const doc = new jsPDF('l', 'mm', 'a4')
      const autoTable = autoTableModule.default
      doc.setFontSize(15)
      doc.text('Stock Summary Report', 12, 14)
      doc.setFontSize(9)
      doc.text(`Period: ${fromDate} to ${toDate}`, 12, 20)
      autoTable(doc, {
        startY: 24,
        head: [selectedColumns.map((column) => column.label)],
        body: [
          ...sortedRows.map((row, index) => selectedColumns.map((column) => (
            column.serial
              ? String(index + 1)
              : column.money
                ? amount(row[column.key])
                : quantityOrText(row[column.key], column.key)
          ))),
          selectedColumns.map((column) => totalCell(column)),
        ],
        styles: { fontSize: 7, cellPadding: 1.8, halign: 'center' },
        headStyles: { fillColor: [30, 64, 175] },
        didParseCell: (data) => {
          if (data.section === 'body' && data.row.index === sortedRows.length) {
            data.cell.styles.fontStyle = 'bold'
          }
        },
      })
      doc.save(`stock-summary-${fromDate}-${toDate}.pdf`)
    } catch (error) {
      toast({ title: 'PDF export failed', description: error.message, variant: 'destructive' })
    }
  }

  return (
    <div className="app-layout bg-slate-100">
      {!isMobile && <Sidebar />}
      {isMobile && <MobileSidebar isOpen={mobileMenuOpen} onClose={() => setMobileMenuOpen(false)} />}
      <div className="app-main-content">
        <header className="app-header flex flex-wrap items-center justify-between gap-3 border-b bg-white px-4 py-4 shadow-sm sm:px-6">
          <div className="flex items-center gap-2">
            {isMobile && <Button variant="ghost" size="sm" onClick={() => setMobileMenuOpen(true)} aria-label="Open menu"><Menu className="h-5 w-5" /></Button>}
            <Warehouse className="h-6 w-6 text-blue-700" />
            <div><h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Stock Summary Report</h1><p className="text-sm text-slate-500">Item-wise stock movements and balances</p></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={downloadPdf} disabled={!rows.length}><Download className="mr-2 h-4 w-4" /> PDF</Button>
            <Button variant="outline" onClick={downloadExcel} disabled={!rows.length}><Download className="mr-2 h-4 w-4" /> Excel</Button>
            <Button variant="outline" onClick={() => reportQuery.refetch()} disabled={reportQuery.isFetching}><RefreshCw className={`mr-2 h-4 w-4 ${reportQuery.isFetching ? 'animate-spin' : ''}`} /> Refresh</Button>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" aria-label="Select columns"><Settings className="h-4 w-4" /></Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-72">
                <div className="space-y-1">
                  <p className="px-1 pb-1 text-xs font-medium text-gray-500">Select headers to display</p>
                  {columnOrder.map((key) => {
                    const column = columns.find((item) => item.key === key)
                    if (!column) return null
                    return (
                      <label
                        key={column.key}
                        draggable
                        onDragStart={() => setDraggedColumnKey(column.key)}
                        onDragOver={(event) => event.preventDefault()}
                        onDrop={() => {
                          moveColumn(draggedColumnKey, column.key)
                          setDraggedColumnKey(null)
                        }}
                        className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm hover:bg-gray-50"
                      >
                        <GripVertical className="h-4 w-4 shrink-0 text-gray-400" />
                        <Checkbox checked={!!visibleColumns[column.key]} onCheckedChange={() => toggleColumn(column.key)} />
                        <span>{column.label}</span>
                      </label>
                    )
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
        </header>

        <main className="app-main-scrollable space-y-4 p-4 sm:p-6">
          <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
            {metric('Items', reportQuery.data?.count || 0, Package, quantity)}
            {metric('Opening stock', totals.total_opening_stock, Warehouse)}
            {metric('Opening stock value', totals.total_opening_stock_value, Warehouse, amount)}
            {metric('Inward qty', totals.total_inward_qty, ArrowDown)}
            {metric('Inward stock value', totals.total_inward_stock_value, ArrowDown, amount)}
            {metric('Outward qty', totals.total_outward_qty, ArrowUp)}
            {metric('Outward stock value', totals.total_outward_stock_value, ArrowUp, amount)}
            {metric('Closing balance', totals.total_closing_balance, Warehouse)}
            {metric('Selling balance', totals.total_selling_balance, Warehouse)}
            {metric('Selling stock value', totals.total_selling_stock_value, Warehouse, amount)}
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-6">
              <label className="text-sm font-medium text-slate-700">From date<input type="date" value={fromDate} max={toDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">To date<input type="date" value={toDate} min={fromDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 h-10 w-full rounded-lg border px-3 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Branch<select value={branchId} onChange={(event) => setBranchId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="">All accessible branches</option>{(branchesQuery.data || []).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700">Category<select value={categoryId} onChange={(event) => setCategoryId(event.target.value)} className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm"><option value="">All categories</option>{(categoriesQuery.data || []).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
              <label className="text-sm font-medium text-slate-700 xl:col-span-2">Search items<div className="relative mt-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search item name" className="h-10 w-full rounded-lg border pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div></label>
            </div>
            <label className="mt-4 inline-flex items-center gap-2 text-sm text-slate-600"><input type="checkbox" checked={inStockOnly} onChange={(event) => setInStockOnly(event.target.checked)} className="h-4 w-4 rounded border-slate-300" /> Show items with stock or movement only</label>
            <p className="mt-2 text-xs text-slate-500">Stock values are estimated using the current item valuation rate.</p>
          </section>

          <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            {reportQuery.isLoading ? <Loader isLoading text="Loading stock summary..." /> : null}
            {reportQuery.error ? <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{reportQuery.error.message}</p> : null}
            {!reportQuery.isLoading && !reportQuery.error && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1150px] text-sm">
                  <thead><tr className="bg-slate-50 text-center text-xs uppercase text-slate-600">
                    {selectedColumns.map((column) => <th key={column.key} className="whitespace-nowrap px-3 py-3 text-center">{column.serial ? column.label : <button type="button" className="inline-flex items-center justify-center" onClick={() => toggleSort(column.key)}>{column.label}{sort.key === column.key ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ''}</button>}</th>)}
                    <th className="px-3 py-3 text-center">Details</th>
                  </tr></thead>
                  <tbody className="divide-y divide-slate-100">
                    {pageRows.length ? pageRows.map((row, rowIndex) => (
                      <tr key={row.stock_item_id} className="hover:bg-slate-50">
                        {selectedColumns.map((column) => <td key={column.key} className="whitespace-nowrap px-3 py-3 text-center">{column.serial ? (currentPage - 1) * PAGE_SIZE + rowIndex + 1 : column.money ? amount(row[column.key]) : quantityOrText(row[column.key], column.key)}</td>)}
                        <td className="px-3 py-3 text-center"><button type="button" onClick={() => setSelectedItem(row)} className="rounded-md border p-2 text-blue-700 hover:bg-blue-50" title="View movement vouchers"><Search className="h-4 w-4" /></button></td>
                      </tr>
                    )) : <tr><td colSpan={selectedColumns.length + 1} className="h-28 text-center text-slate-500">No stock records found for these filters.</td></tr>}
                  </tbody>
                  {sortedRows.length > 0 && <tfoot><tr className="border-t-2 bg-slate-50 font-semibold">
                    {selectedColumns.map((column) => <td key={column.key} className="whitespace-nowrap px-3 py-3 text-center">{totalCell(column)}</td>)}
                    <td />
                  </tr></tfoot>}
                </table>
              </div>
            )}
            {!reportQuery.isLoading && !reportQuery.error && sortedRows.length > 0 && (
              <div className="flex flex-col items-center justify-between gap-3 border-t px-4 py-3 text-sm text-slate-600 sm:flex-row">
                <span>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to {Math.min(currentPage * PAGE_SIZE, sortedRows.length)} of {sortedRows.length} records
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                    disabled={currentPage === 1}
                    className="rounded-md border px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Previous
                  </button>
                  <span>Page {currentPage} of {totalPages}</span>
                  <button
                    type="button"
                    onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                    disabled={currentPage >= totalPages}
                    className="rounded-md border px-3 py-1.5 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>

      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSelectedItem(null) }}>
          <section className="max-h-[85vh] w-full max-w-3xl overflow-auto rounded-xl bg-white shadow-xl">
            <header className="flex items-start justify-between border-b p-4"><div><h2 className="font-semibold text-slate-900">{selectedItem.item_name}</h2><p className="text-sm text-slate-500">Inward and outward movements for selected dates</p></div><button type="button" onClick={() => setSelectedItem(null)} aria-label="Close details"><X className="h-5 w-5 text-slate-500" /></button></header>
            {vouchersQuery.isLoading ? <Loader isLoading text="Loading voucher details..." /> : null}
            {vouchersQuery.error ? <p className="m-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">{vouchersQuery.error.message}</p> : null}
            {!vouchersQuery.isLoading && !vouchersQuery.error && (
              <div className="grid gap-4 p-4 md:grid-cols-2">
                {['inward', 'outward'].map((key) => {
                  const data = vouchersQuery.data?.[key] || []
                  return <div key={key} className="overflow-hidden rounded-lg border">
                    <h3 className="border-b bg-slate-50 px-3 py-2 font-semibold capitalize">{key} ({data.reduce((sum, voucher) => sum + Number(voucher.qty || 0), 0).toLocaleString('en-IN')})</h3>
                    {data.length ? data.map((voucher, index) => <div key={`${voucher.voucher_number}-${voucher.date}-${index}`} className="border-b px-3 py-2 last:border-0"><div className="flex justify-between gap-2 text-sm"><span className="font-medium">{voucher.voucher_number}</span><span>{quantity(voucher.qty)}</span></div><div className="text-xs text-slate-500">{voucher.voucher_type} · {voucher.date}{voucher.party_name ? ` · ${voucher.party_name}` : ''}</div></div>) : <p className="p-4 text-center text-sm text-slate-500">No {key} movements.</p>}
                  </div>
                })}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

function isQuantityColumn(key) {
  return ['opening_stock', 'closing_balance', 'selling_balance', 'inward_qty', 'outward_qty'].includes(key)
}

function quantityOrText(value, key) {
  if (isQuantityColumn(key)) {
    return `${quantity(value)}`
  }
  return value || '—'
}
