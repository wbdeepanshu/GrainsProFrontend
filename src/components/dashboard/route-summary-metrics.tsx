import { CheckCircle, Clock, Route } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";

interface RouteSummary {
  total_routes_assigned?: number;
  total_visits_completed?: number;
  total_visits_pending?: number;
  error: null | string;
}

interface RouteSummaryMetricsProps {
  data?: RouteSummary;
  selectedDate?: string;
}

export default function RouteSummaryMetrics({ data, selectedDate }: RouteSummaryMetricsProps) {
  const [, setLocation] = useLocation();
  const { hasPermission } = useUserPermissions();
  const hasRouteManagementRead = hasPermission("route_management", "read");

  if (!hasRouteManagementRead || !data || data.error) {
    return null;
  }

  const dateValue = selectedDate || new Date().toISOString().split("T")[0];

  const handleCardClick = (target: "routes" | "completed" | "pending") => {
    if (target === "routes") {
      setLocation("/route-assignment");
      return;
    }
    const params = new URLSearchParams();
    params.append("from_date", dateValue);
    params.append("to_date", dateValue);
    if (target === "pending") {
      params.append("status", "pending");
    }
    setLocation(`/route-activity?${params.toString()}`);
  };

  const metrics = [
    {
      key: "routes" as const,
      title: "Routes Assigned",
      value: data.total_routes_assigned ?? 0,
      icon: Route,
    },
    {
      key: "completed" as const,
      title: "Visits Completed",
      value: data.total_visits_completed ?? 0,
      icon: CheckCircle,
    },
    {
      key: "pending" as const,
      title: "Visits Pending",
      value: data.total_visits_pending ?? 0,
      icon: Clock,
    },
  ];

  return (
    <DashboardSection title="Route Summary" icon={Route}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {metrics.map((metric) => (
          <ThemeMetricCard
            key={metric.key}
            title={metric.title}
            value={metric.value}
            icon={metric.icon}
            inline
            onClick={() => handleCardClick(metric.key)}
          />
        ))}
      </div>
    </DashboardSection>
  );
}
