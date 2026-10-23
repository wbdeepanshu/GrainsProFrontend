export default function Pagination({
  page,
  currentPage,
  totalPages = 1,
  onPageChange,
  totalCount,
  pageSize,
  className = "",
}) {
  const current = Number(currentPage ?? page) || 1;
  const pages = Math.max(1, Number(totalPages) || 1);
  return (
    <div className={`flex flex-wrap items-center justify-end gap-2 ${className}`}>
      {totalCount != null ? (
        <span className="mr-auto text-sm text-slate-500">
          {totalCount} total
          {pageSize ? ` · ${pageSize}/page` : ""}
        </span>
      ) : null}
      <button
        type="button"
        disabled={current <= 1}
        onClick={() => onPageChange?.(current - 1)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
      >
        Prev
      </button>
      <span className="text-sm text-slate-600">
        {current} / {pages}
      </span>
      <button
        type="button"
        disabled={current >= pages}
        onClick={() => onPageChange?.(current + 1)}
        className="rounded border border-slate-300 px-3 py-1.5 text-sm disabled:opacity-40"
      >
        Next
      </button>
    </div>
  );
}
