import React, { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { ArrowDown, ArrowLeft, ArrowUp, ArrowUpDown, CalendarDays, ChevronLeft, ChevronRight, Package, Menu, Filter, Truck, FileText, User, Scale, Clock, Tag, Calendar, Plus, Loader2, Edit, Trash2, Image, Upload, Search, CheckCircle, XCircle, TestTube, Receipt } from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { Calendar as CalendarComponent } from "../components/ui/calendar";
// import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Eye, Info } from "lucide-react";
import { useLocation } from "wouter";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  inwardListSummaryWeightUnit,
  formatTotalWeightDisplay,
  formatInvoiceQuantityLabel,
} from "@/lib/weightDisplay";
import { X, Camera, Save,ChevronsUpDown,Check  } from "lucide-react";
import { format, startOfDay, endOfDay, startOfWeek, endOfWeek } from "date-fns";


const ITEMS_PER_PAGE = 50;
const today = new Date();

const getTodayOnlyDate = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const getPresetDateRange = (preset) => {
  const now = new Date();
  if (preset === "today") {
    const todayOnly = getTodayOnlyDate();
    return { from: todayOnly, to: todayOnly };
  }
  if (preset === "weekly") {
    const currentDay = now.getDay();
    const mondayDiff = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(now);
    monday.setDate(monday.getDate() + mondayDiff);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);
    return { from: monday, to: sunday };
  }
  if (preset === "monthly") {
    return {
      from: new Date(now.getFullYear(), now.getMonth(), 1),
      to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
    };
  }
  return { from: null, to: null };
};

