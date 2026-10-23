import { Card, CardContent } from "@/components/ui/card";

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
      <Card className="shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Synchronization</h3>
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading sync status...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const tallyItemCount = Number(data.tally_item_count ?? 0);
  const syncedItemCount = Number(data.synced_item_count ?? 0);
  const difference = Number(data.difference ?? 0);
  const isSynced = Boolean(data.is_synced);
  const syncStatus = isSynced ? "Synced" : "Out of Sync";
  const hasError = Boolean(data.error);

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Stock Synchronization</h3>
        
        <div className="space-y-4">
          <div className={`flex items-center justify-between p-4 rounded-lg border ${
            isSynced ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center space-x-3">
              <div className={`w-3 h-3 rounded-full ${
                isSynced ? 'bg-green-500' : 'bg-red-500'
              }`} />
              <span className={`font-medium ${
                isSynced ? 'text-green-800' : 'text-red-800'
              }`}>
                Sync Status
              </span>
            </div>
            <span className={`font-semibold ${
              isSynced ? 'text-green-600' : 'text-red-600'
            }`}>
              {syncStatus}
            </span>
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Tally Items</p>
              <p className="text-2xl font-bold text-gray-900">{tallyItemCount.toLocaleString()}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4">
              <p className="text-sm text-gray-600 mb-1">Synced Items</p>
              <p className="text-2xl font-bold text-gray-900">{syncedItemCount.toLocaleString()}</p>
            </div>
          </div>
          
          <div className={`rounded-lg p-4 border ${
            difference === 0 ? 'bg-blue-50 border-blue-200' : 'bg-yellow-50 border-yellow-200'
          }`}>
            <div className="flex items-center justify-between">
              <span className={`font-medium ${
                difference === 0 ? 'text-blue-800' : 'text-yellow-800'
              }`}>
                Difference
              </span>
              <span className={`font-semibold ${
                difference === 0 ? 'text-blue-600' : 'text-yellow-600'
              }`}>
                {difference}
              </span>
            </div>
          </div>

          {hasError && (
            <div className="rounded-lg border border-orange-200 bg-orange-50 p-4">
              <p className="text-sm font-medium text-orange-800">{data.error}</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
