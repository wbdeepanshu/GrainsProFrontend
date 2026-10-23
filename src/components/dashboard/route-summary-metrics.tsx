import { Card } from "@/components/ui/card";
import { CheckCircle, Clock, Route } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";

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

  if (!hasRouteManagementRead) {
    return null;
  }

  if (!data || data.error) {
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
      key: "routes",
      title: "Routes Assigned",
      value: data.total_routes_assigned ?? 0,
      icon: Route,
      gradient: "from-blue-500 to-blue-600",
      textColor: "text-blue-100",
      bgColor: "bg-blue-400",
    },
    {
      key: "completed",
      title: "Visits Completed",
      value: data.total_visits_completed ?? 0,
      icon: CheckCircle,
      gradient: "from-green-500 to-green-600",
      textColor: "text-green-100",
      bgColor: "bg-green-400",
    },
    {
      key: "pending",
      title: "Visits Pending",
      value: data.total_visits_pending ?? 0,
      icon: Clock,
      gradient: "from-amber-500 to-amber-600",
      textColor: "text-amber-100",
      bgColor: "bg-amber-400",
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Route Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <Card
              key={metric.key}
              className={`bg-gradient-to-br ${metric.gradient} shadow-lg p-6 text-white border-0 cursor-pointer hover:shadow-xl transition-all duration-200 hover:scale-105`}
              onClick={() => handleCardClick(metric.key as "routes" | "completed" | "pending")}
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
    </div>
  );
}
