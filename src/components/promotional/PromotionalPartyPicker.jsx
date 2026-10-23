import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, FilterX, ChevronLeft, ChevronRight } from "lucide-react";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useDebounce } from "@/hooks/use-debounce";
import { fetchPromotionalLedgers } from "@/lib/promotional_api";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const PAGE_SIZE = 20;

/**
 * Multi-select party/ledger picker used by Send WhatsApp and Send SMS.
 */
export default function PromotionalPartyPicker({
  selectedIds = [],
  onChange,
  title = "Select recipients",
}) {
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

  const { data: statesResponse } = useQuery({
    queryKey: ["promo-picker-states"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/report/get-states/`);
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to fetch states");
      return data.data ?? data ?? [];
    },
    enabled: !!AuthService.getAccessToken(),
    staleTime: 5 * 60 * 1000,
  });

  const states = Array.isArray(statesResponse) ? statesResponse : [];

  const { data: citiesResponse } = useQuery({
    queryKey: ["promo-picker-cities", selectedState],
    queryFn: async () => {
      if (!selectedState || selectedState === "all") return [];
      const response = await apiRequest(
        "GET",
        `${API_BASE_URL}/api/report/get-cities/?state_id=${selectedState}`,
      );
      const data = await response.json();
      if (!response.ok) throw new Error(data?.message || "Failed to fetch cities");
      return data.data ?? data ?? [];
    },
    enabled: !!AuthService.getAccessToken() && selectedState !== "all",
    staleTime: 5 * 60 * 1000,
  });

  const cities = Array.isArray(citiesResponse) ? citiesResponse : [];

  const selectedStateName = useMemo(() => {
    if (selectedState === "all") return "";
    return states.find((s) => String(s.id) === String(selectedState))?.name || selectedState;
  }, [selectedState, states]);

  const selectedCityName = useMemo(() => {
    if (selectedCity === "all") return "";
    return cities.find((c) => String(c.id) === String(selectedCity))?.name || selectedCity;
  }, [selectedCity, cities]);

  const {
    data: ledgersResponse,
    isLoading,
    isFetching,
  } = useQuery({
    queryKey: [
      "promo-picker-ledgers",
      debouncedName,
      debouncedMobile,
      selectedStateName,
      selectedCityName,
      currentPage,
    ],
    queryFn: async () => {
      const params = {
        is_active: "true",
        page: currentPage,
        per_page: PAGE_SIZE,
      };
      const searchValue = debouncedName || debouncedMobile;
      if (searchValue) params.search = searchValue;
      if (selectedStateName) params.state = selectedStateName;
      if (selectedCityName) params.city = selectedCityName;
      const data = await fetchPromotionalLedgers(params);
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
    keepPreviousData: true,
  });

  const rows = Array.isArray(ledgersResponse?.data) ? ledgersResponse.data : [];
  const pagination = ledgersResponse?.pagination || {
    current_page: currentPage,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false,
  };

  const selectedSet = useMemo(
    () => new Set((selectedIds || []).map((id) => String(id))),
    [selectedIds],
  );

  const toggleId = (id) => {
    const key = String(id);
    const next = new Set(selectedSet);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange?.(Array.from(next).map((v) => Number(v)).filter((n) => Number.isFinite(n)));
  };

  const togglePage = (checked) => {
    const next = new Set(selectedSet);
    rows.forEach((row) => {
      const id = String(row.id);
      if (checked) next.add(id);
      else next.delete(id);
    });
    onChange?.(Array.from(next).map((v) => Number(v)).filter((n) => Number.isFinite(n)));
  };

  const pageAllSelected =
    rows.length > 0 && rows.every((row) => selectedSet.has(String(row.id)));

  const clearFilters = () => {
    setNameSearch("");
    setMobileSearch("");
    setSelectedState("all");
    setSelectedCity("all");
    setCurrentPage(1);
  };

  const hasFilters =
    Boolean(nameSearch.trim()) ||
    Boolean(mobileSearch.trim()) ||
    selectedState !== "all" ||
    selectedCity !== "all";

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900">{title}</p>
          <p className="text-xs text-slate-500">
            {selectedSet.size} selected · phones resolved by backend from party master
          </p>
        </div>
        {selectedSet.size > 0 ? (
          <Button type="button" variant="ghost" size="sm" onClick={() => onChange?.([])}>
            Clear selection
          </Button>
        ) : null}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
        <div>
          <Label className="text-xs">Name</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              className="pl-8 h-9"
              value={nameSearch}
              onChange={(e) => setNameSearch(e.target.value)}
              placeholder="Search name"
            />
          </div>
        </div>
        <div>
          <Label className="text-xs">Mobile</Label>
          <Input
            className="h-9"
            value={mobileSearch}
            onChange={(e) => setMobileSearch(e.target.value)}
            placeholder="Search mobile"
          />
        </div>
        <div>
          <Label className="text-xs">State</Label>
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All states" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All states</SelectItem>
              {states.map((s) => (
                <SelectItem key={s.id} value={String(s.id)}>
                  {s.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">City</Label>
          <Select
            value={selectedCity}
            onValueChange={setSelectedCity}
            disabled={selectedState === "all"}
          >
            <SelectTrigger className="h-9">
              <SelectValue placeholder="All cities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All cities</SelectItem>
              {cities.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {hasFilters ? (
        <Button type="button" variant="outline" size="sm" onClick={clearFilters}>
          <FilterX className="h-3.5 w-3.5 mr-1" />
          Clear filters
        </Button>
      ) : null}

      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-10">
                <Checkbox
                  checked={pageAllSelected}
                  onCheckedChange={(v) => togglePage(Boolean(v))}
                  aria-label="Select page"
                />
              </TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Mobile</TableHead>
              <TableHead>City</TableHead>
              <TableHead>State</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  <Loader2 className="h-4 w-4 animate-spin inline mr-2" />
                  Loading ledgers…
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                  No ledgers found
                </TableCell>
              </TableRow>
            ) : (
              rows.map((row) => {
                const id = String(row.id);
                const checked = selectedSet.has(id);
                return (
                  <TableRow key={id} className={checked ? "bg-blue-50/50" : undefined}>
                    <TableCell>
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() => toggleId(row.id)}
                        aria-label={`Select ${row.name}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium text-slate-900">{row.name || "—"}</TableCell>
                    <TableCell className="text-slate-600">
                      {row.whatsapp_number || row.contact_number || row.mobile || "—"}
                    </TableCell>
                    <TableCell className="text-slate-600">{row.city || "—"}</TableCell>
                    <TableCell className="text-slate-600">{row.state || "—"}</TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between gap-2 text-sm text-slate-600">
        <span>
          Page {pagination.current_page || currentPage} of {pagination.total_pages || 1}
          {isFetching ? " · refreshing…" : ""}
        </span>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pagination.has_previous && currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!pagination.has_next}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {selectedSet.size > 0 ? (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">{selectedSet.size} parties selected</Badge>
        </div>
      ) : null}
    </div>
  );
}
