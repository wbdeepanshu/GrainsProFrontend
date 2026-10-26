import { Cloud, CloudOff, Database } from "lucide-react";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";

interface StockItemsSummary {
  is_synced?: boolean;
  difference?: number;
  tally_item_count?: number;
  synced_item_count?: number;
  status?: number;
  error?: string;
}

interface StockSyncStatusProps {
  data?: StockItemsSummary;
}

export default function StockSyncStatus({ data }: StockSyncStatusProps) {
  if (!data) {
    return (
      <DashboardSection title="Stock Synchronization" icon={Database}>
        <p className="text-center text-sm text-neutral-500 py-4">Loading sync status...</p>
      </DashboardSection>
    );
  }

  const tallyItemCount = Number(data.tally_item_count ?? 0);
  const syncedItemCount = Number(data.synced_item_count ?? 0);
  const difference = Number(data.difference ?? 0);
  const isSynced = Boolean(data.is_synced);
  const hasError = Boolean(data.error);

  return (
    <DashboardSection title="Stock Synchronization" icon={Database}>
      <div className="space-y-1.5">
        <div
          className={`flex items-center justify-between rounded-lg border px-2.5 py-1.5 ${
            isSynced
              ? "border-[#c9a227]/45 bg-neutral-50"
              : "border-neutral-400 bg-neutral-100"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            <div className="h-7 w-7 rounded-md bg-black text-white border border-[#c9a227]/55 shrink-0 flex items-center justify-center">
              {isSynced ? (
                <Cloud className="h-3.5 w-3.5" strokeWidth={2.25} />
              ) : (
                <CloudOff className="h-3.5 w-3.5" strokeWidth={2.25} />
              )}
            </div>
            <span className="text-xs font-medium text-neutral-600">Sync Status</span>
          </div>
          <span className="text-xs font-bold text-black tabular-nums">
            {isSynced ? "Synced" : "Out of Sync"}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <ThemeMetricCard title="Tally Items" value={tallyItemCount} icon={Database} inline />
          <ThemeMetricCard title="Synced Items" value={syncedItemCount} icon={Cloud} inline />
          <ThemeMetricCard
            title="Difference"
            value={difference}
            icon={isSynced ? Cloud : CloudOff}
            inline
          />
        </div>

        {hasError ? (
          <p className="text-xs text-neutral-700 border border-[#c9a227]/40 rounded-lg px-2.5 py-1.5 bg-neutral-50">
            {data.error}
          </p>
        ) : null}
      </div>
    </DashboardSection>
  );
}
