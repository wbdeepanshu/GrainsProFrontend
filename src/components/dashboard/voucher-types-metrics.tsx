import { useLocation } from "wouter";
import {
  MinusCircle,
  PlusCircle,
  ArrowRightLeft,
  Truck,
  FileText,
  BookOpen,
} from "lucide-react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import DashboardSection from "./DashboardSection";
import ThemeMetricCard from "./ThemeMetricCard";

interface VoucherType {
  voucher_type_name: string;
  voucher_type_display?: string;
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
  const { hasReadPermission } = useUserPermissions();
  const hasStockJournalAccess = hasReadPermission("stock_journals");

  if (!hasStockJournalAccess) {
    return null;
  }

  const getIconForVoucherType = (voucherName: string) => {
    const lower = voucherName.toLowerCase();
    if (lower.includes("consumption")) return MinusCircle;
    if (lower.includes("production")) return PlusCircle;
    if (lower.includes("brand")) return ArrowRightLeft;
    if (lower.includes("stock")) return Truck;
    return FileText;
  };

  const getPathForVoucherName = (name: string) => {
    const lowerName = name.toLowerCase();

    if (
      lowerName.startsWith("sj") ||
      lowerName.includes("stock") ||
      lowerName.includes("consumption") ||
      lowerName.includes("production") ||
      lowerName.includes("transfer") ||
      lowerName.includes("inward") ||
      lowerName.includes("outward")
    ) {
      return "/reports/stock-journal";
    }
    if (lowerName.includes("purchase")) return "/reports/purchaseorders-reports";
    if (lowerName.includes("brand")) return "/reports/brand-transfer";
    if (lowerName.includes("hamali")) return "/reports/hamali";
    return "/reports/stock-journal";
  };

  if (!data?.voucher_types?.length) {
    return null;
  }

  return (
    <DashboardSection title="Voucher Types Summary" icon={BookOpen}>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1.5">
        {data.voucher_types.map((voucher) => {
          const Icon = getIconForVoucherType(voucher.voucher_type_name);
          const href = getPathForVoucherName(voucher.voucher_type_name);
          const fullPath = `${href}?voucher_type=${encodeURIComponent(voucher.voucher_type_name)}&date=${selectedDate}`;
          const title = voucher.voucher_type_display || voucher.voucher_type_name;
          const subtitle =
            voucher.source_alias || voucher.destination_alias
              ? `${voucher.source_alias || "—"} → ${voucher.destination_alias || "—"}`
              : undefined;

          return (
            <ThemeMetricCard
              key={voucher.voucher_type_name}
              title={title}
              value={voucher.total_transaction_count}
              icon={Icon}
              subtitle={subtitle}
              inline
              onClick={() => {
                localStorage.setItem("selectedVoucherType", voucher.voucher_type_name);
                localStorage.setItem("DashboardStartDate", selectedDate);
                setLocation(fullPath);
              }}
            />
          );
        })}
      </div>
    </DashboardSection>
  );
}
