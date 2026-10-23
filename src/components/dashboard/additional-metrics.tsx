import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Coins, IndianRupee, Plus } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";

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
}

export default function AdditionalMetrics({ data }: AdditionalMetricsProps) {
  const [, setLocation] = useLocation();

  // Get user permissions
  const { 
    hasCreatePermission,
    hasModuleAccess,
    hasReadPermission,
    isLoading: permissionsLoading 
  } = useUserPermissions();

  const handleAddHamali = () => {
    setLocation('/add-hamali');
  };

  // Check if user has any hamali permissions - if not, don't show the component
  // Check exact module name from API: "hamali"
  const hasHamaliAccess = hasReadPermission("hamali") || hasCreatePermission("hamali");
  
  if (!hasHamaliAccess) {
    return null; // Hide the entire component if user has no hamali access
  }

  if (!data) {
    return (
      <Card className="shadow-sm border border-gray-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Additional Metrics</h3>
            {hasCreatePermission('hamali') && (
              <Button 
                onClick={handleAddHamali}
                className="bg-black hover:bg-gray-800 text-white"
              >
                Add Hamali
              </Button>
            )}
          </div>
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-500">Loading additional metrics...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const metrics = [
    {
      title: "Transfer Types",
      value: data.transfer_types.length,
      icon: FileText,
    },
    {
      title: "Hamali Entries",
      value: data.total_hamali_entries,
      icon: Coins,
    },
    {
      title: "Hamali Amount",
      value: `₹${data.total_hamali_amount.toFixed(2)}`,
      icon: IndianRupee,
    },
  ];

  return (
    <Card className="shadow-sm border border-gray-200">
      <CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Additional Metrics</h3>
          {hasCreatePermission('hamali') && (
            <Button 
              onClick={handleAddHamali}
              className="bg-black hover:bg-gray-800 text-white"
            >
              Add Hamali
            </Button>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {metrics.map((metric, index) => {
            const Icon = metric.icon;
            return (
              <div key={index} className="text-center">
                <div className="bg-gray-100 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3">
                  <Icon className="text-gray-600 h-6 w-6" />
                </div>
                <h4 className="font-semibold text-gray-900 mb-1">{metric.title}</h4>
                <p className="text-3xl font-bold text-gray-900">{metric.value}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
