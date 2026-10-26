import { Inbox, CheckCircle, Clock, XCircle, Package, Truck, Activity } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";

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
  const { hasReadPermission } = useUserPermissions();
  const hasInwardAccess = hasReadPermission("inward");

  if (!hasInwardAccess) {
    return null;
  }

  const handleStatusClick = (status: string) => {
    const params = new URLSearchParams();
    const dateStr = selectedDate || new Date().toISOString().split("T")[0];

    if (status === "pending") {
      // no date params
    } else if (status === "not_unloaded" || status === "unloading_pending") {
      params.append("to_date", dateStr);
    } else {
      params.append("from_date", dateStr);
      params.append("to_date", dateStr);
    }
    params.append("source", "dashboard");
    params.append("status", status);
    setLocation(`/reports/inward-list?${params.toString()}`);
  };

  const metrics = [
    data?.total_pending !== undefined && {
      title: "Total Pending",
      value: data.total_pending,
      icon: Clock,
      status: "pending",
    },
    data?.total_admin_approved !== undefined && {
      title: "Admin Approved",
      value: data.total_admin_approved,
      icon: CheckCircle,
      status: "approved",
    },
    data?.in_progress !== undefined && {
      title: "In Progress",
      value: data.in_progress,
      icon: Activity,
      status: "in-progress",
    },
    data?.rejected !== undefined && {
      title: "Rejected",
      value: data.rejected,
      icon: XCircle,
      status: "rejected",
    },
    data?.unloading_pending !== undefined && {
      title: "Unloading Pending",
      value: data.unloading_pending,
      icon: Package,
      status: "not_unloaded",
    },
    data?.unloaded !== undefined && {
      title: "Unloaded",
      value: data.unloaded,
      icon: Truck,
      status: "unloaded",
    },
    data?.inward_completed !== undefined && {
      title: "Inward Completed",
      value: data.inward_completed,
      icon: CheckCircle,
      status: "completed",
    },
  ].filter(Boolean) as Array<{
    title: string;
    value: number;
    icon: typeof Clock;
    status: string;
  }>;

  const gridClass =
    metrics.length <= 2
      ? "grid-cols-2"
      : metrics.length <= 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6";

  return (
    <DashboardSection title="Inward Entries Summary" icon={Inbox}>
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
        <p className="text-center text-sm text-neutral-500 py-4">No inward entries data available</p>
      )}
    </DashboardSection>
  );
}
