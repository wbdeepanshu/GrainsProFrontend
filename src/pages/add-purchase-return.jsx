import { useEffect, useMemo, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ArrowLeft, Check, ChevronsUpDown, Loader2, Menu, Pencil, Save, Trash2, X } from "lucide-react";

import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import Loader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

const toNumber = (value) => {
  const parsed = parseFloat(String(value ?? "").replace(/[^\d.]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};

const parseRate = (rawRate) => {
  if (!rawRate) return 0;
  const rateText = String(rawRate).split("/")[0]?.trim() || "0";
  return toNumber(rateText);
};

export default function AddPurchaseReturn() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(
    typeof searchString === "string"
      ? searchString
      : (typeof window !== "undefined" ? window.location.search : "")
  );
  const editId = searchParams.get("edit");
  const requestedPurchaseOrderId = searchParams.get("purchase_order_id");
  const requestedPurchaseOrderIdNum = requestedPurchaseOrderId
    ? parseInt(requestedPurchaseOrderId, 10)
    : null;
  const editIdNum = editId ? parseInt(editId, 10) : null;
  const isEditMode = !!editIdNum && !Number.isNaN(editIdNum);

  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [isBootLoading, setIsBootLoading] = useState(true);
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();

  const [purchaseOrderId, setPurchaseOrderId] = useState(
    requestedPurchaseOrderIdNum && requestedPurchaseOrderIdNum > 0
      ? String(requestedPurchaseOrderIdNum)
      : ""
  );
  const [partyName, setPartyName] = useState("");
  const [partyDropdownOpen, setPartyDropdownOpen] = useState(false);
  const [partySearchTerm, setPartySearchTerm] = useState("");
  const [debouncedPartySearch, setDebouncedPartySearch] = useState("");
  const [poDropdownOpen, setPoDropdownOpen] = useState(false);
  const [poSearchTerm, setPoSearchTerm] = useState("");
  const [debouncedPoSearch, setDebouncedPoSearch] = useState("");
  const [remarks, setRemarks] = useState("");
  const [items, setItems] = useState([]);

  const userData = AuthService.getUserData();
  const rawTallyEnabled =
    userData?.is_tally_enabled ??
    userData?.user_info?.is_tally_enabled ??
    userData?.organization?.is_tally_enabled;
  const isTallyEnabled = !(
    rawTallyEnabled === false ||
    rawTallyEnabled === 0 ||
    rawTallyEnabled === "0" ||
    rawTallyEnabled === "false" ||
    rawTallyEnabled === "False"
  );

  useEffect(() => {
    const t = setTimeout(() => setIsBootLoading(false), 300);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPartySearch(partySearchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [partySearchTerm]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedPoSearch(poSearchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [poSearchTerm]);

  const { data: poListData = [] } = useQuery({
    queryKey: ["purchase-order-list-for-return", debouncedPoSearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("per_page", "200");
      if (debouncedPoSearch) params.append("search", debouncedPoSearch);
      const res = await apiRequest("GET", `${API_BASE_URL}/api/report/purchase-orders/?${params.toString()}`);
      const json = await res.json();
      return json?.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const { data: supplierParties = [], isLoading: partiesLoading } = useQuery({
    queryKey: ["supplier-parties-for-purchase-return", debouncedPartySearch],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append("per_page", "300");
      params.append("is_supplier", "true");
      if (debouncedPartySearch) params.append("search", debouncedPartySearch);
      const res = await apiRequest("GET", `${API_BASE_URL}/api/report/get-ledgers/?${params.toString()}`);
      const json = await res.json();
      return json?.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  const partyOptions = useMemo(() => {
    const options = [...supplierParties];
    const exists = options.some((p) => String(p?.name || "").trim() === String(partyName || "").trim());
    if (partyName && !exists) {
      options.unshift({ id: `selected-${partyName}`, name: partyName });
    }
    return options;
  }, [supplierParties, partyName]);

  const { data: purchaseOrderDetail } = useQuery({
    queryKey: ["purchase-order-detail-for-return", purchaseOrderId],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/report/purchase-orders/${purchaseOrderId}/`);
      const json = await res.json();
      if (json?.status !== 200 || !json?.data) throw new Error(json?.message || "Failed to load purchase order");
      return json.data;
    },
    enabled: !!purchaseOrderId && !isEditMode,
    refetchOnWindowFocus: false,
  });

  const { data: purchaseReturnDetail, isLoading: editLoading } = useQuery({
    queryKey: ["purchase-return-detail", editIdNum],
    queryFn: async () => {
      const res = await apiRequest("GET", `${API_BASE_URL}/api/voucher/purchase-return-orders/${editIdNum}/`);
      const json = await res.json();
      if (json?.status !== 200 || !json?.data) throw new Error(json?.message || "Failed to load purchase return");
      return json.data;
    },
    enabled: isEditMode && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!purchaseOrderDetail) return;
    setPartyName(purchaseOrderDetail.party || "");
    if (!purchaseOrderDetail?.purchase_items?.length) {
      setItems([]);
      return;
    }
    setItems(
      purchaseOrderDetail.purchase_items.map((line) => ({
        id: `new-${line.id}`,
        purchase_item_id: line.id,
        stock_item_id: line.item_id,
        stock_item_name: line.stock_item,
        purchase_order_qty: line.purchase_order_qty || line.actual_qty || "",
        rate: parseRate(line.rate) || "",
        base_unit: line.item_unit || "",
        secondary_unit: line.alternate_unit || "",
        uom: line.uom || line.item_unit || line.alternate_unit || "",
        remarks: "",
        isRemarksEditing: false,
        return_qty: "",
        amount: line.amount || 0,
      }))
    );
  }, [purchaseOrderDetail]);

  useEffect(() => {
    if (!purchaseReturnDetail) return;
    setPurchaseOrderId(String(purchaseReturnDetail.purchase_order_id || ""));
    setPartyName(purchaseReturnDetail.party_name || "");
    setRemarks(purchaseReturnDetail.remarks || "");
    setItems(
      (purchaseReturnDetail.items || []).map((line) => ({
        id: line.id,
        purchase_item_id: line.purchase_item_id,
        stock_item_id: line.stock_item_id,
        stock_item_name: line.stock_item_name,
        purchase_order_qty: line.purchase_order_qty || line.actual_qty || "",
        rate: parseRate(line.rate) || "",
        base_unit: line.item_unit || "",
        secondary_unit: line.alternate_unit || "",
        uom: line.uom || line.item_unit || line.alternate_unit || "",
        remarks: line.remarks || "",
        isRemarksEditing: false,
        return_qty: String(line.return_qty || ""),
         amount: line.amount || 0,
      }))
    );
  }, [purchaseReturnDetail]);

  const canCreate =
    hasPermission("purchase_return", "create") ||
    hasPermission("purchase_return", "read") ||
    hasPermission("purchase_order", "create") ||
    hasPermission("purchase_order", "read");
  const canUpdate =
    hasPermission("purchase_return", "update") ||
    hasPermission("purchase_order", "update") ||
    hasPermission("purchase_order", "read");
  const canSubmit = isEditMode ? canUpdate : canCreate;

  const totalAmount = useMemo(() => {
    return items.reduce((sum, line) => sum + (toNumber(line.return_qty) * toNumber(line.rate || 0)), 0);
  }, [items]);

  const mutateSave = useMutation({
    mutationFn: async (payload) => {
      const res = await apiRequest("POST", `${API_BASE_URL}/api/voucher/purchase-return-order/`, payload);
      return res.json();
    },
    onSuccess: (json) => {
      if (json?.status === 200) {
        toast({
          title: "Success",
          description: json.message || "Purchase return saved",
          className: "bg-green-50 border-green-100 text-green-800",
        });
        setLocation("/reports/purchase-return-reports");
      } else {
        toast({ title: "Error", description: json?.message || "Unable to save purchase return", variant: "destructive" });
      }
    },
    onError: (err) => {
      toast({ title: "Error", description: err?.message || "Unable to save purchase return", variant: "destructive" });
    },
  });

  const onSubmit = () => {
    if (!purchaseOrderId) {
      toast({ title: "Validation", description: "Select purchase order", variant: "destructive" });
      return;
    }
    const validItems = items.filter((line) => toNumber(line.return_qty) > 0);
    if (!validItems.length) {
      toast({ title: "Validation", description: "Enter return qty for at least one item", variant: "destructive" });
      return;
    }
    const payload = {
      ...(isEditMode ? { purchase_return_id: editIdNum } : {}),
      purchase_order_id: parseInt(purchaseOrderId, 10),
      party_name: partyName || undefined,
      remarks,
      status: "pending",
      items: validItems.map((line) => ({
        purchase_item_id: line.purchase_item_id,
        stock_item_id: line.stock_item_id,
        return_qty: toNumber(line.return_qty),
        rate: line.rate === "" ? null : toNumber(line.rate),
        uom: line.uom,
        item_status: "pending",
        remarks: line.remarks || "",
      })),
    };
    mutateSave.mutate(payload);
  };

  const updateLine = (idx, key, value) => {
    setItems((prev) => prev.map((line, i) => (i === idx ? { ...line, [key]: value } : line)));
  };

  if (isBootLoading || permissionsLoading || (isEditMode && editLoading)) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="flex-1 flex items-center justify-center"><Loader /></div>
      </div>
    );
  }

  if (!canSubmit) {
    return (
      <div className="flex h-screen overflow-hidden">
        {!isMobile && <Sidebar />}
        {isMobile && <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />}
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
            <p className="text-red-600 mb-4">You don't have permission to {isEditMode ? "update" : "create"} purchase return.</p>
            <Button onClick={() => window.history.back()} variant="outline">Go Back</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {!isMobile && <Sidebar />}
      <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0 h-full">
        <div className="flex items-center justify-between p-4 border-b bg-white flex-shrink-0">
          <div className="flex items-center space-x-4">
            {isMobile && (
              <Button variant="outline" size="sm" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-4 w-4" />
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={() => window.history.back()} className="mr-2">
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{isEditMode ? "Edit Purchase Return" : "Add Purchase Return"}</h1>
              <p className="text-gray-600">{isEditMode ? "Update purchase return" : "Create new purchase return"}</p>
            </div>
          </div>
          <Badge variant="outline">{format(new Date(), "dd/MM/yyyy")}</Badge>
        </div>

        <main className="flex-1 overflow-y-auto bg-gray-50 p-4 sm:p-6 min-h-0">
          <div className="max-w-7xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
              </CardHeader>
              <CardContent className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <Label>Purchase Order</Label>
                  <Popover
                    open={poDropdownOpen}
                    onOpenChange={(open) => {
                      if (isEditMode) return;
                      setPoDropdownOpen(open);
                      if (!open) setPoSearchTerm("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        className={`w-full justify-between text-left ${isEditMode ? "cursor-not-allowed opacity-100" : ""}`}
                        disabled={isEditMode}
                      >
                        <span className="truncate">
                          {purchaseOrderId
                            ? (poListData.find((po) => String(po.id) === String(purchaseOrderId))?.voucher_number || `PO #${purchaseOrderId}`)
                            : "Select purchase order"}
                        </span>
                        {!isEditMode && <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0 z-50" align="start" side="bottom" sideOffset={4}>
                      <Command shouldFilter={false}>
                        <CommandInput placeholder="Search purchase order..." value={poSearchTerm} onValueChange={setPoSearchTerm} />
                        <CommandList>
                          <CommandEmpty>
                            <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                              Searching...
                            </div>
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              {poListData.map((po) => (
                                <CommandItem
                                  key={po.id}
                                  value={String(po.voucher_number || "")}
                                  onSelect={() => {
                                    setPurchaseOrderId(String(po.id));
                                    setPoDropdownOpen(false);
                                    setPoSearchTerm("");
                                  }}
                                  className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check className={`h-4 w-4 ${String(purchaseOrderId) === String(po.id) ? "opacity-100 text-blue-600" : "opacity-0"}`} />
                                    <div>
                                      <div className="font-medium text-gray-900">{po.voucher_number}</div>
                                      <div className="text-xs text-muted-foreground">{po.party}</div>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Party (Supplier)</Label>
                  <Popover
                    open={partyDropdownOpen}
                    onOpenChange={(open) => {
                      setPartyDropdownOpen(open);
                      if (!open) setPartySearchTerm("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={partyDropdownOpen}
                        className="w-full justify-between text-left min-h-[2.75rem] font-normal"
                      >
                        <span className="truncate flex-1 text-left min-w-0">
                          {partyName || "Select party"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[max(20rem,var(--radix-popover-trigger-width))] max-w-[min(32rem,95vw)] p-0 z-50"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                    >
                      <Command shouldFilter={false} className="relative">
                        <CommandInput
                          placeholder="Search parties..."
                          value={partySearchTerm}
                          onValueChange={setPartySearchTerm}
                          className={partyName || partySearchTerm ? "pr-10" : undefined}
                        />
                        {(partyName || partySearchTerm) && (
                          <button
                            type="button"
                            className="absolute right-3 top-0 z-10 flex h-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                            title="Clear party"
                            aria-label="Clear party"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              setPartyName("");
                              setPartySearchTerm("");
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        <CommandList>
                          <CommandEmpty>
                            {partiesLoading ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                                Loading parties...
                              </div>
                            ) : (
                              "No parties found."
                            )}
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              {partyOptions.map((party) => (
                                <CommandItem
                                  key={party.id}
                                  value={party.name}
                                  onSelect={() => {
                                    setPartyName(party.name);
                                    setPartyDropdownOpen(false);
                                    setPartySearchTerm("");
                                  }}
                                  className="flex items-start cursor-pointer hover:bg-gray-50 px-3 py-2"
                                >
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <Check
                                      className={`mt-0.5 h-4 w-4 shrink-0 ${partyName === party.name ? "opacity-100 text-blue-600" : "opacity-0"}`}
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="font-medium text-gray-900 leading-snug">{party.name}</div>
                                    </div>
                                  </div>
                                </CommandItem>
                              ))}
                            </ScrollArea>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="md:col-span-2 max-w-[520px]">
                  <Label>Remarks</Label>
                  <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="Enter remarks..." />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Return Items</span>
                  <Badge variant="secondary">{items.length} item(s)</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {items.map((line, idx) => {
                  // const uomOptions = [line.base_unit, line.secondary_unit]
                  const uomOptions = [line.uom]
                    .map((u) => String(u || "").trim())
                    .filter(Boolean)
                    .filter((u, i, arr) => arr.indexOf(u) === i);
                  return (
                    <div key={line.id || idx} className="border rounded-md p-3 grid grid-cols-1 md:grid-cols-8 gap-3 items-end">
                      <div className="md:col-span-2">
                        <Label>Stock Item</Label>
                        <Input value={line.stock_item_name || ""} disabled />
                      </div>
                      <div>
                        <Label>PO Qty</Label>
                        <Input value={line.purchase_order_qty || "-"} disabled />
                      </div>
                      <div>
                        <Label>Rate (optional)</Label>
                        <Input className="w-[110px]" value={line.rate} onChange={(e) => updateLine(idx, "rate", e.target.value)} placeholder="Optional" disabled/>
                      </div>
                      <div>
                        <Label>UOM</Label>
                        <Select value={line.uom || ""} onValueChange={(v) => updateLine(idx, "uom", v)} disabled>
                          <SelectTrigger><SelectValue placeholder="Select UOM" /></SelectTrigger>
                          <SelectContent>
                            {uomOptions.length ? (
                              uomOptions.map((unit) => (
                                <SelectItem key={unit} value={unit}>{unit}</SelectItem>
                              ))
                            ) : (
                              <SelectItem value="-" disabled>No units mapped</SelectItem>
                            )}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Return Qty</Label>
                        <Input className="w-[110px]" value={Math.floor(line.return_qty)} onChange={(e) => updateLine(idx, "return_qty", e.target.value)} />
                      </div>
                      <div>
                        <Label>Amount</Label>
                        <Input value={`₹ ${(toNumber(line.amount)).toFixed(2)}`} disabled />
                      </div>
                      <div>
                        <Label>Remarks</Label>
                        {line.isRemarksEditing ? (
                          <Input
                            value={line.remarks || ""}
                            onChange={(e) => updateLine(idx, "remarks", e.target.value)}
                            onBlur={() => updateLine(idx, "isRemarksEditing", false)}
                            autoFocus
                            placeholder="Item remark"
                          />
                        ) : (
                          <Button
                            type="button"
                            variant="outline"
                            className="w-full justify-center"
                            onClick={() => updateLine(idx, "isRemarksEditing", true)}
                            title={line.remarks ? "Edit remark" : "Add remark"}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="flex justify-between items-center">
              <div className="text-sm font-medium text-gray-700">Total Amount: ₹ {totalAmount.toFixed(2)}</div>
              <div className="space-x-2">
                <Button variant="outline" onClick={() => window.history.back()}>
                  <Trash2 className="h-4 w-4 mr-2" /> Cancel
                </Button>
                <Button onClick={onSubmit} disabled={mutateSave.isPending}>
                  <Save className="h-4 w-4 mr-2" />
                  {mutateSave.isPending ? "Saving..." : isEditMode ? "Update Purchase Return" : "Create Purchase Return"}
                </Button>
              </div>
            </div>

            {!isTallyEnabled && (
              <p className="text-xs text-muted-foreground">
                Tally is disabled for this customer. Tally-related fields are hidden in listing/detail screens.
              </p>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
