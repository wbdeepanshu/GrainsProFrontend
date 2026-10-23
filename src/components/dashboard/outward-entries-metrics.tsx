import { Card } from "@/components/ui/card";
import { CheckCircle, Clock, FileText, ShoppingCart, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface OutwardEntriesSummary {
  gate_pass_count?: number;
  delivery_note_count?: number;
  total_count?: number;
  pending_count?: number;
  approved_count?: number;
  error: null | string;
}

interface OutwardEntriesMetricsProps {
  data?: OutwardEntriesSummary;
  selectedDate?: string;
}

export default function OutwardEntriesMetrics({ data, selectedDate }: OutwardEntriesMetricsProps) {
  const [, setLocation] = useLocation();
  
  // Permission-based display: sales_order R → Total SO, Total Pending, Total Approved; outward R → Gate Pass, Delivery Note
  const { hasReadPermission } = useUserPermissions();
  const hasSalesOrderRead = hasReadPermission("sales_order");
  const hasOutwardRead = hasReadPermission("outward");
  
  // Hide entire section if user has neither permission
  if (!hasSalesOrderRead && !hasOutwardRead) {
    return null;
  }

  // Handle click on status box to redirect to appropriate pages
  const handleStatusClick = (status?: string) => {
    // Format date with fallback (same pattern as Inward Entries Summary)
    const dateValue = selectedDate || new Date().toISOString().split('T')[0];
    
    if (status === 'total_so') {
      // Redirect to sales order list with date filters
      const params = new URLSearchParams();
      params.append('from_date', dateValue);
      params.append('to_date', dateValue);
      setLocation(`/reports/sales-order-list?${params.toString()}`);
    } else if (status === 'pending') {
      // Redirect to sales order list with pending status filter and date filters
      const params = new URLSearchParams();
      params.append('status', 'pending');
      params.append('from_date', dateValue);
      params.append('to_date', dateValue);
      setLocation(`/reports/sales-order-list?${params.toString()}`);
    } else if (status === 'approved') {
      // Redirect to sales order list with approved status filter and date filters
      const params = new URLSearchParams();
      params.append('status', 'approved');
      params.append('from_date', dateValue);
      params.append('to_date', dateValue);
      setLocation(`/reports/sales-order-list?${params.toString()}`);
    } else if (status === 'gate_pass') {
      // Redirect to outward list with date filters
      const params = new URLSearchParams();
      params.append('from_date', dateValue);
      params.append('to_date', dateValue);
      setLocation(`/outward/outward-list?${params.toString()}`);
    } else if (status === 'delivery_note') {
      // Redirect to delivery notes page with date filters
      const params = new URLSearchParams();
      params.append('from_date', dateValue);
      params.append('to_date', dateValue);
      setLocation(`/outward/delivery-notes?${params.toString()}`);
    }
  };

  // Show boxes by permission only: sales_order R → SO boxes; outward R → Gate Pass & Delivery Note
  const createMetrics = () => {
    const metrics = [];

    // Sales order R permission → Total SO, Total Pending, Total Approved
    if (hasSalesOrderRead) {
      if (data?.total_count !== undefined) {
        metrics.push({
          title: "Total SO",
          value: data.total_count,
          icon: ShoppingCart,
          gradient: "from-blue-500 to-blue-600",
          textColor: "text-blue-100",
          bgColor: "bg-blue-400",
          status: "total_so",
        });
      }
      if (data?.pending_count !== undefined) {
        metrics.push({
          title: "Total Pending",
          value: data.pending_count,
          icon: Clock,
          gradient: "from-yellow-500 to-yellow-600",
          textColor: "text-yellow-100",
          bgColor: "bg-yellow-400",
          status: "pending",
        });
      }
      if (data?.approved_count !== undefined) {
        metrics.push({
          title: "Total Approved",
          value: data.approved_count,
          icon: CheckCircle,
          gradient: "from-green-500 to-green-600",
          textColor: "text-green-100",
          bgColor: "bg-green-400",
          status: "approved",
        });
      }
    }

    // Outward R permission → Gate Pass, Delivery Note
    if (hasOutwardRead) {
      if (data?.gate_pass_count !== undefined) {
        metrics.push({
          title: "Gate Pass",
          value: data.gate_pass_count,
          icon: FileText,
          gradient: "from-purple-500 to-purple-600",
          textColor: "text-purple-100",
          bgColor: "bg-purple-400",
          status: "gate_pass",
        });
      }
      if (data?.delivery_note_count !== undefined) {
        metrics.push({
          title: "Delivery Note",
          value: data.delivery_note_count,
          icon: Truck,
          gradient: "from-indigo-500 to-indigo-600",
          textColor: "text-indigo-100",
          bgColor: "bg-indigo-400",
          status: "delivery_note",
        });
      }
    }

    return metrics;
  };

  const metrics = createMetrics();

  // Determine grid layout based on number of metrics
  const getGridLayout = () => {
    const count = metrics.length;
    // For role 9: 3 boxes layout
    if (count === 3) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
    // For other roles: 5 boxes layout
    if (count === 5) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-5";
    if (count <= 2) return "grid-cols-1 sm:grid-cols-2";
    if (count <= 4) return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4";
    return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5";
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Outward Entries Summary</h2>
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
          <p className="text-gray-500">No outward entries data available</p>
        </div>
      )}
    </div>
  );
}

