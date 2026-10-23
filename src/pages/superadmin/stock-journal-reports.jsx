import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { format } from "date-fns";
import { useIsMobile } from "@/hooks/use-mobile";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import Loader from "@/components/common/loader";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Calendar,
  RefreshCw,
  Building2,
  CheckCircle2,
  XCircle,
} from "lucide-react";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

function getSuperAdminToken() {
  return localStorage.getItem("superadmin_token");
}

export default function SuperAdminStockJournalReports() {
  const [, setLocation] = useLocation();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const today = new Date();
  const [fromDate, setFromDate] = useState(format(today, "dd-MM-yyyy"));
  const [toDate, setToDate] = useState(format(today, "dd-MM-yyyy"));
  const [selectedOrg, setSelectedOrg] = useState("all");
  const [searchQuery, setSearchQuery] = useState(""); // voucher number or created by name
  const [syncFilter, setSyncFilter] = useState("all"); // all | synced | unsynced
  const [currentPage, setCurrentPage] = useState(1);
  const [confirmTallyEntry, setConfirmTallyEntry] = useState(null); // { entry, nextValue } when confirmation open

  // Redirect to superadmin login if not authenticated (same as other superadmin pages)
  useEffect(() => {
    const token = localStorage.getItem("superadmin_token");
    const user = localStorage.getItem("superadmin_user");
    if (!token || !user) {
      setLocation("/superadmin/login");
    }
  }, [setLocation]);

  // Fetch organizations for dropdown (use superadmin token, not apiRequest)
  const { data: organizationsData, isLoading: organizationsLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/superadmin/super-admin/organizations/`],
    queryFn: async () => {
      const token = getSuperAdminToken();
      const response = await fetch(`${API_BASE_URL}/api/superadmin/super-admin/organizations/`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      const json = await response.json();
      if (json.status !== 200) {
        throw new Error(json.message || "Failed to fetch organizations");
      }
      return json.data || [];
    },
    enabled: !!getSuperAdminToken(),
  });

  const organizations = organizationsData || [];

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    if (fromDate) params.append("from_date", fromDate);
    if (toDate) params.append("to_date", toDate);
    if (selectedOrg && selectedOrg !== "all") {
      params.append("organization_id", selectedOrg);
    }
    if (searchQuery.trim()) {
      params.append("search", searchQuery.trim());
    }
    if (syncFilter === "synced") {
      params.append("is_tally_synced", "true");
    } else if (syncFilter === "unsynced") {
      params.append("is_tally_synced", "false");
    }
    params.append("page", currentPage.toString());
    params.append("page_size", "50");
    return params.toString();
  };

  // Fetch stock journal entries (all organizations) - use superadmin token
  const {
    data: stockData,
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: [
      `${API_BASE_URL}/api/superadmin/super-admin/stock-journals/`,
      fromDate,
      toDate,
      selectedOrg,
      searchQuery,
      syncFilter,
      currentPage,
    ],
    queryFn: async () => {
      const token = getSuperAdminToken();
      const qs = buildQueryParams();
      const url = `${API_BASE_URL}/api/superadmin/super-admin/stock-journals/?${qs}`;
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      const json = await response.json();
      if (json.status !== 200) {
        throw new Error(json.message || "Failed to fetch stock journals");
      }
      return json;
    },
    enabled: !!getSuperAdminToken(),
  });

  // Mutation to update is_tally_synched - use superadmin token
  const updateTallyStatusMutation = useMutation({
    mutationFn: async ({ transaction_id, is_tally_synced }) => {
      const token = getSuperAdminToken();
      const response = await fetch(
        `${API_BASE_URL}/api/superadmin/super-admin/stock-journals/update-tally-status/`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token && { Authorization: `Bearer ${token}` }),
          },
          body: JSON.stringify({ transaction_id, is_tally_synced }),
        }
      );
      const json = await response.json();
      if (json.status !== 200) {
        throw new Error(json.message || "Failed to update tally sync status");
      }
      return json;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: [`${API_BASE_URL}/api/superadmin/super-admin/stock-journals/`],
      });
      toast({
        title: "Updated",
        description: "Tally sync status updated successfully.",
      });
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to update tally sync status.",
        variant: "destructive",
      });
    },
  });

  const handleToggleTallySync = (entry) => {
    const nextValue = !entry.is_tally_synched;
    setConfirmTallyEntry({ entry, nextValue });
  };

  const handleConfirmTallySync = () => {
    if (!confirmTallyEntry) return;
    const { entry, nextValue } = confirmTallyEntry;
    updateTallyStatusMutation.mutate(
      { transaction_id: entry.transaction_id, is_tally_synced: nextValue },
      { onSettled: () => setConfirmTallyEntry(null) }
    );
  };

  const handleRefresh = () => {
    refetch();
    toast({
      title: "Refreshed",
      description: "Stock journal data has been refreshed.",
    });
  };

  const entries = stockData?.data || [];
  const pagination = stockData?.pagination || {};

  return (
    <div className="flex h-screen bg-gray-50">
      {!isMobile && <SuperAdminSidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                ☰
              </Button>
            )}
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                Stock Journal Reports
              </h1>
              <p className="text-sm text-gray-600">
                View stock journal transactions across all organizations and
                update Tally sync status.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          </div>
        </header>

        {/* Filters and table */}
        <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base sm:text-lg">
                Filters
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end w-full">
                <div className="w-[140px] flex-shrink-0">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    From Date
                  </label>
                  <Input
                    type="date"
                    className="w-full"
                    value={format(
                      new Date(
                        fromDate.split("-").reverse().join("-")
                      ),
                      "yyyy-MM-dd"
                    )}
                    onChange={(e) =>
                      setFromDate(
                        format(new Date(e.target.value), "dd-MM-yyyy")
                      )
                    }
                  />
                </div>
                <div className="w-[140px] flex-shrink-0">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Calendar className="h-4 w-4" />
                    To Date
                  </label>
                  <Input
                    type="date"
                    className="w-full"
                    value={format(
                      new Date(toDate.split("-").reverse().join("-")),
                      "yyyy-MM-dd"
                    )}
                    onChange={(e) =>
                      setToDate(
                        format(new Date(e.target.value), "dd-MM-yyyy")
                      )
                    }
                  />
                </div>
                <div className="min-w-[160px] flex-shrink-0 sm:max-w-[200px]">
                  <label className="text-xs font-medium text-gray-600 flex items-center gap-1">
                    <Building2 className="h-4 w-4" />
                    Organization
                  </label>
                  <Select
                    value={selectedOrg}
                    onValueChange={(val) => {
                      setSelectedOrg(val);
                      setCurrentPage(1);
                    }}
                    disabled={organizationsLoading}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select organization" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Organizations</SelectItem>
                      {organizations.map((org) => (
                        <SelectItem key={org.id} value={org.id.toString()}>
                          {org.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="text-xs font-medium text-gray-600">
                    Voucher No / Created By
                  </label>
                  <Input
                    className="w-full"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="Search voucher no. or created by"
                  />
                </div>
                <div className="w-[120px] flex-shrink-0">
                  <label className="text-xs font-medium text-gray-600">
                    Tally Sync
                  </label>
                  <Select
                    value={syncFilter}
                    onValueChange={(val) => {
                      setSyncFilter(val);
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      <SelectItem value="synced">Synced</SelectItem>
                      <SelectItem value="unsynced">Not Synced</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="h-full">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base sm:text-lg">
                Stock Journal Entries ({stockData?.total_count || 0})
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="py-8">
                  <Loader isLoading text="Loading stock journal entries..." />
                </div>
              ) : error ? (
                <div className="p-6 text-center text-red-600">
                  Failed to load stock journal entries.
                </div>
              ) : entries.length === 0 ? (
                <div className="p-6 text-center text-gray-500">
                  No stock journal entries found for the selected filters.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-100">
                      <tr>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Transaction ID
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Voucher No
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Voucher Type
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Organization
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Branch
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Tally Synced
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Created By
                        </th>
                        <th className="px-3 py-2 text-left font-medium text-gray-700">
                          Created At
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.transaction_id} className="border-b">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {entry.transaction_id}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap font-medium">
                            {entry.voucher_number}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {entry.voucher_type_name}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {entry.organization_name || "-"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {entry.branch_name || "-"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            <label className="inline-flex items-center gap-2">
                              <input
                                type="checkbox"
                                className="h-4 w-4 accent-green-600 cursor-pointer"
                                checked={!!entry.is_tally_synched}
                                onChange={() => handleToggleTallySync(entry)}
                                disabled={updateTallyStatusMutation.isPending}
                              />
                              <span className="text-xs text-gray-700">
                                {entry.is_tally_synched ? "Synced" : "Not Synced"}
                              </span>
                            </label>
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {entry.created_by_name || "-"}
                          </td>
                          <td className="px-3 py-2 whitespace-nowrap">
                            {entry.created_at || "-"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pagination */}
          {entries.length > 0 && pagination?.total_pages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <div className="text-xs sm:text-sm text-gray-600">
                Page {pagination.current_page} of {pagination.total_pages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_previous}
                  onClick={() =>
                    setCurrentPage((prev) => Math.max(prev - 1, 1))
                  }
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!pagination.has_next}
                  onClick={() =>
                    setCurrentPage((prev) => prev + 1)
                  }
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Themed confirmation dialog for Tally sync status */}
      <AlertDialog open={!!confirmTallyEntry} onOpenChange={(open) => !open && setConfirmTallyEntry(null)}>
        <AlertDialogContent className="bg-white border border-gray-200 shadow-xl text-gray-900">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-lg font-semibold text-gray-900">
              Confirm Tally sync status
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm text-gray-600">
              {confirmTallyEntry && (
                <>
                  Are you sure you want to{" "}
                  {confirmTallyEntry.nextValue
                    ? "mark this transaction as Tally synced"
                    : "mark this transaction as NOT Tally synced"}
                  ?
                  <span className="mt-2 block text-gray-700">
                    Transaction ID: {confirmTallyEntry.entry.transaction_id}
                    <br />
                    Voucher No: {confirmTallyEntry.entry.voucher_number}
                  </span>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel className="border-gray-300 text-gray-700 hover:bg-gray-50">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmTallySync}
              className="bg-gray-800 hover:bg-gray-700 text-white"
            >
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

