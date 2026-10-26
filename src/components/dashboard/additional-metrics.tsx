import { Button } from "@/components/ui/button";
import { Coins, FileText, IndianRupee, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";

interface HamaliSummary {
  total_hamali_entries: number;
  total_hamali_amount: number;
  transfer_types: Array<{
    transfer_type: string;
    transfer_type_display: string;
  }>;
}

interface AdditionalMetricsProps {
  data?: HamaliSummary;
  selectedDate?: string;
}

export default function AdditionalMetrics({ data }: AdditionalMetricsProps) {
  const [, setLocation] = useLocation();
  const { hasCreatePermission, hasReadPermission } = useUserPermissions();
  const hasHamaliAccess = hasReadPermission("hamali") || hasCreatePermission("hamali");

  if (!hasHamaliAccess) {
    return null;
  }

  const addButton = hasCreatePermission("hamali") ? (
    <Button
      onClick={() => setLocation("/add-hamali")}
      size="sm"
      className="h-8 bg-black hover:bg-neutral-800 text-white border border-[#c9a227]/70"
    >
      <Plus className="h-3.5 w-3.5 mr-1" />
      Add Hamali
    </Button>
  ) : null;

  if (!data) {
    return (
      <DashboardSection title="Additional Metrics" icon={Coins} headerAction={addButton}>
        <p className="text-center text-sm text-neutral-500 py-4">Loading additional metrics...</p>
      </DashboardSection>
    );
  }

  return (
    <DashboardSection title="Additional Metrics" icon={Coins} headerAction={addButton}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        <ThemeMetricCard
          title="Transfer Types"
          value={data.transfer_types?.length ?? 0}
          icon={FileText}
          inline
        />
        <ThemeMetricCard
          title="Hamali Entries"
          value={data.total_hamali_entries}
          icon={Coins}
          inline
        />
        <ThemeMetricCard
          title="Hamali Amount"
          value={data.total_hamali_amount}
          valueFormat="currency"
          icon={IndianRupee}
          inline
        />
      </div>
    </DashboardSection>
  );
}
