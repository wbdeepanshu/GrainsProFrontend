import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useIsMobile } from "../hooks/use-mobile";
import Sidebar from "../components/layout/sidebar";
import MobileSidebar from "../components/layout/mobile-sidebar";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "../components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "../components/ui/popover";
import { ScrollArea } from "../components/ui/scroll-area";
import { Textarea } from "../components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../components/ui/tabs";
import { Checkbox } from "../components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import {
  Menu,
  Search,
  Eye,
  FileText,
  CheckCircle,
  XCircle,
  Truck,
  Building,
  User,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Check,
  ChevronsUpDown,
  Filter,
  RefreshCw,
  Plus,
  Users,
  Pencil,
  Edit,
  Trash2,
  Link2,
  CheckCircle2,
  Clock,
  FilterX,
  MapPin,
  X,
  ImageIcon,
  Minus,
  Download,
  Calendar,
  CreditCard,
  Store,
  SlidersHorizontal,
  MoreVertical,
} from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "../components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { AuthService } from "../lib/auth";
import { apiRequest } from "../lib/queryClient";
import { uploadVoucherMediaFile } from "../lib/voucherMediaUpload";
import { supervisorList, godownList } from "../lib/static-data";
import Loader from "../components/common/loader";
import { useUserPermissions } from "../hooks/useUserPermissions";
import { useToast } from "../hooks/use-toast";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const GOOGLE_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;

const isKycImageFileUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const path = url.split("?")[0].toLowerCase();
  if (path.endsWith(".pdf")) return false;
  return /\.(jpg|jpeg|png|gif|webp|bmp|svg|jfif|heic|heif)$/i.test(path);
};

/** Indian GSTIN rules:
 * 1. Exactly 15 chars
 * 2. First 2 chars = valid GST state code
 * 3. Characters 3-12 = valid PAN format
 * 4. Character 13 = entity number (1-9 or A-Z)
 * 5. Character 14 = Z
 * 6. Character 15 = GSTIN check digit
 */
const GST_STATE_CODES = new Set(
  Array.from({ length: 99 }, (_, index) => String(index + 1).padStart(2, "0"))
);
const INDIA_STATE_OPTIONS = [
  "Andaman and Nicobar Islands",
  "Andhra Pradesh",
  "Arunachal Pradesh",
  "Assam",
  "Bihar",
  "Chandigarh",
  "Chhattisgarh",
  "Dadra and Nagar Haveli and Daman and Diu",
  "Delhi",
  "Goa",
  "Gujarat",
  "Haryana",
  "Himachal Pradesh",
  "Jammu and Kashmir",
  "Jharkhand",
  "Karnataka",
  "Kerala",
  "Ladakh",
  "Lakshadweep",
  "Madhya Pradesh",
  "Maharashtra",
  "Manipur",
  "Meghalaya",
  "Mizoram",
  "Nagaland",
  "Odisha",
  "Puducherry",
  "Punjab",
  "Rajasthan",
  "Sikkim",
  "Tamil Nadu",
  "Telangana",
  "Tripura",
  "Uttar Pradesh",
  "Uttarakhand",
  "West Bengal",
];
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]$/;

const sanitizeGstinInput = (raw) => {
  const normalized = String(raw || "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  const characterRules = [
    /^[0-9]$/,
    /^[0-9]$/,
    /^[A-Z]$/,
    /^[A-Z]$/,
    /^[A-Z]$/,
    /^[A-Z]$/,
    /^[A-Z]$/,
    /^[0-9]$/,
    /^[0-9]$/,
    /^[0-9]$/,
    /^[0-9]$/,
    /^[A-Z]$/,
    /^[1-9A-Z]$/,
    /^Z$/,
    /^[A-Z0-9]$/,
  ];

  return [...normalized]
    .reduce((result, character) => {
      if (result.length < characterRules.length && characterRules[result.length].test(character)) {
        result.push(character);
      }
      return result;
    }, [])
    .join("");
};

const getPanFromGstin = (gstin) => {
  const normalized = sanitizeGstinInput(gstin);
  if (normalized.length < 12) return "";
  return normalized.slice(2, 12);
};

const getGstinValidationError = (value) => {
  const normalized = sanitizeGstinInput(value);

  if (!normalized) return "";
  if (normalized.length !== 15) return "GSTIN must be exactly 15 characters.";

  const stateCode = normalized.slice(0, 2);
  if (!GST_STATE_CODES.has(stateCode)) return "GSTIN state code is invalid.";

  const pan = normalized.slice(2, 12);
  if (!PAN_REGEX.test(pan)) return "GSTIN PAN section is invalid. Use 5 letters + 4 digits + 1 letter.";

  const entityCode = normalized[12];
  if (!/^[1-9A-Z]$/.test(entityCode)) return "GSTIN entity code must be 1-9 or A-Z.";

  if (normalized[13] !== "Z") return "GSTIN 14th character must be Z.";

  const checkDigit = normalized[14];
  if (!/^[0-9A-Z]$/.test(checkDigit)) return "GSTIN check digit is invalid.";

  return "";
};

const isValidGstin = (value) => !getGstinValidationError(value);


async function uploadMediaFile(file) {
  return uploadVoucherMediaFile(file, "CPxGrowth/customer_kyc");
}
const PAGE_SIZE = 50;
const LEDGER_GROUPS_PAGE_SIZE = 50;
const SEARCH_DEBOUNCE_MS = 500;
const DEFAULT_LEDGER_GROUP_PARENT_OPTIONS = [
  "Primary",
  "Sundry Debtors",
  "Sundry Creditors",
];
const EMPTY_LEDGER_GROUP_FORM = {
  name: "",
  parent: "Primary",
  is_active: true,
  is_live: true,
};

const LEDGER_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All" },
  { value: "SUNDRY DEBTORS", label: "Sundry Debtor" },
  { value: "SUNDRY CREDITORS", label: "Sundry Creditor" },
  { value: "BOTH", label: "Both" },
];

const LEDGER_TYPE_FORM_OPTIONS = LEDGER_TYPE_FILTER_OPTIONS.filter(
  (option) => option.value !== "all"
);

const ACCOUNT_TYPE_FORM_OPTIONS = [
  { value: "none", label: "None" },
  { value: "ASSET", label: "Asset" },
  { value: "LIABILITY", label: "Liability" },
];

const WEEK_OFF_OPTIONS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const normalizeLedgerTypeValue = (ledgerType, isSupplierFallback) => {
  const raw = String(ledgerType ?? "").trim();
  const normalized = raw.toLowerCase();
  if (
    normalized === "sundry debtors" ||
    normalized === "sundry debtor" ||
    normalized === "customer" ||
    normalized === "customers" ||
    normalized === "debtor" ||
    normalized === "debtors"
  ) {
    return "SUNDRY DEBTORS";
  }
  if (
    normalized === "sundry creditors" ||
    normalized === "sundry creditor" ||
    normalized === "supplier" ||
    normalized === "suppliers" ||
    normalized === "creditor" ||
    normalized === "creditors"
  ) {
    return "SUNDRY CREDITORS";
  }
  if (normalized === "both") return "BOTH";
  if (raw.toUpperCase() === "SUNDRY DEBTORS") return "SUNDRY DEBTORS";
  if (raw.toUpperCase() === "SUNDRY CREDITORS") return "SUNDRY CREDITORS";
  if (raw.toUpperCase() === "BOTH") return "BOTH";
  if (isSupplierFallback === true) return "SUNDRY CREDITORS";
  if (isSupplierFallback === false) return "SUNDRY DEBTORS";
  return "SUNDRY DEBTORS";
};

const normalizeAccountTypeValue = (accountType) => {
  const raw = String(accountType ?? "").trim();
  if (!raw || raw.toLowerCase() === "none" || raw.toLowerCase() === "null") {
    return "none";
  }
  const upper = raw.toUpperCase();
  if (upper === "ASSET" || upper === "LIABILITY") return upper;
  return "none";
};

const applyLedgerTypeToSubmitPayload = (submitData, ledgerType) => {
  const normalized = normalizeLedgerTypeValue(ledgerType);
  submitData.ledger_type = normalized;
  if (normalized === "SUNDRY CREDITORS") {
    submitData.is_supplier = true;
  } else if (normalized === "SUNDRY DEBTORS") {
    submitData.is_supplier = false;
  } else {
    submitData.is_supplier = false;
  }
  return submitData;
};

const applyAccountTypeToSubmitPayload = (submitData, accountType) => {
  const normalized = normalizeAccountTypeValue(accountType);
  submitData.account_type = normalized === "none" ? null : normalized;
  return submitData;
};

const emptyBankDetailRow = () => ({
  id: null,
  account_holder: "",
  bank_name: "",
  branch_name: "",
  account_number: "",
  ifsc_code: "",
  account_type: "CURRENT",
  upi_id: "",
  remarks: "",
  is_primary: false,
  is_active: true,
});

const BANK_ACCOUNT_TYPE_OPTIONS = [
  { value: "SAVINGS", label: "Savings" },
  { value: "CURRENT", label: "Current" },
  { value: "OTHER", label: "Other" },
];

const buildBankDetailsPayload = (rows = []) =>
  (rows || [])
    .map((row) => {
      const item = {
        account_holder: (row.account_holder || "").trim(),
        bank_name: (row.bank_name || "").trim(),
        branch_name: (row.branch_name || "").trim(),
        account_number: (row.account_number || "").trim(),
        ifsc_code: (row.ifsc_code || "").trim().toUpperCase(),
        account_type: (row.account_type || "CURRENT").trim().toUpperCase() || "CURRENT",
        upi_id: (row.upi_id || "").trim(),
        remarks: (row.remarks || "").trim(),
        is_primary: Boolean(row.is_primary),
        is_active: row.is_active === false ? false : true,
      };
      if (row.id != null && row.id !== "") {
        item.id = Number(row.id);
      }
      return item;
    })
    .filter((item) =>
      Boolean(
        item.account_holder ||
          item.bank_name ||
          item.branch_name ||
          item.account_number ||
          item.ifsc_code ||
          item.upi_id
      )
    );

const buildCreateCustomerApiPayload = ({
  form,
  firmName,
  ownerName,
  aliasName,
  registrationType,
  customerId,
  branchId = null,
  branchName = "",
  kycDocuments: kycDocs = [],
  bankDetails: bankRows = [],
}) => {
  const ledgerType = normalizeLedgerTypeValue(form.ledger_type);

  const payload = {
    name: firmName,
    firm_name: firmName,
    alias_name: (aliasName || "").trim(),
    owner_name: (ownerName || "").trim(),
    tally_name: (form.tally_name || "").trim(),
    email: (form.email || "").trim(),
    parent: form.parent,
    registration_type: registrationType,
    gst_number: form.gst_number ? form.gst_number.toUpperCase() : "",
    pan_number: form.pan_number ? form.pan_number.toUpperCase() : "",
    religion: form.religion,
    address: form.address,
    landmark: form.landmark,
    city: form.city,
    state: form.state,
    country: form.country,
    pincode: form.pincode,
    lat: form.lat ? parseFloat(form.lat) : null,
    long: form.long ? parseFloat(form.long) : null,
    shipping_address: form.shipping_address,
    shipping_city: form.shipping_city,
    shipping_state: form.shipping_state,
    shipping_pincode: form.shipping_pincode,
    shipping_lat: form.shipping_lat ? parseFloat(form.shipping_lat) : null,
    shipping_long: form.shipping_long ? parseFloat(form.shipping_long) : null,
    contact_person: form.contact_person,
    contact_number: form.contact_number,
    whatsapp_number: form.whatsapp_number,
    customer_type_id: parseOptionalFormId(form.customer_type_id),
    taxation_type_id: parseOptionalFormId(form.taxation_type_id),
    credit_type_id: parseOptionalFormId(form.credit_type_id),
    category_type_id: parseOptionalFormId(form.category_type_id),
    ledger_type: ledgerType,
  };

  if (branchId !== null && branchId !== undefined) {
    payload.branch_id = branchId;
  }
  if (branchName) {
    payload.branch_name = branchName;
  }

  if (customerId) {
    payload.customer_id = Number(customerId);
  }

  if (kycDocs.length > 0) {
    payload.kyc_documents = kycDocs;
  }

  const bankPayload = buildBankDetailsPayload(bankRows);
  if (bankPayload.length > 0) {
    // Ensure at least one primary when any bank rows are sent
    if (!bankPayload.some((b) => b.is_primary)) {
      bankPayload[0].is_primary = true;
    }
    payload.bank_details = bankPayload;
  }

  Object.keys(payload).forEach((key) => {
    if (payload[key] === "") {
      delete payload[key];
    }
  });

  applyLedgerTypeToSubmitPayload(payload, form.ledger_type);
  applyAccountTypeToSubmitPayload(payload, form.account_type);
  applyCustomerTypeToSubmitPayload(payload, form.customer_type_id);

  return payload;
};

const parseOptionalFormId = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const parsed = parseInt(String(value), 10);
  return Number.isNaN(parsed) ? null : parsed;
};

/** Branch ids are nvarchar (e.g. BR001) — never parseInt them. */
const parseOptionalBranchId = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
};

const getBranchRecordId = (branch) => {
  if (!branch) return null;
  const id = branch.id ?? branch.branch_id;
  if (id === "" || id === null || id === undefined) return null;
  return id;
};

const resolvePartyBranchId = (detail, branches = [], listEntry = null) => {
  const idCandidates = [
    detail?.organization_info?.branch_id,
    detail?.organization_info?.branch?.id,
    typeof detail?.organization_info?.branch === "number" ? detail.organization_info.branch : null,
    detail?.branch_id,
    detail?.basic_info?.branch_id,
    listEntry?.branch_id,
  ];

  for (const candidate of idCandidates) {
    if (candidate != null && String(candidate).trim() !== "" && String(candidate) !== "undefined") {
      return String(candidate);
    }
  }

  const branchName = String(
    detail?.organization_info?.branch_name ||
      detail?.branch_name ||
      listEntry?.branch_name ||
      ""
  ).trim();
  if (!branchName || !branches.length) return "";

  const matchedBranch = branches.find(
    (branch) =>
      String(branch?.name || "")
        .trim()
        .toLowerCase() === branchName.toLowerCase()
  );
  const matchedId = getBranchRecordId(matchedBranch);
  return matchedId != null ? String(matchedId) : "";
};

const resolvePartyBranchName = (detail, branches = [], listEntry = null, branchId = "") => {
  const responseName = String(
    detail?.organization_info?.branch_name ||
      detail?.organization_info?.branch?.name ||
      detail?.branch_name ||
      listEntry?.branch_name ||
      ""
  ).trim();
  if (responseName) return responseName;

  const matchedBranch = branches.find(
    (branch) => String(getBranchRecordId(branch)) === String(branchId)
  );
  return String(matchedBranch?.name || "").trim();
};

const getPartyBusinessTypeId = (classificationInfo) => {
  if (!classificationInfo) return null;
  return (
    classificationInfo.bussiness_type?.id ??
    classificationInfo.business_type?.id ??
    classificationInfo.customer_type?.id ??
    null
  );
};

const applyCustomerTypeToSubmitPayload = (submitData, customerTypeIdValue) => {
  const customerTypeId = parseOptionalFormId(customerTypeIdValue);
  if (customerTypeId !== null) {
    submitData.customer_type_id = customerTypeId;
    submitData.business_type_id = customerTypeId;
  } else {
    delete submitData.customer_type_id;
    delete submitData.business_type_id;
  }
  return submitData;
};

const formatLedgerTypeLabel = (ledgerType, isSupplierFallback) => {
  const canonical = normalizeLedgerTypeValue(ledgerType, isSupplierFallback);
  if (canonical === "SUNDRY DEBTORS") return "Sundry Debtor";
  if (canonical === "SUNDRY CREDITORS") return "Sundry Creditor";
  if (canonical === "BOTH") return "Both";
  return ledgerType ? String(ledgerType) : "Sundry Debtor";
};

const formatAccountTypeLabel = (accountType) => {
  const normalized = normalizeAccountTypeValue(accountType);
  if (normalized === "ASSET") return "Asset";
  if (normalized === "LIABILITY") return "Liability";
  return "None";
};

const PARTY_PROFILE_PENDING_FIELDS = [
  { value: "taxation_type", label: "Taxation Type" },
  { value: "customer_type", label: "Customer Type" },
  { value: "address", label: "Address" },
  { value: "contact_number", label: "Contact Number" },
  { value: "gst_number", label: "GST Number" },
  { value: "pan_number", label: "PAN Number" },
  { value: "religion", label: "Religion" },
  { value: "exact_location", label: "Exact Location" },
];

const formatExactLocation = (lat, lng) => {
  const latitude = String(lat ?? "").trim();
  const longitude = String(lng ?? "").trim();
  if (!latitude || !longitude) return "";
  return `${latitude}, ${longitude}`;
};

const CompleteStatusBadge = ({ value, compact = false }) => {
  const pct = Number.isFinite(Number(value)) ? Number(value) : 0;
  const tone =
    pct >= 100
      ? "bg-green-50 text-green-700 border-green-200"
      : pct >= 50
        ? "bg-amber-50 text-amber-700 border-amber-200"
        : "bg-red-50 text-red-700 border-red-200";

  if (compact) {
    return (
      <span
        className={`inline-flex items-center justify-center rounded border px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${tone}`}
        title={`Profile completion: ${pct}%`}
      >
        {pct}%
      </span>
    );
  }

  return (
    <div
      className={`inline-flex flex-col items-end rounded-md border px-2 py-0.5 text-right ${tone}`}
      title="Profile completion"
    >
      <span className="text-[10px] uppercase tracking-wide font-medium leading-none opacity-80">
        Complete
      </span>
      <span className="text-xs font-bold tabular-nums leading-tight">{pct}%</span>
    </div>
  );
};

const actionIconButtonClass =
  "inline-flex items-center justify-center shrink-0 h-8 w-8 min-h-8 min-w-8 p-0";

