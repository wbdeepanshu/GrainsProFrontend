import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Building2,
  CheckCircle2,
  CreditCard,
  Eye,
  History,
  Loader2,
  LogOut,
  MapPin,
  Menu,
  Search,
  Smartphone,
  Trash2,
  User,
  Users,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import CommonLoader from "@/components/common/loader";
import { AuthService } from "@/lib/auth";
import { queryClient as appQueryClient } from "@/lib/queryClient";
import {
  fetchRetailerInfoDetail,
  fetchRetailersInfo,
  removeRetailerAccess,
} from "@/lib/retailers_api";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 400;

function formatPoints(value) {
  const num = Number(value);
  return Number.isFinite(num) ? num.toFixed(2) : "0.00";
}

function combinedWalletPoints(row) {
  const wallet = Number(row?.wallet_points) || 0;
  const bonus = Number(row?.bonus_points) || 0;
  return formatPoints(wallet + bonus);
}

function displayValue(value) {
  if (value === null || value === undefined || String(value).trim() === "") return "—";
  return String(value);
}

function isCreditTransaction(item) {
  return String(item?.transaction_type || "").trim().toLowerCase() === "credit";
}

function DetailSection({ title, icon: Icon, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white">
        {Icon && <Icon className="h-4 w-4 text-blue-100 shrink-0" />}
        <h3 className="text-sm font-semibold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DetailField({ label, value, children }) {
  const display = value != null && String(value).trim() !== "" ? value : null;
  return (
    <div className="min-w-0 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</p>
      <div className="text-sm font-semibold text-slate-900 mt-1 break-words">
        {children ?? display ?? "—"}
      </div>
    </div>
  );
}

export default function RetailersInfo() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const {
    permissions,
    hasPermission,
    isLoading: permissionsLoading,
  } = useUserPermissions();

  const hasRetailersModule = (permissions || []).some(
    (p) => String(p?.alias || "").toLowerCase() === "retailers_app",
  );
  // Prefer retailers_app when present; otherwise allow (Ledger Management pages are not module-gated).
  const canRead = hasRetailersModule ? hasPermission("retailers_app", "read") : true;
  const canDelete = hasRetailersModule ? hasPermission("retailers_app", "delete") : true;

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isActiveFilter, setIsActiveFilter] = useState("active");
  const [currentPage, setCurrentPage] = useState(1);

  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRetailerId, setSelectedRetailerId] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const confirmLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await AuthService.logout();
      appQueryClient.clear();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      setShowLogoutConfirm(false);
      setIsLoggingOut(false);
      window.location.href = `${import.meta.env.BASE_URL || "/"}login`.replace(/\/+/g, "/");
    }
  };

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [searchInput]);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedSearch, isActiveFilter]);

  const listParams = useMemo(() => {
    const params = {
      page: currentPage,
      per_page: PAGE_SIZE,
    };
    if (debouncedSearch) params.search = debouncedSearch;
    if (isActiveFilter === "active") params.is_active = "true";
    if (isActiveFilter === "inactive") params.is_active = "false";
    return params;
  }, [currentPage, debouncedSearch, isActiveFilter]);

  const {
    data: listData,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: ["retailers-info", listParams],
    queryFn: () => fetchRetailersInfo(listParams),
    enabled: !permissionsLoading && canRead,
  });

  const { data: detailData, isLoading: detailLoading } = useQuery({
    queryKey: ["retailer-info-detail", selectedRetailerId],
    queryFn: () => fetchRetailerInfoDetail(selectedRetailerId),
    enabled: detailOpen && Boolean(selectedRetailerId),
  });

  const removeMutation = useMutation({
    mutationFn: (retailerId) => removeRetailerAccess(retailerId),
    onSuccess: (result) => {
      toast({
        title: "Success",
        description: result?.message || "Mobile app access removed",
      });
      setConfirmRemove(null);
      if (selectedRetailerId && confirmRemove?.retailer_id === selectedRetailerId) {
        setDetailOpen(false);
        setSelectedRetailerId(null);
      }
      queryClient.invalidateQueries({ queryKey: ["retailers-info"] });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err?.message || "Failed to remove access",
        variant: "destructive",
      });
    },
  });

  const rows = listData?.data || [];
  const pagination = listData?.pagination;
  const totalPages = pagination?.total_pages || 1;

  const customer = detailData?.customer;
  const retailer = detailData?.retailer;
  const detailTitle = customer?.name || retailer?.name || selectedRetailerId;

  const layoutShell = (content) => (
    <div className="flex h-screen bg-slate-100/80 overflow-hidden">
      {isMobile ? (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      ) : (
        <Sidebar />
      )}
      <div className="flex-1 flex flex-col min-w-0 min-h-0 overflow-hidden">{content}</div>
    </div>
  );

  if (permissionsLoading) {
    return layoutShell(
      <div className="flex-1 flex items-center justify-center">
        <CommonLoader text="Loading permissions..." />
      </div>,
    );
  }

  if (!canRead) {
    return layoutShell(
      <main className="flex-1 p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-blue-100 shadow-sm p-10 text-center max-w-md">
          <Smartphone className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Access denied</h2>
          <p className="text-sm text-gray-500">
            You do not have permission to view retailers info.
          </p>
        </div>
      </main>,
    );
  }

  return layoutShell(
    <>
      <div className="sticky top-0 z-30 flex-shrink-0 bg-white border-b border-slate-200">
        <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-3">
          <div className="flex items-center gap-3 min-w-0">
            {isMobile ? (
              <button
                type="button"
                onClick={() => setIsMobileSidebarOpen(true)}
                className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
                aria-label="Open menu"
              >
                <Menu className="h-5 w-5" />
              </button>
            ) : null}
            <h1 className="text-lg font-semibold text-slate-900 truncate">Retailers Info</h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => refetch()}
              disabled={isFetching}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 cursor-pointer"
            >
              <Loader2 className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => setShowLogoutConfirm(true)}
              className="inline-flex items-center justify-center p-2 rounded-lg border border-gray-200 bg-white text-slate-600 hover:bg-red-50 hover:text-red-600 hover:border-red-200 cursor-pointer"
              aria-label="Log out"
              title="Log out"
            >
              <LogOut className="h-5 w-5" />
            </button>
          </div>
        </div>
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6">
        <div className="max-w-[1400px] mx-auto space-y-4">
          <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
              <div className="min-w-0 sm:col-span-2 lg:col-span-2">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Search
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Search by name or mobile..."
                    className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-800/20 focus:border-blue-800"
                  />
                </div>
              </div>
              <div className="min-w-0">
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  Status
                </label>
                <Select value={isActiveFilter} onValueChange={setIsActiveFilter}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="all">All</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </section>

          <section className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            {isLoading ? (
              <div className="p-10">
                <CommonLoader text="Loading retailers..." />
              </div>
            ) : rows.length === 0 ? (
              <div className="p-10 text-center text-slate-500">
                <Smartphone className="h-10 w-10 mx-auto mb-3 text-slate-300" />
                No retailers found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[900px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                      <th className="px-4 py-3 font-semibold">Name</th>
                      <th className="px-4 py-3 font-semibold">Mobile</th>
                      <th className="px-4 py-3 font-semibold">Organization</th>
                      <th className="px-4 py-3 font-semibold">Wallet Points</th>
                      <th className="px-4 py-3 font-semibold">Status</th>
                      <th className="px-4 py-3 font-semibold">Allowed Access On</th>
                      <th className="px-4 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((row) => (
                      <tr
                        key={`${row.mapping_id}-${row.retailer_id}`}
                        className="hover:bg-slate-50/80"
                      >
                        <td className="px-4 py-3 font-medium text-slate-900 whitespace-nowrap">
                          {displayValue(row.name)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {displayValue(row.mobile)}
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {displayValue(row.organization_name)}
                        </td>
                        <td className="px-4 py-3 font-semibold text-slate-900 whitespace-nowrap">
                          {combinedWalletPoints(row)}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-md font-medium border ${
                              row.is_active
                                ? "bg-green-50 text-green-700 border-green-200"
                                : "bg-slate-100 text-slate-600 border-slate-200"
                            }`}
                          >
                            {row.is_active ? (
                              <CheckCircle2 className="h-3.5 w-3.5" />
                            ) : (
                              <XCircle className="h-3.5 w-3.5" />
                            )}
                            {row.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                          {displayValue(row.allowed_access_on)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedRetailerId(row.retailer_id);
                                setDetailOpen(true);
                              }}
                              title="View details"
                              className="inline-flex items-center justify-center h-8 w-8 rounded-lg bg-blue-900 text-white hover:bg-blue-800 cursor-pointer shadow-sm"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            {canDelete && row.is_active ? (
                              <button
                                type="button"
                                onClick={() => setConfirmRemove(row)}
                                title="Remove mobile access"
                                className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer shadow-sm"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {totalPages > 1 ? (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-slate-500">
                Page {pagination?.current_page || currentPage} of {totalPages} ·{" "}
                {pagination?.total_count || 0} retailers
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm disabled:opacity-50 cursor-pointer"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-sm disabled:opacity-50 cursor-pointer"
                >
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </main>

      {detailOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-4xl my-8 overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white flex items-start justify-between gap-3 sticky top-0 z-10">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">Retailer Details</h2>
                {detailTitle ? (
                  <p className="text-sm text-blue-100 mt-0.5 truncate">{detailTitle}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => {
                  setDetailOpen(false);
                  setSelectedRetailerId(null);
                }}
                className="p-2 cursor-pointer rounded-lg text-blue-100 hover:text-white hover:bg-white/10"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4 max-h-[80vh] overflow-y-auto bg-slate-50/40">
              {detailLoading ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-800" />
                </div>
              ) : !detailData ? (
                <p className="text-center text-slate-500 py-8">No details available.</p>
              ) : (
                <>
                  <DetailSection title="Basic Information" icon={User}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <DetailField label="Name" value={customer?.name || retailer?.name} />
                      <DetailField label="Mobile" value={customer?.mobile || retailer?.mobile} />
                      <DetailField label="Email" value={customer?.email || retailer?.email} />
                    </div>
                  </DetailSection>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <DetailSection title="Organization" icon={Building2}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DetailField
                          label="Organization"
                          value={customer?.organization_name || retailer?.organization_name}
                        />
                        <DetailField label="Branch" value={customer?.branch_name} />
                      </div>
                    </DetailSection>

                    <DetailSection title="Contact" icon={Users}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <DetailField
                          label="Contact Person"
                          value={customer?.contact_person || retailer?.contact_person}
                        />
                        <DetailField
                          label="Contact Number"
                          value={customer?.mobile || retailer?.mobile || customer?.contact_number}
                        />
                      </div>
                    </DetailSection>
                  </div>

                  <DetailSection title="Address" icon={MapPin}>
                    <div className="space-y-3">
                      <DetailField
                        label="Address"
                        value={customer?.address || customer?.address_1}
                      />
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <DetailField label="City" value={customer?.city} />
                        <DetailField label="State" value={customer?.state} />
                        <DetailField label="Pincode" value={customer?.pincode} />
                      </div>
                    </div>
                  </DetailSection>

                  <DetailSection title="Classification" icon={CreditCard}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      <DetailField label="Business Type" value={customer?.business_type} />
                      <DetailField label="Credit Type" value={customer?.credit_type} />
                      <DetailField label="Category Type" value={customer?.category_type} />
                    </div>
                  </DetailSection>

                  <DetailSection title="Wallet Summary" icon={Wallet}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <DetailField label="Wallet Balance">
                        {formatPoints(detailData.wallet_summary?.wallet_points)}
                      </DetailField>
                      <DetailField label="Bonus Balance">
                        {formatPoints(detailData.wallet_summary?.bonus_points)}
                      </DetailField>
                    </div>
                  </DetailSection>

                  <DetailSection title="Wallet History" icon={History}>
                    {(detailData.wallet_history || []).length === 0 ? (
                      <p className="text-sm text-slate-500">No wallet history found.</p>
                    ) : (
                      <div className="space-y-2 max-h-80 overflow-y-auto">
                        {detailData.wallet_history.map((item) => {
                          const credit = isCreditTransaction(item);
                          const amountLabel = `${credit ? "+" : "-"}${formatPoints(item.point)}`;
                          return (
                            <div
                              key={item.id}
                              className="rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2.5 flex items-start gap-3"
                            >
                              <span
                                className={`shrink-0 font-semibold tabular-nums ${
                                  credit ? "text-green-600" : "text-red-600"
                                }`}
                              >
                                {amountLabel}
                              </span>
                              <div className="min-w-0 flex-1">
                                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                  <span className="text-sm font-semibold text-slate-900 capitalize">
                                    {item.points_type || "—"}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    {item.created_at || "—"}
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 mt-0.5 break-words">
                                  {item.description || "—"}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </DetailSection>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden">
            <div className="px-5 py-4 bg-gradient-to-r from-blue-900 via-blue-800 to-indigo-800 text-white">
              <h3 className="text-base font-semibold">Remove Mobile Access</h3>
              <p className="text-sm text-blue-100 mt-0.5 truncate">{confirmRemove.name}</p>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-slate-600">
                Remove mobile app access for &quot;{confirmRemove.name || "this retailer"}&quot;?
              </p>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmRemove(null)}
                  disabled={removeMutation.isPending}
                  className="px-4 py-2 rounded-lg border border-slate-200 bg-white text-sm font-medium text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(confirmRemove.retailer_id)}
                  disabled={removeMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-sm font-semibold text-red-700 hover:bg-red-100 cursor-pointer disabled:opacity-60"
                >
                  {removeMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="h-4 w-4" />
                  )}
                  Remove Access
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showLogoutConfirm ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-xl w-full max-w-md border border-blue-100 p-6"
          >
            <div className="flex items-start gap-3 mb-5">
              <div className="p-2 rounded-full bg-blue-50 shrink-0">
                <LogOut className="h-5 w-5 text-blue-800" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Log out</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Are you sure you want to log out of your account?
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowLogoutConfirm(false)}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-lg border border-gray-200 text-sm font-medium text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmLogout}
                disabled={isLoggingOut}
                className="px-4 py-2 rounded-lg bg-blue-900 text-white text-sm font-medium cursor-pointer disabled:opacity-60 hover:bg-blue-800"
              >
                {isLoggingOut ? "Logging out..." : "Yes"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>,
  );
}
