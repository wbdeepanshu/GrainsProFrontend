import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ReferenceLine,
  ResponsiveContainer,
} from "recharts";
import { format, parseISO } from "date-fns";
import { BarChart3, Loader2 } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { formatCurrency } from "@/lib/dashboardHelpers";
import { buildAmountAxis, formatAxisAmount, withAverageDelta } from "@/lib/chartAxisHelpers";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const DAY_OPTIONS = [1, 7, 15, 30];
const COLOR_APPROVED = "#000000";
const COLOR_REMAINING = "#d4af37";

function formatDeltaLabel(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || Math.abs(n) < 0.5) return "";
  const rounded = Math.round(n);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
}

function OverviewTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload || {};
  return (
    <div className="rounded-lg border border-[#c9a227]/40 bg-white px-3 py-2.5 shadow-lg text-xs min-w-[11rem]">
      <p className="font-semibold text-slate-800 mb-2">{label}</p>
      <div className="space-y-1 text-slate-600">
        <p className="flex justify-between gap-4">
          <span>Approved</span>
          <span className="font-semibold tabular-nums">{formatCurrency(row.approved_amount)}</span>
        </p>
        <p className="flex justify-between gap-4">
          <span>Total</span>
          <span className="font-semibold tabular-nums">{formatCurrency(row.total_amount)}</span>
        </p>
        <p className="flex justify-between gap-4 text-slate-500">
          <span>Count</span>
          <span className="tabular-nums">
            {row.approved_count ?? 0}/{row.total_count ?? 0}
          </span>
        </p>
      </div>
    </div>
  );
}

export default function SalesOrderOverviewChart({ selectedDate, enabled = true }) {
  const [days, setDays] = useState(7);

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["dashboard-sales-order-overview", selectedDate, days],
    queryFn: async () => {
      try {
        const response = await apiRequest("POST", `${API_BASE_URL}/api/dashboard-data/`, {
          object_name: "sales_order_overview",
          date: selectedDate,
          days,
        });
        return await response.json();
      } catch (err) {
        const message = String(err?.message || "");
        if (message.includes("Invalid object name") || message.startsWith("400:")) {
          return { status: 200, data: { sales_order_overview: { series: [] } }, soft_failed: true };
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

  const overview = data?.data?.sales_order_overview;
  const chartData = useMemo(() => {
    const series = Array.isArray(overview?.series) ? overview.series : [];
    return series.map((item) => {
      let label = item.date_display || item.date || "";
      try {
        if (item.date) label = format(parseISO(item.date), "dd MMM");
      } catch {
        /* keep */
      }
      const totalAmount = Math.max(Number(item.total_amount ?? 0), Number(item.approved_amount ?? 0));
      const approvedAmount = Number(item.approved_amount ?? 0);
      return {
        ...item,
        label,
        total_count: Math.max(Number(item.total_count ?? 0), Number(item.approved_count ?? 0)),
        approved_count: Number(item.approved_count ?? 0),
        total_amount: totalAmount,
        approved_amount: approvedAmount,
        remaining_amount: Math.max(totalAmount - approvedAmount, 0),
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
          acc.total_count += row.total_count;
          acc.approved_count += row.approved_count;
          acc.total_amount += row.total_amount;
          acc.approved_amount += row.approved_amount;
          return acc;
        },
        { total_count: 0, approved_count: 0, total_amount: 0, approved_amount: 0 },
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
        <BarChart3 className="h-4 w-4 text-black shrink-0" />
        <h2 className="text-sm font-semibold text-slate-900">Sales Order Overview</h2>
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
              Created <strong className="tabular-nums text-black">{formatCurrency(totals.total_amount)}</strong> (
              {totals.total_count})
            </span>
            <span>
              Approved <strong className="tabular-nums text-blue-950">{formatCurrency(totals.approved_amount)}</strong> (
              {totals.approved_count})
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
                <Tooltip content={<OverviewTooltip />} cursor={{ fill: "rgba(30,58,138,0.06)" }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                {averageAmount > 0 ? (
                  <ReferenceLine y={averageAmount} stroke="#94a3b8" strokeDasharray="4 4" />
                ) : null}
                <Bar
                  dataKey="approved_amount"
                  name="Approved"
                  stackId="so"
                  fill={COLOR_APPROVED}
                  maxBarSize={22}
                  isAnimationActive={false}
                />
                <Bar
                  dataKey="remaining_amount"
                  name="Remaining"
                  stackId="so"
                  fill={COLOR_REMAINING}
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