const TypeMasterCardGrid = ({
  items,
  emptyMessage,
  onEdit,
  onDelete,
  deletingId,
}) => {
  if (!items?.length) {
    return (
      <div className="text-center text-gray-500 py-10 border border-dashed border-gray-200 rounded-lg">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-sm text-gray-900 break-words">{item.name}</p>
              <p className="text-xs text-gray-500 mt-1 line-clamp-2">
                {item.description?.trim() ? item.description : "No description"}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onEdit(item)}
                title="Edit"
                className={`${actionIconButtonClass} border-blue-600 text-blue-600 hover:bg-blue-50`}
              >
                <Pencil className="h-4 w-4" />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onDelete(item)}
                disabled={deletingId === item.id}
                title="Delete"
                className={`${actionIconButtonClass} border-red-300 text-red-600 hover:bg-red-50`}
              >
                {deletingId === item.id ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
              </Button>
            </div>
          </div>
          <div className="mt-3 pt-2 border-t border-gray-100 text-xs">
            <span className="text-gray-500">Margin %</span>
            <span className="ml-1 font-semibold text-gray-900 tabular-nums">
              {item.margin_percent ?? "-"}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
};

const DetailField = ({ label, value, children, className = "" }) => (
  <div className={className}>
    <Label className="text-sm font-medium text-gray-500">{label}</Label>
    {children ?? <p className="text-lg font-semibold break-words">{value ?? "-"}</p>}
  </div>
);

const FormSection = ({
  title,
  icon: Icon,
  children,
  className = "border-gray-200 bg-gray-50/60",
  headerClassName = "",
}) => (
  <div className={`rounded-md border p-2.5 space-y-2 ${className}`}>
    <div
      className={`flex items-center gap-1.5 border-b border-gray-200 pb-1.5 -mx-2.5 -mt-2.5 mb-1.5 px-2.5 pt-2 rounded-t-md ${headerClassName}`.trim()}
    >
      {Icon && <Icon className="h-3.5 w-3.5 text-blue-600 shrink-0" />}
      <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-900">{title}</h3>
    </div>
    {children}
  </div>
);

const FormLabel = ({ children, required }) => (
  <Label className="text-xs font-semibold text-gray-800">
    {children}
    {required && <span className="text-red-500 ml-0.5">*</span>}
  </Label>
);

// Component for select all checkbox with indeterminate state support
const SelectAllCheckbox = ({ checked, indeterminate, onCheckedChange, disabled }) => {
  const checkboxRef = useRef(null);

  useEffect(() => {
    if (checkboxRef.current) {
      checkboxRef.current.indeterminate = indeterminate;
    }
  }, [indeterminate]);

  return (
    <Checkbox
      ref={checkboxRef}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className="data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary"
    />
  );
};

export default function InwardReports() {
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
  const [, setLocation] = useLocation();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [newStatus, setNewStatus] = useState("");
  const [selectedSupervisor, setSelectedSupervisor] = useState("");
  const [selectedGodown, setSelectedGodown] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedParent, setSelectedParent] = useState(null);
  const [selectedIsSupplier, setSelectedIsSupplier] = useState(null); // null | SUNDRY DEBTORS | SUNDRY CREDITORS | BOTH
  const [selectedIsActive, setSelectedIsActive] = useState("all"); // "all", "active", "inactive" — default all so count matches Import Data
  const [selectedIsTallySync, setSelectedIsTallySync] = useState(null); // null = all, "true", "false"
  const [selectedPendingField, setSelectedPendingField] = useState(null);
  const [selectedBranchFilter, setSelectedBranchFilter] = useState(null); // null | { id, name }
  const [branchFilterDropdownOpen, setBranchFilterDropdownOpen] = useState(false);
  const [branchFilterSearch, setBranchFilterSearch] = useState("");
  const [isMoreFiltersOpen, setIsMoreFiltersOpen] = useState(false);
  const [selectedAreaGroupIds, setSelectedAreaGroupIds] = useState([]); // number[]
  const [selectedCreatedByIds, setSelectedCreatedByIds] = useState([]); // string[]
  const [selectedBusinessTypeIds, setSelectedBusinessTypeIds] = useState([]); // number[]
  const [selectedCreditTypeIds, setSelectedCreditTypeIds] = useState([]); // number[]
  const [selectedCategoryTypeIds, setSelectedCategoryTypeIds] = useState([]); // number[]
  const [selectedReligions, setSelectedReligions] = useState([]); // string[]
  const [selectedWeekOffs, setSelectedWeekOffs] = useState([]); // string[]
  // Draft state inside More filters sheet (applied on Apply)
  const [moreFiltersDraft, setMoreFiltersDraft] = useState({
    parent: null,
    branchFilter: null, // { id, name } | null
    isActive: "all",
    areaGroupIds: [],
    ledgerType: null,
    createdByIds: [],
    businessTypeIds: [],
    creditTypeIds: [],
    categoryTypeIds: [],
    religions: [],
    weekOffs: [],
  });
  const emptyMoreFiltersDraft = {
    parent: null,
    branchFilter: null,
    isActive: "all",
    areaGroupIds: [],
    ledgerType: null,
    createdByIds: [],
    businessTypeIds: [],
    creditTypeIds: [],
    categoryTypeIds: [],
    religions: [],
    weekOffs: [],
  };
  const [isGeneratingExcel, setIsGeneratingExcel] = useState(false);
  const [isExcelDownloadDialogOpen, setIsExcelDownloadDialogOpen] = useState(false);
  const [generatedExcelFile, setGeneratedExcelFile] = useState(null);
  const [parentDropdownOpen, setParentDropdownOpen] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [createCustomerParentOpen, setCreateCustomerParentOpen] = useState(false);
  const [createCustomerParentSearch, setCreateCustomerParentSearch] = useState("");
  const [registrationTypeOpen, setRegistrationTypeOpen] = useState(false);
  const [registrationTypeSearch, setRegistrationTypeSearch] = useState("");
  const [customerBusinessTypeOpen, setCustomerBusinessTypeOpen] = useState(false);
  const [customerBusinessTypeSearch, setCustomerBusinessTypeSearch] = useState("");
  const [categoryTypeOpen, setCategoryTypeOpen] = useState(false);
  const [categoryTypeSearch, setCategoryTypeSearch] = useState("");
  const [branchOpen, setBranchOpen] = useState(false);
  const [branchSearch, setBranchSearch] = useState("");
  const [kycDocNameOpenIndex, setKycDocNameOpenIndex] = useState(null);
  const [kycDocNameSearch, setKycDocNameSearch] = useState("");
  const [sameAsAddressChecked, setSameAsAddressChecked] = useState(false);
  const sameAsAddressCheckedRef = useRef(false);
  const addressInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const shippingAddressInputRef = useRef(null);
  const shippingAutocompleteRef = useRef(null);
  const [isGoogleScriptLoaded, setIsGoogleScriptLoaded] = useState(false);
  const [addressErrors, setAddressErrors] = useState({
    address: "",
    city: "",
    state: "",
    pincode: "",
  });
  const [createCustomerStateOpen, setCreateCustomerStateOpen] = useState(false);
  const [gstNumberError, setGstNumberError] = useState("");
  const GST_NUMBER_ERROR_TEXT =
    "Invalid GST Number. Use 15 characters: valid state code, PAN, entity code, Z, and checksum digit.";
  const [editingCustomerId, setEditingCustomerId] = useState(null);
  const [kycDocuments, setKycDocuments] = useState([]); // { id?, document_name, document_number, file?, uploading?, fileName? }[]
  const [bankDetails, setBankDetails] = useState([]); // party bank detail rows for create/edit
  const editPrefillDoneRef = useRef(null);
  const editFormTouchedRef = useRef(false);
  const editingLedgerEntryRef = useRef(null);
  const kycTouchedRef = useRef(false);
  const bankTouchedRef = useRef(false);
  const [isKycImageDialogOpen, setIsKycImageDialogOpen] = useState(false);
  const [selectedKycImage, setSelectedKycImage] = useState(null);
  const [kycImageZoom, setKycImageZoom] = useState(1);
  const [kycImagePosition, setKycImagePosition] = useState({ x: 0, y: 0 });
  const [isKycImageDragging, setIsKycImageDragging] = useState(false);
  const [kycImageDragStart, setKycImageDragStart] = useState({ x: 0, y: 0 });

  // Business / Credit type management
  const [isBusinessTypeDialogOpen, setIsBusinessTypeDialogOpen] = useState(false);
  const [isCreditTypeDialogOpen, setIsCreditTypeDialogOpen] = useState(false);
  const [editingBusinessTypeId, setEditingBusinessTypeId] = useState(null);
  const [editingCreditTypeId, setEditingCreditTypeId] = useState(null);
  const [businessTypeForm, setBusinessTypeForm] = useState({ name: "", description: "", margin_percent: "" });
  const [creditTypeForm, setCreditTypeForm] = useState({ name: "", description: "", margin_percent: "" });

  // Tab state for split screen
  const [activeTab, setActiveTab] = useState("ledgers");

  // Ledger Groups state
  const [ledgerGroupsSearchInput, setLedgerGroupsSearchInput] = useState("");
  const [debouncedLedgerGroupsSearch, setDebouncedLedgerGroupsSearch] = useState("");
  const [ledgerGroupsActiveFilter, setLedgerGroupsActiveFilter] = useState("all"); // "all", "active", "inactive"
  const [ledgerGroupsLiveFilter, setLedgerGroupsLiveFilter] = useState("all"); // "all", "live", "not_live"
  const [ledgerGroupsCurrentPage, setLedgerGroupsCurrentPage] = useState(1);
  const [ledgerGroupsData, setLedgerGroupsData] = useState([]);
  const [selectedLedgerGroupIds, setSelectedLedgerGroupIds] = useState([]);
  const [ledgerGroupChanges, setLedgerGroupChanges] = useState({}); // Track local changes: { id: { is_active: bool, is_live: bool } }
  const [ledgerGroupsPagination, setLedgerGroupsPagination] = useState({
    current_page: 1,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false
  });
  const [isCreateLedgerGroupDialogOpen, setIsCreateLedgerGroupDialogOpen] = useState(false);
  const [ledgerGroupForm, setLedgerGroupForm] = useState(EMPTY_LEDGER_GROUP_FORM);
  const [ledgerGroupParentOptions, setLedgerGroupParentOptions] = useState(
    DEFAULT_LEDGER_GROUP_PARENT_OPTIONS
  );

  // Ledgers (tblPartyInfo) multi-select for bulk activate/deactivate
  const [selectedLedgerIds, setSelectedLedgerIds] = useState([]);

  const isMobile = useIsMobile();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { hasPermission } = useUserPermissions();

  useEffect(() => {
    sameAsAddressCheckedRef.current = sameAsAddressChecked;
  }, [sameAsAddressChecked]);

  // Load Google Places API script
  useEffect(() => {
    if (!GOOGLE_API_KEY) {
      console.warn('Google API key not found in environment variables. Please set VITE_GOOGLE_MAPS_API_KEY in your .env file');
      return;
    }

    if (window.google && window.google.maps && window.google.maps.places) {
      setIsGoogleScriptLoaded(true);
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      if (existingScript.getAttribute('data-loaded') === 'true') {
        setIsGoogleScriptLoaded(true);
        return;
      }
      existingScript.addEventListener('load', () => {
        existingScript.setAttribute('data-loaded', 'true');
        setIsGoogleScriptLoaded(true);
      });
      return;
    }

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_API_KEY}&libraries=places`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      setTimeout(() => {
        if (window.google && window.google.maps && window.google.maps.places) {
          script.setAttribute('data-loaded', 'true');
          setIsGoogleScriptLoaded(true);
        } else {
          console.error('Google Places API not available after script load');
        }
      }, 100);
    };

    script.onerror = (error) => {
      console.error('Failed to load Google Places API:', error);
      toast({
        title: "Error",
        description: "Failed to load Google Places API. Please check your API key.",
        variant: "destructive"
      });
    };

    document.head.appendChild(script);
  }, [GOOGLE_API_KEY, toast]);

  // Styles for Google Places Autocomplete dropdown (shared id with add-user)
  useEffect(() => {
    const styleId = 'google-places-autocomplete-styles';
    let style = document.getElementById(styleId);
    if (!style) {
      style = document.createElement('style');
      style.id = styleId;
      document.head.appendChild(style);
    }
    style.textContent = `
      .pac-container {
        z-index: 99999 !important;
        pointer-events: auto !important;
        border-radius: 8px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
        border: 1px solid #e5e7eb;
        margin-top: 4px;
        font-family: inherit;
      }
      .pac-item {
        padding: 8px 12px;
        cursor: pointer;
        border-top: 1px solid #f3f4f6;
        font-size: 14px;
      }
      .pac-item:first-child {
        border-top: none;
      }
      .pac-item:hover {
        background-color: #f9fafb;
      }
      .pac-item-selected {
        background-color: #f3f4f6;
      }
      .pac-icon {
        margin-right: 8px;
      }
    `;
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLedgerGroupsSearch(ledgerGroupsSearchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ledgerGroupsSearchInput]);

  // Reset to first page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [
    selectedParent,
    selectedIsSupplier,
    debouncedSearch,
    selectedIsActive,
    selectedIsTallySync,
    selectedPendingField,
    selectedBranchFilter,
    selectedAreaGroupIds,
    selectedCreatedByIds,
    selectedBusinessTypeIds,
    selectedCreditTypeIds,
    selectedCategoryTypeIds,
    selectedReligions,
    selectedWeekOffs,
  ]);

  useEffect(() => {
    setLedgerGroupsCurrentPage(1);
  }, [debouncedLedgerGroupsSearch, ledgerGroupsActiveFilter, ledgerGroupsLiveFilter]);

  // Fetch Ledger Groups
  const { data: ledgerGroupsResponse, isLoading: isLoadingLedgerGroups, refetch: refetchLedgerGroups } = useQuery({
    queryKey: ['ledger-groups', debouncedLedgerGroupsSearch, ledgerGroupsActiveFilter, ledgerGroupsLiveFilter, ledgerGroupsCurrentPage],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (debouncedLedgerGroupsSearch) params.append('search', debouncedLedgerGroupsSearch);
      if (ledgerGroupsActiveFilter !== 'all') {
        params.append('is_active', ledgerGroupsActiveFilter === 'active' ? 'true' : 'false');
      }
      if (ledgerGroupsLiveFilter !== 'all') {
        params.append('is_live', ledgerGroupsLiveFilter === 'live' ? 'true' : 'false');
      }
      params.append('page', ledgerGroupsCurrentPage.toString());
      params.append('per_page', LEDGER_GROUPS_PAGE_SIZE.toString());

      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`);
      const data = await response.json();
      return data;
    },
    enabled: !!AuthService.getAccessToken() && activeTab === 'groups',
    refetchOnWindowFocus: false,
  });

  // Update ledger groups data when response changes
  useEffect(() => {
    if (ledgerGroupsResponse) {
      setLedgerGroupsData(ledgerGroupsResponse.data || []);
      setLedgerGroupsPagination(ledgerGroupsResponse.pagination || {
        current_page: 1,
        total_count: 0,
        total_pages: 1,
        has_next: false,
        has_previous: false
      });
      if (
        Array.isArray(ledgerGroupsResponse.parent_options) &&
        ledgerGroupsResponse.parent_options.length > 0
      ) {
        setLedgerGroupParentOptions(ledgerGroupsResponse.parent_options);
      }
      // Clear selection and changes when data changes
      setSelectedLedgerGroupIds([]);
      setLedgerGroupChanges({});
    }
  }, [ledgerGroupsResponse]);

  // Create ledger group mutation
  const createLedgerGroupMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest(
        "POST",
        `${API_BASE_URL}/api/report/create-ledger-group/`,
        payload
      );
      const data = await response.json();
      if (!response.ok || (data.status && data.status >= 400)) {
        throw new Error(data.error || data.message || "Failed to create ledger group");
      }
      return data;
    },
    onSuccess: (data) => {
      if (Array.isArray(data.parent_options) && data.parent_options.length > 0) {
        setLedgerGroupParentOptions(data.parent_options);
      }
      toast({
        title: "Success",
        description: data.message || "Ledger group created successfully",
      });
      setIsCreateLedgerGroupDialogOpen(false);
      setLedgerGroupForm(EMPTY_LEDGER_GROUP_FORM);
      refetchLedgerGroups();
      queryClient.invalidateQueries({ queryKey: ["ledger-groups-for-parent"] });
      queryClient.invalidateQueries({ queryKey: ["ledger-groups-for-parent-dropdown"] });
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create ledger group. Please try again.",
        variant: "destructive",
      });
    },
  });

  // Bulk update ledger groups mutation
  const bulkUpdateLedgerGroupsMutation = useMutation({
    mutationFn: async (ledgerGroups) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/report/bulk-update-ledger-groups/`, {
        ledger_groups: ledgerGroups
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: "Success",
          description: data.message || `${data.data.updated_count} ledger group(s) updated successfully`,
        });
        // Clear selection and changes after successful update
        setSelectedLedgerGroupIds([]);
        setLedgerGroupChanges({});
        // Refetch data to get updated values
        refetchLedgerGroups();
      } else {
        toast({
          title: "Error",
          description: data.error || "Failed to update ledger groups",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error('Bulk update ledger groups error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update ledger groups. Please try again.",
        variant: "destructive"
      });
    }
  });

  // Update ledger group status mutation with optimistic updates (for individual updates)
  const updateLedgerGroupMutation = useMutation({
    mutationFn: async ({ groupId, isActive, isLive }) => {
      const response = await apiRequest('PUT', `${API_BASE_URL}/api/report/update-ledger-group/${groupId}/`, {
        is_active: isActive,
        is_live: isLive
      });
      return response.json();
    },
    onMutate: async ({ groupId, isActive, isLive }) => {
      // Cancel any outgoing refetches
      const ledgerGroupsQueryKey = [
        'ledger-groups',
        debouncedLedgerGroupsSearch,
        ledgerGroupsActiveFilter,
        ledgerGroupsLiveFilter,
        ledgerGroupsCurrentPage,
      ];
      await queryClient.cancelQueries(ledgerGroupsQueryKey);

      // Snapshot the previous value
      const previousData = queryClient.getQueryData(ledgerGroupsQueryKey);

      // Optimistically update local state immediately (no loading state)
      setLedgerGroupsData((prev) =>
        prev.map((group) =>
          group.id === groupId
            ? { ...group, is_active: isActive, is_live: isLive }
            : group
        )
      );

      return { previousData };
    },
    onSuccess: (data) => {
      if (data.status !== 200) {
        // Only show error toast if status is not 200
        toast({
          title: "Error",
          description: data.error || "Failed to update ledger group",
          variant: "destructive"
        });
        // Revert on error by refetching
        refetchLedgerGroups();
      }
      // Success case: UI already updated optimistically, no need to refetch or show toast
    },
    onError: (error, variables, context) => {
      // Revert optimistic update on error by refetching
      refetchLedgerGroups();
      console.error('Update ledger group error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to update ledger group. Please try again.",
        variant: "destructive"
      });
    }
  });

  const handleLedgerGroupStatusChange = (groupId, field, value) => {
    const group = ledgerGroupsData.find(g => g.id === groupId);
    if (!group) return;

    const newIsActive = field === 'is_active' ? value : group.is_active;
    const newIsLive = field === 'is_live' ? value : group.is_live;

    // Call mutation - UI updates immediately via optimistic update
    updateLedgerGroupMutation.mutate({
      groupId,
      isActive: newIsActive,
      isLive: newIsLive
    });
  };

  const handleLedgerGroupsPageChange = (page) => {
    if (page < 1 || page > ledgerGroupsPagination.total_pages) return;
    setLedgerGroupsCurrentPage(page);
  };

  // Handle individual selection
  const handleLedgerGroupSelect = (groupId, checked) => {
    if (checked) {
      setSelectedLedgerGroupIds((prev) => [...prev, groupId]);
      // Initialize changes for this group with current values
      const group = ledgerGroupsData.find(g => g.id === groupId);
      if (group) {
        setLedgerGroupChanges((prev) => ({
          ...prev,
          [groupId]: {
            is_active: group.is_active,
            is_live: group.is_live
          }
        }));
      }
    } else {
      setSelectedLedgerGroupIds((prev) => prev.filter((id) => id !== groupId));
      // Remove changes for this group
      setLedgerGroupChanges((prev) => {
        const newChanges = { ...prev };
        delete newChanges[groupId];
        return newChanges;
      });
    }
  };

  // Handle select all
  const handleSelectAll = () => {
    const allIds = ledgerGroupsData.map((group) => group.id);
    setSelectedLedgerGroupIds(allIds);
    // Initialize changes for all groups
    const changes = {};
    ledgerGroupsData.forEach((group) => {
      changes[group.id] = {
        is_active: group.is_active,
        is_live: group.is_live
      };
    });
    setLedgerGroupChanges(changes);
  };

  // Handle unselect all
  const handleUnselectAll = () => {
    setSelectedLedgerGroupIds([]);
    setLedgerGroupChanges({});
  };

  // Handle local checkbox change (updates local state, not API)
  const handleLocalStatusChange = (groupId, field, value) => {
    setLedgerGroupChanges((prev) => ({
      ...prev,
      [groupId]: {
        ...(prev[groupId] || {
          is_active: ledgerGroupsData.find(g => g.id === groupId)?.is_active ?? false,
          is_live: ledgerGroupsData.find(g => g.id === groupId)?.is_live ?? false
        }),
        [field]: value
      }
    }));
  };

  // Get current display value (from changes if selected, otherwise from data)
  const getDisplayValue = (groupId, field) => {
    // If item is selected and has changes, use the changed value
    if (selectedLedgerGroupIds.includes(groupId) && ledgerGroupChanges[groupId]) {
      const changedValue = ledgerGroupChanges[groupId][field];
      if (changedValue !== undefined) {
        return changedValue;
      }
    }
    // Otherwise, use the original value from data
    const group = ledgerGroupsData.find(g => g.id === groupId);
    return group ? group[field] : false;
  };

  // Handle save - bulk update all selected items
  const handleSaveChanges = () => {
    if (selectedLedgerGroupIds.length === 0) {
      toast({
        title: "No Selection",
        description: "Please select at least one ledger group to update",
        variant: "destructive"
      });
      return;
    }

    // Prepare bulk update payload with IDs and their current status values
    const ledgerGroups = selectedLedgerGroupIds.map((groupId) => {
      const changes = ledgerGroupChanges[groupId];
      const group = ledgerGroupsData.find(g => g.id === groupId);

      // Use changed values if available, otherwise use current values from data
      return {
        id: groupId,
        is_active: changes?.is_active !== undefined ? changes.is_active : (group?.is_active ?? false),
        is_live: changes?.is_live !== undefined ? changes.is_live : (group?.is_live ?? false)
      };
    });

    // Make single API call with all selected IDs and their status values
    bulkUpdateLedgerGroupsMutation.mutate(ledgerGroups);
  };

  // Check if all current items are selected
  const areAllSelected = ledgerGroupsData.length > 0 &&
    ledgerGroupsData.every((group) => selectedLedgerGroupIds.includes(group.id));

  // Handle select all/deselect all for Active status (local changes)
  const handleSelectAllActive = () => {
    const newChanges = { ...ledgerGroupChanges };
    selectedLedgerGroupIds.forEach((groupId) => {
      newChanges[groupId] = {
        ...(newChanges[groupId] || {
          is_active: ledgerGroupsData.find(g => g.id === groupId)?.is_active ?? false,
          is_live: ledgerGroupsData.find(g => g.id === groupId)?.is_live ?? false
        }),
        is_active: true
      };
    });
    setLedgerGroupChanges(newChanges);
  };

  const handleDeselectAllActive = () => {
    const newChanges = { ...ledgerGroupChanges };
    selectedLedgerGroupIds.forEach((groupId) => {
      newChanges[groupId] = {
        ...(newChanges[groupId] || {
          is_active: ledgerGroupsData.find(g => g.id === groupId)?.is_active ?? false,
          is_live: ledgerGroupsData.find(g => g.id === groupId)?.is_live ?? false
        }),
        is_active: false
      };
    });
    setLedgerGroupChanges(newChanges);
  };

  // Handle select all/deselect all for Live status (local changes)
  const handleSelectAllLive = () => {
    const newChanges = { ...ledgerGroupChanges };
    selectedLedgerGroupIds.forEach((groupId) => {
      newChanges[groupId] = {
        ...(newChanges[groupId] || {
          is_active: ledgerGroupsData.find(g => g.id === groupId)?.is_active ?? false,
          is_live: ledgerGroupsData.find(g => g.id === groupId)?.is_live ?? false
        }),
        is_live: true
      };
    });
    setLedgerGroupChanges(newChanges);
  };

  const handleDeselectAllLive = () => {
    const newChanges = { ...ledgerGroupChanges };
    selectedLedgerGroupIds.forEach((groupId) => {
      newChanges[groupId] = {
        ...(newChanges[groupId] || {
          is_active: ledgerGroupsData.find(g => g.id === groupId)?.is_active ?? false,
          is_live: ledgerGroupsData.find(g => g.id === groupId)?.is_live ?? false
        }),
        is_live: false
      };
    });
    setLedgerGroupChanges(newChanges);
  };

  // Check if all Active are selected (for selected items)
  const areAllActiveSelected = selectedLedgerGroupIds.length > 0 &&
    selectedLedgerGroupIds.every((groupId) => {
      const value = getDisplayValue(groupId, 'is_active');
      return value === true;
    });

  // Check if all Live are selected (for selected items)
  const areAllLiveSelected = selectedLedgerGroupIds.length > 0 &&
    selectedLedgerGroupIds.every((groupId) => {
      const value = getDisplayValue(groupId, 'is_live');
      return value === true;
    });

  // Check if all Active are selected (for all items on current page)
  const areAllPageActiveSelected = ledgerGroupsData.length > 0 &&
    ledgerGroupsData.every((group) => {
      const value = getDisplayValue(group.id, 'is_active');
      return value === true;
    });

  // Check if some (but not all) Active are selected (for indeterminate state)
  const areSomePageActiveSelected = ledgerGroupsData.length > 0 &&
    ledgerGroupsData.some((group) => {
      const value = getDisplayValue(group.id, 'is_active');
      return value === true;
    }) && !areAllPageActiveSelected;

  // Check if all Live are selected (for all items on current page)
  const areAllPageLiveSelected = ledgerGroupsData.length > 0 &&
    ledgerGroupsData.every((group) => {
      const value = getDisplayValue(group.id, 'is_live');
      return value === true;
    });

  // Check if some (but not all) Live are selected (for indeterminate state)
  const areSomePageLiveSelected = ledgerGroupsData.length > 0 &&
    ledgerGroupsData.some((group) => {
      const value = getDisplayValue(group.id, 'is_live');
      return value === true;
    }) && !areAllPageLiveSelected;

  // Handle select all/deselect all for Active status (all items on current page)
  const handleSelectAllPageActive = (checked) => {
    // First, ensure all items on the page are selected
    const allPageIds = ledgerGroupsData.map((group) => group.id);
    const newSelectedIds = [...new Set([...selectedLedgerGroupIds, ...allPageIds])];

    // Initialize changes for all items if not already present
    const newChanges = { ...ledgerGroupChanges };
    ledgerGroupsData.forEach((group) => {
      // Initialize with current values if not already in changes
      if (!newChanges[group.id]) {
        newChanges[group.id] = {
          is_active: group.is_active ?? false,
          is_live: group.is_live ?? false
        };
      }
      // Update the active status
      newChanges[group.id] = {
        ...newChanges[group.id],
        is_active: checked
      };
    });

    // Update both state and changes atomically
    setSelectedLedgerGroupIds(newSelectedIds);
    setLedgerGroupChanges(newChanges);
  };

  // Handle select all/deselect all for Live status (all items on current page)
  const handleSelectAllPageLive = (checked) => {
    // First, ensure all items on the page are selected
    const allPageIds = ledgerGroupsData.map((group) => group.id);
    const newSelectedIds = [...new Set([...selectedLedgerGroupIds, ...allPageIds])];

    // Initialize changes for all items if not already present
    const newChanges = { ...ledgerGroupChanges };
    ledgerGroupsData.forEach((group) => {
      // Initialize with current values if not already in changes
      if (!newChanges[group.id]) {
        newChanges[group.id] = {
          is_active: group.is_active ?? false,
          is_live: group.is_live ?? false
        };
      }
      // Update the live status
      newChanges[group.id] = {
        ...newChanges[group.id],
        is_live: checked
      };
    });

    // Update both state and changes atomically
    setSelectedLedgerGroupIds(newSelectedIds);
    setLedgerGroupChanges(newChanges);
  };

  const buildQueryParams = (options = {}) => {
    const { forDownload = false } = options;
    const params = new URLSearchParams();
    // Show all org parties (same as Import Data count). Without this, API only returns
    // ledgers whose parent matches a live+active ledger group — hiding many uploaded rows.
    params.append('include_all', 'true');
    // API accepts: search, parent, ledger_type, is_active, state, gst_number, page, per_page
    if (debouncedSearch) params.append('search', debouncedSearch);
    if (selectedParent) params.append('parent', selectedParent);
    if (selectedIsSupplier !== null) {
      params.append('ledger_type', selectedIsSupplier);
    }
    if (selectedIsActive && selectedIsActive !== 'all') {
      params.append('is_active', selectedIsActive === 'active' ? 'true' : 'false');
    } else if (selectedIsActive === 'all') {
      params.append('is_active', 'all');
    }
    if (selectedIsTallySync !== null) {
      params.append('is_tally_sync', selectedIsTallySync);
    }
    if (selectedPendingField) {
      params.append('pending_field', selectedPendingField);
    }
    if (selectedBranchFilter?.id != null && String(selectedBranchFilter.id).trim() !== "") {
      params.append('branch_id', String(selectedBranchFilter.id));
    }
    if (selectedBranchFilter?.name) {
      params.append('branch_name', String(selectedBranchFilter.name).trim());
    }
    selectedAreaGroupIds.forEach((id) => params.append('area_group_id', String(id)));
    selectedCreatedByIds.forEach((id) => params.append('created_by', String(id)));
    selectedBusinessTypeIds.forEach((id) => params.append('business_type_id', String(id)));
    selectedCreditTypeIds.forEach((id) => params.append('credit_type_id', String(id)));
    selectedCategoryTypeIds.forEach((id) => params.append('category_type_id', String(id)));
    selectedReligions.forEach((religion) => params.append('religion', religion));
    selectedWeekOffs.forEach((day) => params.append('week_off', day));
    if (forDownload) {
      params.append('download', 'true');
    } else {
    params.append('page', currentPage.toString());
    params.append('per_page', PAGE_SIZE.toString());
    }

    return params.toString();
  };

  const handleGenerateExcel = async () => {
    try {
      setIsGeneratingExcel(true);
      const queryParams = buildQueryParams({ forDownload: true });
      const response = await apiRequest(
        'GET',
        `${API_BASE_URL}/api/report/get-ledgers/?${queryParams}`
      );
      const data = await response.json();

      if (data.status === 200 && data.download_url) {
        setGeneratedExcelFile({
          download_url: data.download_url,
          filename: data.filename || 'ledger_masters.xlsx',
          total_records: data.total_records ?? null,
        });
        setIsExcelDownloadDialogOpen(true);
      } else {
        throw new Error(data.error || data.message || 'Failed to generate Excel report');
      }
    } catch (error) {
      console.error('Ledger excel generation error:', error);
      toast({
        title: 'Generation Failed',
        description: error.message || 'Failed to generate ledger masters Excel report',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingExcel(false);
    }
  };

  const handleExcelDownloadDialogChange = (open) => {
    setIsExcelDownloadDialogOpen(open);
    if (!open) {
      setGeneratedExcelFile(null);
    }
  };

  // Fetch ledger groups for parent dropdown (with is_live=True)
  const { data: ledgerGroupsForParent } = useQuery({
    queryKey: ['ledger-groups-for-parent'],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.append('is_live', 'true');
      params.append('page', '1');
      params.append('per_page', '1000'); // Get all live ledger groups

      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Fetch ALL ledger groups for Create Customer Parent dropdown (all pages, full list e.g. 597)
  const { data: ledgerGroupsForParentDropdown = [], isLoading: parentDropdownLoading } = useQuery({
    queryKey: ['ledger-groups-for-parent-dropdown'],
    queryFn: async () => {
      const all = [];
      let page = 1;
      let hasMore = true;
      while (hasMore) {
        const params = new URLSearchParams();
        params.append('page', String(page));
        params.append('per_page', '100');
        const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers-groups/?${params.toString()}`);
        const data = await response.json();
        const list = data.data || [];
        all.push(...list);
        const pagination = data.pagination || {};
        hasMore = pagination.has_next === true && list.length === 100;
        page += 1;
      }
      return all;
    },
    enabled: !!AuthService.getAccessToken() && isCreateDialogOpen,
    refetchOnWindowFocus: false,
  });

  // Get ledgers list API: GET api/report/get-ledgers/?search=&parent=&ledger_type=&is_active=&branch_name=&page=&per_page=
  const { data: responseData, isLoading, refetch } = useQuery({
    queryKey: [
      `${API_BASE_URL}/api/report/get-ledgers/`,
      debouncedSearch,
      selectedParent,
      selectedIsSupplier,
      selectedIsActive,
      selectedIsTallySync,
      selectedPendingField,
      selectedBranchFilter?.id ?? null,
      selectedBranchFilter?.name ?? null,
      selectedAreaGroupIds,
      selectedCreatedByIds,
      selectedBusinessTypeIds,
      selectedCreditTypeIds,
      selectedCategoryTypeIds,
      selectedReligions,
      selectedWeekOffs,
      currentPage,
    ],
    queryFn: async () => {
      const queryParams = buildQueryParams();
      const url = `${API_BASE_URL}/api/report/get-ledgers/${queryParams ? `?${queryParams}` : ''}`;
      const response = await apiRequest('GET', url);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Failed to fetch ledgers');
      }
      return {
        data: data.data ?? [],
        summary: data.summary ?? null,
        pagination: data.pagination ?? {
          current_page: 1,
          total_count: 0,
          total_pages: 1,
          has_next: false,
          has_previous: false
        }
      };
    },
    enabled: !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
    keepPreviousData: true,
  });

  // Ledger details API: GET api/report/get-ledgers/:id/ (get_party_detail – full party + KYC with file/files and audit fields)
  const { data: entryDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: [`${API_BASE_URL}/api/report/get-ledgers/`, selectedEntry?.id],
    queryFn: async () => {
      if (!selectedEntry?.id) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers/${selectedEntry.id}/`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error || data?.message || 'Failed to fetch ledger details');
      }
      return data.data ?? null;
    },
    enabled: !!selectedEntry?.id && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Sync ledger to Tally
  const syncLedgerToTallyMutation = useMutation({
    mutationFn: async (partyId) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/sales/sync-ledger-to-tally/`, { party_id: partyId });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Failed to sync ledger to Tally');
      }
      return data;
    },
    onSuccess: (data, partyId) => {
      toast({
        title: 'Success',
        description: data?.message || 'Ledger synced to Tally successfully',
      });
      queryClient.invalidateQueries({ queryKey: [`${API_BASE_URL}/api/report/get-ledgers/`] });
      if (partyId) {
        queryClient.invalidateQueries({ queryKey: [`${API_BASE_URL}/api/report/get-ledgers/`, partyId] });
      }
      if (selectedEntry?.id === partyId) {
        queryClient.invalidateQueries({ queryKey: [`${API_BASE_URL}/api/report/get-ledgers/`, selectedEntry.id] });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to sync ledger to Tally',
        variant: 'destructive',
      });
    },
  });

  // Fetch party detail for edit dialog prefill (same get_party_detail API as view)
  const { data: editPartyDetail, isLoading: isEditPartyDetailLoading } = useQuery({
    queryKey: ['party-detail-edit', editingCustomerId],
    queryFn: async () => {
      if (!editingCustomerId) return null;
      const response = await apiRequest('GET', `${API_BASE_URL}/api/report/get-ledgers/${editingCustomerId}/`);
      const res = await response.json();
      if (!response.ok) {
        throw new Error(res?.error || res?.message || 'Failed to fetch party details');
      }
      return res.data ?? null;
    },
    enabled: !!editingCustomerId && isCreateDialogOpen && !!AuthService.getAccessToken(),
    refetchOnWindowFocus: false,
  });

  // Match list rows to selected branch via response `branch_name` (fallback if API ignores branch params)
  const ledgerEntries = useMemo(() => {
    const raw = responseData?.data || [];
    if (!selectedBranchFilter?.name) return raw;
    const selectedName = String(selectedBranchFilter.name).trim().toLowerCase();
    return raw.filter((entry) => {
      const entryBranch = String(entry?.branch_name || "").trim().toLowerCase();
      return entryBranch && entryBranch === selectedName;
    });
  }, [responseData?.data, selectedBranchFilter]);

  const pagination = responseData?.pagination || {
    current_page: 1,
    total_count: 0,
    total_pages: 1,
    has_next: false,
    has_previous: false
  };

  const profileSummary = responseData?.summary || null;

  const getPendingFieldLabel = (fieldKey) =>
    PARTY_PROFILE_PENDING_FIELDS.find((field) => field.value === fieldKey)?.label || fieldKey;

  // Clear ledger selection when ledger list data changes (page/filters)
  useEffect(() => {
    setSelectedLedgerIds([]);
  }, [responseData?.data, responseData?.pagination?.current_page]);

  // Bulk update ledgers (activate/deactivate) mutation
  const bulkUpdateLedgersActiveStatusMutation = useMutation({
    mutationFn: async (ledgers) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/report/bulk-update-ledgers-active-status/`, {
        ledgers
      });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.status === 200) {
        toast({
          title: 'Success',
          description: data.message || `${data.data?.updated_count ?? 0} ledger(s) updated successfully`,
        });
        setSelectedLedgerIds([]);
        refetch();
      } else {
        toast({
          title: 'Error',
          description: data.error || 'Failed to update ledgers',
          variant: 'destructive',
        });
      }
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to update ledgers. Please try again.',
        variant: 'destructive',
      });
    },
  });

  const handleLedgerSelect = (ledgerId, checked) => {
    if (checked) {
      setSelectedLedgerIds((prev) => [...prev, ledgerId]);
    } else {
      setSelectedLedgerIds((prev) => prev.filter((id) => id !== ledgerId));
    }
  };

  const handleSelectAllLedgersOnPage = () => {
    const pageIds = ledgerEntries.map((e) => e.id);
    setSelectedLedgerIds((prev) => {
      const combined = new Set([...prev, ...pageIds]);
      return Array.from(combined);
    });
  };

  const handleClearLedgerSelection = () => {
    setSelectedLedgerIds([]);
  };

  const handleBulkActivateLedgers = () => {
    if (selectedLedgerIds.length === 0) return;
    bulkUpdateLedgersActiveStatusMutation.mutate(
      selectedLedgerIds.map((id) => ({ id, is_active: true }))
    );
  };

  const handleBulkDeactivateLedgers = () => {
    if (selectedLedgerIds.length === 0) return;
    bulkUpdateLedgersActiveStatusMutation.mutate(
      selectedLedgerIds.map((id) => ({ id, is_active: false }))
    );
  };

  const areAllLedgersOnPageSelected =
    ledgerEntries.length > 0 &&
    ledgerEntries.every((e) => selectedLedgerIds.includes(e.id));

  const areSomeLedgersOnPageSelected =
    ledgerEntries.length > 0 &&
    ledgerEntries.some((e) => selectedLedgerIds.includes(e.id));

  // Handle parent selection
  const handleParentSelect = (parent) => {
    setSelectedParent(parent);
    setParentDropdownOpen(false);
  };

  // Handle ledger type filter (supplier / customer / both)
  const handleIsSupplierSelect = (value) => {
    setSelectedIsSupplier(value);
    setCurrentPage(1);
  };

  // Get unique parent names from ledger groups API
  const uniqueParents = useMemo(() => {
    if (!ledgerGroupsForParent) return [];
    return [...new Set(ledgerGroupsForParent.map(group => group.name).filter(name => name && name.trim() !== ""))].sort();
  }, [ledgerGroupsForParent]);


  // Form state for create customer
  const [customerFormData, setCustomerFormData] = useState({
    name: "",
    tally_name: "",
    firm_name: "",
    alias_name: "",
    parent: "",
    email: "",
    registration_type: "",
    gst_number: "",
    pan_number: "",
    owner_name: "",
    address: "",
    landmark: "",
    shipping_address: "",
    state: "",
    shipping_state: "",
    city: "",
    shipping_city: "",
    country: "",
    pincode: "",
    shipping_pincode: "",
    lat: "",
    long: "",
    shipping_lat: "",
    shipping_long: "",
    contact_person: "",
    contact_number: "",
    whatsapp_number: "",
    ledger_type: "SUNDRY DEBTORS",
    account_type: "none",
    religion: "",
    customer_type_id: "",
    taxation_type_id: "",
    credit_type_id: "",
    category_type_id: "",
    branch_id: "",
    branch_name: ""
  });

  const destroyAddressAutocomplete = useCallback(() => {
    if (autocompleteRef.current && window.google?.maps?.event) {
      try {
        window.google.maps.event.clearInstanceListeners(autocompleteRef.current);
      } catch (error) {
        console.error('Error clearing autocomplete listeners:', error);
      }
      autocompleteRef.current = null;
    }
  }, []);

  const initAddressAutocomplete = useCallback(() => {
    if (!isCreateDialogOpen || !isGoogleScriptLoaded || !window.google?.maps?.places) {
      return false;
    }

    const inputElement = addressInputRef.current;
    if (!inputElement || inputElement.tagName !== 'INPUT') {
      return false;
    }

    if (autocompleteRef.current?.inputElement === inputElement) {
      return true;
    }

    destroyAddressAutocomplete();

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(
        inputElement,
        {
          types: ['geocode', 'establishment'],
          componentRestrictions: { country: 'in' },
          fields: ['address_components', 'formatted_address', 'geometry', 'name']
        }
      );

      autocomplete.inputElement = inputElement;
      autocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place || !place.address_components) {
          return;
        }

        let city = '';
        let state = '';
        let pincode = '';
        const address = place.formatted_address || place.name || '';

        place.address_components.forEach((component) => {
          const types = component.types;
          if (types.includes('postal_code')) {
            pincode = component.long_name;
          } else if (types.includes('locality')) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_2') && !city) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
          }
        });

        const lat = place.geometry?.location ? String(place.geometry.location.lat()) : '';
        const long = place.geometry?.location ? String(place.geometry.location.lng()) : '';

        setCustomerFormData((prev) => {
          const updated = {
            ...prev,
            address,
            city: city || prev.city,
            state: state || prev.state,
            pincode: pincode || prev.pincode,
            lat: lat || prev.lat,
            long: long || prev.long,
          };
          if (sameAsAddressCheckedRef.current) {
            return {
              ...updated,
              shipping_address: updated.address,
              shipping_city: updated.city,
              shipping_state: updated.state,
              shipping_pincode: updated.pincode,
              shipping_lat: updated.lat,
              shipping_long: updated.long,
            };
          }
          return updated;
        });

        setAddressErrors({ address: "", city: "", state: "", pincode: "" });
      });

      return true;
    } catch (error) {
      console.error('Error initializing Google Places Autocomplete:', error);
      toast({
        title: "Error",
        description: "Failed to initialize address autocomplete. Please refresh the page.",
        variant: "destructive"
      });
      return false;
    }
  }, [isCreateDialogOpen, isGoogleScriptLoaded, destroyAddressAutocomplete, toast]);

  const handleAddressInputRef = useCallback((node) => {
    addressInputRef.current = node;
    if (node && isCreateDialogOpen && isGoogleScriptLoaded) {
      initAddressAutocomplete();
    }
  }, [isCreateDialogOpen, isGoogleScriptLoaded, initAddressAutocomplete]);

  const destroyShippingAddressAutocomplete = useCallback(() => {
    if (shippingAutocompleteRef.current && window.google?.maps?.event) {
      try {
        window.google.maps.event.clearInstanceListeners(shippingAutocompleteRef.current);
      } catch (error) {
        console.error('Error clearing shipping autocomplete listeners:', error);
      }
      shippingAutocompleteRef.current = null;
    }
  }, []);

  const initShippingAddressAutocomplete = useCallback(() => {
    if (!isCreateDialogOpen || !isGoogleScriptLoaded || !window.google?.maps?.places) {
      return false;
    }

    if (sameAsAddressCheckedRef.current) {
      destroyShippingAddressAutocomplete();
      return false;
    }

    const inputElement = shippingAddressInputRef.current;
    if (!inputElement || inputElement.tagName !== 'INPUT') {
      return false;
    }

    if (shippingAutocompleteRef.current?.inputElement === inputElement) {
      return true;
    }

    destroyShippingAddressAutocomplete();

    try {
      const autocomplete = new window.google.maps.places.Autocomplete(
        inputElement,
        {
          types: ['geocode', 'establishment'],
          componentRestrictions: { country: 'in' },
          fields: ['address_components', 'formatted_address', 'geometry', 'name']
        }
      );

      autocomplete.inputElement = inputElement;
      shippingAutocompleteRef.current = autocomplete;

      autocomplete.addListener('place_changed', () => {
        const place = autocomplete.getPlace();
        if (!place || !place.address_components) {
          return;
        }

        let city = '';
        let state = '';
        let pincode = '';
        const address = place.formatted_address || place.name || '';

        place.address_components.forEach((component) => {
          const types = component.types;
          if (types.includes('postal_code')) {
            pincode = component.long_name;
          } else if (types.includes('locality')) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_2') && !city) {
            city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            state = component.long_name;
          }
        });

        const lat = place.geometry?.location ? String(place.geometry.location.lat()) : '';
        const long = place.geometry?.location ? String(place.geometry.location.lng()) : '';

        setCustomerFormData((prev) => ({
          ...prev,
          shipping_address: address,
          shipping_city: city || prev.shipping_city,
          shipping_state: state || prev.shipping_state,
          shipping_pincode: pincode || prev.shipping_pincode,
          shipping_lat: lat || prev.shipping_lat,
          shipping_long: long || prev.shipping_long,
        }));
      });

      return true;
    } catch (error) {
      console.error('Error initializing shipping address autocomplete:', error);
      toast({
        title: "Error",
        description: "Failed to initialize shipping address autocomplete. Please refresh the page.",
        variant: "destructive"
      });
      return false;
    }
  }, [isCreateDialogOpen, isGoogleScriptLoaded, destroyShippingAddressAutocomplete, toast]);

  const handleShippingAddressInputRef = useCallback((node) => {
    shippingAddressInputRef.current = node;
    if (node && isCreateDialogOpen && isGoogleScriptLoaded && !sameAsAddressCheckedRef.current) {
      initShippingAddressAutocomplete();
    }
  }, [isCreateDialogOpen, isGoogleScriptLoaded, initShippingAddressAutocomplete]);

  // Initialize Google Places Autocomplete when create/edit dialog opens (retry until input is mounted)
  useEffect(() => {
    if (!isCreateDialogOpen || !isGoogleScriptLoaded) {
      destroyAddressAutocomplete();
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retryTimer;

    const tryInit = () => {
      if (cancelled) return;
      if (initAddressAutocomplete()) return;
      if (attempts < 30) {
        attempts += 1;
        retryTimer = window.setTimeout(tryInit, 50);
      }
    };

    retryTimer = window.setTimeout(tryInit, 0);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      destroyAddressAutocomplete();
    };
  }, [isCreateDialogOpen, isGoogleScriptLoaded, initAddressAutocomplete, destroyAddressAutocomplete]);

  // Initialize shipping address autocomplete when dialog opens (skip when same as address)
  useEffect(() => {
    if (!isCreateDialogOpen || !isGoogleScriptLoaded || sameAsAddressChecked) {
      destroyShippingAddressAutocomplete();
      return;
    }

    let cancelled = false;
    let attempts = 0;
    let retryTimer;

    const tryInit = () => {
      if (cancelled) return;
      if (initShippingAddressAutocomplete()) return;
      if (attempts < 30) {
        attempts += 1;
        retryTimer = window.setTimeout(tryInit, 50);
      }
    };

    retryTimer = window.setTimeout(tryInit, 0);

    return () => {
      cancelled = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      destroyShippingAddressAutocomplete();
    };
  }, [isCreateDialogOpen, isGoogleScriptLoaded, sameAsAddressChecked, initShippingAddressAutocomplete, destroyShippingAddressAutocomplete]);

  const isPacContainerTarget = (target) => {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest('.pac-container'));
  };

  // Fetch branches (same API as branch-settings) for list filter + create/edit form
  const { data: branchesData = [], isLoading: branchesLoading } = useQuery({
    queryKey: ['branches'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-branches/`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && (isCreateDialogOpen || activeTab === "ledgers"),
  });

  const branchFilterOptions = useMemo(() => {
    return (branchesData || []).filter((b) => b?.name && String(b.name).trim() !== "");
  }, [branchesData]);

  const needsBusinessTypes =
    isCreateDialogOpen || activeTab === "business-types" || activeTab === "ledgers" || isMoreFiltersOpen;
  const needsCreditTypes =
    isCreateDialogOpen || activeTab === "credit-types" || activeTab === "ledgers" || isMoreFiltersOpen;
  const needsTaxationTypes = isCreateDialogOpen;
  const needsCategoryTypes = isCreateDialogOpen || isMoreFiltersOpen || activeTab === "ledgers";
  const needsReligions = isCreateDialogOpen || isMoreFiltersOpen || activeTab === "ledgers";
  const needsKycDocumentTypes = isCreateDialogOpen;

  const { data: areaGroupsData = [] } = useQuery({
    queryKey: ['ledger-area-groups-filter'],
    queryFn: async () => {
      const response = await apiRequest(
        'GET',
        `${API_BASE_URL}/api/report/get-ledger-area-groups/?is_active=true&page_size=1000`
      );
      const data = await response.json();
      return data.data || data.results || [];
    },
    enabled: !!AuthService.getAccessToken() && (isMoreFiltersOpen || activeTab === "ledgers"),
    refetchOnWindowFocus: false,
  });

  const { data: orgUsersData = [] } = useQuery({
    queryKey: ['org-users-for-ledger-filters'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/get-users/`);
      const data = await response.json();
      return data.data || data.users || [];
    },
    enabled: !!AuthService.getAccessToken() && (isMoreFiltersOpen || activeTab === "ledgers"),
    refetchOnWindowFocus: false,
  });

  // Fetch business types
  const { data: businessTypesData, isLoading: isLoadingBusinessTypes, refetch: refetchBusinessTypes } = useQuery({
    queryKey: ['business-types'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/accounts/business-types/?page_size=1000`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && needsBusinessTypes,
  });

  // Fetch credit types
  const { data: creditTypesData, isLoading: isLoadingCreditTypes, refetch: refetchCreditTypes } = useQuery({
    queryKey: ['credit-types'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/accounts/credit-types/?page_size=1000`);
      const data = await response.json();
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && needsCreditTypes,
  });

  // Fetch taxation types and category types from common listings
  const { data: commonListingsData } = useQuery({
    queryKey: ['common-listings', needsTaxationTypes, needsCategoryTypes],
    queryFn: async () => {
      const names = [];
      if (needsTaxationTypes) names.push('taxation_types');
      if (needsCategoryTypes) names.push('category_types');
      if (names.length === 0) return {};
      const response = await apiRequest('POST', `${API_BASE_URL}/api/growth/get-list/`, {
        names,
      });
      const data = await response.json();
      return data.data || {};
    },
    enabled: !!AuthService.getAccessToken() && (needsTaxationTypes || needsCategoryTypes),
  });

  const taxationTypes = commonListingsData?.taxation_types || [];
  const categoryTypes = commonListingsData?.category_types || [];

  const { data: religionsData = [] } = useQuery({
    queryKey: ['religions'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/user/religions/?page_size=1000`);
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || 'Failed to fetch religions');
      }
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && needsReligions,
    refetchOnWindowFocus: false,
  });

  const { data: kycDocumentTypesData = [] } = useQuery({
    queryKey: ['kyc-document-types'],
    queryFn: async () => {
      const response = await apiRequest('GET', `${API_BASE_URL}/api/user/kyc-document-types/?page_size=1000`);
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || 'Failed to fetch KYC document types');
      }
      return data.data || [];
    },
    enabled: !!AuthService.getAccessToken() && needsKycDocumentTypes,
    refetchOnWindowFocus: false,
  });

  const activeKycDocumentTypes = useMemo(
    () =>
      (kycDocumentTypesData || [])
        .map((item) => ({
          ...item,
          document_name: (item.document_name || item.name || "").trim(),
        }))
        .filter((item) => item.is_active !== false && item.document_name),
    [kycDocumentTypesData]
  );

  const religionOptions = useMemo(() => {
    const list = (religionsData || []).filter((item) => (item.religion || "").trim());
    const current = (customerFormData.religion || "").trim();
    if (current && !list.some((item) => item.religion === current)) {
      return [{ id: `legacy-${current}`, religion: current }, ...list];
    }
    return list;
  }, [religionsData, customerFormData.religion]);

  // When edit dialog opens and party detail is loaded, prefill form once per edit session.
  useEffect(() => {
    if (!isCreateDialogOpen || !editingCustomerId || !editPartyDetail) return;
    if (editFormTouchedRef.current) return;
    if (editPrefillDoneRef.current === editingCustomerId) return;

    const d = editPartyDetail;
    const detailId = d.basic_info?.id ?? d.id ?? null;
    if (detailId != null && String(detailId) !== String(editingCustomerId)) return;

    editPrefillDoneRef.current = editingCustomerId;

    const taxationTypeId = d.registration_tax_info?.taxation_type?.id
      ? String(d.registration_tax_info.taxation_type.id)
      : "";
    const registrationTypeName = d.registration_tax_info?.registration_type ?? "";
    const matchedTaxType = taxationTypes.find(
      (t) =>
        String(t.id) === taxationTypeId ||
        (t.type && registrationTypeName && t.type.toLowerCase() === registrationTypeName.toLowerCase())
    );
    const ledgerDisplayName = (d.basic_info?.firm_name || d.basic_info?.name || "").trim();
    const resolvedBranchId = resolvePartyBranchId(d, branchesData, editingLedgerEntryRef.current);
    setCustomerFormData({
      name: ledgerDisplayName,
      tally_name: d.basic_info?.tally_name ?? d.basic_info?.name ?? "",
      firm_name: ledgerDisplayName,
      alias_name: d.basic_info?.alias_name ?? "",
      parent: d.basic_info?.parent ?? "",
      email: d.basic_info?.email ?? "",
      owner_name: d.basic_info?.owner_name ?? "",
      registration_type: matchedTaxType?.type || registrationTypeName,
      gst_number: (d.registration_tax_info?.gst_number ?? "").toUpperCase(),
      pan_number: (d.registration_tax_info?.pan_number ?? "").toUpperCase(),
      religion: d.registration_tax_info?.religion ?? "",
      address: d.address_info?.address ?? "",
      landmark: d.address_info?.landmark ?? "",
      city: d.address_info?.city ?? "",
      state: d.address_info?.state ?? "",
      country: d.address_info?.country ?? "",
      pincode: d.address_info?.pincode ?? "",
      lat: d.address_info?.lat ?? "",
      long: d.address_info?.long ?? "",
      shipping_address: d.shipping_address_info?.shipping_address ?? "",
      shipping_city: d.shipping_address_info?.shipping_city ?? "",
      shipping_state: d.shipping_address_info?.shipping_state ?? "",
      shipping_pincode: d.shipping_address_info?.shipping_pincode ?? "",
      shipping_lat: d.shipping_address_info?.shipping_lat ?? "",
      shipping_long: d.shipping_address_info?.shipping_long ?? "",
      contact_person: d.contact_info?.contact_person ?? "",
      contact_number: d.contact_info?.contact_number ?? "",
      whatsapp_number: d.contact_info?.whatsapp_number ?? "",
      ledger_type: normalizeLedgerTypeValue(
        d.basic_info?.ledger_type ?? d.ledger_type,
        d.basic_info?.is_supplier ?? d.is_supplier
      ),
      account_type: normalizeAccountTypeValue(
        d.basic_info?.account_type ?? d.account_type
      ),
      customer_type_id: (() => {
        const businessTypeId = getPartyBusinessTypeId(d.classification_info);
        return businessTypeId != null ? String(businessTypeId) : "";
      })(),
      credit_type_id: d.classification_info?.credit_type?.id ? String(d.classification_info.credit_type.id) : "",
      category_type_id: d.classification_info?.category_type?.id ? String(d.classification_info.category_type.id) : "",
      taxation_type_id: matchedTaxType ? String(matchedTaxType.id) : taxationTypeId,
      branch_id: resolvedBranchId,
      branch_name: resolvePartyBranchName(
        d,
        branchesData,
        editingLedgerEntryRef.current,
        resolvedBranchId
      ),
    });
    if (!kycTouchedRef.current) {
      setKycDocuments((d.kyc_documents || []).map((doc) => {
        const existingFile =
          (typeof doc.file === "string" && doc.file.startsWith("http") ? doc.file : "") ||
          (typeof doc.file_url === "string" && doc.file_url.startsWith("http") ? doc.file_url : "") ||
          (Array.isArray(doc.files) ? doc.files.find((url) => typeof url === "string" && url.startsWith("http")) : "") ||
          "";
        return {
          id: doc.id,
          document_name: doc.document_name ?? "",
          document_number: doc.document_number ?? "",
          file: existingFile,
        };
      }));
    }
    if (!bankTouchedRef.current) {
      const incomingBanks = Array.isArray(d.bank_details) ? d.bank_details : [];
      setBankDetails(
        incomingBanks.map((row) => ({
          id: row.id ?? null,
          account_holder: row.account_holder ?? "",
          bank_name: row.bank_name ?? "",
          branch_name: row.branch_name ?? "",
          account_number: row.account_number ?? "",
          ifsc_code: row.ifsc_code ?? "",
          account_type: (row.account_type || "CURRENT").toUpperCase(),
          upi_id: row.upi_id ?? "",
          remarks: row.remarks ?? "",
          is_primary: Boolean(row.is_primary),
          is_active: row.is_active === false ? false : true,
        }))
      );
    }
  }, [isCreateDialogOpen, editingCustomerId, editPartyDetail, taxationTypes, branchesData]);

  // Resolve branch_id from branch_name once branches list is available (detail API often omits branch_id).
  useEffect(() => {
    if (!isCreateDialogOpen || !editingCustomerId || editFormTouchedRef.current) return;

    const resolvedBranchId = resolvePartyBranchId(
      editPartyDetail,
      branchesData,
      editingLedgerEntryRef.current
    );
    if (!resolvedBranchId) return;
    const resolvedBranchName = resolvePartyBranchName(
      editPartyDetail,
      branchesData,
      editingLedgerEntryRef.current,
      resolvedBranchId
    );

    setCustomerFormData((prev) => {
      if (editFormTouchedRef.current) return prev;
      if (prev.branch_id && prev.branch_name) return prev;
      return {
        ...prev,
        branch_id: prev.branch_id || resolvedBranchId,
        branch_name: prev.branch_name || resolvedBranchName,
      };
    });
  }, [isCreateDialogOpen, editingCustomerId, editPartyDetail, branchesData]);

  useEffect(() => {
    if (!isCreateDialogOpen) {
      editPrefillDoneRef.current = null;
      editFormTouchedRef.current = false;
      editingLedgerEntryRef.current = null;
      kycTouchedRef.current = false;
    }
  }, [isCreateDialogOpen]);

  const saveBusinessTypeMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/create-business-type/`, payload);
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || 'Failed to save business type');
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message || 'Business type saved' });
      queryClient.invalidateQueries({ queryKey: ['business-types'] });
      setIsBusinessTypeDialogOpen(false);
      setEditingBusinessTypeId(null);
      setBusinessTypeForm({ name: "", description: "", margin_percent: "" });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const saveCreditTypeMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest('POST', `${API_BASE_URL}/api/accounts/create-credit-type/`, payload);
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || 'Failed to save credit type');
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message || 'Credit type saved' });
      queryClient.invalidateQueries({ queryKey: ['credit-types'] });
      setIsCreditTypeDialogOpen(false);
      setEditingCreditTypeId(null);
      setCreditTypeForm({ name: "", description: "", margin_percent: "" });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteBusinessTypeMutation = useMutation({
    mutationFn: async (businessTypeId) => {
      const response = await apiRequest(
        'DELETE',
        `${API_BASE_URL}/api/accounts/delete-business-type/${businessTypeId}/`
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || 'Failed to delete business type');
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message || 'Business type deleted' });
      queryClient.invalidateQueries({ queryKey: ['business-types'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  const deleteCreditTypeMutation = useMutation({
    mutationFn: async (creditTypeId) => {
      const response = await apiRequest(
        'DELETE',
        `${API_BASE_URL}/api/accounts/delete-credit-type/${creditTypeId}/`
      );
      const data = await response.json();
      if (!response.ok || data.status !== 200) {
        throw new Error(data.message || 'Failed to delete credit type');
      }
      return data;
    },
    onSuccess: (data) => {
      toast({ title: 'Success', description: data.message || 'Credit type deleted' });
      queryClient.invalidateQueries({ queryKey: ['credit-types'] });
    },
    onError: (error) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Create / update customer via salesApp create_customer API
  const createCustomerMutation = useMutation({
    mutationFn: async (payload) => {
      const requestBody = JSON.stringify(payload);
      if (payload?.customer_id) {
        console.log("[Ledger Master Edit] fetch() body string:", requestBody);
      } else {
        console.log("[Ledger Master Create] fetch() body string:", requestBody);
      }

      const headers = {
        ...AuthService.getAuthHeaders(),
        "Content-Type": "application/json",
      };
      const response = await fetch(`${API_BASE_URL}/api/sales/create-customer/`, {
        method: "POST",
        headers,
        body: requestBody,
        credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      if (response.status === 401) {
        AuthService.clearAuthData();
        throw new Error("Session expired. Please sign in again.");
      }
      if (!response.ok) {
        const detail =
          result?.detail ||
          result?.message ||
          result?.update_status ||
          (result && typeof result === "object"
            ? Object.entries(result)
                .map(([key, value]) => {
                  if (Array.isArray(value)) return `${key}: ${value.join(", ")}`;
                  if (value && typeof value === "object") return `${key}: ${JSON.stringify(value)}`;
                  return `${key}: ${value}`;
                })
                .join("; ")
            : "Failed to save customer");
        throw new Error(detail || "Failed to save customer");
      }
      return result;
    },
    onSuccess: (data) => {
      if (data.status === 201 || data.status === 200) {
        const kycStatus = data.kyc_status;
        let description =
          data.update_status ||
          (data.status === 200 ? "Customer updated successfully" : "Customer created successfully");
        if (kycStatus?.created_documents?.length) {
          const savedCount = kycStatus.created_documents.length;
          const errorCount = kycStatus.errors?.length || 0;
          if (errorCount === 0) {
            description += ` ${savedCount} KYC document(s) saved.`;
          } else {
            description += ` KYC: ${savedCount} saved, ${errorCount} error(s).`;
          }
        } else if (kycStatus?.errors?.length) {
          description += ` KYC errors: ${kycStatus.errors.join("; ")}`;
        }
        const bankStatus = data.bank_status;
        if (bankStatus?.processed > 0) {
          description += ` ${bankStatus.processed} bank detail(s) saved.`;
        }
        if (bankStatus?.errors?.length) {
          description += ` Bank errors: ${bankStatus.errors.join("; ")}`;
        }
        toast({
          title: "Success",
          description,
        });
        queryClient.invalidateQueries([`${API_BASE_URL}/api/report/get-ledgers/`]);
        const savedCustomerId = data.cust_id || editingCustomerId;
        if (savedCustomerId) {
          queryClient.invalidateQueries({ queryKey: ['party-detail-edit', savedCustomerId] });
          queryClient.invalidateQueries({
            queryKey: [`${API_BASE_URL}/api/report/get-ledgers/`, savedCustomerId],
          });
        }
        setIsCreateDialogOpen(false);
        resetCustomerForm();
      } else {
        toast({
          title: "Error",
          description: data.update_status || data.detail || "Failed to save customer",
          variant: "destructive"
        });
      }
    },
    onError: (error) => {
      console.error('Create customer error:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to create customer. Please try again.",
        variant: "destructive"
      });
    }
  });

  const isSavingCustomer = createCustomerMutation.isPending;
  const isKycUploading = kycDocuments.some((doc) => doc.uploading);

  const openKycImageViewer = useCallback((url, title) => {
    if (!isKycImageFileUrl(url)) return;
    setSelectedKycImage({ url, title: title || "KYC Document" });
    setIsKycImageDialogOpen(true);
    setKycImageZoom(1);
    setKycImagePosition({ x: 0, y: 0 });
  }, []);

  const getKycDocumentTypeMeta = useCallback(
    (documentName) =>
      activeKycDocumentTypes.find(
        (item) =>
          (item.document_name || "").trim().toLowerCase() ===
          (documentName || "").trim().toLowerCase()
      ),
    [activeKycDocumentTypes]
  );

  const handleKycFileSelect = async (index, selectedFile) => {
    if (!selectedFile) return;

    kycTouchedRef.current = true;
    setKycDocuments((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], uploading: true, fileName: selectedFile.name };
      return next;
    });

    try {
      const url = await uploadMediaFile(selectedFile);
      setKycDocuments((prev) => {
        const next = [...prev];
        next[index] = {
          ...next[index],
          file: url,
          uploading: false,
          fileName: selectedFile.name,
        };
        return next;
      });
    } catch (error) {
      setKycDocuments((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], uploading: false };
        return next;
      });
      toast({
        title: "Upload failed",
        description: error.message || "Failed to upload KYC file",
        variant: "destructive",
      });
    }
  };

  const resetCustomerForm = () => {
    setEditingCustomerId(null);
    kycTouchedRef.current = false;
    bankTouchedRef.current = false;
    editFormTouchedRef.current = false;
    editPrefillDoneRef.current = null;
    editingLedgerEntryRef.current = null;
    setKycDocuments([]);
    setBankDetails([]);
    setCustomerFormData({
      name: "",
      tally_name: "",
      firm_name: "",
      alias_name: "",
      parent: "",
      email: "",
      registration_type: "",
      gst_number: "",
      pan_number: "",
      owner_name: "",
      address: "",
      landmark: "",
      shipping_address: "",
      state: "",
      shipping_state: "",
      city: "",
      shipping_city: "",
      country: "",
      pincode: "",
      shipping_pincode: "",
      lat: "",
      long: "",
      shipping_lat: "",
      shipping_long: "",
      contact_person: "",
      contact_number: "",
      whatsapp_number: "",
      ledger_type: "SUNDRY DEBTORS",
      account_type: "none",
      religion: "",
      customer_type_id: "",
      taxation_type_id: "",
      credit_type_id: "",
      category_type_id: "",
      branch_id: "",
      branch_name: ""
    });
    setAddressErrors({ address: "", city: "", state: "", pincode: "" });
    setGstNumberError("");
  };

  const handleClearAddress = () => {
    setCustomerFormData((prev) => {
      const cleared = {
        ...prev,
        address: "",
        city: "",
        state: "",
        pincode: "",
        lat: "",
        long: "",
      };
      if (sameAsAddressCheckedRef.current) {
        return {
          ...cleared,
          shipping_address: "",
          shipping_city: "",
          shipping_state: "",
          shipping_pincode: "",
          shipping_lat: "",
          shipping_long: "",
        };
      }
      return cleared;
    });
    setAddressErrors({ address: "", city: "", state: "", pincode: "" });
  };

  const handleClearShippingAddress = () => {
    setCustomerFormData((prev) => ({
      ...prev,
      shipping_address: "",
      shipping_city: "",
      shipping_state: "",
      shipping_pincode: "",
      shipping_lat: "",
      shipping_long: "",
    }));
  };

  const handleCustomerFormChange = (field, value) => {
    if (editingCustomerId) {
      editFormTouchedRef.current = true;
    }
    // Contact Number, WhatsApp Number, Pincode, Shipping Pincode: allow only digits (no letters or special characters)
    if (field === "contact_number" || field === "whatsapp_number" || field === "pincode" || field === "shipping_pincode") {
      value = String(value).replace(/\D/g, "");
    }
    if (field === "city" || field === "state" || field === "shipping_city" || field === "shipping_state") {
      value = String(value).replace(/[^A-Za-z ]/g, "");
    }
    if (field === "gst_number") {
      value = sanitizeGstinInput(value);
      const nextError = getGstinValidationError(value);
      setGstNumberError(nextError || "");
      if (value.length >= 12) {
        const panFromGstin = getPanFromGstin(value);
        if (panFromGstin) {
          setCustomerFormData((prev) => ({
            ...prev,
            gst_number: value,
            pan_number: panFromGstin,
          }));
          return;
        }
      }
    } else if (field === "pan_number") {
      value = String(value).toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10);
    }
    if (field === "firm_name") {
      setCustomerFormData((prev) => ({
        ...prev,
        firm_name: value,
        name: value,
      }));
      return;
    }
    if (field === "ledger_type") {
      value = normalizeLedgerTypeValue(value);
    }
    if (field === "account_type") {
      value = normalizeAccountTypeValue(value);
    }
    setCustomerFormData(prev => {
      const updated = {
        ...prev,
        [field]: value,
      };
      if (field === "gst_number") {
        const panFromGstin = getPanFromGstin(value);
        if (panFromGstin) {
          updated.pan_number = panFromGstin;
        }
      }
      return updated;
    });
    if (field === "address" || field === "city" || field === "state" || field === "pincode") {
      setAddressErrors((prev) => ({
        ...prev,
        [field]: "",
      }));
    }
  };

  const handleRegistrationTypeChange = (typeId) => {
    if (editingCustomerId) {
      editFormTouchedRef.current = true;
    }
    const selected = taxationTypes.find((t) => String(t.id) === String(typeId));
    setCustomerFormData((prev) => ({
      ...prev,
      taxation_type_id: typeId,
      registration_type: selected?.type || "",
    }));
  };

  const handleBranchSelect = (branch) => {
    const branchId = getBranchRecordId(branch);
    if (branchId == null) return;
    if (editingCustomerId) {
      editFormTouchedRef.current = true;
    }
    setCustomerFormData((prev) => ({
      ...prev,
      branch_id: String(branchId),
      branch_name: String(branch.name || "").trim(),
    }));
    setBranchOpen(false);
    setBranchSearch("");
  };

  const handleSaveBusinessType = () => {
    if (saveBusinessTypeMutation.isPending) return;
    if (!businessTypeForm.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (businessTypeForm.margin_percent === "" || Number.isNaN(Number(businessTypeForm.margin_percent))) {
      toast({ title: "Validation Error", description: "Valid margin percent is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: businessTypeForm.name.trim(),
      description: businessTypeForm.description.trim(),
      margin_percent: Number(businessTypeForm.margin_percent),
    };
    if (editingBusinessTypeId) payload.id = editingBusinessTypeId;
    saveBusinessTypeMutation.mutate(payload);
  };

  const openCreateLedgerGroupDialog = () => {
    setLedgerGroupForm({
      ...EMPTY_LEDGER_GROUP_FORM,
      parent: ledgerGroupParentOptions.includes("Primary")
        ? "Primary"
        : (ledgerGroupParentOptions[0] || "Primary"),
    });
    setIsCreateLedgerGroupDialogOpen(true);
  };

  const handleSaveLedgerGroup = () => {
    if (createLedgerGroupMutation.isPending) return;
    const name = ledgerGroupForm.name.trim();
    const parent = ledgerGroupForm.parent;
    if (!name) {
      toast({ title: "Validation Error", description: "Group name is required", variant: "destructive" });
      return;
    }
    if (!parent) {
      toast({ title: "Validation Error", description: "Parent is required", variant: "destructive" });
      return;
    }
    createLedgerGroupMutation.mutate({
      name,
      parent,
      is_active: !!ledgerGroupForm.is_active,
      is_live: !!ledgerGroupForm.is_live,
    });
  };

  const handleSaveCreditType = () => {
    if (saveCreditTypeMutation.isPending) return;
    if (!creditTypeForm.name.trim()) {
      toast({ title: "Validation Error", description: "Name is required", variant: "destructive" });
      return;
    }
    if (creditTypeForm.margin_percent === "" || Number.isNaN(Number(creditTypeForm.margin_percent))) {
      toast({ title: "Validation Error", description: "Valid margin percent is required", variant: "destructive" });
      return;
    }
    const payload = {
      name: creditTypeForm.name.trim(),
      description: creditTypeForm.description.trim(),
      margin_percent: Number(creditTypeForm.margin_percent),
    };
    if (editingCreditTypeId) payload.id = editingCreditTypeId;
    saveCreditTypeMutation.mutate(payload);
  };

  const openEditBusinessType = (item) => {
    setEditingBusinessTypeId(item.id);
    setBusinessTypeForm({
      name: item.name || "",
      description: item.description || "",
      margin_percent: item.margin_percent != null ? String(item.margin_percent) : "",
    });
    setIsBusinessTypeDialogOpen(true);
  };

  const openEditCreditType = (item) => {
    setEditingCreditTypeId(item.id);
    setCreditTypeForm({
      name: item.name || "",
      description: item.description || "",
      margin_percent: item.margin_percent != null ? String(item.margin_percent) : "",
    });
    setIsCreditTypeDialogOpen(true);
  };

  const handleDeleteBusinessType = (item) => {
    if (!item?.id) return;
    const confirmed = window.confirm(`Delete business type "${item.name}"?`);
    if (!confirmed) return;
    deleteBusinessTypeMutation.mutate(item.id);
  };

  const handleDeleteCreditType = (item) => {
    if (!item?.id) return;
    const confirmed = window.confirm(`Delete credit type "${item.name}"?`);
    if (!confirmed) return;
    deleteCreditTypeMutation.mutate(item.id);
  };

  const handleCopyAddressToShipping = (checked) => {
    setSameAsAddressChecked(!!checked);
    if (checked) {
      setCustomerFormData(prev => ({
        ...prev,
        shipping_address: prev.address,
        shipping_city: prev.city,
        shipping_state: prev.state,
        shipping_pincode: prev.pincode,
        shipping_lat: prev.lat,
        shipping_long: prev.long,
      }));
    } else {
      setCustomerFormData(prev => ({
        ...prev,
        shipping_address: "",
        shipping_city: "",
        shipping_state: "",
        shipping_pincode: "",
        shipping_lat: "",
        shipping_long: "",
      }));
    }
  };

  const handleCreateCustomer = () => {
    if (isSavingCustomer || isKycUploading) return;

    const firmNameInput = (customerFormData.firm_name || "").trim();

    if (!firmNameInput) {
      toast({
        title: "Validation Error",
        description: "Firm Name is required",
        variant: "destructive"
      });
      return;
    }

    if (
      !customerFormData.taxation_type_id &&
      !(customerFormData.registration_type || "").trim()
    ) {
      toast({
        title: "Validation Error",
        description: "Registration Type is required",
        variant: "destructive",
      });
      return;
    }

    const gstNumber = String(customerFormData.gst_number || "").trim().toUpperCase();
    if (gstNumber && !isValidGstin(gstNumber)) {
      setGstNumberError(GST_NUMBER_ERROR_TEXT);
      return;
    }
    setGstNumberError("");

    if (kycDocuments.some((doc) => doc.uploading)) {
      toast({
        title: "Please wait",
        description: "KYC file upload is still in progress",
        variant: "destructive",
      });
      return;
    }

    const selectedTaxType = taxationTypes.find(
      (t) => String(t.id) === String(customerFormData.taxation_type_id)
    );
    const registrationTypeValue =
      selectedTaxType?.type || customerFormData.registration_type || null;

    const ownerName = (customerFormData.owner_name || "").trim();
    const aliasName = (customerFormData.alias_name || "").trim();

    const getKycFileUrl = (doc) =>
      (
        typeof doc.file === "string"
          ? doc.file
          : typeof doc.file_url === "string"
            ? doc.file_url
            : ""
      ).trim();

    const isValidKycFileUrl = (url) => url.startsWith("http://") || url.startsWith("https://");

    const buildKycPayload = () =>
      kycDocuments
      .filter((d) => (d.document_name || "").trim() !== "")
      .map((d) => {
          const docName = (d.document_name || d.name || "").trim();
          const typeMeta = getKycDocumentTypeMeta(docName);
          const item = { document_name: docName };
          const docNumber = (d.document_number || "").trim();
          if (docNumber && typeMeta?.is_required !== false) {
            item.document_number = docNumber;
          }
          const fileUrl = getKycFileUrl(d);
          if (isValidKycFileUrl(fileUrl)) {
            item.file = fileUrl;
        }
        return item;
        });

    // Build kyc_documents: API expects document_name, document_number, and file (uploaded URL)
    const incompleteKycDoc = kycDocuments.find((d) => {
      const hasAnyValue =
        (d.document_name || "").trim() !== "" ||
        (d.document_number || "").trim() !== "" ||
        getKycFileUrl(d) !== "";
      return hasAnyValue && (d.document_name || "").trim() === "";
    });
    if (incompleteKycDoc) {
      toast({
        title: "Validation Error",
        description: "Please select document type for all added KYC entries.",
        variant: "destructive",
      });
      return;
    }

    const invalidKycDoc = kycDocuments.find((d) => {
      const docName = (d.document_name || "").trim();
      if (!docName) return false;

      const typeMeta = getKycDocumentTypeMeta(docName);
      const docNumber = (d.document_number || "").trim();
      const fileUrl = getKycFileUrl(d);
      const hasFile = isValidKycFileUrl(fileUrl);

      if (typeMeta?.is_required === false) {
        return !hasFile;
      }

      if (typeMeta?.is_required === true) {
        return !docNumber;
      }

      return !docNumber && !hasFile;
    });

    if (invalidKycDoc) {
      const typeMeta = getKycDocumentTypeMeta(invalidKycDoc.document_name);
      const description =
        typeMeta?.is_required === false
          ? `Please upload an image for ${invalidKycDoc.document_name}.`
          : typeMeta?.is_required === true
            ? `Please enter document number for ${invalidKycDoc.document_name}.`
            : `Please provide document number or file for ${invalidKycDoc.document_name}.`;
      toast({
        title: "Validation Error",
        description,
        variant: "destructive",
      });
      return;
    }

    const kycPayload = buildKycPayload();
    const hasPendingKycInput = kycDocuments.some((d) => {
      const hasFile =
        (typeof d.file === "string" && d.file.trim() !== "") ||
        (typeof d.file_url === "string" && d.file_url.trim() !== "");
      return hasFile || (d.document_number || "").trim() !== "" || (d.document_name || "").trim() !== "";
    });

    if (hasPendingKycInput && kycPayload.length === 0) {
      toast({
        title: "Validation Error",
        description: "Please select document type for all KYC entries before saving.",
        variant: "destructive",
      });
      return;
    }

    const resolvedBranchId = parseOptionalBranchId(customerFormData.branch_id);
    const selectedBranch = (branchesData || []).find(
      (branch) => String(getBranchRecordId(branch)) === String(customerFormData.branch_id)
    );
    const selectedBranchName =
      String(selectedBranch?.name || customerFormData.branch_name || "").trim();

    const bankPayloadPreview = buildBankDetailsPayload(bankDetails);

    const apiPayload = buildCreateCustomerApiPayload({
      form: customerFormData,
      firmName: firmNameInput,
      ownerName,
      aliasName,
      registrationType: registrationTypeValue,
      customerId: editingCustomerId,
      branchId: resolvedBranchId,
      branchName: selectedBranchName,
      kycDocuments: kycPayload,
      bankDetails,
    });

    if (editingCustomerId) {
      console.group("[Ledger Master Edit] Submit — data sent to backend");
      console.log("Method:", "POST");
      console.log("URL:", `${API_BASE_URL}/api/sales/create-customer/`);
      console.log("Customer ID:", editingCustomerId);
      console.log("Form values (after your changes):", { ...customerFormData });
      console.log("KYC documents payload:", kycPayload);
      console.log("Bank details payload:", bankPayloadPreview);
      console.log("Request body (object):", apiPayload);
      console.log("Request body (JSON):", JSON.stringify(apiPayload, null, 2));
      console.groupEnd();
    }

    createCustomerMutation.mutate(apiPayload);
  };

  const updateBankDetailRow = (index, field, value) => {
    bankTouchedRef.current = true;
    setBankDetails((prev) => {
      const next = [...prev];
      const row = { ...next[index], [field]: value };
      if (field === "is_primary" && value) {
        return next.map((item, i) => ({
          ...item,
          is_primary: i === index,
        }));
      }
      next[index] = row;
      return next;
    });
  };

  const addBankDetailRow = () => {
    bankTouchedRef.current = true;
    setBankDetails((prev) => [
      ...prev,
      {
        ...emptyBankDetailRow(),
        is_primary: prev.length === 0,
      },
    ]);
  };

  const removeBankDetailRow = (index) => {
    bankTouchedRef.current = true;
    setBankDetails((prev) => {
      const next = prev.filter((_, i) => i !== index);
      if (next.length > 0 && !next.some((row) => row.is_primary)) {
        next[0] = { ...next[0], is_primary: true };
      }
      return next;
    });
  };

  const handleViewDetails = (entry) => {
    setSelectedEntry(entry);
    setIsDetailModalOpen(true);
  };

  const clearAllFilters = () => {
    setSearchInput("");
    setDebouncedSearch("");
    setSelectedParent(null);
    setSelectedIsSupplier(null);
    setSelectedIsActive("all");
    setSelectedIsTallySync(null);
    setSelectedPendingField(null);
    setSelectedBranchFilter(null);
    setBranchFilterSearch("");
    setSelectedAreaGroupIds([]);
    setSelectedCreatedByIds([]);
    setSelectedBusinessTypeIds([]);
    setSelectedCreditTypeIds([]);
    setSelectedCategoryTypeIds([]);
    setSelectedReligions([]);
    setSelectedWeekOffs([]);
    setMoreFiltersDraft({ ...emptyMoreFiltersDraft });
    setCurrentPage(1);
    refetch();
  };

  const openMoreFilters = () => {
    setMoreFiltersDraft({
      parent: selectedParent,
      branchFilter: selectedBranchFilter,
      isActive: selectedIsActive || "all",
      areaGroupIds: [...selectedAreaGroupIds],
      ledgerType: selectedIsSupplier,
      createdByIds: [...selectedCreatedByIds],
      businessTypeIds: [...selectedBusinessTypeIds],
      creditTypeIds: [...selectedCreditTypeIds],
      categoryTypeIds: [...selectedCategoryTypeIds],
      religions: [...selectedReligions],
      weekOffs: [...selectedWeekOffs],
    });
    setIsMoreFiltersOpen(true);
  };

  const clearMoreFiltersDraft = () => {
    setMoreFiltersDraft({ ...emptyMoreFiltersDraft });
  };

  const applyMoreFilters = () => {
    setSelectedParent(moreFiltersDraft.parent || null);
    setSelectedBranchFilter(moreFiltersDraft.branchFilter || null);
    setSelectedIsActive(moreFiltersDraft.isActive || "all");
    setSelectedAreaGroupIds([...(moreFiltersDraft.areaGroupIds || [])]);
    setSelectedIsSupplier(moreFiltersDraft.ledgerType || null);
    setSelectedCreatedByIds([...(moreFiltersDraft.createdByIds || [])]);
    setSelectedBusinessTypeIds([...(moreFiltersDraft.businessTypeIds || [])]);
    setSelectedCreditTypeIds([...(moreFiltersDraft.creditTypeIds || [])]);
    setSelectedCategoryTypeIds([...(moreFiltersDraft.categoryTypeIds || [])]);
    setSelectedReligions([...(moreFiltersDraft.religions || [])]);
    setSelectedWeekOffs([...(moreFiltersDraft.weekOffs || [])]);
    setCurrentPage(1);
    setIsMoreFiltersOpen(false);
  };

  const moreFiltersActiveCount = [
    selectedParent,
    selectedBranchFilter,
    selectedIsActive !== "all" ? selectedIsActive : null,
    selectedIsSupplier,
    selectedAreaGroupIds.length ? selectedAreaGroupIds : null,
    selectedCreatedByIds.length ? selectedCreatedByIds : null,
    selectedBusinessTypeIds.length ? selectedBusinessTypeIds : null,
    selectedCreditTypeIds.length ? selectedCreditTypeIds : null,
    selectedCategoryTypeIds.length ? selectedCategoryTypeIds : null,
    selectedReligions.length ? selectedReligions : null,
    selectedWeekOffs.length ? selectedWeekOffs : null,
  ].filter(Boolean).length;

  const toggleMultiValue = (list, value) => {
    if (list.includes(value)) {
      return list.filter((item) => item !== value);
    }
    return [...list, value];
  };

  const handleBranchFilterSelect = (branch) => {
    setSelectedBranchFilter(branch);
    setBranchFilterDropdownOpen(false);
    setBranchFilterSearch("");
    setCurrentPage(1);
  };

  const handlePendingFieldSelect = (value) => {
    setSelectedPendingField(value === "all" ? null : value);
    setCurrentPage(1);
  };

  const togglePendingFieldFilter = (fieldKey) => {
    setSelectedPendingField((current) => (current === fieldKey ? null : fieldKey));
    setCurrentPage(1);
  };

  const handlePageChange = (page) => {
    if (page < 1 || page > pagination.total_pages) return;
    setCurrentPage(page);
  };

  const handleStatusChange = (item, status) => {
    setSelectedItem(item);
    setNewStatus(status);
    setIsStatusModalOpen(true);
  };

  const handleStatusSubmit = () => {
    console.log("Status updated:", {
      item: selectedItem,
      status: newStatus,
      supervisor: selectedSupervisor,
      godown: selectedGodown,
      reason: rejectionReason
    });

    setIsStatusModalOpen(false);
    setSelectedItem(null);
    setNewStatus("");
    setSelectedSupervisor("");
    setSelectedGodown("");
    setRejectionReason("");
  };

  const getStatusBadgeVariant = (isActive) => {
    return isActive ? 'default' : 'secondary';
  };

  const getStatusIcon = (isActive) => {
    return isActive ? <CheckCircle className="w-4 h-4" /> : <XCircle className="w-4 h-4" />;
  };

  // Pagination helper
  const getPageNumbers = (current, total) => {
    const delta = 2; // pages before and after current
    const range = [];
    const rangeWithDots = [];
    let l;

    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }

    for (let i of range) {
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

  return (
    <div className="app-layout bg-gray-50">
      {!isMobile && <Sidebar />}
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="app-main-content">
        <header className="app-header bg-white shadow-sm border-b border-gray-200 px-3 py-2.5 sm:px-4">
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
              <div className="flex items-center space-x-2">
                <User className="h-4 w-4 text-gray-600" />
                <h1 className="text-lg font-bold text-gray-900 leading-tight">Ledgers Masters</h1>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Button
                onClick={handleGenerateExcel}
                disabled={isGeneratingExcel || isLoading}
                title="Generate Excel with current filters applied"
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {isGeneratingExcel ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4 mr-2" />
                )}
                {isGeneratingExcel ? 'Generating...' : 'Generate Excel'}
              </Button>
              {hasPermission("customer_management", "create") && activeTab === "ledgers" && (
                <Button
                  onClick={() => {
                    resetCustomerForm();
                    setIsCreateDialogOpen(true);
                  }}
                  className="bg-black hover:bg-gray-900 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Ledger
                </Button>
              )}
              {activeTab === "groups" && (
                <Button
                  onClick={openCreateLedgerGroupDialog}
                  className="bg-black hover:bg-gray-900 text-white"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Group
                </Button>
              )}
              {isLoading && <Loader2 className="h-4 w-4 animate-spin text-gray-600" />}
            </div>
          </div>
        </header>

        <main className="app-main-scrollable p-2.5 sm:p-3">
          <div className="max-w-7xl mx-auto">
            <div className="space-y-3">
              {/* Tabs for Split Screen */}
              <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
                <TabsList className="grid w-full max-w-3xl grid-cols-2 lg:grid-cols-4">
                  <TabsTrigger value="ledgers">Ledgers Master</TabsTrigger>
                  <TabsTrigger value="groups">Ledgers Groups</TabsTrigger>
                  <TabsTrigger value="business-types">Business Types</TabsTrigger>
                  <TabsTrigger value="credit-types">Credit Types</TabsTrigger>
                </TabsList>

                {/* Ledgers Master Tab */}
                <TabsContent value="ledgers" className="space-y-3 mt-4">
                  {/* Filters — single compact row */}
                  <Card>
                    <CardContent className="py-2.5 px-3">
                      <div className="flex flex-nowrap items-center gap-2 overflow-x-auto">
                        <div className="relative flex-1 min-w-[180px]">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 w-3.5 h-3.5" />
                          <Input
                            placeholder="Search ledgers..."
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            className="pl-8 h-8 text-sm"
                          />
                        </div>

                        {isTallyEnabled && (
                          <Select
                            value={selectedIsTallySync || "all"}
                            onValueChange={(value) => {
                              setSelectedIsTallySync(value === "all" ? null : value);
                              setCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-8 w-[130px] shrink-0 text-sm">
                              <SelectValue placeholder="Tally Sync" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">Tally: All</SelectItem>
                              <SelectItem value="true">Synced</SelectItem>
                              <SelectItem value="false">Not Synced</SelectItem>
                            </SelectContent>
                          </Select>
                        )}

                        <Select
                          value={selectedPendingField || "all"}
                          onValueChange={handlePendingFieldSelect}
                        >
                          <SelectTrigger className="h-8 w-[160px] shrink-0 text-sm">
                            <SelectValue placeholder="Pending field" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">All fields</SelectItem>
                            {PARTY_PROFILE_PENDING_FIELDS.map((field) => (
                              <SelectItem key={field.value} value={field.value}>
                                {field.label}
                                {profileSummary ? ` (${profileSummary[field.value] ?? 0})` : ""}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        <Button
                          type="button"
                          variant="outline"
                          onClick={openMoreFilters}
                          className="h-8 shrink-0 border-gray-300 px-2.5"
                        >
                          <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />
                          More filters
                          {moreFiltersActiveCount > 0 && (
                            <Badge className="ml-1.5 h-5 min-w-5 px-1 text-[10px]">
                              {moreFiltersActiveCount}
                            </Badge>
                          )}
                        </Button>

                        <Button
                          type="button"
                          variant="ghost"
                          onClick={clearAllFilters}
                          title="Clear filters"
                          aria-label="Clear filters"
                          className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                        >
                          <FilterX className="h-4 w-4" />
                        </Button>
                      </div>

                      {profileSummary && (
                        <div className="mt-2.5 pt-2.5 border-t border-gray-100">
                          <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                            <span className="text-xs font-medium text-gray-600">Profile pending summary</span>
                            <span className="text-[11px] text-gray-500">
                              Total ledgers: {profileSummary.total_entries ?? 0}
                            </span>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {PARTY_PROFILE_PENDING_FIELDS.map((field) => {
                              const count = profileSummary[field.value] ?? 0;
                              const isActive = selectedPendingField === field.value;
                              return (
                                <button
                                  key={field.value}
                                  type="button"
                                  onClick={() => togglePendingFieldFilter(field.value)}
                                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium transition-colors ${
                                    isActive
                                      ? "border-orange-500 bg-orange-50 text-orange-800"
                                      : "border-gray-200 bg-white text-gray-700 hover:border-orange-300 hover:bg-orange-50/60"
                                  }`}
                                  title={`Filter ledgers with empty ${field.label}`}
                                >
                                  {field.label}: {count}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Active Filters Display */}
                      {(selectedParent || selectedBranchFilter || selectedIsSupplier !== null || selectedIsActive !== "all" || selectedIsTallySync !== null || selectedPendingField || selectedAreaGroupIds.length > 0 || selectedCreatedByIds.length > 0 || selectedBusinessTypeIds.length > 0 || selectedCreditTypeIds.length > 0 || selectedCategoryTypeIds.length > 0 || selectedReligions.length > 0 || selectedWeekOffs.length > 0) && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm text-gray-600">Active filters:</span>
                            {selectedParent && (
                              <Badge variant="outline" className="text-xs">
                                Parent: {selectedParent}
                              </Badge>
                            )}
                            {selectedBranchFilter && (
                              <Badge variant="outline" className="text-xs">
                                Branch: {selectedBranchFilter.name}
                              </Badge>
                            )}
                            {selectedIsSupplier !== null && (
                              <Badge variant="outline" className="text-xs">
                                Ledger Type: {formatLedgerTypeLabel(selectedIsSupplier)}
                              </Badge>
                            )}
                            {selectedIsActive !== "all" && (
                              <Badge variant="outline" className="text-xs">
                                Status: {selectedIsActive === "inactive" ? "Inactive" : "Active"}
                              </Badge>
                            )}
                            {selectedIsTallySync !== null && (
                              <Badge variant="outline" className="text-xs">
                                Tally Sync: {selectedIsTallySync === "true" ? "Synced" : "Not Synced"}
                              </Badge>
                            )}
                            {selectedPendingField && (
                              <Badge variant="outline" className="text-xs border-orange-300 text-orange-800 bg-orange-50">
                                Pending: {getPendingFieldLabel(selectedPendingField)}
                              </Badge>
                            )}
                            {selectedAreaGroupIds.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Area groups: {selectedAreaGroupIds.length}
                              </Badge>
                            )}
                            {selectedCreatedByIds.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Created by: {selectedCreatedByIds.length}
                              </Badge>
                            )}
                            {selectedBusinessTypeIds.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Business types: {selectedBusinessTypeIds.length}
                              </Badge>
                            )}
                            {selectedCreditTypeIds.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Credit types: {selectedCreditTypeIds.length}
                              </Badge>
                            )}
                            {selectedCategoryTypeIds.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Category types: {selectedCategoryTypeIds.length}
                              </Badge>
                            )}
                            {selectedReligions.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Religions: {selectedReligions.length}
                              </Badge>
                            )}
                            {selectedWeekOffs.length > 0 && (
                              <Badge variant="outline" className="text-xs">
                                Week offs: {selectedWeekOffs.join(", ")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Ledger Entries List */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                        <CardTitle>Ledger Masters ({pagination.total_count})</CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleSelectAllLedgersOnPage}
                            disabled={ledgerEntries.length === 0}
                          >
                            Select all (page)
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={handleClearLedgerSelection}
                            disabled={selectedLedgerIds.length === 0}
                          >
                            Clear selection
                          </Button>
                          {selectedLedgerIds.length > 0 && (
                            <>
                              <span className="text-sm text-muted-foreground px-1">
                                {selectedLedgerIds.length} selected
                              </span>
                              <Button
                                variant="default"
                                size="sm"
                                onClick={handleBulkActivateLedgers}
                                disabled={bulkUpdateLedgersActiveStatusMutation.isPending}
                              >
                                {bulkUpdateLedgersActiveStatusMutation.isPending ? (
                                  <Loader2 className="w-4 h-4 animate-spin mr-1" />
                                ) : (
                                  <CheckCircle className="w-4 h-4 mr-1" />
                                )}
                                Activate
                              </Button>
                              <Button
                                variant="secondary"
                                size="sm"
                                onClick={handleBulkDeactivateLedgers}
                                disabled={bulkUpdateLedgersActiveStatusMutation.isPending}
                              >
                                <XCircle className="w-4 h-4 mr-1" />
                                Deactivate
                              </Button>
                            </>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="px-0 sm:px-2">
                      <div className="overflow-x-auto">
                        <Table className="min-w-[1100px]">
                          <TableHeader>
                            <TableRow className="hover:bg-transparent border-b">
                              <TableHead className="w-10 px-2 py-2">
                                <Checkbox
                                  checked={
                                    areAllLedgersOnPageSelected
                                      ? true
                                      : areSomeLedgersOnPageSelected
                                        ? "indeterminate"
                                        : false
                                  }
                                  onCheckedChange={(checked) => {
                                    if (checked) handleSelectAllLedgersOnPage();
                                    else {
                                      const pageIds = new Set(ledgerEntries.map((e) => e.id));
                                      setSelectedLedgerIds((prev) =>
                                        prev.filter((id) => !pageIds.has(id))
                                      );
                                    }
                                  }}
                                  aria-label="Select all ledgers on page"
                                />
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Ledger
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Type
                              </TableHead>
                              {isTallyEnabled && (
                                <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                  Tally
                                </TableHead>
                              )}
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Status
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                Created
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Parent
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                Reg. Type
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                                Contact
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                State / City
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap">
                                Created By / Updated By
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground text-center">
                                Co
                              </TableHead>
                              <TableHead className="px-2 py-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground w-10 text-right">
                                Actions
                              </TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {ledgerEntries.map((entry) => (
                              <TableRow
                                key={entry.id}
                                className="hover:bg-muted/40 border-b border-gray-100"
                              >
                                <TableCell className="px-2 py-2 align-middle">
                                  <Checkbox
                                    checked={selectedLedgerIds.includes(entry.id)}
                                    onCheckedChange={(checked) =>
                                      handleLedgerSelect(entry.id, checked === true)
                                    }
                                    aria-label={`Select ledger ${entry.name}`}
                                  />
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle max-w-[200px]">
                                  <div className="min-w-0">
                                    <p className="text-sm font-semibold text-foreground truncate leading-tight">
                                      {entry.name || "-"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                                      {entry.branch_name || "—"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle">
                                  <div className="flex flex-col gap-0.5">
                                    <Badge
                                      variant="outline"
                                      className="w-fit text-[10px] px-1.5 py-0 h-5 font-medium gap-0.5"
                                    >
                                      <User className="h-2.5 w-2.5" />
                                      {formatLedgerTypeLabel(entry.ledger_type, entry.is_supplier)}
                                    </Badge>
                                    <span className="text-[10px] text-muted-foreground pl-0.5">
                                      {formatAccountTypeLabel(entry.account_type)}
                                    </span>
                                  </div>
                                </TableCell>
                                {isTallyEnabled && (
                                  <TableCell className="px-2 py-2 align-middle">
                                    <Badge
                                      variant="outline"
                                      className={`w-fit text-[10px] px-1.5 py-0 h-5 gap-0.5 ${
                                        entry.is_tally_sync
                                          ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                          : "border-amber-300 text-amber-700 bg-amber-50"
                                      }`}
                                    >
                                      {entry.is_tally_sync ? (
                                        <>
                                          <CheckCircle2 className="h-2.5 w-2.5" />
                                          Synced
                                        </>
                                      ) : (
                                        <>
                                          <Clock className="h-2.5 w-2.5" />
                                          Not Synced
                                        </>
                                      )}
                                    </Badge>
                                  </TableCell>
                                )}
                                <TableCell className="px-2 py-2 align-middle">
                                  <Badge
                                    variant="outline"
                                    className={`w-fit text-[10px] px-1.5 py-0 h-5 gap-0.5 ${
                                      entry.is_active
                                        ? "border-emerald-300 text-emerald-700 bg-emerald-50"
                                        : "border-gray-300 text-gray-600 bg-gray-50"
                                    }`}
                                  >
                                    {entry.is_active ? (
                                      <CheckCircle className="h-2.5 w-2.5" />
                                    ) : (
                                      <XCircle className="h-2.5 w-2.5" />
                                    )}
                                    {entry.is_active ? "Active" : "Inactive"}
                                  </Badge>
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle text-xs text-muted-foreground whitespace-nowrap">
                                  {entry.created_at || "—"}
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle text-xs max-w-[140px]">
                                  <span className="truncate block" title={entry.parent || ""}>
                                    {entry.parent || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle text-xs max-w-[110px]">
                                  <span className="truncate block" title={entry.registration_type || ""}>
                                    {entry.registration_type || "—"}
                                  </span>
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle text-xs tabular-nums whitespace-nowrap">
                                  {entry.contact_number || "—"}
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle max-w-[130px]">
                                  <div className="min-w-0">
                                    <p className="text-xs truncate leading-tight">
                                      {entry.state || "—"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate leading-tight">
                                      {entry.city || "—"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle max-w-[140px]">
                                  <div className="min-w-0">
                                    <p className="text-xs truncate leading-tight">
                                      {entry.created_by || "—"}
                                    </p>
                                    <p className="text-[11px] text-muted-foreground truncate leading-tight">
                                      {entry.updated_by || "—"}
                                    </p>
                                  </div>
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle text-center">
                                  <CompleteStatusBadge value={entry.complete_status} compact />
                                </TableCell>
                                <TableCell className="px-2 py-2 align-middle text-right">
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0"
                                        aria-label={`Actions for ${entry.name}`}
                                      >
                                        <MoreVertical className="h-4 w-4" />
                                      </Button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="end" className="w-44">
                                      <DropdownMenuItem
                                        onClick={() => handleViewDetails(entry)}
                                      >
                                        <Eye className="h-4 w-4 mr-2" />
                                        View details
                                      </DropdownMenuItem>
                                      {hasPermission("customer_management", "update") && (
                                        <DropdownMenuItem
                                          onClick={() => {
                                            editPrefillDoneRef.current = null;
                                            editFormTouchedRef.current = false;
                                            editingLedgerEntryRef.current = entry;
                                            setEditingCustomerId(entry.id);
                                            setIsCreateDialogOpen(true);
                                          }}
                                        >
                                          <Edit className="h-4 w-4 mr-2" />
                                          Edit ledger
                                        </DropdownMenuItem>
                                      )}
                                      {isTallyEnabled &&
                                        !entry.is_tally_sync &&
                                        hasPermission("customer_management", "update") && (
                                          <>
                                            <DropdownMenuSeparator />
                                            <DropdownMenuItem
                                              disabled={
                                                syncLedgerToTallyMutation.isPending &&
                                                syncLedgerToTallyMutation.variables === entry.id
                                              }
                                              onClick={() =>
                                                syncLedgerToTallyMutation.mutate(entry.id)
                                              }
                                            >
                                              {syncLedgerToTallyMutation.isPending &&
                                              syncLedgerToTallyMutation.variables === entry.id ? (
                                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                              ) : (
                                                <RefreshCw className="h-4 w-4 mr-2" />
                                              )}
                                              Sync to Tally
                                            </DropdownMenuItem>
                                          </>
                                        )}
                                    </DropdownMenuContent>
                                  </DropdownMenu>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>

                        {ledgerEntries.length === 0 && (
                          <div className="text-center py-8 text-gray-500">
                            <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                            <p>No ledger entries found matching your criteria.</p>
                          </div>
                        )}
                      </div>

                      {/* Pagination */}
                      {pagination.total_pages > 1 && (
                        <div className="flex items-center justify-between mt-6">
                          <div className="text-sm text-gray-500">
                            Showing {((pagination.current_page - 1) * (pagination.per_page || PAGE_SIZE)) + 1} to {Math.min(pagination.current_page * (pagination.per_page || PAGE_SIZE), pagination.total_count)} of {pagination.total_count} entries
                          </div>
                          <div className="flex items-center space-x-2">
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
                                <span key={`ellipsis-${idx}-${pagination.current_page}`} className="px-2">...</span>
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
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Ledgers Groups Tab */}
                <TabsContent value="groups" className="space-y-3 mt-3">
                  {/* Search Filter */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Filters</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap items-end gap-4">
                        {/* Search */}
                        <div className="min-w-[200px] flex-1 sm:max-w-md">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Search className="h-4 w-4 text-gray-600" />
                            Search
                          </Label>
                          <div className="relative mt-2">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                            <Input
                              placeholder="Search by name or parent..."
                              value={ledgerGroupsSearchInput}
                              onChange={(e) => setLedgerGroupsSearchInput(e.target.value)}
                              className="pl-12 h-9"
                            />
                          </div>
                        </div>

                        {/* Active Filter */}
                        <div className="w-full sm:w-auto sm:min-w-[140px]">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Filter className="h-4 w-4 text-gray-600" />
                            Active Status
                          </Label>
                          <Select
                            value={ledgerGroupsActiveFilter}
                            onValueChange={(value) => {
                              setLedgerGroupsActiveFilter(value);
                              setLedgerGroupsCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-9 mt-2">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="active">Active</SelectItem>
                              <SelectItem value="inactive">Inactive</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Live Filter */}
                        <div className="w-full sm:w-auto sm:min-w-[140px]">
                          <Label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center gap-2">
                            <Filter className="h-4 w-4 text-gray-600" />
                            Live Status
                          </Label>
                          <Select
                            value={ledgerGroupsLiveFilter}
                            onValueChange={(value) => {
                              setLedgerGroupsLiveFilter(value);
                              setLedgerGroupsCurrentPage(1);
                            }}
                          >
                            <SelectTrigger className="h-9 mt-2">
                              <SelectValue placeholder="Select status" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All</SelectItem>
                              <SelectItem value="live">Live</SelectItem>
                              <SelectItem value="not_live">Not Live</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        {/* Clear Filters Button */}
                        <Button
                          variant="outline"
                          onClick={() => {
                            setLedgerGroupsSearchInput("");
                            setDebouncedLedgerGroupsSearch("");
                            setLedgerGroupsActiveFilter("all");
                            setLedgerGroupsLiveFilter("all");
                            setLedgerGroupsCurrentPage(1);
                          }}
                          className="h-9 shrink-0 border-gray-300 hover:border-red-300 hover:text-red-600 hover:bg-red-50"
                        >
                          Clear All Filters
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Ledger Groups List */}
                  <Card>
                    <CardHeader>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <CardTitle className="flex items-center gap-2">
                          <Users className="h-5 w-5" />
                          Ledgers Groups ({ledgerGroupsPagination.total_count})
                        </CardTitle>
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedLedgerGroupIds.length > 0 && (
                            <>
                              <Badge variant="secondary" className="h-9 px-3 flex items-center">
                                {selectedLedgerGroupIds.length} selected
                              </Badge>
                              <Button
                                onClick={handleSaveChanges}
                                disabled={bulkUpdateLedgerGroupsMutation.isLoading}
                                className="h-9 bg-blue-600 hover:bg-blue-700 text-white"
                              >
                                {bulkUpdateLedgerGroupsMutation.isLoading ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Saving...
                                  </>
                                ) : (
                                  <>
                                    <CheckCircle className="h-4 w-4 mr-2" />
                                    Save Changes
                                  </>
                                )}
                              </Button>
                            </>
                          )}
                          <Button
                            onClick={openCreateLedgerGroupDialog}
                            className="h-9 bg-black hover:bg-gray-900 text-white"
                          >
                            <Plus className="h-4 w-4 mr-2" />
                            Add Group
                          </Button>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent>
                      {isLoadingLedgerGroups ? (
                        <div className="flex justify-center items-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-600" />
                        </div>
                      ) : (
                        <>
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead className="w-[300px]">Ledger Group Name</TableHead>
                                  <TableHead className="w-[300px]">Parent Name</TableHead>
                                  <TableHead className="w-[120px]">Ledger Count</TableHead>
                                  <TableHead className="w-[150px] text-center">
                                    <div className="flex flex-col items-center gap-2">
                                      <span>Active</span>
                                      <SelectAllCheckbox
                                        checked={areAllPageActiveSelected}
                                        indeterminate={areSomePageActiveSelected}
                                        onCheckedChange={handleSelectAllPageActive}
                                        disabled={bulkUpdateLedgerGroupsMutation.isLoading || ledgerGroupsData.length === 0}
                                      />
                                    </div>
                                  </TableHead>
                                  <TableHead className="w-[150px] text-center">
                                    <div className="flex flex-col items-center gap-2">
                                      <span>Live</span>
                                      <SelectAllCheckbox
                                        checked={areAllPageLiveSelected}
                                        indeterminate={areSomePageLiveSelected}
                                        onCheckedChange={handleSelectAllPageLive}
                                        disabled={bulkUpdateLedgerGroupsMutation.isLoading || ledgerGroupsData.length === 0}
                                      />
                                    </div>
                                  </TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {ledgerGroupsData.length > 0 ? (
                                  ledgerGroupsData.map((group) => {
                                    const isSelected = selectedLedgerGroupIds.includes(group.id);
                                    return (
                                      <TableRow
                                        key={group.id}
                                        className={`hover:bg-gray-50 ${isSelected ? 'bg-blue-50' : ''}`}
                                      >
                                        <TableCell className="font-medium">
                                          {group.name || 'N/A'}
                                        </TableCell>

                                        <TableCell>
                                          {group.parent || 'N/A'}
                                        </TableCell>
                                        <TableCell>
                                          {group.ledger_count || '0'}
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center">
                                            <Checkbox
                                              checked={getDisplayValue(group.id, 'is_active')}
                                              onCheckedChange={(checked) => {
                                                if (isSelected) {
                                                  handleLocalStatusChange(group.id, 'is_active', checked);
                                                } else {
                                                  handleLedgerGroupStatusChange(group.id, 'is_active', checked);
                                                }
                                              }}
                                              disabled={!isSelected && bulkUpdateLedgerGroupsMutation.isLoading}
                                            />
                                          </div>
                                        </TableCell>
                                        <TableCell className="text-center">
                                          <div className="flex items-center justify-center">
                                            <Checkbox
                                              checked={getDisplayValue(group.id, 'is_live')}
                                              onCheckedChange={(checked) => {
                                                if (isSelected) {
                                                  handleLocalStatusChange(group.id, 'is_live', checked);
                                                } else {
                                                  handleLedgerGroupStatusChange(group.id, 'is_live', checked);
                                                }
                                              }}
                                              disabled={!isSelected && bulkUpdateLedgerGroupsMutation.isLoading}
                                            />
                                          </div>
                                        </TableCell>
                                      </TableRow>
                                    );
                                  })
                                ) : (
                                  <TableRow>
                                    <TableCell colSpan={4} className="text-center py-8 text-gray-500">
                                      <FileText className="w-12 h-12 mx-auto mb-4 text-gray-300" />
                                      <p>No ledger groups found matching your criteria.</p>
                                    </TableCell>
                                  </TableRow>
                                )}
                              </TableBody>
                            </Table>
                          </div>

                          {/* Pagination */}
                          {ledgerGroupsPagination.total_pages > 1 && (
                            <div className="flex items-center justify-between mt-6">
                              <div className="text-sm text-gray-500">
                                Showing {((ledgerGroupsPagination.current_page - 1) * LEDGER_GROUPS_PAGE_SIZE) + 1} to {Math.min(ledgerGroupsPagination.current_page * LEDGER_GROUPS_PAGE_SIZE, ledgerGroupsPagination.total_count)} of {ledgerGroupsPagination.total_count} entries
                              </div>
                              <div className="flex items-center space-x-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleLedgerGroupsPageChange(ledgerGroupsPagination.current_page - 1)}
                                  disabled={!ledgerGroupsPagination.has_previous}
                                >
                                  <ChevronLeft className="h-4 w-4" />
                                  Previous
                                </Button>

                                {getPageNumbers(ledgerGroupsPagination.current_page, ledgerGroupsPagination.total_pages).map((page, idx) =>
                                  page === "..." ? (
                                    <span key={`ellipsis-${idx}-${ledgerGroupsPagination.current_page}`} className="px-2">...</span>
                                  ) : (
                                    <Button
                                      key={`page-${page}-${idx}`}
                                      variant={ledgerGroupsPagination.current_page === page ? "default" : "outline"}
                                      size="sm"
                                      onClick={() => handleLedgerGroupsPageChange(page)}
                                    >
                                      {page}
                                    </Button>
                                  )
                                )}

                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleLedgerGroupsPageChange(ledgerGroupsPagination.current_page + 1)}
                                  disabled={!ledgerGroupsPagination.has_next}
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
                </TabsContent>

                {/* Business Types Tab */}
                <TabsContent value="business-types" className="space-y-3 mt-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle>Business Types</CardTitle>
                      <Button
                        onClick={() => {
                          setEditingBusinessTypeId(null);
                          setBusinessTypeForm({ name: "", description: "", margin_percent: "" });
                          setIsBusinessTypeDialogOpen(true);
                        }}
                        className="bg-black hover:bg-gray-900 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Business Type
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {isLoadingBusinessTypes ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                        </div>
                      ) : (
                        <TypeMasterCardGrid
                          items={businessTypesData || []}
                          emptyMessage="No business types found"
                          onEdit={openEditBusinessType}
                          onDelete={handleDeleteBusinessType}
                          deletingId={
                            deleteBusinessTypeMutation.isPending
                              ? deleteBusinessTypeMutation.variables
                              : null
                          }
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Credit Types Tab */}
                <TabsContent value="credit-types" className="space-y-3 mt-3">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0">
                      <CardTitle>Credit Types</CardTitle>
                      <Button
                        onClick={() => {
                          setEditingCreditTypeId(null);
                          setCreditTypeForm({ name: "", description: "", margin_percent: "" });
                          setIsCreditTypeDialogOpen(true);
                        }}
                        className="bg-black hover:bg-gray-900 text-white"
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        Add Credit Type
                      </Button>
                    </CardHeader>
                    <CardContent>
                      {isLoadingCreditTypes ? (
                        <div className="flex justify-center py-8">
                          <Loader2 className="h-6 w-6 animate-spin text-gray-500" />
                        </div>
                      ) : (
                        <TypeMasterCardGrid
                          items={creditTypesData || []}
                          emptyMessage="No credit types found"
                          onEdit={openEditCreditType}
                          onDelete={handleDeleteCreditType}
                          deletingId={
                            deleteCreditTypeMutation.isPending
                              ? deleteCreditTypeMutation.variables
                              : null
                          }
                        />
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </main>
      </div>

      {/* Detail Modal */}
      <Dialog open={isDetailModalOpen} onOpenChange={setIsDetailModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center space-x-2 flex-shrink-0">
                <User className="h-5 w-5" />
                <span>Ledger Details</span>
            </div>
              {entryDetail && (
                <div className="flex items-center gap-2 mr-8 flex-wrap justify-end">
                  {hasPermission("customer_management", "update") && (
              <Button
                size="sm"
                      variant="outline"
                      onClick={() => {
                        setIsDetailModalOpen(false);
                        editPrefillDoneRef.current = null;
                        editFormTouchedRef.current = false;
                        editingLedgerEntryRef.current = selectedEntry;
                        setEditingCustomerId(entryDetail.basic_info?.id ?? selectedEntry?.id);
                        setIsCreateDialogOpen(true);
                      }}
                      className="flex items-center border-blue-600 text-blue-700 hover:bg-blue-50"
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      <span>Edit</span>
                    </Button>
                  )}
                  {isTallyEnabled &&
                    entryDetail.system_info &&
                    !entryDetail.system_info.is_tally_sync &&
                    hasPermission("customer_management", "update") && (
                      <Button
                        size="sm"
                        onClick={() =>
                          syncLedgerToTallyMutation.mutate(
                            entryDetail.basic_info?.id ?? selectedEntry?.id
                          )
                        }
                disabled={syncLedgerToTallyMutation.isPending}
                        className="flex items-center"
              >
                {syncLedgerToTallyMutation.isPending ? (
                          <>
                  <Loader2 className="h-4 w-4 animate-spin mr-1" />
                            <span>Syncing...</span>
                          </>
                ) : (
                          <>
                  <RefreshCw className="h-4 w-4 mr-1" />
                            <span>Sync to Tally</span>
                          </>
                )}
              </Button>
            )}
                </div>
              )}
            </DialogTitle>
          </DialogHeader>

          {isDetailLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
          ) : entryDetail ? (
            <div className="space-y-4">
              <FormSection
                title="Basic Information"
                icon={User}
                headerClassName="bg-blue-100 border-blue-100"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <DetailField label="Firm Name" value={entryDetail.basic_info?.firm_name} />
                  <DetailField label="Name" value={entryDetail.basic_info?.name} />
                  <DetailField
                    label="Tally Name"
                    value={entryDetail.basic_info?.tally_name || entryDetail.basic_info?.name}
                  />
                  <DetailField label="Parent" value={entryDetail.basic_info?.parent} />
                  <DetailField label="Status">
                    <Badge
                      variant={entryDetail.basic_info?.is_active ? "default" : "secondary"}
                      className="flex items-center space-x-1 w-fit mt-1"
                    >
                      {entryDetail.basic_info?.is_active ? (
                        <CheckCircle className="h-3 w-3" />
                      ) : (
                        <XCircle className="h-3 w-3" />
                      )}
                      <span>{entryDetail.basic_info?.is_active ? "Active" : "Inactive"}</span>
                    </Badge>
                  </DetailField>
                  <DetailField label="Type">
                    <Badge variant="outline" className="flex items-center space-x-1 w-fit mt-1">
                      <User className="h-3 w-3" />
                      <span>
                        {formatLedgerTypeLabel(
                          entryDetail.basic_info?.ledger_type ?? entryDetail.ledger_type,
                          entryDetail.basic_info?.is_supplier
                        )}
                      </span>
                          </Badge>
                  </DetailField>
                  <DetailField label="Account Type">
                    <Badge variant="outline" className="w-fit mt-1">
                      {formatAccountTypeLabel(
                        entryDetail.basic_info?.account_type ?? entryDetail.account_type
                      )}
                    </Badge>
                  </DetailField>
                  <DetailField label="Owner Name" value={entryDetail.basic_info?.owner_name} />
                  <DetailField label="Alias Name" value={entryDetail.basic_info?.alias_name} />
                  <DetailField label="Email" value={entryDetail.basic_info?.email} />
                        </div>
              </FormSection>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormSection title="Organization" icon={Building} headerClassName="bg-blue-100 border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DetailField
                      label="Organization"
                      value={entryDetail.organization_info?.organization_name}
                    />
                    <DetailField label="Branch" value={entryDetail.organization_info?.branch_name} />
                    </div>
                </FormSection>

                <FormSection title="Contact Information" icon={Users} headerClassName="bg-blue-100 border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DetailField label="Contact Person" value={entryDetail.contact_info?.contact_person} />
                    <DetailField
                      label="Contact Number"
                      value={entryDetail.contact_info?.contact_number}
                    />
                    <DetailField
                      label="WhatsApp Number"
                      value={entryDetail.contact_info?.whatsapp_number}
                    />
                      </div>
                </FormSection>
                      </div>

              <FormSection title="Address" icon={MapPin} headerClassName="bg-blue-100 border-blue-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                  <div className="md:col-span-2 lg:col-span-4">
                    <Label className="text-sm font-medium text-gray-500">Address</Label>
                    <div className="flex items-start space-x-2 mt-1 p-3 bg-white rounded-md border border-gray-100">
                      <MapPin className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                      <p className="text-gray-700 break-words">
                        {entryDetail.address_info?.address || "No address provided"}
                          </p>
                        </div>
                    </div>
                  <DetailField label="Landmark" value={entryDetail.address_info?.landmark} />
                  <DetailField label="City" value={entryDetail.address_info?.city} />
                  <DetailField label="State" value={entryDetail.address_info?.state} />
                  {/* <DetailField label="Country" value={entryDetail.address_info?.country} /> */}
                  <DetailField label="Pincode" value={entryDetail.address_info?.pincode} />
                  <DetailField
                    label="Exact Location"
                    value={formatExactLocation(
                      entryDetail.address_info?.lat,
                      entryDetail.address_info?.long
                    )}
                  />
                </div>
              </FormSection>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <FormSection title="Registration & Tax" icon={FileText} headerClassName="bg-blue-100 border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DetailField
                      label="Registration Type"
                      value={entryDetail.registration_tax_info?.registration_type}
                    />
                    <DetailField label="GST Number" value={entryDetail.registration_tax_info?.gst_number} />
                    <DetailField
                      label="Taxation Type"
                      value={entryDetail.registration_tax_info?.taxation_type?.type}
                    />
                    <DetailField label="Religion" value={entryDetail.registration_tax_info?.religion} />
                        </div>
                </FormSection>

                <FormSection title="Classification" icon={Link2} headerClassName="bg-blue-100 border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <DetailField
                      label="Business Type"
                      value={
                        entryDetail.classification_info?.bussiness_type?.name ??
                        entryDetail.classification_info?.business_type?.name ??
                        entryDetail.classification_info?.customer_type?.name
                      }
                    />
                    <DetailField
                      label="Credit Type"
                      value={entryDetail.classification_info?.credit_type?.name}
                    />
                    <DetailField
                      label="Category Type"
                      value={entryDetail.classification_info?.category_type?.type}
                    />
                        </div>
                </FormSection>
                        </div>

              {(entryDetail.shipping_address_info?.shipping_address ||
                entryDetail.shipping_address_info?.shipping_city ||
                entryDetail.shipping_address_info?.shipping_state) && (
                <FormSection title="Shipping Address" icon={Truck}>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 items-start">
                    <div className="md:col-span-2 lg:col-span-4">
                      <Label className="text-sm font-medium text-gray-500">Shipping Address</Label>
                      <div className="flex items-start space-x-2 mt-1 p-3 bg-white rounded-md border border-gray-100">
                        <Truck className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                        <p className="text-gray-700 break-words">
                          {entryDetail.shipping_address_info?.shipping_address ||
                            "No shipping address provided"}
                        </p>
                      </div>
                      </div>
                    <DetailField
                      label="Shipping City"
                      value={entryDetail.shipping_address_info?.shipping_city}
                    />
                    <DetailField
                      label="Shipping State"
                      value={entryDetail.shipping_address_info?.shipping_state}
                    />
                      </div>
                </FormSection>
              )}

              <FormSection title="System Information" icon={Clock} headerClassName="bg-blue-100 border-blue-100">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <DetailField label="Created At" value={entryDetail.system_info?.created_at} />
                  <DetailField label="Updated At" value={entryDetail.system_info?.updated_at} />
                  <DetailField
                    label="Created in Tally"
                    value={entryDetail.system_info?.created_in_tally}
                  />
                  <DetailField label="KYC Done">
                    <Badge
                      variant={entryDetail.system_info?.is_kyc_done ? "default" : "outline"}
                      className="w-fit mt-1"
                    >
                      {entryDetail.system_info?.is_kyc_done ? "Yes" : "No"}
                    </Badge>
                  </DetailField>
                  {isTallyEnabled && (
                    <DetailField label="Tally Sync">
                      <Badge
                        variant={entryDetail.system_info?.is_tally_sync ? "default" : "secondary"}
                        className="flex items-center space-x-1 w-fit mt-1"
                      >
                        {entryDetail.system_info?.is_tally_sync ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            <span>Synced</span>
                          </>
                        ) : (
                          <>
                            <Clock className="h-3 w-3" />
                            <span>Not Synced</span>
                          </>
                        )}
                          </Badge>
                    </DetailField>
                  )}
                  <DetailField label="Created By" value={entryDetail.system_info?.created_by} />
                  <DetailField label="Updated By" value={entryDetail.system_info?.updated_by} />
                </div>
              </FormSection>

              {Array.isArray(entryDetail.bank_details) && entryDetail.bank_details.length > 0 && (
                <FormSection title="Bank Details" icon={CreditCard} headerClassName="bg-blue-100 border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {entryDetail.bank_details.map((bank, bankIdx) => (
                      <div
                        key={bank.id || bankIdx}
                        className="border border-gray-200 rounded-lg p-3 bg-white space-y-2"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-gray-900">
                            {bank.bank_name || "Bank account"}
                          </p>
                          {bank.is_primary ? (
                            <Badge className="text-[10px]">Primary</Badge>
                          ) : null}
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <DetailField label="Account Holder" value={bank.account_holder} />
                          <DetailField label="Account Type" value={bank.account_type} />
                          <DetailField label="Account Number" value={bank.account_number} />
                          <DetailField label="IFSC" value={bank.ifsc_code} />
                          <DetailField label="Branch" value={bank.branch_name} />
                          <DetailField label="UPI ID" value={bank.upi_id} />
                        </div>
                        {bank.remarks ? (
                          <DetailField label="Remarks" value={bank.remarks} />
                        ) : null}
                      </div>
                    ))}
                  </div>
                </FormSection>
              )}

              {entryDetail.kyc_documents && entryDetail.kyc_documents.length > 0 && (
                <FormSection title="KYC Documents" icon={FileText} headerClassName="bg-blue-100 border-blue-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                      {entryDetail.kyc_documents.map((doc, docIdx) => {
                      const fileUrl =
                        (typeof doc.file_url === "string" && doc.file_url) ||
                        (typeof doc.file === "string" && doc.file) ||
                        "";
                      const urls = fileUrl ? [fileUrl] : [];
                      const createdByName =
                        typeof doc.created_by === "string"
                          ? doc.created_by
                          : doc.created_by?.name ??
                            (doc.created_by?.user_id != null ? String(doc.created_by.user_id) : "");
                        return (
                        <div
                          key={doc.id || docIdx}
                          className="border border-gray-200 rounded-lg p-4 bg-white space-y-4"
                        >
                          <div className={`grid gap-4 ${(doc.document_number || "").trim() ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1"}`}>
                            <DetailField label="Document Name" value={doc.document_name} />
                            {(doc.document_number || "").trim() ? (
                              <DetailField label="Document Number" value={doc.document_number} />
                            ) : null}
                            </div>

                          {urls.length > 0 ? (
                            <div className="w-full">
                              {isKycImageFileUrl(urls[0]) ? (
                                <div
                                  className="w-full aspect-video bg-gray-100 rounded-md overflow-hidden border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors shadow-sm"
                                  onClick={() => openKycImageViewer(urls[0], doc.document_name || "KYC Document")}
                                >
                                  <img
                                    src={urls[0]}
                                    alt={`${doc.document_name || "KYC"} image`}
                                    className="w-full h-full object-cover"
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                      if (e.target.nextSibling) {
                                        e.target.nextSibling.style.display = "flex";
                                      }
                                    }}
                                  />
                                  <div className="w-full h-full hidden items-center justify-center text-gray-500">
                                    <div className="text-center px-2">
                                      <ImageIcon className="h-6 w-6 mx-auto mb-1" />
                                      <p className="text-xs">Preview not available</p>
                            </div>
                                  </div>
                                </div>
                              ) : (
                                <a
                                  href={urls[0]}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                  className="text-sm font-medium text-blue-600 hover:underline"
                                >
                                  View document file
                                </a>
                              )}
                              </div>
                          ) : (
                            <DetailField label="Document File" value="-" />
                          )}

                          <DetailField
                            label="Created"
                            value={[createdByName, doc.created_at].filter(Boolean).join(" · ") || "-"}
                          />
                          </div>
                        );
                      })}
                    </div>
                </FormSection>
              )}
            </div>
          ) : (
            <p className="text-gray-500">No details available.</p>
          )}
        </DialogContent>
      </Dialog>

      {/* Status Update Modal */}
      <Dialog open={isStatusModalOpen} onOpenChange={setIsStatusModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Update Status</DialogTitle>
            <DialogDescription>Change the status of the selected entry.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
              </SelectContent>
            </Select>

            {newStatus === "approved" && (
              <>
                <Select value={selectedSupervisor} onValueChange={setSelectedSupervisor}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign Supervisor" />
                  </SelectTrigger>
                  <SelectContent>
                    {supervisorList.map((sup) => (
                      <SelectItem key={sup.id} value={sup.name}>{sup.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={selectedGodown} onValueChange={setSelectedGodown}>
                  <SelectTrigger>
                    <SelectValue placeholder="Assign Godown" />
                  </SelectTrigger>
                  <SelectContent>
                    {godownList.map((gd) => (
                      <SelectItem key={gd.id} value={gd.name}>{gd.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {newStatus === "rejected" && (
              <Textarea
                placeholder="Enter rejection reason"
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
              />
            )}

            <Button className="w-full" onClick={handleStatusSubmit}>Submit</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Customer Dialog */}
      <Dialog
        open={isCreateDialogOpen}
        onOpenChange={(open) => {
          if (!open && isSavingCustomer) return;
          setIsCreateDialogOpen(open);
          if (!open) {
            resetCustomerForm();
            setCreateCustomerParentSearch("");
            setCreateCustomerParentOpen(false);
            setRegistrationTypeSearch("");
            setRegistrationTypeOpen(false);
            setCustomerBusinessTypeSearch("");
            setCustomerBusinessTypeOpen(false);
            setCategoryTypeSearch("");
            setCategoryTypeOpen(false);
            setBranchSearch("");
            setBranchOpen(false);
            setKycDocNameOpenIndex(null);
            setKycDocNameSearch("");
            setSameAsAddressChecked(false);
          }
        }}
      >
        <DialogContent
          className="max-w-5xl max-h-[92vh] overflow-y-auto p-4"
          onInteractOutside={(e) => {
            if (isPacContainerTarget(e.target)) e.preventDefault();
          }}
          onPointerDownOutside={(e) => {
            if (isPacContainerTarget(e.target)) e.preventDefault();
          }}
        >
          <DialogHeader>
            <DialogTitle>{editingCustomerId ? "Edit Ledger" : "Create Ledger"}</DialogTitle>
            <DialogDescription>{editingCustomerId ? "Update ledger entry and KYC documents." : "Create a new ledger entry"}</DialogDescription>
          </DialogHeader>
          <div className="relative space-y-2.5">
            {isSavingCustomer && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center rounded-lg bg-white/80 backdrop-blur-[1px]">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                <p className="mt-3 text-sm font-medium text-gray-700">
                  {editingCustomerId ? "Updating ledger..." : "Creating ledger..."}
                </p>
                </div>
            )}
            {editingCustomerId && isEditPartyDetailLoading && !isSavingCustomer && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-lg bg-white/70 backdrop-blur-[1px]">
                <Loader2 className="h-7 w-7 animate-spin text-blue-600" />
                <p className="mt-2 text-sm text-gray-600">Loading customer details...</p>
              </div>
            )}

            <FormSection title="Basic Information" icon={User}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <FormLabel required>Firm Name</FormLabel>
                  <Input
                    value={customerFormData.firm_name}
                    placeholder="Enter firm name"
                    disabled={isSavingCustomer}
                    maxLength={100}
                    onChange={(e) => {
                      handleCustomerFormChange("firm_name", e.target.value);
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Alias Name</FormLabel>
                  <Input
                    value={customerFormData.alias_name}
                    onChange={(e) => handleCustomerFormChange('alias_name', e.target.value)}
                    placeholder="Enter alias name"
                    disabled={isSavingCustomer}
                    maxLength={10}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Parent</FormLabel>
                  <Popover open={createCustomerParentOpen} onOpenChange={(open) => { setCreateCustomerParentOpen(open); if (!open) setCreateCustomerParentSearch(""); }}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={createCustomerParentOpen}
                        className="w-full justify-between font-normal"
                        disabled={parentDropdownLoading || isSavingCustomer}
                      >
                        <span className="truncate">
                          {parentDropdownLoading ? "Loading..." : (customerFormData.parent || "Select parent")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[420px] min-w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0"
                      align="start"
                    >
                      <Command shouldFilter={false} className="w-full">
                        <CommandInput
                          placeholder="Search parent..."
                          value={createCustomerParentSearch}
                          onValueChange={setCreateCustomerParentSearch}
                        />
                        <CommandList className="!max-h-[none] overflow-visible p-0">
                          <CommandEmpty>No parent found.</CommandEmpty>
                          <CommandGroup className="overflow-visible p-0">
                            <div
                              className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                              style={{ minHeight: 0 }}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  handleCustomerFormChange('parent', "");
                                  setCreateCustomerParentOpen(false);
                                }}
                                className="cursor-pointer"
                              >
                                <span className="font-medium">None</span>
                              </CommandItem>
                              {(ledgerGroupsForParentDropdown || [])
                                .filter((g) => g.name?.trim())
                                .filter((g) =>
                                  !createCustomerParentSearch.trim()
                                    ? true
                                    : (g.name || "").toLowerCase().includes(createCustomerParentSearch.toLowerCase())
                                )
                                .map((group) => (
                                  <CommandItem
                                    key={group.id}
                                    value={`${group.name}-${group.id}`}
                                    onSelect={() => {
                                      handleCustomerFormChange('parent', group.name);
                                      setCreateCustomerParentOpen(false);
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <div className="flex flex-col">
                                      <span className="font-medium">{group.name}</span>
                                      {group.parent && (
                                        <span className="text-xs text-gray-500">{group.parent}</span>
                                      )}
                                    </div>
                                  </CommandItem>
                                ))}
                            </div>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <FormLabel>Owner Name</FormLabel>
                  <Input
                    value={customerFormData.owner_name}
                    placeholder="Enter owner name"
                    disabled={isSavingCustomer}
                    maxLength={30}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[A-Za-z\s]*$/.test(value)) {
                        handleCustomerFormChange("owner_name", value);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Ledger Type</FormLabel>
                  <Select
                    value={normalizeLedgerTypeValue(customerFormData.ledger_type)}
                    onValueChange={(value) => handleCustomerFormChange("ledger_type", value)}
                    disabled={isSavingCustomer}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select ledger type" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      {LEDGER_TYPE_FORM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  </div>
                <div className="space-y-1">
                  <FormLabel>Account Type</FormLabel>
                  <Select
                    value={normalizeAccountTypeValue(customerFormData.account_type)}
                    onValueChange={(value) => handleCustomerFormChange("account_type", value)}
                    disabled={isSavingCustomer}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select account type" />
                    </SelectTrigger>
                    <SelectContent className="z-[100]">
                      {ACCOUNT_TYPE_FORM_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FormLabel>Branch</FormLabel>
                  <Popover
                    open={branchOpen}
                    onOpenChange={(open) => {
                      setBranchOpen(open);
                      if (!open) setBranchSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={branchOpen}
                        className="w-full justify-between font-normal"
                        disabled={isSavingCustomer}
                      >
                        <span className="truncate">
                          {customerFormData.branch_id
                            ? (branchesData || []).find(
                                (b) =>
                                  String(getBranchRecordId(b)) === String(customerFormData.branch_id)
                              )?.name || customerFormData.branch_name || "Select branch"
                            : "Select branch"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[420px] min-w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0"
                      align="start"
                    >
                      <Command shouldFilter={false} className="w-full">
                        <CommandInput
                          placeholder="Search branch..."
                          value={branchSearch}
                          onValueChange={setBranchSearch}
                        />
                        <CommandList className="!max-h-[none] overflow-visible p-0">
                          <CommandEmpty>No branch found.</CommandEmpty>
                          <CommandGroup className="overflow-visible p-0">
                            <div
                              className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                              style={{ minHeight: 0 }}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              {(branchesData || [])
                                .filter((branch) =>
                                  !branchSearch.trim()
                                    ? true
                                    : (branch.name || "")
                                        .toLowerCase()
                                        .includes(branchSearch.toLowerCase())
                                )
                                .map((branch) => {
                                  const branchId = getBranchRecordId(branch);
                                  return (
                                    <CommandItem
                                      key={branchId ?? branch.name}
                                      value={`${branch.name}-${branchId}`}
                                      onSelect={() => handleBranchSelect(branch)}
                                      className="cursor-pointer"
                                    >
                                      <Check
                                        className={`mr-2 h-4 w-4 ${
                                          String(customerFormData.branch_id) === String(branchId)
                                            ? "opacity-100"
                                            : "opacity-0"
                                        }`}
                                      />
                                      <span className="font-medium">{branch.name}</span>
                                    </CommandItem>
                                  );
                                })}
                            </div>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                </div>
            </FormSection>

            <FormSection title="Contact Information" icon={Users}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <FormLabel>Contact Person</FormLabel>
                  <Input
                    value={customerFormData.contact_person}
                    placeholder="Enter contact person"
                    disabled={isSavingCustomer}
                    maxLength={30}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[A-Za-z\s]*$/.test(value)) {
                        handleCustomerFormChange("contact_person", value);
                      }
                    }}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Contact Number</FormLabel>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={customerFormData.contact_number}
                    onChange={(e) => handleCustomerFormChange('contact_number', e.target.value)}
                    placeholder="Enter contact number (numbers only)"
                    disabled={isSavingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>WhatsApp Number</FormLabel>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={customerFormData.whatsapp_number}
                    onChange={(e) => handleCustomerFormChange('whatsapp_number', e.target.value)}
                    placeholder="Enter WhatsApp number (numbers only)"
                    disabled={isSavingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Email</FormLabel>
                  <Input
                    type="email"
                    value={customerFormData.email}
                    onChange={(e) => handleCustomerFormChange("email", e.target.value)}
                    placeholder="Enter email address"
                    disabled={isSavingCustomer}
                  />
              </div>
            </div>
            </FormSection>

            <FormSection title="Address Information" icon={MapPin}>
              <div className="flex items-center justify-end -mt-1">
                {(customerFormData.address || customerFormData.city || customerFormData.state || customerFormData.pincode) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearAddress}
                    disabled={isSavingCustomer}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="space-y-1">
                <FormLabel>Address</FormLabel>
                <Input
                  ref={handleAddressInputRef}
                  type="text"
                    value={customerFormData.address}
                    onChange={(e) => handleCustomerFormChange('address', e.target.value)}
                  placeholder="Start typing address..."
                  autoComplete="off"
                  disabled={isSavingCustomer}
                  className={addressErrors.address ? "border-red-500 focus-visible:ring-red-500" : ""}
                />
                {addressErrors.address && (
                  <p className="text-xs text-red-600">{addressErrors.address}</p>
                )}
                {GOOGLE_API_KEY ? (
                  <p className="text-xs text-gray-500">
                    {isGoogleScriptLoaded
                      ? "Start typing to see address suggestions from Google"
                      : "Loading Google Places API..."}
                  </p>
                ) : (
                  <p className="text-xs text-yellow-600">
                    Google API key not configured. Address autocomplete will not work.
                  </p>
                )}
                </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <FormLabel>City</FormLabel>
                  <Input
                    value={customerFormData.city}
                    onChange={(e) => handleCustomerFormChange('city', e.target.value)}
                    placeholder="Enter city"
                    disabled={isSavingCustomer}
                    className={addressErrors.city ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {addressErrors.city && (
                    <p className="text-xs text-red-600">{addressErrors.city}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <FormLabel>State</FormLabel>
                  <Popover open={createCustomerStateOpen} onOpenChange={setCreateCustomerStateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={createCustomerStateOpen}
                        disabled={isSavingCustomer}
                        className={`w-full justify-between font-normal ${addressErrors.state ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                      >
                        <span className="truncate">{customerFormData.state || "Select state"}</span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                      <Command>
                        <CommandInput placeholder="Search state or union territory..." />
                        <CommandList className="!max-h-[none] overflow-visible p-0">
                          <CommandEmpty>No state or union territory found.</CommandEmpty>
                          <CommandGroup className="overflow-visible p-0">
                            <div
                              className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                              style={{ minHeight: 0 }}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              {INDIA_STATE_OPTIONS.map((state) => (
                                <CommandItem
                                  key={state}
                                  value={state}
                                  className="cursor-pointer"
                                  onSelect={() => {
                                    handleCustomerFormChange("state", state);
                                    setCreateCustomerStateOpen(false);
                                  }}
                                >
                                  {state}
                                </CommandItem>
                              ))}
                            </div>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {addressErrors.state && (
                    <p className="text-xs text-red-600">{addressErrors.state}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <FormLabel>Pincode</FormLabel>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={customerFormData.pincode}
                    onChange={(e) => handleCustomerFormChange('pincode', e.target.value)}
                    placeholder="Enter pincode"
                    disabled={isSavingCustomer}
                    className={addressErrors.pincode ? "border-red-500 focus-visible:ring-red-500" : ""}
                  />
                  {addressErrors.pincode && (
                    <p className="text-xs text-red-600">{addressErrors.pincode}</p>
                  )}
                </div>
                <div className="space-y-1">
                  <FormLabel>Landmark</FormLabel>
                  <Input
                    value={customerFormData.landmark}
                    onChange={(e) => handleCustomerFormChange('landmark', e.target.value)}
                    placeholder="Enter landmark"
                    disabled={isSavingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Exact Location</FormLabel>
                  <Input
                    value={formatExactLocation(customerFormData.lat, customerFormData.long)}
                    placeholder="Set via address autocomplete"
                    readOnly
                    disabled
                    className="bg-gray-50 text-gray-700"
                  />
                  <p className="text-xs text-gray-500">
                    Captured automatically when you pick an address from Google suggestions.
                  </p>
              </div>
            </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <FormLabel>Country</FormLabel>
                  <Input
                    value={customerFormData.country}
                    placeholder="Enter country"
                    disabled={isSavingCustomer}
                    maxLength={20}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (/^[A-Za-z\s]*$/.test(value)) {
                        handleCustomerFormChange("country", value);
                      }
                    }}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Shipping Address" icon={Truck}>
              <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="same-as-address"
                  checked={sameAsAddressChecked}
                  onCheckedChange={handleCopyAddressToShipping}
                    disabled={isSavingCustomer}
                />
                <label
                  htmlFor="same-as-address"
                    className="text-sm font-semibold text-gray-800 leading-none cursor-pointer"
                >
                  Same as Address Information
                </label>
                </div>
                {!sameAsAddressChecked &&
                  (customerFormData.shipping_address ||
                    customerFormData.shipping_city ||
                    customerFormData.shipping_state ||
                    customerFormData.shipping_pincode) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleClearShippingAddress}
                    disabled={isSavingCustomer}
                    className="text-gray-600 hover:text-gray-900"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <div className="md:col-span-3 space-y-1.5">
                  <FormLabel>Shipping Address</FormLabel>
                  <Input
                    ref={handleShippingAddressInputRef}
                    type="text"
                    value={customerFormData.shipping_address}
                    onChange={(e) => handleCustomerFormChange('shipping_address', e.target.value)}
                    placeholder="Start typing shipping address..."
                    autoComplete="off"
                    disabled={isSavingCustomer || sameAsAddressChecked}
                  />
                  {!sameAsAddressChecked && GOOGLE_API_KEY ? (
                    <p className="text-xs text-gray-500">
                      {isGoogleScriptLoaded
                        ? "Start typing to see address suggestions from Google"
                        : "Loading Google Places API..."}
                    </p>
                  ) : !sameAsAddressChecked ? (
                    <p className="text-xs text-yellow-600">
                      Google API key not configured. Address autocomplete will not work.
                    </p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <FormLabel>Shipping City</FormLabel>
                  <Input
                    value={customerFormData.shipping_city}
                    onChange={(e) => handleCustomerFormChange('shipping_city', e.target.value)}
                    placeholder="Enter shipping city"
                    disabled={isSavingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Shipping State</FormLabel>
                  <Input
                    value={customerFormData.shipping_state}
                    onChange={(e) => handleCustomerFormChange('shipping_state', e.target.value)}
                    placeholder="Enter shipping state"
                    disabled={isSavingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Shipping Pincode</FormLabel>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={6}
                    value={customerFormData.shipping_pincode}
                    onChange={(e) => handleCustomerFormChange('shipping_pincode', e.target.value)}
                    placeholder="Enter shipping pincode"
                    disabled={isSavingCustomer}
                  />
                </div>
              </div>
            </FormSection>

            <FormSection title="Registration & Tax Information" icon={Building}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                <div className="space-y-1">
                  <FormLabel required>Registration Type</FormLabel>
                  <Popover
                    open={registrationTypeOpen}
                    onOpenChange={(open) => {
                      setRegistrationTypeOpen(open);
                      if (!open) setRegistrationTypeSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={registrationTypeOpen}
                        className="w-full justify-between font-normal"
                        disabled={isSavingCustomer}
                      >
                        <span className="truncate">
                          {customerFormData.taxation_type_id
                            ? taxationTypes.find(
                                (t) => String(t.id) === String(customerFormData.taxation_type_id)
                              )?.type || customerFormData.registration_type || "Select registration type"
                            : "Select registration type"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[420px] min-w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0"
                      align="start"
                    >
                      <Command shouldFilter={false} className="w-full">
                        <CommandInput
                          placeholder="Search registration type..."
                          value={registrationTypeSearch}
                          onValueChange={setRegistrationTypeSearch}
                        />
                        <CommandList className="!max-h-[none] overflow-visible p-0">
                          <CommandEmpty>No registration type found.</CommandEmpty>
                          <CommandGroup className="overflow-visible p-0">
                            <div
                              className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                              style={{ minHeight: 0 }}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              {taxationTypes
                                .filter((type) =>
                                  !registrationTypeSearch.trim()
                                    ? true
                                    : (type.type || "")
                                        .toLowerCase()
                                        .includes(registrationTypeSearch.toLowerCase())
                                )
                                .map((type) => (
                                  <CommandItem
                                    key={type.id}
                                    value={`${type.type}-${type.id}`}
                                    onSelect={() => {
                                      handleRegistrationTypeChange(String(type.id));
                                      setRegistrationTypeOpen(false);
                                      setRegistrationTypeSearch("");
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <span className="font-medium">{type.type}</span>
                                  </CommandItem>
                                ))}
                </div>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <FormLabel>GST Number</FormLabel>
                  <Input
                    value={customerFormData.gst_number}
                    onChange={(e) => handleCustomerFormChange('gst_number', e.target.value)}
                    onBlur={() => {
                      const gstNumber = String(customerFormData.gst_number || "").trim();
                      if (gstNumber && !isValidGstin(gstNumber)) {
                        setGstNumberError(GST_NUMBER_ERROR_TEXT);
                      } else {
                        setGstNumberError("");
                      }
                    }}
                    placeholder="e.g. 29ABCDE1234F1Z5"
                    className={`uppercase ${gstNumberError ? "border-red-500 focus-visible:ring-red-500" : ""}`}
                    autoCapitalize="characters"
                    autoComplete="off"
                    spellCheck={false}
                    inputMode="text"
                    disabled={isSavingCustomer}
                    maxLength={15}
                  />
                  {gstNumberError ? (
                    <p className="text-xs text-red-600">{gstNumberError}</p>
                  ) : null}
                </div>
                <div className="space-y-1">
                  <FormLabel>PAN Number</FormLabel>
                  <Input
                    value={customerFormData.pan_number}
                    onChange={(e) => handleCustomerFormChange('pan_number', e.target.value)}
                    placeholder="Enter PAN number"
                    className="uppercase"
                    autoCapitalize="characters"
                    maxLength={10}
                    disabled={isSavingCustomer}
                  />
                </div>
                <div className="space-y-1">
                  <FormLabel>Religion</FormLabel>
                  <Select
                    value={customerFormData.religion || ""}
                    onValueChange={(value) => handleCustomerFormChange('religion', value)}
                    disabled={isSavingCustomer}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select religion" />
                    </SelectTrigger>
                    <SelectContent>
                      {religionOptions.map((item) => (
                        <SelectItem key={item.id} value={item.religion}>
                          {item.religion}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </FormSection>

            <FormSection title="Additional Details" icon={Building}>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <FormLabel>Customer Type (Business Type)</FormLabel>
                  <Popover
                    open={customerBusinessTypeOpen}
                    onOpenChange={(open) => {
                      setCustomerBusinessTypeOpen(open);
                      if (!open) setCustomerBusinessTypeSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={customerBusinessTypeOpen}
                        className="w-full justify-between font-normal"
                        disabled={isSavingCustomer || isLoadingBusinessTypes}
                      >
                        <span className="truncate">
                          {isLoadingBusinessTypes
                            ? "Loading..."
                            : customerFormData.customer_type_id
                              ? (businessTypesData || []).find(
                                  (t) => String(t.id) === String(customerFormData.customer_type_id)
                                )?.name || "Select customer type"
                              : "Select customer type"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[420px] min-w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0"
                      align="start"
                    >
                      <Command shouldFilter={false} className="w-full">
                        <CommandInput
                          placeholder="Search customer type..."
                          value={customerBusinessTypeSearch}
                          onValueChange={setCustomerBusinessTypeSearch}
                        />
                        <CommandList className="!max-h-[none] overflow-visible p-0">
                          <CommandEmpty>No customer type found.</CommandEmpty>
                          <CommandGroup className="overflow-visible p-0">
                            <div
                              className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                              style={{ minHeight: 0 }}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              <CommandItem
                                value="__none__"
                                onSelect={() => {
                                  handleCustomerFormChange("customer_type_id", "");
                                  setCustomerBusinessTypeOpen(false);
                                  setCustomerBusinessTypeSearch("");
                                }}
                                className="cursor-pointer"
                              >
                                <Check
                                  className={`mr-2 h-4 w-4 ${
                                    !customerFormData.customer_type_id ? "opacity-100" : "opacity-0"
                                  }`}
                                />
                                <span className="font-medium">None</span>
                              </CommandItem>
                              {(businessTypesData || [])
                                .filter((type) =>
                                  !customerBusinessTypeSearch.trim()
                                    ? true
                                    : (type.name || "")
                                        .toLowerCase()
                                        .includes(customerBusinessTypeSearch.toLowerCase())
                                )
                                .map((type) => (
                                  <CommandItem
                                    key={type.id}
                                    value={`${type.name}-${type.id}`}
                                    onSelect={() => {
                                      handleCustomerFormChange("customer_type_id", String(type.id));
                                      setCustomerBusinessTypeOpen(false);
                                      setCustomerBusinessTypeSearch("");
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <Check
                                      className={`mr-2 h-4 w-4 ${
                                        String(customerFormData.customer_type_id) === String(type.id)
                                          ? "opacity-100"
                                          : "opacity-0"
                                      }`}
                                    />
                                    <span className="font-medium">{type.name}</span>
                                  </CommandItem>
                                ))}
                            </div>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
                <div className="space-y-1">
                  <FormLabel>Credit Type</FormLabel>
                  <Select
                    value={customerFormData.credit_type_id}
                    onValueChange={(value) => handleCustomerFormChange('credit_type_id', value)}
                    disabled={isSavingCustomer}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select credit type" />
                    </SelectTrigger>
                    <SelectContent>
                      {(creditTypesData || []).map((type) => (
                        <SelectItem key={type.id} value={String(type.id)}>
                          {type.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <FormLabel>Category Type</FormLabel>
                  <Popover
                    open={categoryTypeOpen}
                    onOpenChange={(open) => {
                      setCategoryTypeOpen(open);
                      if (!open) setCategoryTypeSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={categoryTypeOpen}
                        className="w-full justify-between font-normal"
                        disabled={isSavingCustomer}
                      >
                        <span className="truncate">
                          {customerFormData.category_type_id
                            ? categoryTypes.find(
                                (t) => String(t.id) === String(customerFormData.category_type_id)
                              )?.type || "Select category type"
                            : "Select category type"}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[420px] min-w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0"
                      align="start"
                    >
                      <Command shouldFilter={false} className="w-full">
                        <CommandInput
                          placeholder="Search category type..."
                          value={categoryTypeSearch}
                          onValueChange={setCategoryTypeSearch}
                        />
                        <CommandList className="!max-h-[none] overflow-visible p-0">
                          <CommandEmpty>No category type found.</CommandEmpty>
                          <CommandGroup className="overflow-visible p-0">
                            <div
                              className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                              style={{ minHeight: 0 }}
                              onWheel={(e) => e.stopPropagation()}
                            >
                              {categoryTypes
                                .filter((type) =>
                                  !categoryTypeSearch.trim()
                                    ? true
                                    : (type.type || "")
                                        .toLowerCase()
                                        .includes(categoryTypeSearch.toLowerCase())
                                )
                                .map((type) => (
                                  <CommandItem
                                    key={type.id}
                                    value={`${type.type}-${type.id}`}
                                    onSelect={() => {
                                      handleCustomerFormChange("category_type_id", String(type.id));
                                      setCategoryTypeOpen(false);
                                      setCategoryTypeSearch("");
                                    }}
                                    className="cursor-pointer"
                                  >
                                    <span className="font-medium">{type.type}</span>
                                  </CommandItem>
                                ))}
                </div>
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>
            </div>
            </FormSection>

            <FormSection title="Bank Details" icon={CreditCard}>
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-xs text-gray-600">
                  Optional. Add one or more bank accounts for this ledger. Mark one as primary.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={addBankDetailRow}
                  disabled={isSavingCustomer}
                >
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add bank
                </Button>
              </div>
              {bankDetails.length === 0 ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-md px-2.5 py-2">
                  No bank details added. Click &quot;Add bank&quot; to capture account information.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {bankDetails.map((row, index) => (
                    <div
                      key={row.id || `bank-${index}`}
                      className="border rounded-md bg-white p-2.5 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-xs font-medium text-gray-700 cursor-pointer">
                          <Checkbox
                            checked={Boolean(row.is_primary)}
                            onCheckedChange={(checked) =>
                              updateBankDetailRow(index, "is_primary", Boolean(checked))
                            }
                            disabled={isSavingCustomer}
                          />
                          Primary account
                        </label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => removeBankDetailRow(index)}
                          disabled={isSavingCustomer}
                        >
                          <Trash2 className="h-3.5 w-3.5 mr-1" />
                          Remove
                        </Button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2">
                        <div className="space-y-1">
                          <FormLabel>Account Holder</FormLabel>
                          <Input
                            value={row.account_holder}
                            onChange={(e) =>
                              updateBankDetailRow(index, "account_holder", e.target.value)
                            }
                            placeholder="Account holder name"
                            disabled={isSavingCustomer}
                            maxLength={100}
                          />
                        </div>
                        <div className="space-y-1">
                          <FormLabel>Bank Name</FormLabel>
                          <Input
                            value={row.bank_name}
                            onChange={(e) =>
                              updateBankDetailRow(index, "bank_name", e.target.value)
                            }
                            placeholder="e.g. HDFC Bank"
                            disabled={isSavingCustomer}
                            maxLength={100}
                          />
                        </div>
                        <div className="space-y-1">
                          <FormLabel>Branch Name</FormLabel>
                          <Input
                            value={row.branch_name}
                            onChange={(e) =>
                              updateBankDetailRow(index, "branch_name", e.target.value)
                            }
                            placeholder="Branch name"
                            disabled={isSavingCustomer}
                            maxLength={100}
                          />
                        </div>
                        <div className="space-y-1">
                          <FormLabel>Account Type</FormLabel>
                          <Select
                            value={row.account_type || "CURRENT"}
                            onValueChange={(value) =>
                              updateBankDetailRow(index, "account_type", value)
                            }
                            disabled={isSavingCustomer}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select account type" />
                            </SelectTrigger>
                            <SelectContent>
                              {BANK_ACCOUNT_TYPE_OPTIONS.map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  {opt.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <FormLabel>Account Number</FormLabel>
                          <Input
                            value={row.account_number}
                            onChange={(e) =>
                              updateBankDetailRow(
                                index,
                                "account_number",
                                e.target.value.replace(/[^0-9]/g, "")
                              )
                            }
                            placeholder="Account number"
                            disabled={isSavingCustomer}
                            maxLength={30}
                            inputMode="numeric"
                          />
                        </div>
                        <div className="space-y-1">
                          <FormLabel>IFSC Code</FormLabel>
                          <Input
                            value={row.ifsc_code}
                            onChange={(e) =>
                              updateBankDetailRow(
                                index,
                                "ifsc_code",
                                e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "")
                              )
                            }
                            placeholder="e.g. HDFC0001234"
                            className="uppercase"
                            disabled={isSavingCustomer}
                            maxLength={11}
                          />
                        </div>
                        <div className="space-y-1">
                          <FormLabel>UPI ID</FormLabel>
                          <Input
                            value={row.upi_id}
                            onChange={(e) =>
                              updateBankDetailRow(index, "upi_id", e.target.value)
                            }
                            placeholder="name@upi"
                            disabled={isSavingCustomer}
                            maxLength={100}
                          />
                        </div>
                        <div className="space-y-1">
                          <FormLabel>Remarks</FormLabel>
                          <Input
                            value={row.remarks}
                            onChange={(e) =>
                              updateBankDetailRow(index, "remarks", e.target.value)
                            }
                            placeholder="Optional remarks"
                            disabled={isSavingCustomer}
                            maxLength={200}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </FormSection>

            <FormSection title="KYC Documents" icon={FileText}>
              <p className="text-sm text-gray-600">
                Select document type from KYC masters. When document number is required, enter the number and optionally upload a file.
                When only an image is required, upload the file for that document type.
              </p>
              {kycDocuments.map((doc, index) => {
                const selectedNames = kycDocuments
                  .map((item, itemIndex) => (itemIndex === index ? "" : (item.document_name || "").trim().toLowerCase()))
                  .filter(Boolean);
                const availableTypes = activeKycDocumentTypes.filter(
                  (item) => !selectedNames.includes((item.document_name || "").trim().toLowerCase())
                );
                const typeMeta = getKycDocumentTypeMeta(doc.document_name);
                const isImageOnlyDocument = Boolean(typeMeta) && typeMeta.is_required === false;
                const isDocumentNumberRequired = typeMeta?.is_required === true;
                const showDocumentNumber = !isImageOnlyDocument;
                const maxLength = typeMeta?.length || 50;
                const fileUrl =
                  typeof doc.file === "string" && (doc.file.startsWith("http://") || doc.file.startsWith("https://"))
                    ? doc.file
                    : "";

                return (
                  <div key={doc.id || `new-${index}`} className="flex flex-wrap items-start gap-3 p-3 border rounded-md bg-gray-50/50">
                    <div className="flex-1 min-w-[180px]">
                      <Label className="text-xs">Document name</Label>
                      {doc.id ? (
                        <Input value={doc.document_name} disabled />
                      ) : (
                        <Popover
                          open={kycDocNameOpenIndex === index}
                          onOpenChange={(open) => {
                            setKycDocNameOpenIndex(open ? index : null);
                            if (!open) setKycDocNameSearch("");
                          }}
                        >
                          <PopoverTrigger asChild>
                            <Button
                              variant="outline"
                              role="combobox"
                              aria-expanded={kycDocNameOpenIndex === index}
                              className="w-full justify-between font-normal h-10"
                              disabled={isSavingCustomer || doc.uploading}
                            >
                              <span className="truncate">
                                {doc.document_name || "Select document type"}
                                {doc.document_name && typeMeta?.is_required ? " *" : ""}
                              </span>
                              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            className="w-[420px] min-w-[var(--radix-popover-trigger-width)] max-w-[95vw] p-0"
                            align="start"
                          >
                            <Command shouldFilter={false} className="w-full">
                              <CommandInput
                                placeholder="Search document type..."
                                value={kycDocNameSearch}
                                onValueChange={setKycDocNameSearch}
                              />
                              <CommandList className="!max-h-[none] overflow-visible p-0">
                                <CommandEmpty>No document type found.</CommandEmpty>
                                <CommandGroup className="overflow-visible p-0">
                                  <div
                                    className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                                    style={{ minHeight: 0 }}
                                    onWheel={(e) => e.stopPropagation()}
                                  >
                                    {availableTypes
                                      .filter((item) =>
                                        !kycDocNameSearch.trim()
                                          ? true
                                          : (item.document_name || "")
                                              .toLowerCase()
                                              .includes(kycDocNameSearch.toLowerCase())
                                      )
                                      .map((item) => (
                                        <CommandItem
                                          key={item.id}
                                          value={`${item.document_name}-${item.id}`}
                                          onSelect={() => {
                                            kycTouchedRef.current = true;
                                            const selectedMeta = getKycDocumentTypeMeta(item.document_name);
                          const next = [...kycDocuments];
                                            next[index] = {
                                              ...next[index],
                                              document_name: item.document_name,
                                              document_number:
                                                selectedMeta?.is_required === false
                                                  ? ""
                                                  : next[index].document_number,
                                            };
                          setKycDocuments(next);
                                            setKycDocNameOpenIndex(null);
                                            setKycDocNameSearch("");
                                          }}
                                          className="cursor-pointer"
                                        >
                                          <span className="font-medium">
                                            {item.document_name}
                                            {item.is_required ? " *" : ""}
                                          </span>
                                        </CommandItem>
                                      ))}
                    </div>
                                </CommandGroup>
                              </CommandList>
                            </Command>
                          </PopoverContent>
                        </Popover>
                      )}
                    </div>
                    {showDocumentNumber && (
                      <div className="flex-1 min-w-[140px]">
                        <Label className="text-xs">
                          Document number
                          {isDocumentNumberRequired ? <span className="text-red-500 ml-0.5">*</span> : null}
                        </Label>
                      <Input
                        placeholder="Number"
                        value={doc.document_number}
                          maxLength={maxLength}
                        onChange={(e) => {
                            kycTouchedRef.current = true;
                          const next = [...kycDocuments];
                          next[index] = { ...next[index], document_number: e.target.value };
                          setKycDocuments(next);
                        }}
                          disabled={isSavingCustomer || doc.uploading}
                      />
                        {typeMeta?.length ? (
                          <p className="text-[11px] text-gray-500 mt-1">Max {typeMeta.length} characters</p>
                        ) : null}
                    </div>
                    )}
                    <div className="flex-1 min-w-[200px]">
                      <Label className="text-xs">
                        {isImageOnlyDocument ? "Image" : "File"}
                        {isImageOnlyDocument ? <span className="text-red-500 ml-0.5">*</span> : " (optional)"}
                      </Label>
                      <Input
                        type="file"
                        accept="image/*,.pdf"
                        onChange={(e) => {
                          const selectedFile = e.target.files?.[0];
                          if (selectedFile) {
                            handleKycFileSelect(index, selectedFile);
                          }
                          e.target.value = "";
                        }}
                        disabled={isSavingCustomer || doc.uploading}
                      />
                      {doc.uploading && (
                        <div className="mt-1 flex items-center gap-1 text-xs text-blue-600">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Uploading{doc.fileName ? ` ${doc.fileName}` : ""}...
                        </div>
                      )}
                      {!doc.uploading && fileUrl && (
                        <div className="mt-1 flex items-center gap-2 flex-wrap">
                          {isKycImageFileUrl(fileUrl) ? (
                            <button
                              type="button"
                              className="relative w-16 h-16 rounded-sm overflow-hidden bg-white border border-gray-200 cursor-pointer hover:border-blue-300 transition-colors shadow-sm"
                              onClick={() => openKycImageViewer(fileUrl, doc.document_name || "KYC Document")}
                            >
                              <img
                                src={fileUrl}
                                alt={doc.document_name || "KYC preview"}
                                className="w-full h-full object-cover"
                              />
                            </button>
                          ) : (
                            <a
                              href={fileUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs font-medium text-blue-600 hover:underline"
                            >
                              View uploaded file
                            </a>
                          )}
                                <button
                                  type="button"
                            className="inline-flex items-center rounded hover:bg-gray-200 p-0.5"
                                  onClick={() => {
                              kycTouchedRef.current = true;
                                    const next = [...kycDocuments];
                              next[index] = { ...next[index], file: "", fileName: "" };
                                    setKycDocuments(next);
                                  }}
                            aria-label="Remove uploaded file"
                                >
                            <XCircle className="h-3.5 w-3.5 text-gray-600" />
                                </button>
                        </div>
                      )}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="shrink-0 text-red-600 hover:text-red-700 hover:bg-red-50"
                      onClick={() => {
                        kycTouchedRef.current = true;
                        setKycDocuments((prev) => prev.filter((_, i) => i !== index));
                      }}
                      disabled={isSavingCustomer || doc.uploading}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  kycTouchedRef.current = true;
                  setKycDocuments((prev) => [...prev, { document_name: "", document_number: "", file: "" }]);
                }}
                disabled={isSavingCustomer || isKycUploading || activeKycDocumentTypes.length === 0}
              >
                <Plus className="h-4 w-4 mr-2" />
                Add document
              </Button>
              {activeKycDocumentTypes.length === 0 && (
                <p className="text-xs text-amber-700">
                  No active KYC document types found. Add them under Masters → KYC Document Types.
                </p>
              )}
            </FormSection>

            <div className="flex justify-end gap-2 pt-1.5 border-t border-gray-200">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isSavingCustomer}
                onClick={() => {
                  setIsCreateDialogOpen(false);
                  resetCustomerForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleCreateCustomer}
                disabled={isSavingCustomer || isKycUploading}
                className="hover:bg-gray-800 min-w-[8rem]"
              >
                {isSavingCustomer ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    {editingCustomerId ? "Updating..." : "Creating..."}
                  </>
                ) : (
                  editingCustomerId ? "Update Ledger" : "Create Ledger"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Ledger Group Dialog */}
      <Dialog
        open={isCreateLedgerGroupDialogOpen}
        onOpenChange={(open) => {
          if (!open && createLedgerGroupMutation.isPending) return;
          setIsCreateLedgerGroupDialogOpen(open);
          if (!open) {
            setLedgerGroupForm(EMPTY_LEDGER_GROUP_FORM);
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Ledger Group</DialogTitle>
            <DialogDescription>
              Create a ledger group under Primary, Sundry Debtors, or Sundry Creditors.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <FormLabel required>Group Name</FormLabel>
              <Input
                value={ledgerGroupForm.name}
                placeholder="Enter ledger group name"
                disabled={createLedgerGroupMutation.isPending}
                onChange={(e) =>
                  setLedgerGroupForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </div>
            <div className="space-y-1">
              <FormLabel required>Parent</FormLabel>
              <Select
                value={ledgerGroupForm.parent}
                onValueChange={(value) =>
                  setLedgerGroupForm((prev) => ({ ...prev, parent: value }))
                }
                disabled={createLedgerGroupMutation.isPending}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select parent" />
                </SelectTrigger>
                <SelectContent>
                  {ledgerGroupParentOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <Checkbox
                  checked={!!ledgerGroupForm.is_live}
                  disabled={createLedgerGroupMutation.isPending}
                  onCheckedChange={(checked) =>
                    setLedgerGroupForm((prev) => ({ ...prev, is_live: !!checked }))
                  }
                />
                Live
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={createLedgerGroupMutation.isPending}
                onClick={() => setIsCreateLedgerGroupDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveLedgerGroup}
                disabled={createLedgerGroupMutation.isPending}
                className="bg-black hover:bg-gray-900 text-white min-w-[6rem]"
              >
                {createLedgerGroupMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Business Type Dialog */}
      <Dialog
        open={isBusinessTypeDialogOpen}
        onOpenChange={(open) => {
          if (!open && saveBusinessTypeMutation.isPending) return;
          setIsBusinessTypeDialogOpen(open);
          if (!open) {
            setEditingBusinessTypeId(null);
            setBusinessTypeForm({ name: "", description: "", margin_percent: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingBusinessTypeId ? "Edit Business Type" : "Add Business Type"}</DialogTitle>
            <DialogDescription>Manage business types used in ledger classification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <FormLabel required>Name</FormLabel>
              <Input
                value={businessTypeForm.name}
                placeholder="Enter business type name"
                disabled={saveBusinessTypeMutation.isPending}
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setBusinessTypeForm((prev) => ({ ...prev, name: value }));
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <FormLabel>Description</FormLabel>
              <Textarea
                value={businessTypeForm.description}
                onChange={(e) => setBusinessTypeForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
                disabled={saveBusinessTypeMutation.isPending}
              />
            </div>
            <div className="space-y-1">
              <FormLabel required>Margin %</FormLabel>
              <Input
                type="number"
                step="0.01"
                value={businessTypeForm.margin_percent}
                onChange={(e) => setBusinessTypeForm((prev) => ({ ...prev, margin_percent: e.target.value }))}
                placeholder="e.g. 2.5"
                disabled={saveBusinessTypeMutation.isPending}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={saveBusinessTypeMutation.isPending}
                onClick={() => setIsBusinessTypeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveBusinessType}
                disabled={saveBusinessTypeMutation.isPending}
                className="bg-black hover:bg-gray-900 text-white min-w-[6rem]"
              >
                {saveBusinessTypeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingBusinessTypeId ? "Update" : "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Credit Type Dialog */}
      <Dialog
        open={isCreditTypeDialogOpen}
        onOpenChange={(open) => {
          if (!open && saveCreditTypeMutation.isPending) return;
          setIsCreditTypeDialogOpen(open);
          if (!open) {
            setEditingCreditTypeId(null);
            setCreditTypeForm({ name: "", description: "", margin_percent: "" });
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCreditTypeId ? "Edit Credit Type" : "Add Credit Type"}</DialogTitle>
            <DialogDescription>Manage credit types used in ledger classification.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <FormLabel required>Name</FormLabel>
              <Input
                value={creditTypeForm.name}
                placeholder="Enter credit type name"
                disabled={saveCreditTypeMutation.isPending}
                maxLength={30}
                onChange={(e) => {
                  const value = e.target.value;
                  if (/^[A-Za-z\s]*$/.test(value)) {
                    setCreditTypeForm((prev) => ({ ...prev, name: value }));
                  }
                }}
              />
            </div>
            <div className="space-y-1">
              <FormLabel>Description</FormLabel>
              <Textarea
                value={creditTypeForm.description}
                onChange={(e) => setCreditTypeForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Optional description"
                rows={2}
                disabled={saveCreditTypeMutation.isPending}
              />
            </div>
            <div className="space-y-1">
              <FormLabel required>Margin %</FormLabel>
              <Input
                type="number"
                step="0.01"
                value={creditTypeForm.margin_percent}
                onChange={(e) => setCreditTypeForm((prev) => ({ ...prev, margin_percent: e.target.value }))}
                placeholder="e.g. 1.5"
                disabled={saveCreditTypeMutation.isPending}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                disabled={saveCreditTypeMutation.isPending}
                onClick={() => setIsCreditTypeDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleSaveCreditType}
                disabled={saveCreditTypeMutation.isPending}
                className="bg-black hover:bg-gray-900 text-white min-w-[6rem]"
              >
                {saveCreditTypeMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  editingCreditTypeId ? "Update" : "Create"
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* KYC Image Viewer Dialog */}
      <Dialog
        open={isKycImageDialogOpen}
        onOpenChange={(open) => {
          setIsKycImageDialogOpen(open);
          if (!open) {
            setSelectedKycImage(null);
            setKycImageZoom(1);
            setKycImagePosition({ x: 0, y: 0 });
          }
        }}
      >
        <DialogContent className="max-w-6xl max-h-[90vh] p-0">
          {selectedKycImage && (
            <>
              <DialogHeader className="px-6 pt-6 pb-4 border-b">
                <DialogTitle className="flex items-center space-x-2">
                  <ImageIcon className="h-5 w-5" />
                  <span>{selectedKycImage.title}</span>
                </DialogTitle>
              </DialogHeader>

              <div
                className="relative flex items-center justify-center bg-black/50 p-6 min-h-[400px] max-h-[70vh] overflow-hidden cursor-move"
                onMouseDown={(e) => {
                  if (e.button === 0) {
                    setIsKycImageDragging(true);
                    setKycImageDragStart({
                      x: e.clientX - kycImagePosition.x,
                      y: e.clientY - kycImagePosition.y,
                    });
                  }
                }}
                onMouseMove={(e) => {
                  if (isKycImageDragging) {
                    setKycImagePosition({
                      x: e.clientX - kycImageDragStart.x,
                      y: e.clientY - kycImageDragStart.y,
                    });
                  }
                }}
                onMouseUp={() => {
                  setIsKycImageDragging(false);
                }}
                onMouseLeave={() => {
                  setIsKycImageDragging(false);
                }}
                onWheel={(e) => {
                  e.preventDefault();
                  const delta = e.deltaY > 0 ? -0.1 : 0.1;
                  setKycImageZoom((prev) => Math.max(0.5, Math.min(3, prev + delta)));
                }}
              >
                <div
                  className="relative inline-block"
                  style={{
                    transform: `translate(${kycImagePosition.x}px, ${kycImagePosition.y}px) scale(${kycImageZoom})`,
                    transformOrigin: "center center",
                    transition: isKycImageDragging ? "none" : "transform 0.1s ease-out",
                    cursor: isKycImageDragging ? "grabbing" : "grab",
                  }}
                >
                  <img
                    src={selectedKycImage.url}
                    alt={selectedKycImage.title}
                    className="max-w-full max-h-[70vh] object-contain select-none"
                    draggable={false}
                    onError={(e) => {
                      e.target.style.display = "none";
                    }}
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t flex items-center justify-between bg-gray-50">
                <div className="flex items-center space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setKycImageZoom((prev) => Math.max(0.5, prev - 0.25))}
                    disabled={kycImageZoom <= 0.5}
                  >
                    <Minus className="h-4 w-4 mr-1" />
                    Zoom Out
                  </Button>
                  <span className="text-sm text-gray-600 px-2">
                    {Math.round(kycImageZoom * 100)}%
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setKycImageZoom((prev) => Math.min(3, prev + 0.25))}
                    disabled={kycImageZoom >= 3}
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Zoom In
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setKycImageZoom(1);
                      setKycImagePosition({ x: 0, y: 0 });
                    }}
                  >
                    Reset
                  </Button>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.open(selectedKycImage.url, "_blank")}
                >
                  Open in New Tab
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={isExcelDownloadDialogOpen} onOpenChange={handleExcelDownloadDialogChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Excel Generated Successfully</DialogTitle>
            <DialogDescription>
              Your ledger masters Excel report is ready.
              {generatedExcelFile?.total_records != null && (
                <span>
                  {' '}
                  {generatedExcelFile.total_records} ledger
                  {generatedExcelFile.total_records === 1 ? '' : 's'} included based on your current filters.
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => handleExcelDownloadDialogChange(false)}
            >
              Close
            </Button>
            <a
              href={generatedExcelFile?.download_url || '#'}
              target="_blank"
              rel="noopener noreferrer"
              download={generatedExcelFile?.filename || 'ledger_masters.xlsx'}
              onClick={(event) => {
                if (!generatedExcelFile?.download_url) {
                  event.preventDefault();
                }
              }}
              className="inline-flex items-center justify-center rounded-md text-sm font-medium h-10 px-4 py-2 bg-green-600 hover:bg-green-700 text-white disabled:pointer-events-none disabled:opacity-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Download Now
            </a>
          </div>
        </DialogContent>
      </Dialog>

      <Sheet open={isMoreFiltersOpen} onOpenChange={setIsMoreFiltersOpen}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="px-6 py-4 border-b bg-slate-900 text-white space-y-1">
            <SheetTitle className="text-white">More filters</SheetTitle>
            <SheetDescription className="text-slate-300">
              Apply additional ledger filters.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Building className="h-4 w-4 text-blue-600" />
                Parent
              </Label>
              <Select
                value={moreFiltersDraft.parent || "all"}
                onValueChange={(value) =>
                  setMoreFiltersDraft((prev) => ({
                    ...prev,
                    parent: value === "all" ? null : value,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All parents" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All parents</SelectItem>
                  {uniqueParents.map((parent) => (
                    <SelectItem key={parent} value={parent}>
                      {parent}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-indigo-600" />
                  Branch
                </Label>
                <Select
                  value={
                    moreFiltersDraft.branchFilter?.id != null
                      ? String(moreFiltersDraft.branchFilter.id)
                      : "all"
                  }
                  onValueChange={(value) => {
                    if (value === "all") {
                      setMoreFiltersDraft((prev) => ({ ...prev, branchFilter: null }));
                      return;
                    }
                    const branch = (branchFilterOptions || []).find(
                      (b) => String(b.id) === String(value)
                    );
                    setMoreFiltersDraft((prev) => ({
                      ...prev,
                      branchFilter: branch
                        ? { id: branch.id, name: branch.name }
                        : null,
                    }));
                  }}
                  disabled={branchesLoading}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All branches" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All branches</SelectItem>
                    {(branchFilterOptions || []).map((branch) => (
                      <SelectItem key={branch.id} value={String(branch.id)}>
                        {branch.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-blue-600" />
                  Status
                </Label>
                <Select
                  value={moreFiltersDraft.isActive || "all"}
                  onValueChange={(value) =>
                    setMoreFiltersDraft((prev) => ({ ...prev, isActive: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-indigo-600" />
                Area Group
              </Label>
              <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                {(areaGroupsData || []).length === 0 ? (
                  <p className="text-xs text-muted-foreground px-1 py-2">No area groups found</p>
                ) : (
                  (areaGroupsData || []).map((area) => {
                    const areaId = Number(area.id);
                    const checked = moreFiltersDraft.areaGroupIds.includes(areaId);
                    return (
                      <label
                        key={area.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              areaGroupIds: toggleMultiValue(prev.areaGroupIds, areaId),
                            }))
                          }
                        />
                        <span className="truncate">{area.name}</span>
                      </label>
                    );
                  })
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-green-600" />
                  Ledger Type
                </Label>
                <Select
                  value={moreFiltersDraft.ledgerType || "all"}
                  onValueChange={(value) =>
                    setMoreFiltersDraft((prev) => ({
                      ...prev,
                      ledgerType: value === "all" ? null : value,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All" />
                  </SelectTrigger>
                  <SelectContent>
                    {LEDGER_TYPE_FILTER_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-slate-600" />
                  Created By
                </Label>
                <div className="border rounded-md max-h-40 overflow-y-auto p-2 space-y-1">
                  {(orgUsersData || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">No users found</p>
                  ) : (
                    (orgUsersData || []).map((user) => {
                      const userId = String(user.user_id || user.id || "");
                      if (!userId) return null;
                      const checked = moreFiltersDraft.createdByIds.includes(userId);
                      return (
                        <label
                          key={userId}
                          className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                        >
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              setMoreFiltersDraft((prev) => ({
                                ...prev,
                                createdByIds: toggleMultiValue(prev.createdByIds, userId),
                              }))
                            }
                          />
                          <span className="truncate">{user.name || userId}</span>
                        </label>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <Store className="h-4 w-4 text-emerald-600" />
                  Business Type
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(businessTypesData || []).map((type) => {
                    const typeId = Number(type.id);
                    const checked = moreFiltersDraft.businessTypeIds.includes(typeId);
                    return (
                      <label
                        key={type.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              businessTypeIds: toggleMultiValue(prev.businessTypeIds, typeId),
                            }))
                          }
                        />
                        <span className="truncate">{type.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-violet-600" />
                  Credit Type
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(creditTypesData || []).map((type) => {
                    const typeId = Number(type.id);
                    const checked = moreFiltersDraft.creditTypeIds.includes(typeId);
                    return (
                      <label
                        key={type.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              creditTypeIds: toggleMultiValue(prev.creditTypeIds, typeId),
                            }))
                          }
                        />
                        <span className="truncate">{type.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-sky-600" />
                  Category Type
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(categoryTypes || []).map((type) => {
                    const typeId = Number(type.id);
                    const checked = moreFiltersDraft.categoryTypeIds.includes(typeId);
                    return (
                      <label
                        key={type.id}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              categoryTypeIds: toggleMultiValue(prev.categoryTypeIds, typeId),
                            }))
                          }
                        />
                        <span className="truncate">{type.type || type.name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-1">
                <Label className="flex items-center gap-2">
                  <User className="h-4 w-4 text-amber-600" />
                  Religion
                </Label>
                <div className="border rounded-md max-h-36 overflow-y-auto p-2 space-y-1">
                  {(religionOptions || []).map((item) => {
                    const value = item.religion;
                    const checked = moreFiltersDraft.religions.includes(value);
                    return (
                      <label
                        key={item.id || value}
                        className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() =>
                            setMoreFiltersDraft((prev) => ({
                              ...prev,
                              religions: toggleMultiValue(prev.religions, value),
                            }))
                          }
                        />
                        <span className="truncate">{value}</span>
                      </label>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-rose-600" />
                Week Off
              </Label>
              <div className="border rounded-md p-2 grid grid-cols-2 gap-1">
                {WEEK_OFF_OPTIONS.map((day) => {
                  const checked = moreFiltersDraft.weekOffs.includes(day);
                  return (
                    <label
                      key={day}
                      className="flex items-center gap-2 text-sm px-1 py-1 rounded hover:bg-muted/50 cursor-pointer"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          setMoreFiltersDraft((prev) => ({
                            ...prev,
                            weekOffs: toggleMultiValue(prev.weekOffs, day),
                          }))
                        }
                      />
                      <span>{day}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <SheetFooter className="px-6 py-4 border-t gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={clearMoreFiltersDraft} className="flex-1">
              <X className="h-4 w-4 mr-1" />
              Clear
            </Button>
            <Button type="button" onClick={applyMoreFilters} className="flex-1 bg-slate-900 hover:bg-slate-800">
              Apply
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      {isLoading && <Loader />}
    </div>
  );
}