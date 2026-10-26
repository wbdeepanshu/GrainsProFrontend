import { Activity, ArrowRight, Database, User } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import DashboardSection from "./DashboardSection";

interface RecentActivityProps {
  data?: {
    activities: Array<{
      id: number;
      sync_module: string;
      description: string;
      sync_date: string;
      sync_by: string;
      branch: string;
    }>;
    error: string | null;
  };
}

export default function RecentActivity({ data }: RecentActivityProps) {
  const [, setLocation] = useLocation();
  const activities = data?.activities || [];

  const viewMore = (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => setLocation("/recent-activity")}
      className="h-8 text-black hover:bg-neutral-100 border border-transparent hover:border-[#c9a227]/50"
    >
      View More
      <ArrowRight className="h-3.5 w-3.5 ml-1" />
    </Button>
  );

  if (data?.error) {
    return (
      <DashboardSection title="Recent Activity" icon={Activity} headerAction={viewMore}>
        <p className="text-center text-sm text-neutral-500 py-4">Unable to load recent activities</p>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Recent Activity" icon={Activity} headerAction={viewMore}>
      {activities.length === 0 ? (
        <p className="text-center text-sm text-neutral-500 py-4">No recent activities</p>
      ) : (
        <div className="space-y-1.5">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-center gap-2 rounded-lg border border-[#c9a227]/35 bg-gradient-to-br from-white to-neutral-50 px-2.5 py-1.5 hover:border-[#c9a227] transition-colors"
            >
              <div className="h-7 w-7 rounded-md bg-black text-white border border-[#c9a227]/55 shrink-0 flex items-center justify-center">
                <Database className="h-3.5 w-3.5" strokeWidth={2.25} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-black truncate">{activity.sync_module}</p>
                <div className="flex items-center gap-1 mt-0.5 text-[10px] text-neutral-500">
                  <User className="h-3 w-3 shrink-0" />
                  <span className="truncate">{activity.sync_by || "Unknown User"}</span>
                  <span className="shrink-0">·</span>
                  <span className="shrink-0 tabular-nums">{activity.sync_date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </DashboardSection>
  );
}
