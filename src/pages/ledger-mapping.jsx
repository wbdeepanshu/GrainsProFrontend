import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Menu,
  Search,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,
  Filter,
  RefreshCw,
  Building,
  CheckCircle,
  Link2,
  Save,
} from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import CommonLoader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 50;

/** Map list row to tri-state roles (extend when API adds fields). */
function entryPartyRoles(entry) {
  return {
    supplier: Boolean(entry.is_supplier),
    customer: Boolean(entry.is_customer),
    broker: Boolean(entry.is_broker),
  };
}

export default function LedgerMapping() {
  const [, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedIsSupplier, setSelectedIsSupplier] = useState(null);
  const [selectedIsActive, setSelectedIsActive] = useState("active");
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);
  /** ledger id string -> { supplier, customer, broker } */
  const [draftRolesByLedgerId, setDraftRolesByLedgerId] = useState({});
  const [changedLedgerIds, setChangedLedgerIds] = useState(() => new Set());

  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasPermission } = useUserPermissions();
  const canUpdateMapping = hasPermission("customer_management", "update");

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedParent, selectedIsSupplier, searchTerm, selectedIsActive]);

  const buildQueryParams = useCallback(() => {
    const params = new URLSearchParams();
    if (searchTerm) params.append("search", searchTerm);
    if (selectedParent) params.append("parent", selectedParent);
    if (selectedIsSupplier !== null) {
      params.append("is_supplier", selectedIsSupplier);
    }
    if (selectedIsActive && selectedIsActive !== "all") {
      params.append("is_active", selectedIsActive === "active" ? "true" : "false");
    } else if (selectedIsActive === "all") {
      params.append("is_active", "all");
    }
    params.append("page", currentPage.toString());
    params.append("per_page", PAGE_SIZE.toString());
    return params.toString();
  }, [searchTerm, selectedParent, selectedIsSupplier, selectedIsActive, currentPage]);

  const { data: ledgerGroupsForParent } = useQuery({
    queryKey: ["ledger-groups-for-parent"],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("is_live", "true");
      params.append("page", "1");
      params.append("per_page", "1000");
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`
      );
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const uniqueParents = useMemo(() => {
    if (!ledgerGroupsForParent) return [];
    return [
      ...new Set(
        ledgerGroupsForParent.map((g) => g.name).filter((name) => name && String(name).trim() !== "")
      ),
    ].sort();
  }, [ledgerGroupsForParent]);

  const { data: responseData, isLoading, isFetching, refetch } = useQuery({
    queryKey: [
      "ledger-mapping",
      `${API_BASE_URL}/api/report/get-ledgers/`,
      searchTerm,
      selectedParent,
      selectedIsSupplier,
      selectedIsActive,
      currentPage,
    ],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/report/get-ledgers/${queryParams ? `?${queryParams}` : ""}`;
      const response = await apiRequest("GET", url);
      const data = await response.json();
      return {
        data: data.data ?? [],
        pagination: data.pagination ?? {
          current_page: 1,
          total_count: 0,
          total_pages: 1,
          has_next: false,
          has_previous: false,
          per_page: PAGE_SIZE,
        },
      };
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    placeholderData: (prev) => prev,
  });

  const ledgerEntries = responseData?.data || [];
  const pagination = responseData?.pagination || {
    current_page: 1,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false,
    per_page: PAGE_SIZE,
  };

  useEffect(() => {
    if (!ledgerEntries.length) return;
    setDraftRolesByLedgerId((prev) => {
      const next = { ...prev };
      for (const entry of ledgerEntries) {
        const id = entry?.id != null ? String(entry.id) : "";
        if (!id) continue;
        if (!changedLedgerIds.has(id)) {
          next[id] = entryPartyRoles(entry);
        }
      }
      return next;
    });
  }, [ledgerEntries, changedLedgerIds]);

  const getRolesForEntry = useCallback(
    (entry) => {
      const id = entry?.id != null ? String(entry.id) : "";
      if (!id) return entryPartyRoles(entry);
      if (Object.prototype.hasOwnProperty.call(draftRolesByLedgerId, id)) {
        return draftRolesByLedgerId[id] || entryPartyRoles(entry);
      }
      return entryPartyRoles(entry);
    },
    [draftRolesByLedgerId]
  );

  const toggleRole = (entry, roleKey, checked) => {
    const id = entry?.id != null ? String(entry.id) : "";
    if (!id) return;
    const current = { ...getRolesForEntry(entry), [roleKey]: checked === true };
    setDraftRolesByLedgerId((prev) => ({
      ...prev,
      [id]: current,
    }));
    setChangedLedgerIds((prev) => new Set(prev).add(id));
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedParent(null);
    setSelectedIsSupplier(null);
    setSelectedIsActive("active");
    setCurrentPage(1);
    refetch();
  };

  const handleParentSelect = (parent) => {
    setSelectedParent(parent);
    setParentDropdownOpen(false);
  };

  const handleIsSupplierSelect = (value) => {
    setSelectedIsSupplier(value);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.total_pages) return;
    setCurrentPage(page);
  };

  const getPageNumbers = (current, total) => {
    const delta = 2;
    const range = [];
    const rangeWithDots = [];
    let l;
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }
    for (const i of range) {
      if (l) {
        if (i - l === 2) {
          rangeWithDots.push(l + 1);
        } else if (i - l !== 1) {
          rangeWithDots.push("...");
        }
      }
      rangeWithDots.push(i);
      l = i;
    }
    return rangeWithDots;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (changedLedgerIds.size === 0) {
        throw new Error("No changes to save.");
      }
      const token = AuthService.getAccessToken();
      if (!token) throw new Error("No authentication token found");

      const ledgers = Array.from(changedLedgerIds).map((idStr) => {
        const r = draftRolesByLedgerId[idStr] || { supplier: false, customer: false, broker: false };
        return {
          id: Number(idStr),
          is_supplier: !!r.supplier,
          is_customer: !!r.customer,
          is_broker: !!r.broker,
        };
      });

      const response = await fetch(`${API_BASE_URL}/api/report/bulk-update-ledgers-mapping/`, {
        method: "POST",
        headers: {
          ...AuthService.getAuthHeaders(),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ ledgers }),
      });
      const resJson = await response.json().catch(() => ({}));
      if (!response.ok) {
        const msg =
          resJson?.message ||
          resJson?.error ||
          (response.status === 404
            ? "Ledger mapping save API is not available on the server (404)."
            : `HTTP ${response.status}`);
        throw new Error(msg);
      }
      if (resJson?.status >= 400) {
        throw new Error(resJson?.message || resJson?.error || "Save rejected");
      }
      return resJson;
    },
    onSuccess: (res) => {
      toast({
        title: "Saved",
        description: res?.message || "Ledger mapping updated successfully.",
      });
      const saved = Array.from(changedLedgerIds);
      setDraftRolesByLedgerId((prev) => {
        const next = { ...prev };
        saved.forEach((id) => {
          delete next[id];
        });
        return next;
      });
      setChangedLedgerIds(new Set());
      queryClient.invalidateQueries({ queryKey: [`${API_BASE_URL}/api/report/get-ledgers/`] });
      queryClient.invalidateQueries({ queryKey: ["ledger-mapping"] });
      refetch();
    },
    onError: (err) => {
      toast({
        title: "Save failed",
        description: err?.message || "Could not save ledger mapping.",
        variant: "destructive",
      });
    },
  });

  const startIndex = (pagination.current_page - 1) * (pagination.per_page || PAGE_SIZE);

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
      )}

      <div className="app-main-content">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-4 sm:px-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center">
              {isMobile && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMobileSidebarOpen(true)}
                  className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 mr-4"
                >
                  <Menu className="h-6 w-6" />
                </Button>
              )}
              <div className="flex items-center space-x-2">
                <Link2 className="h-6 w-6 text-gray-600" />
                <h1 className="text-2xl font-bold text-gray-900">Ledger mapping</h1>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Button variant="outline" size="sm" onClick={() => setLocation("/ledger-masters")}>
                Ledger masters
              </Button>
              {hasPermission("customer_management", "update") && (
                <Button
                  size="sm"
                  className="bg-black hover:bg-gray-900 text-white"
                  disabled={changedLedgerIds.size === 0 || saveMutation.isPending}
                  onClick={() => saveMutation.mutate()}
                >
                  {saveMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Save
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
              </Button>
              {(isLoading || isFetching) && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-4 sm:p-6">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Filters</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col sm:flex-row gap-4 items-end">
                  <div className="flex-1 min-w-0">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Search className="h-4 w-4 text-gray-600" />
                      Search
                    </Label>
                    <div className="relative mt-2">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                      <Input
                        placeholder="Search ledgers..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="pl-10 h-8"
                      />
                    </div>
                  </div>

                  <div className="w-full sm:w-[200px]">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Building className="h-4 w-4 text-blue-600" />
                      Parent
                    </Label>
                    <div className="relative mt-2">
                      <Popover open={parentDropdownOpen} onOpenChange={setParentDropdownOpen}>
                        <PopoverTrigger asChild>
                          <Button
                            variant="outline"
                            role="combobox"
                            aria-expanded={parentDropdownOpen}
                            className="w-full justify-between h-8 border-gray-300"
                          >
                            <span className="truncate">{selectedParent ? selectedParent : "Select parent"}</span>
                            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-[--radix-popover-trigger-width] p-0 z-50"
                          align="start"
                          side="bottom"
                          sideOffset={4}
                        >
                          <Command>
                            <CommandInput placeholder="Search parents..." />
                            <CommandList>
                              <CommandEmpty>
                                {uniqueParents.length === 0 ? "No parents found." : "No parents match your search."}
                              </CommandEmpty>
                              <CommandGroup>
                                <ScrollArea className="h-64">
                                  {uniqueParents.map((parent) => (
                                    <CommandItem
                                      key={parent}
                                      value={parent}
                                      onSelect={() => handleParentSelect(parent)}
                                      className="flex items-center justify-between cursor-pointer"
                                    >
                                      <div className="flex items-center gap-3">
                                        <Check
                                          className={`h-4 w-4 ${
                                            selectedParent === parent ? "opacity-100 text-blue-600" : "opacity-0"
                                          }`}
                                        />
                                        <span className="font-medium text-gray-900">{parent}</span>
                                      </div>
                                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                        Parent
                                      </Badge>
                                    </CommandItem>
                                  ))}
                                </ScrollArea>
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="w-full sm:w-[180px]">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <Filter className="h-4 w-4 text-green-600" />
                      Is Supplier
                    </Label>
                    <Select
                      value={selectedIsSupplier || "all"}
                      onValueChange={(value) => handleIsSupplierSelect(value === "all" ? null : value)}
                    >
                      <SelectTrigger className="h-8 mt-2">
                        <SelectValue placeholder="Select supplier status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="true">Yes (Supplier)</SelectItem>
                        <SelectItem value="false">No (Consumer)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-[180px]">
                    <Label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-blue-600" />
                      Status
                    </Label>
                    <Select value={selectedIsActive} onValueChange={setSelectedIsActive}>
                      <SelectTrigger className="h-8 mt-2">
                        <SelectValue placeholder="Active / Inactive" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="inactive">Inactive</SelectItem>
                        <SelectItem value="all">All</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="w-full sm:w-auto">
                    <Button
                      variant="outline"
                      onClick={clearAllFilters}
                      className="w-full sm:w-auto h-11 border-gray-300 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                    >
                      Clear All
                    </Button>
                  </div>
                </div>

                {(selectedParent || selectedIsSupplier !== null || selectedIsActive !== "active") && (
                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm text-gray-600">Active filters:</span>
                      {selectedParent && (
                        <Badge variant="outline" className="text-xs">
                          Parent: {selectedParent}
                        </Badge>
                      )}
                      {selectedIsSupplier !== null && (
                        <Badge variant="outline" className="text-xs">
                          Is Supplier: {selectedIsSupplier === "true" ? "Yes" : "No"}
                        </Badge>
                      )}
                      {selectedIsActive !== "active" && (
                        <Badge variant="outline" className="text-xs">
                          Status: {selectedIsActive === "inactive" ? "Inactive" : "All"}
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <CardTitle>Parties ({pagination.total_count})</CardTitle>
                  {changedLedgerIds.size > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {changedLedgerIds.size} row(s) modified — click Save to apply
                    </p>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {isLoading && !ledgerEntries.length ? (
                  <CommonLoader />
                ) : (
                  <>
                    <div className="rounded-md border overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">Sl No</TableHead>
                            <TableHead>Party name</TableHead>
                            <TableHead className="text-center w-28">Supplier</TableHead>
                            <TableHead className="text-center w-28">Customer</TableHead>
                            <TableHead className="text-center w-28">Broker</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ledgerEntries.map((entry, idx) => {
                            const roles = getRolesForEntry(entry);
                            const sl = startIndex + idx + 1;
                            return (
                              <TableRow key={entry.id}>
                                <TableCell className="font-medium text-muted-foreground">{sl}</TableCell>
                                <TableCell className="font-medium">{entry.name || "—"}</TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={roles.supplier}
                                    disabled={!canUpdateMapping}
                                    onCheckedChange={(c) => toggleRole(entry, "supplier", c === true)}
                                    aria-label={`Supplier ${entry.name}`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={roles.customer}
                                    disabled={!canUpdateMapping}
                                    onCheckedChange={(c) => toggleRole(entry, "customer", c === true)}
                                    aria-label={`Customer ${entry.name}`}
                                  />
                                </TableCell>
                                <TableCell className="text-center">
                                  <Checkbox
                                    checked={roles.broker}
                                    disabled={!canUpdateMapping}
                                    onCheckedChange={(c) => toggleRole(entry, "broker", c === true)}
                                    aria-label={`Broker ${entry.name}`}
                                  />
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    {ledgerEntries.length === 0 && (
                      <div className="text-center py-12 text-gray-500">No ledger entries match your filters.</div>
                    )}

                    {pagination.total_pages > 1 && (
                      <div className="flex items-center justify-between mt-6 flex-wrap gap-3">
                        <div className="text-sm text-gray-500">
                          Showing {startIndex + 1} to{" "}
                          {Math.min(
                            pagination.current_page * (pagination.per_page || PAGE_SIZE),
                            pagination.total_count
                          )}{" "}
                          of {pagination.total_count} entries
                        </div>
                        <div className="flex items-center space-x-2 flex-wrap">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.current_page - 1)}
                            disabled={!pagination.has_previous}
                          >
                            <ChevronLeft className="h-4 w-4" />
                            Previous
                          </Button>
                          {getPageNumbers(pagination.current_page, pagination.total_pages).map((page, idx) =>
                            page === "..." ? (
                              <span key={`ellipsis-${idx}`} className="px-2">
                                ...
                              </span>
                            ) : (
                              <Button
                                key={`page-${page}-${idx}`}
                                variant={pagination.current_page === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => handlePageChange(page)}
                              >
                                {page}
                              </Button>
                            )
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handlePageChange(pagination.current_page + 1)}
                            disabled={!pagination.has_next}
                          >
                            Next
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
