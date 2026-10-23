export default function PageHeader({ title, children, description, className = "" }) {
  return (
    <div
      className={`sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-200/80 bg-white/95 px-4 py-4 backdrop-blur sm:flex-row sm:items-center sm:justify-between sm:px-6 ${className}`}
    >
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        ) : null}
      </div>
      {children ? (
        <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{children}</div>
      ) : null}
    </div>
  );
}
