import { formatCurrency } from "@/lib/dashboardHelpers";

export default function ThemeMetricCard({
  title,
  value,
  icon: Icon,
  onClick,
  valueFormat = "number",
  displayValue,
  subtitle,
  tone = "brand",
  inline = false,
}) {
  const numeric = Number(value ?? 0);
  const displayValueFinal =
    displayValue != null && String(displayValue).trim() !== ""
      ? String(displayValue)
      : valueFormat === "currency"
        ? formatCurrency(numeric)
        : numeric.toLocaleString("en-IN");

  const t = {
    wrap: "border-[#c9a227]/55 from-white to-neutral-50 hover:border-[#c9a227]",
    icon: "bg-black text-white shadow-sm border border-[#c9a227]/60",
    title: "text-neutral-500",
    value: "text-black",
    subtitle: "text-neutral-500",
  };

  const longValue = displayValueFinal.length > 10;
  const valueSizeClass =
    longValue || valueFormat === "currency"
      ? "text-[11px] sm:text-xs md:text-sm"
      : "text-sm sm:text-base";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      title={`${title} : ${displayValueFinal}${subtitle ? ` (${subtitle})` : ""}`}
      className={`w-full text-left rounded-lg border bg-gradient-to-br shadow-sm transition-all duration-200 px-2.5 py-1.5 sm:px-3 sm:py-2 ${t.wrap} ${
        onClick ? "cursor-pointer hover:shadow-md" : "cursor-default"
      }`}
    >
      <div className="flex items-start justify-between gap-2 min-w-0">
        <div className="min-w-0 flex-1">
          <p className={`${t.title} text-[10px] sm:text-xs font-medium leading-snug line-clamp-2`}>{title}</p>
          <p
            title={displayValueFinal}
            className={`${t.value} font-bold tabular-nums leading-tight break-all ${valueSizeClass} ${
              inline ? "mt-0.5" : "mt-1"
            }`}
          >
            {displayValueFinal}
          </p>
          {subtitle ? (
            <p className={`${t.subtitle} text-[10px] mt-0.5 leading-snug truncate`} title={subtitle}>
              {subtitle}
            </p>
          ) : null}
        </div>
        {Icon ? (
          <div
            className={`h-6 w-6 sm:h-7 sm:w-7 rounded-md ${t.icon} shrink-0 flex items-center justify-center`}
          >
            <Icon className="h-3 w-3 sm:h-3.5 sm:w-3.5" strokeWidth={2.25} />
          </div>
        ) : null}
      </div>
    </button>
  );
}
