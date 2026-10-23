import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../components/ui/table";
import {
  Menu,
  Search,
  FilterX,
  Loader2,
  Megaphone,
  ChevronLeft,
  ChevronRight,
  Phone,
  MapPin,
  Building2,
} from "lucide-react";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import Loader from "../components/common/loader";
import { useDebounce } from "../hooks/use-debounce";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 20;

const getPageNumbers = (current, total) => {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  if (start > 2) pages.push("...");
  for (let i = start; i <= end; i += 1) pages.push(i);
  if (end < total - 1) pages.push("...");
  pages.push(total);
  return pages;
};

export default function PromotionalActivity() {
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const [nameSearch, setNameSearch] = useState("");
  const [mobileSearch, setMobileSearch] = useState("");
  const [selectedState, setSelectedState] = useState("all");
  const [selectedCity, setSelectedCity] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);

  const debouncedName = useDebounce((nameSearch || "").trim(), 350);
  const debouncedMobile = useDebounce((mobileSearch || "").trim(), 350);

  useEffect(() => {
    setCurrentPage(1);
  }, [debouncedName, debouncedMobile, selectedState, selectedCity]);

  useEffect(() => {
    setSelectedCity("all");
  }, [selectedState]);

  const { data: statesResponse, isLoading: statesLoading } = useQuery({
    queryKey: ["promotional-activity-states"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/states/?page=1&page_size=1000`
      );
      const json = await response.json();
      return json?.data || json?.results || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const { data: citiesResponse, isLoading: citiesLoading } = useQuery({
    queryKey: ["promotional-activity-cities"],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/accounts/cities/?page=1&page_size=1000`
      );
      const json = await response.json();
      return json?.data || json?.results || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const states = useMemo(() => {
    const list = Array.isArray(statesResponse) ? statesResponse : [];
    return list
      .map((s) => ({
        id: s.id,
        name: s.name || s.state_name || "",
      }))
      .filter((s) => s.name)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [statesResponse]);

  const cities = useMemo(() => {
    const list = Array.isArray(citiesResponse) ? citiesResponse : [];
    const selectedStateName =
      selectedState === "all"
        ? ""
        : states.find((s) => String(s.id) === String(selectedState))?.name || selectedState;

    return list
      .map((c) => ({
        id: c.id,
        name: c.name || c.city_name || "",
        stateName: c.state_name || c.state?.name || "",
        stateId: c.state?.id || c.state_id || null,
      }))
      .filter((c) => c.name)
      .filter((c) => {
        if (selectedState === "all") return true;
        if (c.stateId != null && String(c.stateId) === String(selectedState)) return true;
        if (selectedStateName && c.stateName) {
          return String(c.stateName).toLowerCase() === String(selectedStateName).toLowerCase();
        }
        return true;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [citiesResponse, selectedState, states]);

  const selectedStateName = useMemo(() => {
    if (selectedState === "all") return "";
    return states.find((s) => String(s.id) === String(selectedState))?.name || selectedState;
  }, [selectedState, states]);

  const selectedCityName = useMemo(() => {
    if (selectedCity === "all") return "";
    return cities.find((c) => String(c.id) === String(selectedCity))?.name || selectedCity;
  }, [selectedCity, cities]);

  const buildQueryParams = () => {
    const params = new URLSearchParams();
    // Prefer customer name for API search; fall back to mobile when name is empty
    const searchValue = debouncedName || debouncedMobile;
    if (searchValue) params.append("search", searchValue);
    if (selectedStateName) params.append("state", selectedStateName);
    if (selectedCityName) params.append("city", selectedCityName);
    params.append("is_active", "true");
    params.append("page", String(currentPage));
    params.append("per_page", String(PAGE_SIZE));
    return params.toString();
  };

  const {
    data: ledgersResponse,
    isLoading: ledgersLoading,
    isFetching: ledgersFetching,
  } = useQuery({
    queryKey: [
      "promotional-activity-ledgers",
      debouncedName,
      debouncedMobile,
      selectedStateName,
      selectedCityName,
      currentPage,
    ],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-ledgers/?${queryParams}`
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || "Failed to fetch ledgers");
      }
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
    keepPreviousData: true,
  });

  const ledgerEntries = useMemo(() => {
    const rows = Array.isArray(ledgersResponse?.data) ? ledgersResponse.data : [];
    return rows.filter((entry) => {
      const name = String(entry.name || "").toLowerCase();
      const mobile = String(entry.contact_number || entry.mobile || "").toLowerCase();
      const state = String(entry.state || "").toLowerCase();
      const city = String(entry.city || "").toLowerCase();

      if (debouncedName && !name.includes(debouncedName.toLowerCase())) return false;
      if (debouncedMobile && !mobile.includes(debouncedMobile.toLowerCase())) return false;
      if (selectedStateName && state !== selectedStateName.toLowerCase()) {
        // Keep row if API already filtered and state is empty on record
        if (state && state !== selectedStateName.toLowerCase()) return false;
      }
      if (selectedCityName && city && city !== selectedCityName.toLowerCase()) return false;
      return true;
    });
  }, [ledgersResponse?.data, debouncedName, debouncedMobile, selectedStateName, selectedCityName]);

  const pagination = ledgersResponse?.pagination || {
    current_page: currentPage,
    total_count: ledgerEntries.length,
    total_pages: 1,
    has_next: false,
    has_previous: false,
    per_page: PAGE_SIZE,
  };

  const clearFilters = () => {
    setNameSearch("");
    setMobileSearch("");
    setSelectedState("all");
    setSelectedCity("all");
    setCurrentPage(1);
  };

  const hasActiveFilters =
    Boolean(nameSearch.trim()) ||
    Boolean(mobileSearch.trim()) ||
    selectedState !== "all" ||
    selectedCity !== "all";

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setIsMobileSidebarOpen(true)}
              >
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <div className="flex items-center gap-2">
              <Megaphone className="h-5 w-5 text-gray-700" />
              <div>
                <h1 className="text-lg font-semibold text-gray-900">Promotional Activity</h1>
                <p className="text-xs text-muted-foreground">
                  Search customers/ledgers by name, mobile, state, and city
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto bg-slate-50 p-4 sm:p-6 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Filters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                <div className="space-y-2">
                  <Label htmlFor="customer-name">Customer Name</Label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="customer-name"
                      placeholder="Search by name..."
                      value={nameSearch}
                      onChange={(e) => setNameSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customer-mobile">Mobile Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      id="customer-mobile"
                      placeholder="Search by mobile..."
                      value={mobileSearch}
                      onChange={(e) => setMobileSearch(e.target.value)}
                      className="pl-9"
                      inputMode="tel"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>State</Label>
                  <Select value={selectedState} onValueChange={setSelectedState}>
                    <SelectTrigger>
                      <SelectValue placeholder={statesLoading ? "Loading..." : "All states"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All States</SelectItem>
                      {states.map((state) => (
                        <SelectItem key={state.id} value={String(state.id)}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>City</Label>
                  <Select
                    value={selectedCity}
                    onValueChange={setSelectedCity}
                    disabled={citiesLoading}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={citiesLoading ? "Loading..." : "All cities"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Cities</SelectItem>
                      {cities.map((city) => (
                        <SelectItem key={city.id} value={String(city.id)}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={clearFilters}
                    disabled={!hasActiveFilters}
                    className="w-full"
                  >
                    <FilterX className="h-4 w-4 mr-2" />
                    Clear
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <CardTitle className="text-base">
                  Ledgers ({pagination.total_count ?? ledgerEntries.length})
                </CardTitle>
                {ledgersFetching && !ledgersLoading && (
                  <span className="inline-flex items-center text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Updating...
                  </span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {ledgersLoading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader text="Loading ledgers..." />
                </div>
              ) : ledgerEntries.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p>No ledgers found matching your criteria.</p>
                </div>
              ) : (
                <>
                  <div className="rounded-md border overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-slate-50">
                          <TableHead className="w-14">#</TableHead>
                          <TableHead>Customer Name</TableHead>
                          <TableHead>Mobile</TableHead>
                          <TableHead>City</TableHead>
                          <TableHead>State</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {ledgerEntries.map((entry, index) => (
                          <TableRow key={entry.id || `${entry.name}-${index}`}>
                            <TableCell className="text-muted-foreground">
                              {(pagination.current_page - 1) * (pagination.per_page || PAGE_SIZE) +
                                index +
                                1}
                            </TableCell>
                            <TableCell className="font-medium">
                              {entry.name || "-"}
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5">
                                <Phone className="h-3.5 w-3.5 text-gray-400" />
                                {entry.contact_number || entry.mobile || "-"}
                              </span>
                            </TableCell>
                            <TableCell>
                              <span className="inline-flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5 text-gray-400" />
                                {entry.city || "-"}
                              </span>
                            </TableCell>
                            <TableCell>{entry.state || "-"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {pagination.total_pages > 1 && (
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mt-4">
                      <div className="text-sm text-gray-500">
                        Showing{" "}
                        {(pagination.current_page - 1) * (pagination.per_page || PAGE_SIZE) + 1} to{" "}
                        {Math.min(
                          pagination.current_page * (pagination.per_page || PAGE_SIZE),
                          pagination.total_count
                        )}{" "}
                        of {pagination.total_count} entries
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(pagination.current_page - 1)}
                          disabled={!pagination.has_previous}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        {getPageNumbers(pagination.current_page, pagination.total_pages).map(
                          (page, idx) =>
                            page === "..." ? (
                              <span key={`ellipsis-${idx}`} className="px-2">
                                ...
                              </span>
                            ) : (
                              <Button
                                key={`page-${page}`}
                                variant={pagination.current_page === page ? "default" : "outline"}
                                size="sm"
                                onClick={() => setCurrentPage(page)}
                              >
                                {page}
                              </Button>
                            )
                        )}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCurrentPage(pagination.current_page + 1)}
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
      </div>
    </div>
  );
}
