import { Card } from "@/components/ui/card";
import { Inbox, CheckCircle, Clock, XCircle, UserCheck, Package, Truck, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface InwardEntriesSummary {
  total_pending?: number;
  total_admin_approved?: number;
  rejected?: number;
  unloading_pending?: number;
  unloaded?: number;
  in_progress?: number;
  inward_completed?: number;
  error: null | string;
}

interface InwardEntriesMetricsProps {
  data?: InwardEntriesSummary;
  selectedDate?: string;
}

export default function InwardEntriesMetrics({ data, selectedDate }: InwardEntriesMetricsProps) {
  const [, setLocation] = useLocation();
  
  // Get user permissions
  const { 
    hasReadPermission,
    hasCreatePermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading 
  } = useUserPermissions();
  
  // Check if user has read permission for inward - dashboard summary requires read access
  const hasInwardAccess = hasReadPermission("inward");
  
  if (!hasInwardAccess) {
    return null; // Hide the entire component if user has no inward access
  }

  // Handle click on status box to redirect to inward reports
  const handleStatusClick = (status: string) => {
    const params = new URLSearchParams();
    const dateStr = selectedDate || new Date().toISOString().split('T')[0];

    // Pending: no date params (all-time / list default).
    // Unloading Pending / Not unloaded: cumulative through dashboard date — only to_date (matches get_inward_entries_data).
    // Other cards: single dashboard day as from_date + to_date.
    if (status === "pending") {
      // no date params
    } else if (status === "not_unloaded" || status === "unloading_pending") {
      params.append("to_date", dateStr);
    } else {
      params.append("from_date", dateStr);
      params.append("to_date", dateStr);
    }
    params.append('source', 'dashboard');
    params.append('status', status);
    setLocation(`/reports/inward-list?${params.toString()}`);
  };

  // Create dynamic metrics based on available data
  const createMetrics = () => {
    const metrics = [];

    // Check what data is available and create appropriate metrics
    if (data?.total_pending !== undefined) {
      metrics.push({
        title: "Total Pending",
        value: data.total_pending,
        icon: Clock,
        gradient: "from-yellow-500 to-yellow-600",
        textColor: "text-yellow-100",
        bgColor: "bg-yellow-400",
        status: "pending",
      });
    }

    if (data?.total_admin_approved !== undefined) {
      metrics.push({
        title: "Admin Approved",
        value: data.total_admin_approved,
        icon: CheckCircle,
        gradient: "from-green-500 to-green-600",
        textColor: "text-green-100",
        bgColor: "bg-green-400",
        status: "approved",
      });
    }

    if (data?.in_progress !== undefined) {
      metrics.push({
        title: "In Progress",
        value: data.in_progress,
        icon: Activity,
        gradient: "from-blue-500 to-blue-600",
        textColor: "text-blue-100",
        bgColor: "bg-blue-400",
        status: "in-progress",
      });
    }

    if (data?.rejected !== undefined) {
      metrics.push({
        title: "Rejected",
        value: data.rejected,
        icon: XCircle,
        gradient: "from-red-500 to-red-600",
        textColor: "text-red-100",
        bgColor: "bg-red-400",
        status: "rejected",
      });
    }

    if (data?.unloading_pending !== undefined) {
      metrics.push({
        title: "Unloading Pending",
        value: data.unloading_pending,
        icon: Package,
        gradient: "from-orange-500 to-orange-600",
        textColor: "text-orange-100",
        bgColor: "bg-orange-400",
        status: "not_unloaded",
      });
    }

    if (data?.unloaded !== undefined) {
      metrics.push({
        title: "Unloaded",
        value: data.unloaded,
        icon: Truck,
        gradient: "from-indigo-500 to-indigo-600",
        textColor: "text-indigo-100",
        bgColor: "bg-indigo-400",
        status: "unloaded",
      });
    }

// console.log("cards" + data?.inward_completed);

    if (data?.inward_completed !== undefined) {
      metrics.push({
        title: "Inward Completed",
        value: data.inward_completed,
        icon: CheckCircle,
        gradient: "from-emerald-500 to-emerald-600",
        textColor: "text-emerald-100",
        bgColor: "bg-emerald-400",
        status: "completed",
      });
    }

    return metrics;
  };

  const metrics = createMetrics();

  // Determine grid layout based on number of metrics
  const getGridLayout = () => {
    const count = metrics.length;
    if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
    if (count <= 4) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
    if (count <= 6) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-6";
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Inward Entries Summary</h2>
      {metrics.length > 0 ? (
        <div className={`grid ${getGridLayout()} gap-4`}>
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <Card
                key={index}
                className={`bg-gradient-to-br ${metric.gradient} shadow-lg p-6 text-white border-0 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-105`}
                onClick={() => handleStatusClick(metric.status)}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`${metric.textColor} text-sm mb-1`}>{metric.title}</p>
                    <p className="text-3xl font-bold">{metric.value}</p>
                  </div>
                  <div className={`${metric.bgColor} bg-opacity-30 p-3 rounded-lg`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-8">
          <p className="text-gray-500">No inward entries data available</p>
        </div>
      )}
    </div>
  );
}
