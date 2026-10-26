import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { Receipt, Loader2 } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/dashboardHelpers";
import { buildAmountAxis, formatAxisAmount, withAverageDelta } from "@/lib/chartAxisHelpers";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const DAY_OPTIONS = [1, 7, 15, 30];
const COLOR_AMOUNT = "#000000";

function formatDeltaLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 0.5) return "";
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function ReceiptsTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-lg border border-[#c9a227]/40 bg-white px-3 py-2.5 shadow-lg text-xs min-w-[11rem]">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      <p className="flex justify-between gap-4 text-slate-600">
        <span>Receipts</span>
        <span className="font-semibold tabular-nums">{row.receipt_count ?? 0}</span>
      </p>
      <p className="flex justify-between gap-4 text-slate-600">
        <span>Amount</span>
        <span className="font-semibold tabular-nums">{formatCurrency(row.total_amount)}</span>
      </p>
    </div>
  );
}

export default function ReceiptsOverviewChart({ selectedDate, enabled = true }) {
  const [days, setDays] = useState(7);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard-receipts-overview", selectedDate, days],
    queryFn: async () => {
      try {
        const response = await apiRequest("POST", `${API_BASE_URL}/api/dashboard-data/`, {
          object_name: "receipts_overview",
          date: selectedDate,
          days,
        });
        return await response.json();
      } catch (err) {
        const message = String(err?.message || "");
        if (message.includes("Invalid object name") || message.startsWith("400:")) {
          return { status: 200, data: { receipts_overview: { series: [] } }, soft_failed: true };
        }
        throw err;
      }
    },
    enabled: enabled && !!AuthService.getAccessToken() && !!selectedDate,
    refetchOnWindowFocus: false,
    staleTime: 2 * 60 * 1000,
    retry: (failureCount, err) => {
      const message = String(err?.message || "");
      if (message.includes("Invalid object name") || message.startsWith("400:")) return false;
      return failureCount < 1;
    },
  });

  const overview = data?.data?.receipts_overview;
  const chartData = useMemo(() => {
    const series = Array.isArray(overview?.series) ? overview.series : [];
    return series.map((item) => {
      let label = item.date_display || item.date || "";
      try {
        if (item.date) label = format(parseISO(item.date), "dd MMM");
      } catch {
        /* keep */
      }
      return {
        ...item,
        label,
        receipt_count: Number(item.receipt_count ?? 0),
        total_amount: Number(item.total_amount ?? 0),
      };
    });
  }, [overview]);

  const { chartRows, averageAmount } = useMemo(() => {
    const { average, rows } = withAverageDelta(chartData, "total_amount");
    return { chartRows: rows, averageAmount: average };
  }, [chartData]);

  const totals = useMemo(
    () =>
      chartRows.reduce(
        (acc, row) => {
          acc.receipt_count += row.receipt_count;
          acc.total_amount += row.total_amount;
          return acc;
        },
        { receipt_count: 0, total_amount: 0 },
      ),
    [chartRows],
  );

  const { yTicks, yDomain } = useMemo(() => {
    const maxVal = Math.max(...chartRows.map((d) => Number(d.total_amount || 0)), 0);
    const { ticks, domainMax } = buildAmountAxis(maxVal);
    return { yTicks: ticks, yDomain: [0, domainMax] };
  }, [chartRows]);

  if (!enabled) return null;

  return (
    <section className="bg-white rounded-xl border border-[#c9a227]/50 shadow-sm overflow-hidden h-full flex flex-col">
      <div className="px-3 py-2.5 border-b border-[#c9a227]/25 bg-gradient-to-r from-neutral-50 to-white flex items-center gap-2">
        <Receipt className="h-4 w-4 text-black shrink-0" />
        <h2 className="text-sm font-semibold text-slate-900">Receipts Overview</h2>
      </div>
      <div className="p-3 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="inline-flex rounded-lg border border-[#c9a227]/40 bg-neutral-100 p-0.5">
              {DAY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setDays(option)}
                  className={`px-2 py-1 cursor-pointer text-[11px] font-semibold rounded-md ${
                    days === option ? "bg-black text-white shadow-sm" : "text-slate-600 hover:bg-white"
                  }`}
                >
                  {option === 1 ? "1D" : `${option}D`}
                </button>
              ))}
            </div>
            {(isLoading || isFetching) && <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-700" />}
          </div>
          <div className="flex flex-wrap gap-2 text-[10px] text-slate-600">
            <span>
              Receipts <strong className="tabular-nums text-black">{totals.receipt_count}</strong>
            </span>
            <span>
              Amount <strong className="tabular-nums">{formatCurrency(totals.total_amount)}</strong>
            </span>
            {averageAmount > 0 ? (
              <span>
                Avg <strong className="tabular-nums">{formatCurrency(averageAmount)}</strong>
              </span>
            ) : null}
          </div>
        </div>

        {error ? (
          <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-4 text-center text-sm text-red-700">
            Failed to load.{" "}
            <button type="button" className="underline" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : isLoading && !chartRows.length ? (
          <div className="h-40 flex items-center justify-center text-sm text-slate-500 gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : (
          <div className="w-full h-44 sm:h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartRows} margin={{ top: 8, right: 6, left: -2, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} tickLine={false} />
                <YAxis
                  domain={yDomain}
                  ticks={yTicks}
                  tickFormatter={formatAxisAmount}
                  tick={{ fontSize: 10, fill: "#64748b" }}
                  tickLine={false}
                  axisLine={false}
                  width={40}
                />
                <Tooltip content={<ReceiptsTooltip />} cursor={{ fill: "rgba(30,58,138,0.06)" }} />
                {averageAmount > 0 ? (
                  <ReferenceLine y={averageAmount} stroke="#94a3b8" strokeDasharray="4 4" />
                ) : null}
                <Bar
                  dataKey="total_amount"
                  name="Amount"
                  fill={COLOR_AMOUNT}
                  radius={[3, 3, 0, 0]}
                  maxBarSize={22}
                  isAnimationActive={false}
                >
                  <LabelList
                    dataKey="avg_delta_pct"
                    position="top"
                    formatter={formatDeltaLabel}
                    style={{ fontSize: 9, fill: "#64748b", fontWeight: 600 }}
                  />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </section>
  );
}