const formatDateForApi = (date) => {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
// Image type choices based on API
const IMAGE_TYPE_CHOICES = [
  { value: 'bardan_quality', label: 'Bardan Quality' },
  { value: 'inward_chitti', label: 'Inward Chitti' },
  { value: 'bucket_photo', label: 'Bucket Photo' },
  { value: 'lab_samples', label: 'Lab Samples' },
  { value: 'others', label: 'Others' },
];

// Form validation schema for edit
const editInwardSchema = z.object({
  update_type: z.enum(['admin_approval', 'assign_supervisor', 'supervisor_update', 'final_completion']),
  items: z.array(z.object({
    id: z.number(),
    our_brand: z.string().optional(),
    remarks: z.string().optional(),
    supervisor_remarks: z.string().optional(),
    unloaded_weight: z.string().optional(),
    status: z.string().optional(),
  })).optional(),
  images: z.array(z.object({
    type: z.string(),
    image: z.string(), // base64
    remarks: z.string().optional(),
  })).optional(),
});

// Edit Inward Entry Form Component
function EditInwardEntryForm({ entry, onClose, onSuccess }) {
  const { toast } = useToast();
  const [images, setImages] = useState([]);
  const [imagePreview, setImagePreview] = useState({});

  const form = useForm({
    resolver: zodResolver(editInwardSchema),
    defaultValues: {
      update_type: 'admin_approval',
      items: [],
      images: [],
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data) => {
      const response = await apiRequest('POST', `${import.meta.env.VITE_BASE_URL}/api/report/update-inward/`, {
        inward_entry_id: entry.id,
        ...data,
      });
      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "✅ Success",
        description: "Inward entry updated successfully",
        variant: "success",
      });
      onSuccess();
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to update inward entry",
        variant: "destructive",
      });
    },
  });

  const handleImageUpload = (file, type, remarks = '') => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const base64 = e.target.result;
      const newImage = {
        type,
        image: base64,
        remarks,
        id: Date.now(), // temporary ID for preview
      };
      setImages(prev => [...prev, newImage]);

      // Create preview
      setImagePreview(prev => ({
        ...prev,
        [newImage.id]: URL.createObjectURL(file)
      }));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = (imageId) => {
    setImages(prev => prev.filter(img => img.id !== imageId));
    if (imagePreview[imageId]) {
      URL.revokeObjectURL(imagePreview[imageId]);
      setImagePreview(prev => {
        const newPreview = { ...prev };
        delete newPreview[imageId];
        return newPreview;
      });
    }
  };

  const onSubmit = (data) => {
    const submitData = {
      ...data,
      images: images.map(({ id, ...rest }) => rest), // Remove temporary ID
    };
    updateMutation.mutate(submitData);
  };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
      {/* Update Type Selection */}
      <div className="space-y-2">
        <Label htmlFor="update_type">Update Type</Label>
        <Select
          value={form.watch('update_type')}
          onValueChange={(value) => form.setValue('update_type', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select update type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin_approval">Admin Approval</SelectItem>
            <SelectItem value="assign_supervisor">Assign Supervisor</SelectItem>
            <SelectItem value="supervisor_update">Supervisor Update</SelectItem>
            <SelectItem value="final_completion">Final Completion</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Image Upload Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label className="text-lg font-semibold">Upload Images</Label>
          <Badge variant="outline">{images.length} images</Badge>
        </div>

        {/* Image Upload Controls */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {IMAGE_TYPE_CHOICES.map((imageType) => (
            <div key={imageType.value} className="space-y-2">
              <Label className="text-sm font-medium">{imageType.label}</Label>
              <div className="relative">
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files[0];
                    if (file) {
                      handleImageUpload(file, imageType.value);
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 text-center hover:border-gray-400 transition-colors">
                  <Camera className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                  <p className="text-sm text-gray-600">Click to upload</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Image Previews */}
        {images.length > 0 && (
          <div className="space-y-4">
            <Label className="text-sm font-medium">Uploaded Images</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {images.map((image) => (
                <div key={image.id} className="relative group">
                  <img
                    src={imagePreview[image.id]}
                    alt={image.type}
                    className="w-full h-32 object-cover rounded-lg border"
                  />
                  <div className="absolute top-2 left-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                    {IMAGE_TYPE_CHOICES.find(t => t.value === image.type)?.label}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeImage(image.id)}
                    className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  {image.remarks && (
                    <div className="absolute bottom-2 left-2 right-2 bg-black bg-opacity-50 text-white text-xs px-2 py-1 rounded">
                      {image.remarks}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end space-x-4 pt-4 border-t">
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={updateMutation.isPending}
          className="bg-blue-600 hover:bg-blue-700"
        >
          {updateMutation.isPending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              Updating...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Update Entry
            </>
          )}
        </Button>
      </div>
    </form>
  );
}

export default function ItemMasters() {
  // Get user role for role-based status filters
  const userData = AuthService.getUserData();
  const userRoleId = Number(userData?.role_id);

  // Dashboard-aligned inward summary statuses (matches get_inward_entries_list summary)
  const INWARD_DASHBOARD_SUMMARY_STATUSES = [
    { value: "pending", label: "Pending" },
    { value: "approved", label: "Approved" },
    { value: "rejected", label: "Rejected" },
    { value: "unloading_pending", label: "Unloading Pending" },
    { value: "unloaded", label: "Unloaded" },
    { value: "inward_completed", label: "Inward Completed" },
  ];

  const normalizeInwardSummaryStatusKey = (statusKey) => {
    if (statusKey === "completed") return "inward_completed";
    if (statusKey === "not_unloaded") return "unloading_pending";
    return statusKey;
  };

  // Define role-based status filters (summary chips + status dropdown)
  const getRoleBasedStatusFilters = () => {
    if (userRoleId === 2 || userRoleId === 3) {
      return INWARD_DASHBOARD_SUMMARY_STATUSES.filter((filter) =>
        ["pending", "inward_completed"].includes(filter.value)
      );
    }
    return INWARD_DASHBOARD_SUMMARY_STATUSES;
  };

  // Helper function to format date in YYYY-MM-DD using local timezone
  const formatDateLocal = (date) => {
    if (!(date instanceof Date)) return null;
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const normalizeInwardFilterStatus = (statusParam) => {
    if (!statusParam || statusParam === "all") return "all";
    if (statusParam === "completed") return "inward_completed";
    if (statusParam === "not_unloaded") return "unloading_pending";
    return statusParam;
  };

  // Initialize state with URL parameters if available
  const [status, setStatus] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return normalizeInwardFilterStatus(urlParams.get("status") || "all");
  });

  const isDashboardSingleDayNavigation = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const source = urlParams.get("source");
    const fromDateParam = urlParams.get("from_date");
    const toDateParam = urlParams.get("to_date");
    return source === "dashboard" && !!fromDateParam && !!toDateParam && fromDateParam === toDateParam;
  };

  // Date range preset: today | weekly | monthly | custom
  const [dateRangePreset, setDateRangePreset] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get('from_date');
    const toDateParam = urlParams.get('to_date');
    const presetParam = urlParams.get("date_range");
    if (presetParam && ["today", "weekly", "monthly", "custom"].includes(presetParam)) {
      return presetParam;
    }
    if (isDashboardSingleDayNavigation()) return "today";
    return fromDateParam && toDateParam ? "custom" : "today";
  });

  const [fromDate, setFromDate] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get('from_date');
    const toDateParam = urlParams.get('to_date');
    const presetParam = urlParams.get("date_range");

    if (fromDateParam && (presetParam === "custom" || !presetParam)) {
      return new Date(fromDateParam);
    }
    if (presetParam && ["today", "weekly", "monthly"].includes(presetParam)) {
      return getPresetDateRange(presetParam).from;
    }
    return getTodayOnlyDate();
  });

  const [toDate, setToDate] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get('from_date');
    const toDateParam = urlParams.get('to_date');
    const presetParam = urlParams.get("date_range");

    if (toDateParam && (presetParam === "custom" || !presetParam)) {
      return new Date(toDateParam);
    }
    if (presetParam && ["today", "weekly", "monthly"].includes(presetParam)) {
      return getPresetDateRange(presetParam).to;
    }
    return getTodayOnlyDate();
  });
  const [isDatePickerOpen, setIsDatePickerOpen] = useState({ from: false, to: false });

  const [currentPage, setCurrentPage] = useState(1);
  const [listViewMode, setListViewMode] = useState("party");
  const [itemSort, setItemSort] = useState({ column: "entry", direction: "asc" });
  const [searchQuery, setSearchQuery] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('search') || "";
  });
  const [selectedParty, setSelectedParty] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get('party_id') || "all";
  });

  // Status change modal state
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedEntryForStatus, setSelectedEntryForStatus] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [updateType, setUpdateType] = useState("");
  const [ourBrand, setOurBrand] = useState("");
  const [remarks, setRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [filters, setFilters] = useState(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromDateParam = urlParams.get('from_date');
    const toDateParam = urlParams.get('to_date');
    const presetParam = urlParams.get("date_range");
    const statusParam = normalizeInwardFilterStatus(urlParams.get('status') || "all");
    const partyParam = urlParams.get('party_id');

    if (presetParam && ["today", "weekly", "monthly"].includes(presetParam)) {
      const range = getPresetDateRange(presetParam);
      return {
        from_date: formatDateForApi(range.from),
        to_date: formatDateForApi(range.to),
        status: statusParam || "all",
        party_id: partyParam || "all",
        search: urlParams.get('search') || "",
      };
    }

    if (fromDateParam || toDateParam) {
      return {
        from_date: fromDateParam || null,
        to_date: toDateParam || null,
        status: statusParam || "all",
        party_id: partyParam || "all",
        search: urlParams.get('search') || "",
      };
    }

    const todayRange = getPresetDateRange("today");
    return {
      from_date: formatDateForApi(todayRange.from),
      to_date: formatDateForApi(todayRange.to),
      status: statusParam || "all",
      party_id: partyParam || "all",
      search: urlParams.get('search') || "",
    };
  });
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const { toast } = useToast();
  const isMobile = useIsMobile();
  const token = AuthService.getAccessToken();
  const [, setLocation] = useLocation();
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isInvoiceDialogOpen, setIsInvoiceDialogOpen] = useState(false);
  const [invoiceEntryDetails, setInvoiceEntryDetails] = useState(null);
  const [invoiceItems, setInvoiceItems] = useState([]);
  const [isLoadingInvoiceDetails, setIsLoadingInvoiceDetails] = useState(false);
  const [editingEntry, setEditingEntry] = useState(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [imageUploadErrors, setImageUploadErrors] = useState([]);
  const [statusFilters, setStatusFilters] = useState([]);
  const [partyFilterOpen, setPartyFilterOpen] = useState(false);
  const [partyFilterSearch, setPartyFilterSearch] = useState("");
  
  // State for new invoice creation dialog
  const [isCreateInvoiceDialogOpen, setIsCreateInvoiceDialogOpen] = useState(false);
  const [createInvoiceEntry, setCreateInvoiceEntry] = useState(null);
  const [createInvoiceItems, setCreateInvoiceItems] = useState([]);
  const [isLoadingCreateInvoice, setIsLoadingCreateInvoice] = useState(false);
  const [entryInvoiceNumber, setEntryInvoiceNumber] = useState("");
  const [entryAdditionalPayment, setEntryAdditionalPayment] = useState("");
  const [isJournalDialogOpen, setIsJournalDialogOpen] = useState(false);
  const [selectedJournalEntry, setSelectedJournalEntry] = useState(null);
  const [sourceJournalItems, setSourceJournalItems] = useState([]);
  const [destinationJournalItems, setDestinationJournalItems] = useState([]);
  const [destinationItemsByGodown, setDestinationItemsByGodown] = useState({});
  const [loadingDestinationItemsByGodown, setLoadingDestinationItemsByGodown] = useState({});
  const [destinationItemSearchByRow, setDestinationItemSearchByRow] = useState({});
  const [destinationItemDropdownOpenByRow, setDestinationItemDropdownOpenByRow] = useState({});
  const [journalVoucherId, setJournalVoucherId] = useState("");
  const [journalRemarks, setJournalRemarks] = useState("");
  const [isLoadingJournalSource, setIsLoadingJournalSource] = useState(false);
  const [isSubmittingJournal, setIsSubmittingJournal] = useState(false);

  const normalizeBoolean = (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "number") return value === 1;
    if (typeof value === "string") return value.toLowerCase() === "true" || value === "1";
    return false;
  };

  const toNumberOrZero = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
  };

  const formatFixed = (value, digits = 2) => {
    const n = toNumberOrZero(value);
    return n.toFixed(digits);
  };

  const formatSourceQuantityDisplay = (row) => {
    const bags = toNumberOrZero(row.number_of_bags);
    const baseUnit = (row.base_unit || row.qty_unit || "").trim();
    return `${formatFixed(bags)} ${baseUnit}`.trim();
  };

  const formatSourceAlternateDisplay = (row) => {
    const bags = toNumberOrZero(row.number_of_bags);
    const altQty = toNumberOrZero(row.alternate_qty);
    const baseUnit = (row.base_unit || "").trim();
    const altUnit = (row.alternate_unit || "").trim();
    const explicitConversion = toNumberOrZero(row.item_conversion);
    const derivedConversion = bags > 0 ? altQty / bags : 0;
    const conversion = explicitConversion > 0 ? explicitConversion : derivedConversion;

    if (bags > 0 && baseUnit && altQty > 0 && altUnit) {
      return `${formatFixed(bags)} ${baseUnit} = ${formatFixed(altQty)} ${altUnit}`;
    }
    if (conversion > 0 && baseUnit && altUnit) {
      return `1 ${baseUnit} = ${formatFixed(conversion, 3)} ${altUnit}`;
    }
    return "-";
  };

  const getDestinationItemsKey = (godownName, itemType = "item", searchText = "") => {
    const trimmedGodown = (godownName || "").trim();
    const normalizedType = itemType === "bardan" ? "bardan" : "default";
    const normalizedSearch = (searchText || "").trim().toLowerCase();
    return `${trimmedGodown}::${normalizedType}::${normalizedSearch}`;
  };

  const formatDestinationQtyConversion = (row) => {
    const qty = toNumberOrZero(row.actual_qty);
    const baseUnit = (row.stock_base_unit || "").trim();
    const altUnit = (row.stock_alternate_unit || "").trim();
    const conversion = toNumberOrZero(row.stock_conversion);
    if (!qty || !baseUnit || !altUnit || conversion <= 0) return "";
    const altQty = qty * conversion;
    return `${formatFixed(qty)} ${baseUnit} = ${formatFixed(altQty)} ${altUnit}`;
  };

  const normalizeQtyWithUnit = (qtyText, unitName) => {
    const unit = (unitName || "").trim();
    const raw = String(qtyText || "").trim();
    const match = raw.match(/([+-]?\d+(\.\d+)?)/);
    if (!match) return unit ? `0 ${unit}` : "0";
    const numeric = match[1];
    return unit ? `${numeric} ${unit}` : numeric;
  };

  const { data: stockJournalVoucherTypesData } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-voucher-types/inward-journal`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/get-voucher-types/?is_active=true&add_bardan=true&inward_enabled=true`, {
        headers: AuthService.getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch voucher types");
      const result = await res.json();
      return result?.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const { data: godownMasterData } = useQuery({
    queryKey: [`${API_BASE_URL}/api/get-godowns/inward-journal`],
    queryFn: async () => {
      const res = await fetch(`${API_BASE_URL}/api/get-godowns/`, {
        headers: AuthService.getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch godowns");
      const result = await res.json();
      return result?.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
  });

  const applyDateRangePreset = (preset) => {
    if (preset === "custom") return;
    const { from, to } = getPresetDateRange(preset);
    if (from && to) {
      setFromDate(from);
      setToDate(to);
    }
  };

  const buildApiFilters = React.useCallback(() => ({
    from_date: fromDate instanceof Date ? formatDateLocal(fromDate) : null,
    to_date: toDate instanceof Date ? formatDateLocal(toDate) : null,
    status: status || "all",
    party_id: selectedParty || "all",
    search: (searchQuery || "").trim(),
  }), [fromDate, toDate, status, selectedParty, searchQuery]);

  const applyTodayIfDatesEmpty = () => {
    if (!fromDate && !toDate) {
      const todayOnly = getTodayOnlyDate();
      setFromDate(todayOnly);
      setToDate(todayOnly);
      setDateRangePreset("today");
    }
  };

  // Keep preset-driven ranges aligned (e.g. date_range=today must use today's dates in API).
  useEffect(() => {
    if (dateRangePreset === "custom") return;
    if (isDashboardSingleDayNavigation()) return;

    const { from, to } = getPresetDateRange(dateRangePreset);
    const expectedFrom = formatDateForApi(from);
    const expectedTo = formatDateForApi(to);
    const currentFrom = fromDate instanceof Date ? formatDateLocal(fromDate) : null;
    const currentTo = toDate instanceof Date ? formatDateLocal(toDate) : null;

    if (currentFrom !== expectedFrom || currentTo !== expectedTo) {
      setFromDate(from);
      setToDate(to);
    }
  }, [dateRangePreset]);

  // Get user permissions
  const {
    hasCreatePermission,
    hasReadPermission,
    hasUpdatePermission,
    hasDeletePermission,
    hasModuleAccess,
    isLoading: permissionsLoading
  } = useUserPermissions();

  const hasSalesReturnAccess = hasModuleAccess("sales_return");

  const formatLinkedOrderLabel = (item) => {
    if (hasSalesReturnAccess && item?.sales_return_no) {
      return `SRO: ${item.sales_return_no}`;
    }
    if (item?.purchase_order_no) {
      return `PO: ${item.purchase_order_no}`;
    }
    return `Bill No: ${item?.bill_no || "No Bill"}`;
  };

  // Set status filters based on user role
  useEffect(() => {
    const roleBasedFilters = getRoleBasedStatusFilters();
    setStatusFilters(roleBasedFilters);
  }, [userRoleId]);

  const handleViewDetails = (entry) => {
    setLocation(`/inward-details/${entry.id}`);
  };

  const handleViewEntryInfo = (entry) => {
    setSelectedEntry(entry);
    setIsDialogOpen(true);
  };


  // Fetch and show invoice conversion dialog (old functionality - keeping for backward compatibility)
  const handleConvertToInvoice = async (entry) => {
    setIsInvoiceDialogOpen(true);
    setIsLoadingInvoiceDetails(true);
    setInvoiceEntryDetails(null);
    setInvoiceItems([]);

    try {
      const token = AuthService.getAccessToken();
      const API_URL = import.meta.env.VITE_BASE_URL;
      const res = await fetch(
        `${API_URL}/api/report/get-inwards/${entry.id}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch details");
      const result = await res.json();

      if (result.status === 200) {
        setInvoiceEntryDetails(result.data);
        // Initialize invoice items from API billed details
        const itemsWithRates = (result.items || []).map((item) => ({
          ...item,
          inward_qty: parseFloat(item.number_of_bags || item.total_weight || 0), // Use actual inward qty
          billed_amount: parseFloat(item.billed_amount || 0) || 0,
          billing_date: item.billing_date || null,
        }));
        setInvoiceItems(itemsWithRates);
      } else {
        throw new Error(result.message || "Failed to fetch details");
      }
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch entry details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingInvoiceDetails(false);
    }
  };

  // Handle Create Invoice button click - for completed inward entries
  const handleCreateInvoice = async (entry) => {
    setIsCreateInvoiceDialogOpen(true);
    setIsLoadingCreateInvoice(true);
    setCreateInvoiceEntry(entry);
    setCreateInvoiceItems([]);
    setEntryInvoiceNumber("");
    setEntryAdditionalPayment("");

    try {
      const token = AuthService.getAccessToken();
      const API_URL = import.meta.env.VITE_BASE_URL;
      const res = await fetch(
        `${API_URL}/api/report/get-inwards/${entry.id}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!res.ok) throw new Error("Failed to fetch details");
      const result = await res.json();

      if (result.status === 200) {
        // Filter items that are approved and completed
        const completedItems = (result.items || []).filter(
          (item) => (item.status === 'approved' || item.status === 'completed') && !item.invoice_number
        );
        
        // Initialize invoice items with empty invoice fields
        const itemsForInvoice = completedItems.map((item) => ({
          ...item,
          per_unit_rate: "",
          include_gst: false,
          gst_rate: Number(item?.gst_rate ?? 0) || 0,
          billed_amount: "",
        }));
        
        setCreateInvoiceItems(itemsForInvoice);
        
        if (itemsForInvoice.length === 0) {
          toast({
            title: "No Items Available",
            description: "No approved or completed items found without existing invoices for this entry.",
            variant: "default",
          });
        }
      } else {
        throw new Error(result.message || "Failed to fetch details");
      }
    } catch (error) {
      console.error("Error fetching invoice details:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch entry details",
        variant: "destructive",
      });
    } finally {
      setIsLoadingCreateInvoice(false);
    }
  };

  const handleOpenStockJournalDialog = async (entry) => {
    setSelectedJournalEntry(entry);
    setIsJournalDialogOpen(true);
    setIsLoadingJournalSource(true);
    setSourceJournalItems([]);
    setDestinationJournalItems([]);
    setDestinationItemsByGodown({});
    setLoadingDestinationItemsByGodown({});
    setDestinationItemSearchByRow({});
    setDestinationItemDropdownOpenByRow({});
    setJournalVoucherId("");
    setJournalRemarks("");

    try {
      const res = await fetch(`${API_BASE_URL}/api/report/get-inwards/${entry.id}/`, {
        headers: AuthService.getAuthHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch inward details");
      const result = await res.json();
      if (result.status !== 200) throw new Error(result.message || "Failed to fetch inward details");

      const sourceItems = (result.items || []).map((row) => ({
        inward_item_id: row.id,
        stock_item_id: row.item_id,
        stock_item_name: row.item_name,
        qty: row.number_of_bags || 0,
        qty_unit: row.base_unit || row.unit || "",
        number_of_bags: row.number_of_bags || 0,
        base_unit: row.base_unit || "",
        alternate_unit: row.alternate_unit || "",
        alternate_qty: row.total_weight || 0,
        item_conversion: row.conversion || 0,
        godown_name: row.godown_location || "",
        batch_name: "Primary Batch",
      }));
      setSourceJournalItems(sourceItems);
      const firstSource = sourceItems[0] || {};
      setDestinationJournalItems([
        {
          destination_type: "item",
          stock_item_id: "",
          stock_item_name: "",
          actual_qty: firstSource.number_of_bags
            ? `${firstSource.number_of_bags} ${firstSource.base_unit || firstSource.qty_unit || ""}`.trim()
            : "",
          godown_name: firstSource.godown_name || "",
          batch_name: "Primary Batch",
        },
      ]);

      // Preload destination stock items by current godowns.
      const uniqueGodowns = [...new Set(sourceItems.map((s) => (s.godown_name || "").trim()).filter(Boolean))];
      await Promise.all(uniqueGodowns.map((godownName) => loadDestinationItemsByGodown(godownName, "item", "", 1, false)));
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Unable to load inward source items",
        variant: "destructive",
      });
    } finally {
      setIsLoadingJournalSource(false);
    }
  };

  const loadDestinationItemsByGodown = async (godownName, itemType = "item", searchText = "", page = 1, append = false) => {
    const trimmedGodown = (godownName || "").trim();
    if (!trimmedGodown) return [];
    const typeValue = itemType === "bardan" ? "bardan" : "destination";
    const cacheKey = getDestinationItemsKey(trimmedGodown, itemType, searchText);

    setLoadingDestinationItemsByGodown((prev) => ({ ...prev, [cacheKey]: true }));
    try {
      const res = await apiRequest("POST", `${API_BASE_URL}/api/get-stock-items/`, {
        new_page: page,
        per_page: 50,
        search: searchText || "",
        type: typeValue,
        stock_group: "",
        godown: trimmedGodown,
        voucher_type: "",
      });
      const result = await res.json();
      const rows = result?.data || [];
      setDestinationItemsByGodown((prev) => {
        const prevState = prev[cacheKey] || { items: [], pagination: null };
        const mergedItems = append ? [...prevState.items, ...rows] : rows;
        return {
          ...prev,
          [cacheKey]: {
            items: mergedItems,
            pagination: result?.pagination || null,
          },
        };
      });
      return rows;
    } catch (error) {
      setDestinationItemsByGodown((prev) => ({
        ...prev,
        [cacheKey]: { items: [], pagination: null },
      }));
      return [];
    } finally {
      setLoadingDestinationItemsByGodown((prev) => ({ ...prev, [cacheKey]: false }));
    }
  };

  const handleChangeDestinationJournalItem = (index, key, value) => {
    setDestinationJournalItems((prev) => {
      const next = [...prev];
      const nextRow = { ...next[index], [key]: value };

      if (key === "godown_name") {
        nextRow.stock_item_id = "";
        nextRow.stock_item_name = "";
        nextRow.stock_closing_balance = "";
        nextRow.stock_base_unit = "";
        nextRow.stock_alternate_unit = "";
        nextRow.stock_conversion = "";
        nextRow.batch_name = "Primary Batch";
      }

      next[index] = nextRow;
      return next;
    });

    if (key === "godown_name" && value) {
      const currentType = destinationJournalItems[index]?.destination_type || "item";
      const searchText = destinationItemSearchByRow[index] || "";
      loadDestinationItemsByGodown(value, currentType, searchText, 1, false);
    }
  };

  const addDestinationRow = (rowType = "item") => {
    setDestinationJournalItems((prev) => [
      ...prev,
      {
        destination_type: rowType,
        stock_item_id: "",
        stock_item_name: "",
        stock_closing_balance: "",
        stock_base_unit: "",
        stock_alternate_unit: "",
        stock_conversion: "",
        actual_qty: "",
        godown_name: "",
        batch_name: "Primary Batch",
      },
    ]);
  };

  const removeDestinationRow = (index) => {
    setDestinationJournalItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleDestinationSearchChange = (index, searchText) => {
    setDestinationItemSearchByRow((prev) => ({ ...prev, [index]: searchText }));
    const row = destinationJournalItems[index];
    if (!row?.godown_name) return;
    const rowType = row.destination_type || "item";
    loadDestinationItemsByGodown(row.godown_name, rowType, searchText, 1, false);
  };

  const handleSubmitStockJournalFromInward = async () => {
    if (!selectedJournalEntry?.id) {
      toast({ title: "Validation", description: "Inward entry not selected", variant: "destructive" });
      return;
    }
    if (!journalVoucherId) {
      toast({ title: "Validation", description: "Please select voucher type", variant: "destructive" });
      return;
    }
    const invalidDestination = destinationJournalItems.find(
      (d) => !d.stock_item_id || !d.actual_qty || !d.godown_name || !d.batch_name
    );
    if (invalidDestination) {
      toast({
        title: "Validation",
        description: "Please fill destination item, qty, godown and batch for all rows",
        variant: "destructive",
      });
      return;
    }

    setIsSubmittingJournal(true);
    try {
      const res = await apiRequest("POST", `${API_BASE_URL}/api/voucher/create-inward-stock-journal/`, {
        inward_entry_id: selectedJournalEntry.id,
        voucher_id: Number(journalVoucherId),
        remarks: journalRemarks,
        destination_items: destinationJournalItems.map((d) => ({
          stock_item_id: Number(d.stock_item_id),
          actual_qty: d.actual_qty,
          godown_name: d.godown_name,
          batch_name: d.batch_name || "Primary Batch",
        })),
      });
      const result = await res.json();
      toast({
        title: "Success",
        description: result.message || "Stock journal created successfully",
      });
      setIsJournalDialogOpen(false);
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "Failed to create stock journal",
        variant: "destructive",
      });
    } finally {
      setIsSubmittingJournal(false);
    }
  };

  // Handle invoice field changes
  const handleInvoiceFieldChange = (index, field, value) => {
    const updatedItems = [...createInvoiceItems];
    updatedItems[index][field] = value;

    const qty = parseFloat(updatedItems[index]?.total_weight || updatedItems[index]?.number_of_bags || 0) || 0;
    const rate = parseFloat(updatedItems[index]?.per_unit_rate || 0) || 0;
    const gstRate = parseFloat(updatedItems[index]?.gst_rate || 0) || 0;
    const baseAmount = qty * rate;
    const finalAmount = updatedItems[index]?.include_gst
      ? baseAmount + (baseAmount * gstRate) / 100
      : baseAmount;
    updatedItems[index].billed_amount = finalAmount > 0 ? finalAmount.toFixed(2) : "";

    setCreateInvoiceItems(updatedItems);
  };

  // Handle invoice submission
  const handleSubmitInvoice = async () => {
    // Validate entry-level invoice details and per-unit rate
    if (!entryInvoiceNumber.trim()) {
      toast({
        title: "Validation Error",
        description: "Please enter invoice number.",
        variant: "destructive",
      });
      return;
    }

    const invalidItems = createInvoiceItems.filter((item) => !item.per_unit_rate);

    if (invalidItems.length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fill per unit rate for all items.",
        variant: "destructive",
      });
      return;
    }

    try {
      const token = AuthService.getAccessToken();
      const API_URL = import.meta.env.VITE_BASE_URL;

      // Prepare items for API
      const itemsForAPI = createInvoiceItems.map((item) => ({
        inward_item_id: item.id,
        billed_amount: item.billed_amount,
      }));

      const response = await apiRequest('POST', `${API_URL}/api/report/update-inward/`, {
        inward_entry_id: createInvoiceEntry.id,
        update_type: 'inward_invoicing',
        invoice_number: entryInvoiceNumber.trim(),
        additional_payment: entryAdditionalPayment,
        items: itemsForAPI,
      });

      const result = await response.json();

      if (result.status === 200 || result.status === 'success') {
        toast({
          title: "✅ Success",
          description: result.message || "Invoice created successfully",
          variant: "default",
        });
        setIsCreateInvoiceDialogOpen(false);
        // Refresh the list
        refetch();
      } else {
        throw new Error(result.error || result.message || "Failed to create invoice");
      }
    } catch (error) {
      console.error("Error creating invoice:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create invoice",
        variant: "destructive",
      });
    }
  };

  // Handle rate change in invoice items
  const handleRateChange = (index, rate) => {
    const updatedItems = [...invoiceItems];
    const parsedRate = parseFloat(rate) || 0;
    updatedItems[index].rate = parsedRate;
    updatedItems[index].total = (updatedItems[index].inward_qty || 0) * parsedRate;
    setInvoiceItems(updatedItems);
  };

  // Handle invoice submission
  const handleInvoiceSubmit = () => {
    // Show success alert
    // alert("Submitted successfully");
    toast({
      title: "✅ Success",
      description: "Invoice generated successfully",
      variant: "success",
      duration: 1400,
    });
    setIsInvoiceDialogOpen(false);
  };

  const handleEditEntry = (entry) => {
    setEditingEntry(entry);
    setIsEditDialogOpen(true);
  };

  // Handle approve entry - open modal
  const handleApproveEntry = (entry) => {
    setSelectedEntryForStatus(entry);
    setNewStatus("approved");
    setUpdateType("admin_approval");
    setIsStatusModalOpen(true);
    // Reset form fields
    setOurBrand("");
    setRemarks("");
    setRejectionReason("");
  };

  // Handle reject entry - open modal
  const handleRejectEntry = (entry) => {
    setSelectedEntryForStatus(entry);
    setNewStatus("rejected");
    setUpdateType("admin_approval");
    setIsStatusModalOpen(true);
    // Reset form fields
    setOurBrand("");
    setRemarks("");
    setRejectionReason("");
  };

  // Reset form fields
  const resetStatusForm = () => {
    setSelectedEntryForStatus(null);
    setNewStatus("");
    setUpdateType("");
    setOurBrand("");
    setRemarks("");
    setRejectionReason("");
    setIsUpdating(false);
  };

  // Submit status change
  const handleStatusSubmit = async () => {
    if (!selectedEntryForStatus) return;

    // Validate rejection reason for rejected items
    if (newStatus === 'rejected' && !rejectionReason.trim()) {
      toast({
        title: "Validation Error",
        description: "Please provide a reason for rejection",
        variant: "destructive",
      });
      return;
    }

    setIsUpdating(true);

    try {
      // First fetch entry details to get items
      const detailsResponse = await fetch(
        `${API_BASE_URL}/api/report/get-inwards/${selectedEntryForStatus.id}/`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      if (!detailsResponse.ok) {
        throw new Error('Failed to fetch entry details');
      }

      const detailsResult = await detailsResponse.json();
      if (detailsResult.status !== 200) {
        throw new Error(detailsResult.message || 'Failed to fetch entry details');
      }

      const items = detailsResult.items || [];
      if (items.length === 0) {
        throw new Error('No items found in this entry');
      }

      // Filter items that can be updated based on status
      let itemsToUpdate = [];
      if (newStatus === 'approved') {
        itemsToUpdate = items.filter(item =>
          item.status === 'pending' || item.status === 'rejected'
        );
      } else if (newStatus === 'rejected') {
        itemsToUpdate = items.filter(item =>
          item.status === 'pending' || item.status === 'approved' || item.status === 'not_unloaded'
        );
      }

      if (itemsToUpdate.length === 0) {
        toast({
          title: "Info",
          description: `No items available for ${newStatus === 'approved' ? 'approval' : 'rejection'} in this entry`,
          variant: "destructive",
        });
        setIsUpdating(false);
        return;
      }

      // Prepare items for update
      const itemsData = itemsToUpdate.map(item => ({
        inward_item_id: item.id,
        status: newStatus,
        ...(newStatus === 'approved' && ourBrand && {
          our_brand: ourBrand
        }),
        ...(newStatus === 'approved' && remarks && {
          remarks: remarks
        }),
        ...(newStatus === 'rejected' && rejectionReason && {
          remarks: rejectionReason
        })
      }));

      // Use comprehensive API format
      const response = await apiRequest(
        'POST',
        `${API_BASE_URL}/api/report/update-inward/`,
        {
          inward_entry_id: selectedEntryForStatus.id,
          update_type: 'admin_approval',
          items: itemsData
        }
      );

      const result = await response.json();

      if (response.ok && result.status === 200) {
        toast({
          title: "Success",
          description: `Entry ${newStatus === 'approved' ? 'approved' : 'rejected'} successfully. ${itemsData.length} item(s) updated.`,
          variant: "success",
        });
        // Refetch the data to update the UI
        refetch();
        // Close modal and reset form
        setIsStatusModalOpen(false);
        resetStatusForm();
      } else {
        throw new Error(result.error || result.message || `Failed to ${newStatus === 'approved' ? 'approve' : 'reject'} entry`);
      }
    } catch (error) {
      console.error(`Error ${newStatus === 'approved' ? 'approving' : 'rejecting'} entry:`, error);
      toast({
        title: "Error",
        description: error.message || `Failed to ${newStatus === 'approved' ? 'approve' : 'reject'} entry. Please try again.`,
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  //const API_URL = "http://192.168.1.118:8094";
  const API_URL = import.meta.env.VITE_BASE_URL;

  const fetchItems = async ({ queryKey }) => {
    const [_key, filters, currentPage] = queryKey;

    if (!token) throw new Error("No authentication token found");
    if (!filters) throw new Error("No filters provided");

    const { status, from_date, to_date, party_id, search } = filters;

    const params = new URLSearchParams({
      page: currentPage,
      per_page: String(ITEMS_PER_PAGE),
    });

    if (to_date) {
      params.append("to_date", to_date);
    }

    if (from_date) {
      params.append("from_date", from_date);
    }

    if (status !== "all") {
      params.append("status", status);
    }

    if (party_id && party_id !== "all") {
      params.append("party_id", party_id);
    }

    if (search) {
      params.append("search", search);
    }

    const url = `${API_URL}/api/report/get-inwards/?${params.toString()}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    return {
      data: data.data || [],
      summary: data.summary || null,
      total: data.pagination?.total_count || 0,
      page: data.pagination?.current_page || 1,
      totalPages: data.pagination?.total_pages || 1,
    };
  };

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ["get-inwards", filters, currentPage],
    queryFn: fetchItems,
    enabled: !!AuthService.getAccessToken(),
    keepPreviousData: true, // react-query v4
    placeholderData: (previousData) => previousData, // react-query v5
  });

  // Fetch all parties separately (without party filter) for dropdown options
  // This ensures dropdown always shows all parties regardless of current selection
  const fetchAllParties = async () => {
    const params = new URLSearchParams({
      page: "1",
      per_page: "5000",
    });

    if (filters.to_date) {
      params.append("to_date", filters.to_date);
    }

    if (filters.from_date) {
      params.append("from_date", filters.from_date);
    }

    if (filters.status !== "all") {
      params.append("status", filters.status);
    }

    if (filters.search) {
      params.append("search", filters.search);
    }

    // Note: We don't add party_id filter here to get all parties

    const url = `${API_URL}/api/report/get-inwards/?${params.toString()}`;
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) return [];
    const result = await response.json();
    return result.data || [];
  };

  const { data: allPartiesData } = useQuery({
    queryKey: ["get-all-parties", filters.from_date, filters.to_date, filters.status, filters.search],
    queryFn: fetchAllParties,
    enabled: !!AuthService.getAccessToken(),
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  useEffect(() => {
    if (error) {
      toast({
        title: "Error loading items",
        description: error.message,
        variant: "destructive",
      });
    }
  }, [error, toast]);

  // Sync API filters from UI state (backend handles all filtering).
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setFilters(buildApiFilters());
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [buildApiFilters]);

  // Reset to page 1 when filter scope changes (not on pagination).
  const prevFilterScopeRef = React.useRef(null);
  useEffect(() => {
    const scopeKey = JSON.stringify({
      from_date: filters.from_date,
      to_date: filters.to_date,
      status: filters.status,
      party_id: filters.party_id,
      search: filters.search,
    });
    if (prevFilterScopeRef.current !== null && prevFilterScopeRef.current !== scopeKey) {
      setCurrentPage(1);
    }
    prevFilterScopeRef.current = scopeKey;
  }, [filters.from_date, filters.to_date, filters.status, filters.party_id, filters.search]);

  // Keep filters in URL so back navigation restores state from inward-details screen.
  useEffect(() => {
    const params = new URLSearchParams();
    const fromDateText = fromDate instanceof Date ? formatDateLocal(fromDate) : "";
    const toDateText = toDate instanceof Date ? formatDateLocal(toDate) : "";

    if (dateRangePreset) params.set("date_range", dateRangePreset);
    if (fromDateText) params.set("from_date", fromDateText);
    if (toDateText) params.set("to_date", toDateText);
    if (status && status !== "all") params.set("status", status);
    if (selectedParty && selectedParty !== "all") params.set("party_id", selectedParty);
    if (searchQuery && searchQuery.trim() !== "") params.set("search", searchQuery.trim());

    const nextUrl = `${window.location.pathname}${params.toString() ? `?${params.toString()}` : ""}`;
    window.history.replaceState({}, "", nextUrl);
  }, [dateRangePreset, fromDate, toDate, status, selectedParty, searchQuery]);

  const handleClearFilters = () => {
    const todayOnly = getTodayOnlyDate();
    setDateRangePreset("today");
    setFromDate(todayOnly);
    setToDate(todayOnly);
    setStatus("all");
    setSelectedParty("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const items = data?.data || [];
  const itemRows = items.flatMap((entry) =>
    (entry.items || []).map((entryItem) => ({ ...entryItem, inwardEntry: entry }))
  );
  const getItemSortValue = (row, column) => {
    if (column === "entry") return row.inwardEntry.sl_no || `IW-${row.inwardEntry.id}`;
    if (column === "party") return row.inwardEntry.party_name || "";
    if (column === "item") return row.item_name || "";
    if (column === "quantity") return Number(row.quantity) || 0;
    if (column === "weight") return Number(row.weight) || 0;
    if (column === "amount") {
      const amount = Number(String(row.amount ?? "").replace(/[₹,\s]/g, ""));
      return Number.isFinite(amount) ? amount : null;
    }
    return row.status || "";
  };
  const sortedItemRows = [...itemRows].sort((rowA, rowB) => {
    const valueA = getItemSortValue(rowA, itemSort.column);
    const valueB = getItemSortValue(rowB, itemSort.column);
    if (valueA == null) return valueB == null ? 0 : 1;
    if (valueB == null) return -1;

    const comparison = typeof valueA === "number" && typeof valueB === "number"
      ? valueA - valueB
      : String(valueA).localeCompare(String(valueB), "en-IN", { numeric: true, sensitivity: "base" });
    return itemSort.direction === "asc" ? comparison : -comparison;
  });
  const handleItemSort = (column) => {
    setItemSort((current) => ({
      column,
      direction: current.column === column && current.direction === "asc" ? "desc" : "asc",
    }));
  };
  const renderItemSortIcon = (column) => {
    if (itemSort.column !== column) return <ArrowUpDown className="h-3.5 w-3.5 opacity-50" />;
    return itemSort.direction === "asc"
      ? <ArrowUp className="h-3.5 w-3.5" />
      : <ArrowDown className="h-3.5 w-3.5" />;
  };
  const apiSummary = data?.summary || null;
  const stockJournalVoucherTypes = stockJournalVoucherTypesData || [];
  const selectedVoucherType = stockJournalVoucherTypes.find((v) => String(v.id) === String(journalVoucherId));
  const showAddBardanButton =
    !!selectedVoucherType &&
    normalizeBoolean(selectedVoucherType.add_bardan) &&
    normalizeBoolean(selectedVoucherType.in_destination);
  const godownOptions = godownMasterData || [];
  const totalItems =
    status !== "all"
      ? (data?.total || apiSummary?.filtered_total_entries || 0)
      : (data?.total || apiSummary?.total_entries || apiSummary?.filtered_total_entries || 0);
  const totalPages = data?.totalPages || 1;

  const handlePageChange = (page) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  // Extract unique parties from all parties data (not filtered by party)
  // This ensures dropdown always shows all parties regardless of current selection
  const uniqueParties = React.useMemo(() => {
    // Prioritize allPartiesData (unfiltered by party) over items (may be filtered)
    const sourceItems = allPartiesData || items || [];
    if (sourceItems.length === 0) return [];

    const partyMap = new Map();
    sourceItems.forEach(item => {
      if (item.party_name && item.party_id) {
        partyMap.set(item.party_id, {
          id: item.party_id,
          name: item.party_name
        });
      }
    });

    return Array.from(partyMap.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPartiesData, items]);

  // Filtered parties for searchable Party dropdown
  const filteredParties = React.useMemo(() => {
    const term = (partyFilterSearch || "").trim().toLowerCase();
    if (!term) return uniqueParties;
    return uniqueParties.filter((p) => p.name?.toLowerCase().includes(term));
  }, [uniqueParties, partyFilterSearch]);

  const summaryStats = React.useMemo(() => {
    if (apiSummary) {
      const consensusUnit = inwardListSummaryWeightUnit(items);
      return {
        uniqueParties: apiSummary.unique_parties ?? 0,
        totalBags: apiSummary.total_bags ?? 0,
        totalWeight: apiSummary.total_weight ?? 0,
        totalWeightUnit:
          consensusUnit ||
          (apiSummary.total_weight > 0 ? "Qtl" : null),
        uniqueVehicles: apiSummary.unique_vehicles ?? 0,
        statusCounts: apiSummary,
      };
    }

    return {
      uniqueParties: 0,
      totalBags: 0,
      totalWeight: 0,
      totalWeightUnit: null,
      uniqueVehicles: 0,
      statusCounts: null,
    };
  }, [apiSummary, items]);

  const formatCount = (value) => {
    if (value === null || value === undefined) return "0";
    if (typeof value === "number") {
      return value.toLocaleString("en-IN");
    }
    return value.toString();
  };

  const formatValue = (value) => {
    if (value === null || value === undefined) return "-";
    if (typeof value === "number") {
      return value.toLocaleString("en-IN", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });
    }
    return value.toString();
  };

  const formatInwardAmount = (value) => {
    if (value === null || value === undefined || String(value).trim() === "") return "—";
    const amount = Number(String(value).replace(/[₹,\s]/g, ""));
    if (!Number.isFinite(amount)) return String(value);
    return `₹ ${amount.toLocaleString("en-IN", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  };

  const getWeighmentStatus = (entry) => {
    const weightFields = [
      entry.gross_weight,
      entry.tare_weight,
      entry.party_gross_weight,
      entry.party_tare_weight,
    ];
    const enteredCount = weightFields.filter(
      (value) => value !== null && value !== undefined && String(value).trim() !== ""
    ).length;

    if (enteredCount === 0) return "Not Added";
    if (enteredCount === weightFields.length) return "Complete";
    return "In Progress";
  };

  const getWeighmentStatusClass = (weighmentStatus) => {
    if (weighmentStatus === "Complete") return "bg-green-100 text-green-800";
    if (weighmentStatus === "In Progress") return "bg-amber-100 text-amber-800";
    return "bg-gray-100 text-gray-600";
  };

  const getStatusBadgeVariant = (status) => {
    switch (status?.toLowerCase()) {
      case 'approved':
        return 'default';
      case 'rejected':
        return 'destructive';
      case 'pending':
        return 'secondary';
      case 'unloaded':
        return 'outline';
      case 'completed':
        return 'default';
      case 'partial_approved':
        return 'outline';
      default:
        return 'outline';
    }
  };

  // Check permissions before rendering
  if (permissionsLoading) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <div className="flex-1 flex items-center justify-center">
          <CommonLoader text="Loading permissions..." />
        </div>
      </div>
    );
  }

  // Check if user has read permission for inward
  if (!hasReadPermission("inward")) {
    return (
      <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
        {!isMobile && <Sidebar />}
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
              Access Denied
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              You don't have permission to view inward entries.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Full-page loader only for the very first load (no data yet).
  // On search/filter changes we keep the page mounted so the input keeps focus.
  if (isLoading && !data) {
    return <CommonLoader text="Loading inward list..." />;
  }


  const capitalizeFirst = (str) => {
    if (!str) return "";
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  const statusColors = {
    approved: "bg-green-100 text-green-700",
    completed: "bg-green-200 text-green-800",
    rejected: "bg-red-100 text-red-700",
    unloaded_but_rejected: "bg-red-200 text-red-800",
    pending: "bg-yellow-100 text-yellow-700",
    "assignment-pending": "bg-yellow-200 text-yellow-800",
    unloaded: "bg-blue-100 text-blue-700",
    "not uploaded": "bg-gray-100 text-gray-700",
    partial_approved: "bg-orange-100 text-orange-700",
    unloading_pending: "bg-orange-100 text-orange-700",
    inward_completed: "bg-green-200 text-green-800",
    invoice_created: "bg-gray-100 text-gray-700",
  };

  return (
    <div className="app-layout bg-gray-50 dark:bg-gray-900">
      {!isMobile && <Sidebar />}
      <MobileSidebar
        isOpen={isMobileSidebarOpen}
        onClose={() => setIsMobileSidebarOpen(false)}
      />

      <div className="app-main-content">
        {isMobile && (
          <div className="app-header bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
            <button
              onClick={() => setIsMobileSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Inward List
            </h1>
            <div className="w-10" />
          </div>
        )}

        <div className="app-main-scrollable">

          {/* <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              Inward List
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">
              Manage and view all inward entries with detailed information
            </p>
          </div> */}

          <header className="app-header bg-white shadow-sm border-b border-gray-200 px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between">
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
                <Button
              variant="ghost"
              size="sm"
              onClick={() => window.history.back()}
              className="mr-2"
            >
              <ArrowLeft className="h-4 w-4" />
            </Button>
                <div className="flex items-center space-x-2">
                  <FileText className="h-5 w-5 text-gray-600" />
                  <h1 className="text-xl font-bold text-gray-900">Inward Reports</h1>
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {hasCreatePermission("inward") && (
                  <Button
                    onClick={() => setLocation('/add-inward')}
                    className="bg-black hover:bg-gray-800 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Add Inward
                  </Button>
                )}
                {isFetching && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
              </div>
            </div>
          </header>

          {/* Summary Section */}
          <Card className="mb-4 mt-4 mx-4">
            <CardContent className="px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Summary
                </h3>
                <Badge variant="outline" className="text-sm">
                  {formatCount(
                    status !== "all"
                      ? (apiSummary?.filtered_total_entries ?? totalItems)
                      : (apiSummary?.total_entries ?? totalItems)
                  )}{" "}
                  {(status !== "all"
                    ? (apiSummary?.filtered_total_entries ?? totalItems)
                    : (apiSummary?.total_entries ?? totalItems)) === 1
                    ? "entry"
                    : "entries"}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {/* Unique Parties */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border">
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-blue-100 dark:bg-blue-900 rounded-lg">
                      <User className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Parties
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {summaryStats.uniqueParties}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Bags */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border">
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-green-100 dark:bg-green-900 rounded-lg">
                      <Package className="h-4 w-4 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Quantity
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatValue(summaryStats.totalBags)}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Total Weight */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border">
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-orange-100 dark:bg-orange-900 rounded-lg">
                      <Scale className="h-4 w-4 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Weight
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {formatValue(summaryStats.totalWeight)}
                        {summaryStats.totalWeightUnit
                          ? ` ${summaryStats.totalWeightUnit}`
                          : ""}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Unique Vehicles */}
                <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 border">
                  <div className="flex items-center space-x-3">
                    <div className="p-1.5 bg-purple-100 dark:bg-purple-900 rounded-lg">
                      <Truck className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                        Total Vehicles
                      </p>
                      <p className="text-xl font-bold text-gray-900 dark:text-white">
                        {summaryStats.uniqueVehicles}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {summaryStats.statusCounts && statusFilters.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Status summary
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {statusFilters.map((filter) => {
                      const count = summaryStats.statusCounts[filter.value] ?? 0;
                      const isActive = normalizeInwardSummaryStatusKey(status) === filter.value;
                      return (
                        <button
                          key={filter.value}
                          type="button"
                          onClick={() => {
                            setStatus(isActive ? "all" : filter.value);
                            applyTodayIfDatesEmpty();
                            setCurrentPage(1);
                          }}
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium transition-colors ${
                            isActive
                              ? "border-blue-500 bg-blue-50 text-blue-800"
                              : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50/60 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-200"
                          }`}
                        >
                          {filter.label}: {formatCount(count)}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Filters */}
          <Card className="mb-4 mx-4">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
                {/* Date Range Preset */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Date Range
                  </label>
                  <Select
                    value={dateRangePreset}
                    onValueChange={(value) => {
                      setDateRangePreset(value);
                      setCurrentPage(1);
                      if (value !== "custom") {
                        applyDateRangePreset(value);
                      }
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="Select range" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="today">Today</SelectItem>
                      <SelectItem value="weekly">Weekly (Mon–Sun)</SelectItem>
                      <SelectItem value="monthly">Monthly</SelectItem>
                      <SelectItem value="custom">Custom</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* From Date */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    From Date
                    {fromDate === null && (
                      <span className="text-xs text-blue-600 ml-1">(Empty)</span>
                    )}
                  </label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.from : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, from: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-9 px-2 inline-flex items-center justify-start rounded-md border text-sm ${
                          dateRangePreset === "custom"
                            ? "bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            : "bg-gray-100 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {fromDate ? format(fromDate, "dd-MM-yyyy") : "Start date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`from-${fromDate?.getTime() || "null"}`}
                        mode="single"
                        selected={fromDate || undefined}
                        onSelect={(date) => {
                          setFromDate(date || null);
                          if (date && toDate && date > toDate) {
                            setToDate(date);
                          }
                          setIsDatePickerOpen((prev) => ({ ...prev, from: false }));
                        }}
                        disabled={{ after: today }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* To Date */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    To Date
                  </label>
                  <Popover
                    open={dateRangePreset === "custom" ? isDatePickerOpen.to : false}
                    onOpenChange={(open) => {
                      if (dateRangePreset !== "custom") return;
                      setIsDatePickerOpen((prev) => ({ ...prev, to: open }));
                    }}
                  >
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        disabled={dateRangePreset !== "custom"}
                        className={`w-full h-9 px-2 inline-flex items-center justify-start rounded-md border text-sm ${
                          dateRangePreset === "custom"
                            ? "bg-white text-gray-900 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            : "bg-gray-100 text-gray-500 cursor-not-allowed"
                        }`}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4 text-gray-500" />
                        <span className="truncate">
                          {toDate ? format(toDate, "dd-MM-yyyy") : "End date"}
                        </span>
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <CalendarComponent
                        key={`to-${toDate?.getTime() || "null"}`}
                        mode="single"
                        selected={toDate || undefined}
                        onSelect={(date) => {
                          setToDate(date || null);
                          setIsDatePickerOpen((prev) => ({ ...prev, to: false }));
                        }}
                        disabled={[
                          fromDate ? { before: fromDate } : null,
                          { after: today },
                        ].filter(Boolean)}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Status Dropdown - Medium */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Status
                  </label>
                  <Select
                    value={status}
                    onValueChange={(val) => {
                      setStatus(val);
                      applyTodayIfDatesEmpty();
                      setCurrentPage(1);
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <div className="flex items-center space-x-2">
                        <Filter className="h-4 w-4 text-gray-500" />
                        <SelectValue placeholder="Select status" />
                      </div>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All</SelectItem>
                      {statusFilters.map((filter) => (
                        <SelectItem key={filter.value} value={filter.value}>
                          {filter.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Party Dropdown - Medium with searchable behavior like Party (Ledger) in purchaseorders-reports */}
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Party
                  </label>
                  <Popover
                    open={partyFilterOpen}
                    onOpenChange={(open) => {
                      setPartyFilterOpen(open);
                      if (!open) setPartyFilterSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={partyFilterOpen}
                        className="w-full justify-between h-10 border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      >
                        <span className="truncate flex-1 min-w-0 text-left">
                          {selectedParty === "all"
                            ? "All Parties"
                            : (uniqueParties.find((p) => p.id.toString() === selectedParty)?.name || "Select party")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[--radix-popover-trigger-width] p-0 z-50"
                      align="start"
                      side="bottom"
                      sideOffset={4}
                    >
                      <Command shouldFilter={false}>
                        <CommandInput
                          placeholder="Search parties..."
                          value={partyFilterSearch}
                          onValueChange={setPartyFilterSearch}
                        />
                        <CommandList>
                          <CommandEmpty>
                            {uniqueParties.length === 0
                              ? "No parties found."
                              : "No parties match your search."}
                          </CommandEmpty>
                          <CommandGroup>
                            <ScrollArea className="h-64">
                              {/* All Parties option */}
                              <CommandItem
                                key="all"
                                value="All"
                                onSelect={() => {
                                  setSelectedParty("all");
                                  setCurrentPage(1);
                                  setPartyFilterOpen(false);
                                }}
                                className="flex items-center justify-between cursor-pointer hover:bg-gray-50 px-3 py-2"
                              >
                                <div className="flex items-center gap-3">
                                  <Check
                                    className={`h-4 w-4 ${
                                      selectedParty === "all" ? "opacity-100 text-blue-600" : "opacity-0"
                                    }`}
                                  />
                                  <div>
                                    <div className="font-medium text-gray-900">All Parties</div>
                                  </div>
                                </div>
                              </CommandItem>

                              {/* Individual parties */}
                              {filteredParties.map((party) => (
                                <CommandItem
                                  key={party.id}
                                  value={party.name}
                                  onSelect={() => {
                                    const idStr = party.id?.toString();
                                    setSelectedParty(idStr || "all");
                                    setCurrentPage(1);
                                    setPartyFilterOpen(false);
                                  }}
                                  className="flex items-center justify-between cursor-pointer hover:bg-dark-50 text-white px-3 py-2"
                                >
                                  <div className="flex items-center gap-3">
                                    <Check
                                      className={`h-4 w-4 ${
                                        selectedParty === party.id?.toString()
                                          ? "opacity-100 text-blue-600"
                                          : "opacity-0"
                                      }`}
                                    />
                                    <div>
                                      <div className="font-medium text-gray-900">{party.name}</div>
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

                {/* Search Field - second row, full width up to the Clear button */}
                <div className="space-y-1.5 md:col-span-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Search
                  </label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      type="text"
                      placeholder="Search by inward ID, bill number, vehicle number, party name, Tested By..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-10 h-10"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {isFetching && !searchQuery && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    &nbsp;
                  </label>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleClearFilters}
                    className="w-full h-10"
                  >
                    Clear Filters
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          <Card className="mx-4 mb-4">
            <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
              <CardTitle className="flex items-center justify-between gap-3 text-sm font-semibold text-gray-800">
                <div className="flex min-w-0 items-center space-x-2">
                  <Package className="h-4 w-4 shrink-0" />
                  <span>Inward List</span>
                  <Badge variant="outline" className="ml-2 shrink-0">
                    {listViewMode === "party" ? `${totalItems} entries` : `${itemRows.length} items on this page`}
                  </Badge>
                </div>
                <div className="inline-flex shrink-0 items-center rounded-md border bg-white p-0.5" role="group" aria-label="Inward list view">
                  <Button
                    type="button"
                    size="sm"
                    variant={listViewMode === "party" ? "default" : "ghost"}
                    aria-pressed={listViewMode === "party"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setListViewMode("party")}
                  >
                    Party-wise
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={listViewMode === "item" ? "default" : "ghost"}
                    aria-pressed={listViewMode === "item"}
                    className="h-7 px-2.5 text-xs"
                    onClick={() => setListViewMode("item")}
                  >
                    Item-wise
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4">
              {items.length > 0 ? (
                <>
                  {listViewMode === "party" && <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[120px]">
                            <div className="flex items-center space-x-2">
                              <FileText className="h-4 w-4" />
                              <span>Entry Info</span>
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[150px]">
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4" />
                              <span>Party & Bill No</span>
                            </div>
                          </TableHead>

                          <TableHead className="min-w-[120px]">
                            <div className="flex items-center space-x-2">
                              <Scale className="h-4 w-4" />
                              <span>Weight Details</span>
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[100px]">
                            <div className="flex items-center space-x-2">
                              <Clock className="h-4 w-4" />
                              <span>Date</span>
                            </div>
                          </TableHead>
                          <TableHead className="min-w-[120px]">
                            <div className="flex items-center space-x-2">
                              <Tag className="h-4 w-4" />
                              <span>Status</span>
                            </div>
                          </TableHead>

                          <TableHead className="min-w-[80px]">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((item) => (
                          <TableRow
                            key={item.id}
                            className="cursor-pointer hover:bg-gray-100 transition-colors"
                          >
                            {/* Entry Info Section */}
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium text-sm">
                                  {item.sl_no || `IW-${item.id}`}
                                </div>

                                <div className="text-xs text-gray-500">
                                  Items: {item.total_items || 0}
                                </div>
                              </div>
                            </TableCell>

                            {/* Party & Broker Section */}
                            <TableCell>
                              <div className="space-y-1">
                                <div className="font-medium text-sm">
                                  {item.party_name}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {formatLinkedOrderLabel(item)}
                                </div>
                              </div>
                            </TableCell>

                            {/* Weight Details Section */}
                            <TableCell>
                              <div className="space-y-1">
                                <div className="text-sm">
                                  <span className="font-medium">Quantity:</span> {item.total_bags || 0}
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">Weight:</span>{" "}
                                  {formatTotalWeightDisplay(
                                    item.total_weight,
                                    item.total_weight_unit,
                                    "Qtl"
                                  )}
                                </div>
                                <div className="flex items-center gap-1 text-xs">
                                  <span className="font-medium">Weighment:</span>
                                  <span className={`rounded px-1.5 py-0.5 font-medium ${getWeighmentStatusClass(getWeighmentStatus(item))}`}>
                                    {getWeighmentStatus(item)}
                                  </span>
                                </div>
                                {getWeighmentStatus(item) !== "Not Added" && (
                                  <div className="space-y-0.5 text-xs text-gray-500">
                                    <div>
                                      Our G/T: {formatValue(item.gross_weight)} / {formatValue(item.tare_weight)} kg
                                    </div>
                                    <div>
                                      Party G/T: {formatValue(item.party_gross_weight)} / {formatValue(item.party_tare_weight)} kg
                                    </div>
                                  </div>
                                )}
                              </div>
                            </TableCell>

                            {/* Timeline Section */}
                            <TableCell>
                              <div className="text-xs text-gray-500">
                                {item.created_at}
                              </div>
                              <div className="text-xs text-black">
                                Tested By: {item.tested_by}
                              </div>
                            </TableCell>

                            {/* Status & Testing Section */}
                            <TableCell>
                              <div className="space-y-2">

                                <span className={`text-center px-2 py-1 rounded
                               ${statusColors[item.status] || "bg-gray-200 text-gray-800"}
                              `}>{capitalizeFirst(item.status)}
                                </span>

                              </div>
                            </TableCell>

                            {/* Actions Section */}
                            <TableCell>
                              <div className="flex space-x-2">
                                {hasReadPermission("inward") && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={() => handleViewDetails(item)}
                                    title="View Details"
                                  >
                                    <Eye className="h-4 w-4 " />
                                  </Button>
                                )}
                                {hasUpdatePermission("inward") && item.status !== 'approved' && item.status !== 'pending' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenStockJournalDialog(item);
                                    }}
                                    title="Create Stock Journal"
                                    className="bg-black text-white hover:bg-yellow-400 hover:text-black"
                                  >
                                    <Truck className="h-4 w-4" />
                                  </Button>
                                )}
                                {hasUpdatePermission("inward") && item.status === 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCreateInvoice(item);
                                    }}
                                    title="Create Invoice"
                                    className="bg-green-600 hover:bg-green-700 text-white border-green-200"
                                  >
                                    <Receipt className="h-4 w-4 mr-1" />
                                    GRN
                                  </Button>
                                )}

                                {/* Conditional Approve/Reject Buttons */}
                                {/* Show both buttons if status is pending and user has update permission */}
                                {item.status === 'pending' && hasUpdatePermission("inward") && (
                                  <>
                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleApproveEntry(item);
                                      }}
                                      title="Approve Entry"
                                      className="bg-green-600 hover:bg-green-700 text-white"
                                    >
                                      <CheckCircle className="h-4 w-4" />
                                    </Button>

                                    <Button
                                      variant="default"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleRejectEntry(item);
                                      }}
                                      title="Reject Entry"
                                      className="bg-red-600 hover:bg-red-700 text-white"
                                    >
                                      <XCircle className="h-4 w-4" />
                                    </Button>
                                  </>
                                )}

                                {/* Show only Approve button if status is rejected and user has update permission */}
                                {item.status === 'rejected' && hasUpdatePermission("inward") && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleApproveEntry(item);
                                    }}
                                    title="Approve Entry"
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <CheckCircle className="h-4 w-4" />
                                  </Button>
                                )}

                                {/* Show only Reject button if status is approved or not_unloaded and user has update permission */}
                                {(item.status === 'approved' || item.status === 'not_unloaded') && hasUpdatePermission("inward") && (
                                  <Button
                                    variant="default"
                                    size="sm"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleRejectEntry(item);
                                    }}
                                    title="Reject Entry"
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                  >
                                    <XCircle className="h-4 w-4" />
                                  </Button>
                                )}

                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>}
                  {listViewMode === "item" && (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            {[
                              { key: "entry", label: "Entry", className: "min-w-[110px]" },
                              { key: "party", label: "Party", className: "min-w-[160px]" },
                              { key: "item", label: "Item", className: "min-w-[180px]" },
                              { key: "quantity", label: "Quantity", className: "min-w-[110px]" },
                              { key: "weight", label: "Weight", className: "min-w-[120px]" },
                              { key: "amount", label: "Price / Amount", className: "min-w-[140px]" },
                              { key: "status", label: "Status", className: "min-w-[110px]" },
                            ].map((column) => (
                              <TableHead key={column.key} className={column.className}>
                                <button
                                  type="button"
                                  onClick={() => handleItemSort(column.key)}
                                  aria-label={`Sort by ${column.label} ${itemSort.column === column.key && itemSort.direction === "asc" ? "descending" : "ascending"}`}
                                  aria-sort={itemSort.column === column.key ? (itemSort.direction === "asc" ? "ascending" : "descending") : "none"}
                                  className="inline-flex items-center gap-1 whitespace-nowrap hover:text-foreground"
                                >
                                  {column.label}
                                  {renderItemSortIcon(column.key)}
                                </button>
                              </TableHead>
                            ))}
                            <TableHead className="min-w-[80px]">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {sortedItemRows.map((row) => (
                            <TableRow
                              key={`${row.inwardEntry.id}-${row.id}`}
                              className="cursor-pointer hover:bg-gray-100 transition-colors"
                              onClick={() => handleViewDetails(row.inwardEntry)}
                            >
                              <TableCell>
                                <div className="font-medium text-sm">
                                  {row.inwardEntry.sl_no || `IW-${row.inwardEntry.id}`}
                                </div>
                                <div className="text-xs text-gray-500">
                                  {row.inwardEntry.created_at}
                                </div>
                              </TableCell>
                              <TableCell className="font-medium text-sm">
                                {row.inwardEntry.party_name || "—"}
                              </TableCell>
                              <TableCell>
                                <div className="font-medium text-sm">{row.item_name || "—"}</div>
                                <div className="text-xs text-gray-500">
                                  {row.inwardEntry.bill_no ? `Bill: ${row.inwardEntry.bill_no}` : formatLinkedOrderLabel(row.inwardEntry)}
                                </div>
                              </TableCell>
                              <TableCell>
                                {formatValue(row.quantity)} {row.quantity_unit || ""}
                              </TableCell>
                              <TableCell>
                                {formatTotalWeightDisplay(row.weight, row.weight_unit, "Qtl")}
                              </TableCell>
                              <TableCell className="font-medium">
                                <div>{formatInwardAmount(row.amount)}</div>
                                {row.price != null && String(row.price).trim() !== "" && (
                                  <div className="mt-0.5 text-xs font-normal text-gray-500">
                                    Rate: {formatInwardAmount(row.price)}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell>
                                <span className={`inline-flex rounded px-2 py-1 text-xs font-medium ${statusColors[row.status] || "bg-gray-200 text-gray-800"}`}>
                                  {capitalizeFirst(row.status || "unknown")}
                                </span>
                              </TableCell>
                              <TableCell>
                                {hasReadPermission("inward") && (
                                  <Button
                                    type="button"
                                    variant="default"
                                    size="sm"
                                    onClick={(event) => {
                                      event.stopPropagation();
                                      handleViewDetails(row.inwardEntry);
                                    }}
                                    title="View inward details"
                                  >
                                    <Eye className="h-4 w-4" />
                                  </Button>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                          {itemRows.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={8} className="py-8 text-center text-sm text-gray-500">
                                Item details are not available for these entries.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4 pt-3 border-t">
                      <div className="text-sm text-gray-500">
                        {/* {(() => {
                          if (totalItems === 0) {
                            return "Showing 0 to 0 of 0 items";
                          }
                          // Calculate based on actual items on current page
                          const actualPageSize = items.length;
                          const calculatedStart = (currentPage - 1) * ITEMS_PER_PAGE + 1;
                          const calculatedEnd = (currentPage - 1) * ITEMS_PER_PAGE + actualPageSize;
                          
                          // Ensure values are within valid range
                          const startItem = Math.min(Math.max(1, calculatedStart), totalItems);
                          const endItem = Math.min(Math.max(startItem, calculatedEnd), totalItems);
                          
                          return `Showing ${startItem} to ${endItem} of ${totalItems} items`;
                        })()} */}
                      </div>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                          Previous
                        </Button>
                        {Array.from({ length: totalPages }, (_, i) => (
                          <Button
                            key={i + 1}
                            variant={
                              currentPage === i + 1 ? "default" : "outline"
                            }
                            size="sm"
                            onClick={() => handlePageChange(i + 1)}
                          >
                            {i + 1}
                          </Button>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                        >
                          Next
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-12">
                  <Package className="mx-auto h-12 w-12 text-gray-400" />
                  <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">
                    No items found
                  </h3>
                  <p className="mt-1 text-sm text-gray-500">
                    Try adjusting your filters.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Entry Info Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Info className="h-5 w-5" />
              <span>Entry Information</span>
            </DialogTitle>
          </DialogHeader>
          {selectedEntry && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Entry ID:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">SL No:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.sl_no || `IW-${selectedEntry.id}`}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Date:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.date}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Party:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.party_name}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Vehicle:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.vehicle_no}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Bill No:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.bill_no || 'N/A'}</p>
                </div>
                {selectedEntry.purchase_order_no ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Purchase Order:</label>
                    <p className="text-sm text-gray-900">{selectedEntry.purchase_order_no}</p>
                  </div>
                ) : null}
                {hasSalesReturnAccess && selectedEntry.sales_return_no ? (
                  <div>
                    <label className="text-sm font-medium text-gray-700">Sales Return:</label>
                    <p className="text-sm text-gray-900">{selectedEntry.sales_return_no}</p>
                  </div>
                ) : null}
                <div>
                  <label className="text-sm font-medium text-gray-700">Broker:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.broker_name || 'N/A'}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Status:</label>
                  <Badge variant={getStatusBadgeVariant(selectedEntry.status)} className="ml-2">
                    {selectedEntry.status.toUpperCase()}
                  </Badge>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Items:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.total_items || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Quantity:</label>
                  <p className="text-sm text-gray-900">{selectedEntry.total_bags || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Total Weight:</label>
                  <p className="text-sm text-gray-900">
                    {formatTotalWeightDisplay(
                      selectedEntry.total_weight,
                      selectedEntry.total_weight_unit,
                      "Qtl"
                    )}
                  </p>
                </div>
              </div>

              {selectedEntry.tested_by && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-900 mb-2">Testing Information</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Tested By:</label>
                      <p className="text-sm text-gray-900">{selectedEntry.tested_by}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Test Date:</label>
                      <p className="text-sm text-gray-900">{selectedEntry.test_date || 'N/A'}</p>
                    </div>
                  </div>
                  {selectedEntry.lab_tech_remarks && (
                    <div>
                      <label className="text-sm font-medium text-gray-700">Lab Tech Remarks:</label>
                      <p className="text-sm text-gray-900">{selectedEntry.lab_tech_remarks}</p>
                    </div>
                  )}
                </div>
              )}

              <div className="border-t pt-4">
                <label className="text-sm font-medium text-gray-700">Created At:</label>
                <p className="text-sm text-gray-900">{selectedEntry.created_at}</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Entry Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Edit className="h-5 w-5" />
              <span>Edit Inward Entry</span>
            </DialogTitle>
          </DialogHeader>
          {editingEntry && (
            <EditInwardEntryForm
              entry={editingEntry}
              onClose={() => setIsEditDialogOpen(false)}
              onSuccess={() => {
                setIsEditDialogOpen(false);
                // Refresh the data
                window.location.reload();
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Status Change Modal */}
      <Dialog open={isStatusModalOpen} onOpenChange={(open) => {
        if (!open && !isUpdating) {
          setIsStatusModalOpen(false);
          resetStatusForm();
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {updateType === 'admin_approval'
                ? (newStatus === 'approved' ? 'Approve Entry' : 'Reject Entry')
                : 'Update Entry Status'
              }
            </DialogTitle>
            <DialogDescription>
              {updateType === 'admin_approval'
                ? (newStatus === 'approved'
                  ? 'Approve this entry and optionally set our brand and remarks.'
                  : 'Provide a reason for rejecting this entry.')
                : 'Update the status of this entry.'
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Entry Information */}
            {selectedEntryForStatus && (
              <div className="bg-gray-50 p-3 rounded-md">
                <p className="text-sm text-gray-600">
                  <strong>Entry ID:</strong> {selectedEntryForStatus.id}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Vehicle No:</strong> {selectedEntryForStatus.vehicle_no || 'N/A'}
                </p>
                <p className="text-sm text-gray-600">
                  <strong>Bill No:</strong> {selectedEntryForStatus.bill_no || 'N/A'}
                </p>
              </div>
            )}

            {/* Admin Approval Fields */}
            {updateType === 'admin_approval' && newStatus === 'approved' && (
              <>
                <div>
                  <Label htmlFor="our-brand" className="text-sm font-medium text-gray-700">
                    Our Brand (Optional)
                  </Label>
                  <Input
                    id="our-brand"
                    placeholder="Enter our brand name..."
                    value={ourBrand}
                    onChange={(e) => setOurBrand(e.target.value)}
                    disabled={isUpdating}
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label htmlFor="remarks" className="text-sm font-medium text-gray-700">
                    Remarks (Optional)
                  </Label>
                  <Textarea
                    id="remarks"
                    placeholder="Enter any remarks..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={3}
                    disabled={isUpdating}
                    className="mt-1"
                  />
                </div>
              </>
            )}

            {/* Rejection Reason */}
            {updateType === 'admin_approval' && newStatus === 'rejected' && (
              <div>
                <Label htmlFor="rejection-reason" className="text-sm font-medium text-gray-700">
                  Rejection Reason *
                </Label>
                <Textarea
                  id="rejection-reason"
                  placeholder="Please provide reason for rejection..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={4}
                  disabled={isUpdating}
                  className="mt-1"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  This field is required for rejection.
                </p>
              </div>
            )}

            <div className="flex space-x-2 pt-4">
              <Button
                variant="outline"
                onClick={() => {
                  if (!isUpdating) {
                    setIsStatusModalOpen(false);
                    resetStatusForm();
                  }
                }}
                className="flex-1"
                disabled={isUpdating}
              >
                Cancel
              </Button>
              <Button
                onClick={handleStatusSubmit}
                disabled={
                  isUpdating ||
                  (updateType === 'admin_approval' && newStatus === 'rejected' && !rejectionReason.trim())
                }
                className={`flex-1 ${newStatus === 'rejected'
                  ? 'bg-red-600 hover:bg-red-700'
                  : 'bg-green-600 hover:bg-green-700'
                  }`}
              >
                {isUpdating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    {updateType === 'admin_approval'
                      ? (newStatus === 'approved' ? 'Approve' : 'Reject')
                      : 'Update'
                    }
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Convert to Invoice Dialog */}
      <Dialog open={isInvoiceDialogOpen} onOpenChange={setIsInvoiceDialogOpen}>
        <DialogContent 
          className="max-w-6xl max-h-[90vh] overflow-y-auto min-w-[800px] p-4"
          onInteractOutside={(e) => {
            e.preventDefault();
          }}
          onEscapeKeyDown={(e) => {
            e.preventDefault();
          }}
        >
          <DialogHeader className="pb-2">
            <DialogTitle className="flex items-center space-x-2 text-lg">
              <FileText className="h-4 w-4" />
              <span>Convert to Invoice</span>
            </DialogTitle>
          </DialogHeader>

          {isLoadingInvoiceDetails ? (
            <div className="flex items-center justify-center py-8">
              <CommonLoader text="Loading invoice details..." />
            </div>
          ) : invoiceEntryDetails ? (
            <div className="space-y-3">
              {/* Basic Information */}
              <Card className="border-2">
                <CardHeader className="p-3 pb-2">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <FileText className="h-4 w-4" />
                    <span>Basic Information</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3 pt-0">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="text-sm font-medium text-gray-700">Party:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.party_name}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Entry ID:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.id}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">SL No:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.sl_no || `IW-${invoiceEntryDetails.id}`}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Bill No:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.bill_no || 'N/A'}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Date:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.date}</p>
                    </div>

                    <div>
                      <label className="text-sm font-medium text-gray-700">Vehicle:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.vehicle_no || 'N/A'}</p>
                    </div>
                  
                    <div>
                      <label className="text-sm font-medium text-gray-700">Broker:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.broker_name || 'N/A'}</p>
                    </div>
                    {/* <div>
                      <label className="text-sm font-medium text-gray-700">Status:</label>
                      <Badge variant={getStatusBadgeVariant(invoiceEntryDetails.status)} className="ml-2">
                        {invoiceEntryDetails.status ? invoiceEntryDetails.status.charAt(0).toUpperCase() + invoiceEntryDetails.status.slice(1).toLowerCase().replace('_', ' ') : ''}
                      </Badge>
                    </div> */}
                    <div>
                      <label className="text-sm font-medium text-gray-700">Total Items:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.total_items || 0}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Total Quantity:</label>
                      <p className="text-sm text-gray-900">{invoiceEntryDetails.total_bags || 0}</p>
                    </div>
                    <div>
                  <label className="text-sm font-medium text-gray-700">Total Weight:</label>
                  <p className="text-sm text-gray-900">
                    {formatTotalWeightDisplay(
                      invoiceEntryDetails.total_weight,
                      invoiceEntryDetails.total_weight_unit,
                      "Qtl"
                    )}
                  </p>
                    </div>
                    <div>
                      <label className="text-sm font-medium text-gray-700">Bill Generate Date & Time:</label>
                      <p className="text-sm text-gray-900  text-blue-600">
                        {(() => {
                          const now = new Date();
                          const date = now.toLocaleDateString('en-GB', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }).replaceAll('/', '-');;
                          const time = now.toLocaleTimeString('en-US', {
                            hour: '2-digit',
                            minute: '2-digit',
                            hour12: true
                          });
                          return `${date} ${time}`;
                        })()}
                      </p>
                    </div>


                    {invoiceEntryDetails.remarks && (
                      <div className="col-span-2">
                        <label className="text-sm font-medium text-gray-700">Remarks:</label>
                        <p className="text-sm text-gray-900">{invoiceEntryDetails.remarks}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Bill Format */}
              <Card className="border-2 border-gray-200 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b p-3 pb-2">
                  <CardTitle className="flex items-center space-x-2 text-base">
                    <FileText className="h-4 w-4 text-blue-600" />
                    <span className="font-bold">Invoice Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="mb-3 grid grid-cols-1 md:grid-cols-2 gap-3 rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Invoice Number: </span>
                      <span className="font-semibold text-gray-900">{invoiceEntryDetails.invoice_number || "N/A"}</span>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium text-gray-700">Additional Payment: </span>
                      <span className="font-semibold text-gray-900">₹{Number(invoiceEntryDetails.additional_payment || 0).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <Table className="min-w-full table-fixed">
                      <colgroup>
                        <col className="w-2/5" />
                        <col className="w-1/6" />
                        <col className="w-1/5" />
                        <col className="w-1/4" />
                      </colgroup>
                      <TableHeader>
                        <TableRow className="bg-gray-50 hover:bg-gray-50">
                          <TableHead className="text-center font-semibold text-gray-700 py-2 border-b text-sm">Name of Item</TableHead>
                          <TableHead className="text-center font-semibold text-gray-700 py-2 border-b text-sm">Inward Qty</TableHead>
                          <TableHead className="text-center font-semibold text-gray-700 py-2 border-b text-sm">Billed Amount (₹)</TableHead>
                          <TableHead className="text-center font-semibold text-gray-700 py-2 border-b text-sm">Billing Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {invoiceItems.map((item, index) => (
                          <TableRow key={item.id || index} className="hover:bg-gray-50 transition-colors">
                            <TableCell className="text-center font-medium py-2 border-b text-sm">
                              <div className="max-w-full mx-auto truncate px-1" title={item.item_name || 'Unknown Item'}>
                                {item.item_name || 'Unknown Item'}
                              </div>
                            </TableCell>
                            <TableCell className="text-center py-2 border-b text-sm">
                              <span className="font-medium text-gray-700">{item.inward_qty || 0}</span>
                            </TableCell>
                            <TableCell className="text-center font-semibold text-gray-900 py-2 border-b text-sm">
                              <span className="whitespace-nowrap">₹{Number(item.billed_amount || 0).toFixed(2)}</span>
                            </TableCell>
                            <TableCell className="text-center py-2 border-b text-sm">
                              <span className="font-medium text-gray-700">{item.billing_date || "N/A"}</span>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                      <tfoot>
                        <TableRow className="bg-gray-100 hover:bg-gray-100 font-semibold">
                          <TableCell className="text-center py-2 border-t-2 border-gray-400 text-sm">
                            <span className="font-bold text-gray-900">Total</span>
                          </TableCell>
                          <TableCell className="text-center py-2 border-t-2 border-gray-400 text-sm">
                            <span className="font-bold text-gray-900">
                              {invoiceItems.reduce((sum, item) => sum + (item.inward_qty || 0), 0)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-2 border-t-2 border-gray-400 text-sm">
                            <span className="font-bold text-gray-900">
                              ₹{invoiceItems.reduce((sum, item) => sum + (Number(item.billed_amount || 0) || 0), 0).toFixed(2)}
                            </span>
                          </TableCell>
                          <TableCell className="text-center py-2 border-t-2 border-gray-400 text-sm">
                            <span className="font-bold text-gray-900">-</span>
                          </TableCell>
                        </TableRow>
                      </tfoot>
                    </Table>
                  </div>
                  <div className="mt-3 pt-2 border-t-2 border-gray-300">
                    <div className="flex flex-col items-end space-y-2">
                      <div className="flex justify-between items-center w-full max-w-[300px]">
                        <span className="text-sm font-medium text-gray-700">Items Billed Total:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{invoiceItems.reduce((sum, item) => sum + (Number(item.billed_amount || 0) || 0), 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center w-full max-w-[300px]">
                        <span className="text-sm font-medium text-gray-700">Additional Payment:</span>
                        <span className="text-sm font-semibold text-gray-900">
                          ₹{Number(invoiceEntryDetails.additional_payment || 0).toFixed(2)}
                        </span>
                      </div>
                      <div className="bg-blue-50 px-4 py-2 rounded-lg border-2 border-blue-200 min-w-[200px] max-w-[300px] mt-2">
                        <div className="text-lg font-bold text-blue-700 whitespace-nowrap overflow-hidden text-ellipsis">
                          Grand Total: ₹{(
                            invoiceItems.reduce((sum, item) => sum + (Number(item.billed_amount || 0) || 0), 0) +
                            Number(invoiceEntryDetails.additional_payment || 0)
                          ).toFixed(2)}
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Submit Button */}
              <div className="flex justify-center space-x-3 pt-2 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsInvoiceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleInvoiceSubmit}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Submit
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-center py-12 text-gray-500">
              No details available
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Inward To Stock Journal Dialog */}
      <Dialog open={isJournalDialogOpen} onOpenChange={setIsJournalDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <span>Create Stock Journal</span>
            </DialogTitle>
            <DialogDescription>
              Inward Entry: {selectedJournalEntry?.sl_no || selectedJournalEntry?.id} - map destination items and submit.
            </DialogDescription>
          </DialogHeader>

          {isLoadingJournalSource ? (
            <div className="py-8">
              <CommonLoader text="Loading inward items..." />
            </div>
          ) : (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Voucher & Remarks</CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <Label>Voucher Type *</Label>
                    <Select value={journalVoucherId} onValueChange={setJournalVoucherId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select voucher" />
                      </SelectTrigger>
                      <SelectContent>
                        {stockJournalVoucherTypes.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.display_name || v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Remarks</Label>
                    <Input
                      value={journalRemarks}
                      onChange={(e) => setJournalRemarks(e.target.value)}
                      placeholder="Optional remarks"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Source Items (from Inward)</CardTitle>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Item</TableHead>
                        <TableHead>Qty</TableHead>
                        <TableHead>Alt Qty / Conversion</TableHead>
                        <TableHead>Godown</TableHead>
                        <TableHead>Batch</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sourceJournalItems.map((row, idx) => (
                        <TableRow key={`src-row-${idx}`}>
                          <TableCell>{row.stock_item_name}</TableCell>
                          <TableCell>{formatSourceQuantityDisplay(row)}</TableCell>
                          <TableCell>{formatSourceAlternateDisplay(row)}</TableCell>
                          <TableCell>{row.godown_name || "N/A"}</TableCell>
                          <TableCell>{row.batch_name}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle className="text-base">Destination Mapping</CardTitle>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => addDestinationRow("item")}
                        disabled={isSubmittingJournal}
                      >
                        <Plus className="h-4 w-4 mr-1" />
                        Add Item
                      </Button>
                      {showAddBardanButton && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addDestinationRow("bardan")}
                          disabled={isSubmittingJournal}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Bardan
                        </Button>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {destinationJournalItems.map((row, idx) => {
                    const selectedGodown = (row.godown_name || "").trim();
                    const rowType = row.destination_type || "item";
                    const rowSearchText = destinationItemSearchByRow[idx] || "";
                    const optionsKey = getDestinationItemsKey(selectedGodown, rowType, rowSearchText);
                    const destinationItemsState = selectedGodown ? (destinationItemsByGodown[optionsKey] || { items: [], pagination: null }) : { items: [], pagination: null };
                    const destinationItemOptions = destinationItemsState.items || [];
                    const canLoadMoreItems = !!destinationItemsState.pagination?.has_next;
                    const nextPageNumber = destinationItemsState.pagination?.next_page || null;
                    const isLoadingDestinationItems = selectedGodown ? !!loadingDestinationItemsByGodown[optionsKey] : false;

                    return (
                    <div key={`dst-row-${idx}`} className="grid grid-cols-1 md:grid-cols-12 gap-2 border rounded p-2">
                      <div className="md:col-span-3">
                        <Label>Godown *</Label>
                        <Select
                          value={row.godown_name || ""}
                          onValueChange={(v) => {
                            handleChangeDestinationJournalItem(idx, "godown_name", v);
                            loadDestinationItemsByGodown(v, rowType);
                          }}
                          disabled={isSubmittingJournal}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select godown" />
                          </SelectTrigger>
                          <SelectContent>
                            {godownOptions.map((g) => (
                              <SelectItem key={g.id} value={g.name}>
                                {g.name}
                                {(g.stock_count ?? g.stock_items_count ?? g.count) !== undefined && (
                                  <span className="ml-2 text-xs text-gray-500">
                                    (Stock: {g.stock_count ?? g.stock_items_count ?? g.count})
                                  </span>
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="md:col-span-4">
                        <Label>{rowType === "bardan" ? "Bardan Item *" : "Destination Item *"}</Label>
                        <Popover
                          open={!!destinationItemDropdownOpenByRow[idx]}
                          onOpenChange={(isOpen) => {
                            setDestinationItemDropdownOpenByRow((prev) => ({ ...prev, [idx]: isOpen }));
                            if (isOpen && selectedGodown && destinationItemOptions.length === 0) {
                              loadDestinationItemsByGodown(selectedGodown, rowType, rowSearchText, 1, false);
                            }
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              className="w-full justify-between"
                              disabled={!selectedGodown || isSubmittingJournal}
                            >
                              {row.stock_item_name || (!selectedGodown ? "Select godown first" : "Select stock item")}
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[420px] p-0" align="start">
                            <Command shouldFilter={false}>
                              <CommandInput
                                placeholder="Search stock item..."
                                value={rowSearchText}
                                onValueChange={(value) => handleDestinationSearchChange(idx, value)}
                              />
                              <CommandList>
                                {isLoadingDestinationItems ? (
                                  <div className="p-3 text-sm text-gray-500">Loading items...</div>
                                ) : destinationItemOptions.length > 0 ? (
                                  <CommandGroup>
                                    {destinationItemOptions.map((it) => (
                                      <CommandItem
                                        key={`${optionsKey}-${it.id}`}
                                        value={`${it.name}-${it.id}`}
                                        onSelect={() => {
                                          const nextQtyText = normalizeQtyWithUnit(row.actual_qty, it.base_units_name || "");
                                          handleChangeDestinationJournalItem(idx, "stock_item_id", String(it.id));
                                          handleChangeDestinationJournalItem(idx, "stock_item_name", it.name || "");
                                          handleChangeDestinationJournalItem(idx, "stock_closing_balance", String(it.total_closing_balance ?? 0));
                                          handleChangeDestinationJournalItem(idx, "stock_base_unit", it.base_units_name || "");
                                          handleChangeDestinationJournalItem(idx, "stock_alternate_unit", it.secondary_unit || "");
                                          handleChangeDestinationJournalItem(idx, "stock_conversion", it.conversion || "");
                                          handleChangeDestinationJournalItem(idx, "actual_qty", nextQtyText);
                                          setDestinationItemDropdownOpenByRow((prev) => ({ ...prev, [idx]: false }));
                                        }}
                                      >
                                        <div className="flex flex-col">
                                          <span>{it.name}</span>
                                          <span className="text-xs text-gray-500">
                                            Closing: {it.total_closing_balance ?? 0} {it.base_units_name || ""}
                                          </span>
                                        </div>
                                      </CommandItem>
                                    ))}
                                  </CommandGroup>
                                ) : (
                                  <CommandEmpty>No items for selected godown</CommandEmpty>
                                )}
                              </CommandList>
                            </Command>
                            {canLoadMoreItems && (
                              <div className="border-t p-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => loadDestinationItemsByGodown(selectedGodown, rowType, rowSearchText, nextPageNumber, true)}
                                  disabled={isLoadingDestinationItems}
                                >
                                  {isLoadingDestinationItems ? "Loading..." : "Load More"}
                                </Button>
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                        {(row.stock_closing_balance || row.stock_closing_balance === "0") && (
                          <p className="text-xs text-gray-600 mt-1">
                            Closing Balance: {row.stock_closing_balance} {row.stock_base_unit || ""}
                          </p>
                        )}
                      </div>
                      <div className="md:col-span-3">
                        <Label>Quantity *</Label>
                        <Input
                          value={row.actual_qty}
                          onChange={(e) => handleChangeDestinationJournalItem(idx, "actual_qty", e.target.value)}
                          placeholder="e.g. 50 Kg"
                          disabled={isSubmittingJournal}
                        />
                        {formatDestinationQtyConversion(row) && (
                          <p className="text-xs text-gray-600 mt-1">{formatDestinationQtyConversion(row)}</p>
                        )}
                      </div>
                      <div className="md:col-span-2">
                        <Label>Batch *</Label>
                        <Input
                          value={row.batch_name}
                          readOnly
                          className="bg-gray-50"
                          placeholder="Primary Batch"
                        />
                      </div>
                      <div className="md:col-span-12 flex justify-end">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeDestinationRow(idx)}
                          disabled={destinationJournalItems.length <= 1 || isSubmittingJournal}
                          className="text-red-600 hover:text-red-700"
                        >
                          <Trash2 className="h-4 w-4 mr-1" />
                          Remove
                        </Button>
                      </div>
                    </div>
                    );
                  })}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsJournalDialogOpen(false)} disabled={isSubmittingJournal}>
                  Cancel
                </Button>
                <Button onClick={handleSubmitStockJournalFromInward} disabled={isSubmittingJournal}>
                  {isSubmittingJournal ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Submitting...
                    </>
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Create Invoice Dialog */}
      <Dialog open={isCreateInvoiceDialogOpen} onOpenChange={setIsCreateInvoiceDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2">
              <Receipt className="h-5 w-5 text-green-600" />
              <span>Create Invoice</span>
            </DialogTitle>
            <DialogDescription>
              Enter invoice details for completed inward items
            </DialogDescription>
          </DialogHeader>
          {isLoadingCreateInvoice ? (
            <div className="py-12">
              <CommonLoader text="Loading invoice details..." />
            </div>
          ) : createInvoiceEntry && createInvoiceItems.length > 0 ? (
            <div className="space-y-4">
              {/* Entry Information */}
              <Card>
                <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                  <CardTitle className="text-sm font-semibold text-gray-800">Entry Information</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <Label className="text-gray-600">Entry ID</Label>
                      <p className="font-semibold">{createInvoiceEntry.id}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">SL No</Label>
                      <p className="font-semibold">{createInvoiceEntry.sl_no || `IW-${createInvoiceEntry.id}`}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Party Name</Label>
                      <p className="font-semibold">{createInvoiceEntry.party_name}</p>
                    </div>
                    <div>
                      <Label className="text-gray-600">Date</Label>
                      <p className="font-semibold">{createInvoiceEntry.date}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>

                <CardContent className="p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
                    <div className="flex items-center gap-3">
                      <Label className="text-gray-600 whitespace-nowrap">Invoice Number *</Label>
                      <Input
                        type="text"
                        placeholder="Enter invoice number"
                        value={entryInvoiceNumber}
                        onChange={(e) => setEntryInvoiceNumber(e.target.value)}
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <Label className="text-gray-600 whitespace-nowrap">Additional Payment</Label>
                      <Input
                        type="text"
                        placeholder="Enter additional payment (optional)"
                        value={entryAdditionalPayment}
                        onChange={(e) => setEntryAdditionalPayment(e.target.value)}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Invoice Items Table */}
              <Card>
                <CardHeader className="px-4 py-2.5 border-b bg-gray-50 rounded-t-lg">
                  <CardTitle className="text-sm font-semibold text-gray-800">Stock Items</CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="min-w-[220px]">Item Name</TableHead>
                          <TableHead>Quantity</TableHead>
                          <TableHead>GST</TableHead>
                          <TableHead className="min-w-[130px]">Per Unit Rate (₹)</TableHead>
                          <TableHead className="w-[80px] text-center">GST</TableHead>
                          <TableHead>Billed Amount (₹)</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {createInvoiceItems.map((item, index) => (
                          <TableRow key={item.id} className="border border-green-500 bg-green-50/30">
                            <TableCell className="min-w-[220px] max-w-[320px] whitespace-normal break-words font-medium leading-5">
                              {item.item_name}
                            </TableCell>
                            <TableCell>
                              <span>{formatInvoiceQuantityLabel(item)}</span>
                            </TableCell>
                            <TableCell>
                              <span className="text-sm font-medium text-gray-700">{Number(item.gst_rate || 0)}%</span>
                            </TableCell>
                            <TableCell>
                              <Input
                                type="text"
                                placeholder="Enter per unit rate"
                                value={item.per_unit_rate || ''}
                                onChange={(e) => handleInvoiceFieldChange(index, 'per_unit_rate', e.target.value)}
                                className="w-[120px]"
                              />
                            </TableCell>
                            <TableCell className="text-center">
                              {Number(item.gst_rate || 0) > 0 ? (
                                <label className="inline-flex items-center justify-center rounded-md border border-gray-200 bg-gray-50 px-2 py-1">
                                  <input
                                    type="checkbox"
                                    checked={Boolean(item.include_gst)}
                                    onChange={(e) => handleInvoiceFieldChange(index, "include_gst", e.target.checked)}
                                  />
                                </label>
                              ) : (
                                <span className="text-xs text-gray-400">N/A</span>
                              )}
                            </TableCell>
                            <TableCell>
                              {(() => {
                                const qty = parseFloat(item.total_weight || item.number_of_bags || 0) || 0;
                                const rate = parseFloat(item.per_unit_rate || 0) || 0;
                                const gstRate = parseFloat(item.gst_rate || 0) || 0;
                                const baseAmount = qty * rate;
                                const gstAmount = item.include_gst ? (baseAmount * gstRate) / 100 : 0;
                                const totalAmount = baseAmount + gstAmount;
                                return (
                                  <div className="min-w-[190px] rounded-md border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-700">
                                    <div className="flex justify-between">
                                      <span>Item Amount</span>
                                      <span>₹{baseAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                      <span>GST Amount</span>
                                      <span>₹{gstAmount.toFixed(2)}</span>
                                    </div>
                                    <div className="mt-1 flex justify-between border-t border-gray-200 pt-1 text-sm font-semibold text-gray-900">
                                      <span>Total</span>
                                      <span>₹{totalAmount.toFixed(2)}</span>
                                    </div>
                                  </div>
                                );
                              })()}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setIsCreateInvoiceDialogOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSubmitInvoice}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Receipt className="h-4 w-4 mr-2" />
                  Create Invoice
                </Button>
              </div>
            </div>
          ) : createInvoiceItems.length === 0 && !isLoadingCreateInvoice ? (
            <div className="text-center py-12 text-gray-500">
              No approved or completed items available for invoicing.
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}