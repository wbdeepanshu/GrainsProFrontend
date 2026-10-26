import { ChevronDown } from "lucide-react";

export default function DashboardSection({
  title,
  description,
  icon: Icon,
  children,
  className = "",
  expandable = false,
  expanded = false,
  onHeaderClick,
  headerHint = "",
  headerAction = null,
}) {
  const headerInteractive = expandable && typeof onHeaderClick === "function";

  return (
    <section
      className={`bg-white rounded-xl border border-[#c9a227]/50 shadow-sm overflow-hidden ${className}`}
    >
      <div
        className={`px-4 py-2.5 border-b border-[#c9a227]/30 bg-gradient-to-r from-neutral-50 to-white flex items-start justify-between gap-3 ${
          headerInteractive
            ? "cursor-pointer select-none hover:from-neutral-100 hover:to-neutral-50 transition-colors"
            : ""
        }`}
        onClick={headerInteractive ? onHeaderClick : undefined}
        role={headerInteractive ? "button" : undefined}
        tabIndex={headerInteractive ? 0 : undefined}
        aria-expanded={headerInteractive ? expanded : undefined}
      >
        <div className="min-w-0">
          <h2 className="text-sm sm:text-base font-semibold text-black flex items-center gap-2">
            {Icon && <Icon className="h-4 w-4 sm:h-5 sm:w-5 text-black shrink-0" />}
            {title}
          </h2>
          {description ? <p className="text-xs text-neutral-500 mt-0.5">{description}</p> : null}
          {headerInteractive && headerHint ? (
            <p className="text-[11px] text-neutral-600 mt-1 font-medium">{headerHint}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {headerAction}
          {headerInteractive ? (
            <ChevronDown
              className={`h-5 w-5 text-black shrink-0 transition-transform ${
                expanded ? "rotate-180" : ""
              }`}
              aria-hidden
            />
          ) : null}
        </div>
      </div>
      <div className="p-2.5 sm:p-3">{children}</div>
    </section>
  );
}
