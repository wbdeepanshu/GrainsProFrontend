import { CheckCircle, Clock, FileText, Package, ShoppingCart, Truck } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";

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
  const { hasReadPermission } = useUserPermissions();
  const hasSalesOrderRead = hasReadPermission("sales_order");
  const hasOutwardRead = hasReadPermission("outward");

  if (!hasSalesOrderRead && !hasOutwardRead) {
    return null;
  }

  const handleStatusClick = (status?: string) => {
    const dateValue = selectedDate || new Date().toISOString().split("T")[0];
    const params = new URLSearchParams();
    params.append("from_date", dateValue);
    params.append("to_date", dateValue);

    if (status === "total_so") {
      setLocation(`/reports/sales-order-list?${params.toString()}`);
    } else if (status === "pending") {
      params.append("status", "pending");
      setLocation(`/reports/sales-order-list?${params.toString()}`);
    } else if (status === "approved") {
      params.append("status", "approved");
      setLocation(`/reports/sales-order-list?${params.toString()}`);
    } else if (status === "gate_pass") {
      setLocation(`/outward/outward-list?${params.toString()}`);
    } else if (status === "delivery_note") {
      setLocation(`/outward/delivery-notes?${params.toString()}`);
    }
  };

  const metrics: Array<{
    title: string;
    value: number;
    icon: typeof Clock;
    status: string;
  }> = [];

  if (hasSalesOrderRead) {
    if (data?.total_count !== undefined) {
      metrics.push({
        title: "Total SO",
        value: data.total_count,
        icon: ShoppingCart,
        status: "total_so",
      });
    }
    if (data?.pending_count !== undefined) {
      metrics.push({
        title: "Total Pending",
        value: data.pending_count,
        icon: Clock,
        status: "pending",
      });
    }
    if (data?.approved_count !== undefined) {
      metrics.push({
        title: "Total Approved",
        value: data.approved_count,
        icon: CheckCircle,
        status: "approved",
      });
    }
  }

  if (hasOutwardRead) {
    if (data?.gate_pass_count !== undefined) {
      metrics.push({
        title: "Gate Pass",
        value: data.gate_pass_count,
        icon: FileText,
        status: "gate_pass",
      });
    }
    if (data?.delivery_note_count !== undefined) {
      metrics.push({
        title: "Delivery Note",
        value: data.delivery_note_count,
        icon: Truck,
        status: "delivery_note",
      });
    }
  }

  const gridClass =
    metrics.length <= 2
      ? "grid-cols-2"
      : metrics.length === 3
        ? "grid-cols-2 sm:grid-cols-3"
        : metrics.length === 5
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          : "grid-cols-2 sm:grid-cols-4";

  return (
    <DashboardSection title="Outward Entries Summary" icon={Package}>
      {metrics.length > 0 ? (
        <div className={`grid ${gridClass} gap-1.5`}>
          {metrics.map((metric) => (
            <ThemeMetricCard
              key={metric.status}
              title={metric.title}
              value={metric.value}
              icon={metric.icon}
              inline
              onClick={() => handleStatusClick(metric.status)}
            />
          ))}
        </div>
      ) : (
        <p className="text-center text-sm text-neutral-500 py-4">No outward entries data available</p>
      )}
    </DashboardSection>
  );
}
