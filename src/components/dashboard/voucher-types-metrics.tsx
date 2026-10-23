import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { MinusCircle, PlusCircle, ArrowRightLeft, Truck, FileText, ArrowRight } from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";

interface VoucherType {
  voucher_type_name: string;
  total_transaction_count: number;
  user_transaction_count: number;
  is_batch: boolean;
  is_bardan: boolean;
  in_source: boolean;
  in_destination: boolean;
  source_alias: string;
  destination_alias: string;
}

interface VoucherSummary {
  voucher_types: VoucherType[];
  total_voucher_types: number;
  total_organization_transactions: number;
  total_user_transactions: number;
}

interface VoucherTypesMetricsProps {
  data?: VoucherSummary;
  selectedDate: string;
}

export default function VoucherTypesMetrics({ data, selectedDate }: VoucherTypesMetricsProps) {
  const [, setLocation] = useLocation();

  // Get user permissions
  const {
    hasReadPermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  // Check if user has read permission for stock journals - if not, don't show the component
  // Check exact module name from API: "stock_journals" (plural)
  const hasStockJournalAccess = hasReadPermission("stock_journals");

  if (!hasStockJournalAccess) {
    return null; // Hide the entire component if user has no stock journal access
  }

  const getIconForVoucherType = (voucherName: string) => {
    if (voucherName.toLowerCase().includes("consumption")) return MinusCircle;
    if (voucherName.toLowerCase().includes("production")) return PlusCircle;
    if (voucherName.toLowerCase().includes("brand")) return ArrowRightLeft;
    if (voucherName.toLowerCase().includes("stock")) return Truck;
    return FileText;
  };

  const getColorForVoucherType = (index: number) => {
    const colors = [
      { borderColor: "border-purple-500", iconBg: "bg-purple-100", iconColor: "text-purple-600" },
      { borderColor: "border-indigo-500", iconBg: "bg-indigo-100", iconColor: "text-indigo-600" },
      { borderColor: "border-teal-500", iconBg: "bg-teal-100", iconColor: "text-teal-600" },
      { borderColor: "border-orange-500", iconBg: "bg-orange-100", iconColor: "text-orange-600" },
      { borderColor: "border-green-500", iconBg: "bg-green-100", iconColor: "text-green-600" },
      { borderColor: "border-blue-500", iconBg: "bg-blue-100", iconColor: "text-blue-600" },
    ];
    return colors[index % colors.length];
  };

  const getPathForVoucherName = (name: string) => {
    const lowerName = name.toLowerCase();

    // All stock journal related vouchers should go to stock journal screen
    if (lowerName.startsWith("sj") ||
      lowerName.includes("stock") ||
      lowerName.includes("consumption") ||
      lowerName.includes("production") ||
      lowerName.includes("transfer") ||
      lowerName.includes("inward") ||
      lowerName.includes("outward")) {
      return "/reports/stock-journal";
    }

    // Purchase related vouchers
    if (lowerName.includes("purchase")) return "/reports/purchaseorders-reports";

    // Brand related vouchers
    if (lowerName.includes("brand")) return "/reports/brand-transfer";

    // Hamali related vouchers
    if (lowerName.includes("hamali")) return "/reports/hamali";

    // Default to stock journal for any other voucher types
    return "/reports/stock-journal";
  };

  if (!data || !data.voucher_types) {
    return null; // Don't show anything if data is not available
  }

  // Check if voucher_types array is empty
  if (data.voucher_types.length === 0) {
    return null; // Don't show header or section if there are no voucher types
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">Voucher Types Summary</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {data.voucher_types.map((voucher, index) => {

          const Icon = getIconForVoucherType(voucher.voucher_type_name);
          const colors = getColorForVoucherType(index);
          const href = getPathForVoucherName(voucher.voucher_type_name);

          const fullPath = `${href}?voucher_type=${encodeURIComponent(voucher.voucher_type_name)}&date=${selectedDate}`;
          return (
            <Card
              key={index}
              className={`cursor-pointer shadow-sm border-l-4 ${colors.borderColor} hover:shadow-lg hover:scale-105 transition-all duration-200 group`}
              onClick={() => {
                // Store voucher name in localStorage (fallback for stock-journal)
                localStorage.setItem("selectedVoucherType", voucher.voucher_type_name);
                // Store dashboard date for stock-journal (fallback)
                localStorage.setItem("DashboardStartDate", selectedDate);
                // Navigate with date + voucher_type in URL so stock-journal shows only that day's entries
                setLocation(fullPath);
              }}
            >
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-gray-600 text-sm mb-1">{voucher.voucher_type_display}</p>
                    <p className="text-2xl font-bold text-gray-900">
                      {/* {voucher.user_transaction_count}/{voucher.total_transaction_count} */}
                      {voucher.total_transaction_count}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {voucher.source_alias} → {voucher.destination_alias}
                    </p>
                    <p className="text-xs text-blue-600 mt-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex items-center">
                      <ArrowRight className="h-3 w-3 mr-1" />
                      View Stock Journal
                    </p>
                  </div>
                  <div className={`${colors.iconBg} p-3 rounded-lg group-hover:scale-110 transition-transform duration-200`}>
                    <Icon className={`${colors.iconColor} h-5 w-5`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
