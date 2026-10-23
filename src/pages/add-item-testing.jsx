import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  Camera,
  Check,
  CheckCircle,
  ChevronLeft,
  ChevronsUpDown,
  FileText,
  FlaskConical,
  ImageIcon,
  Menu,
  Package,
  Plus,
  Save,
  TestTube,
  X,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import CommonLoader from "@/components/common/loader";
import { useIsMobile } from "@/hooks/use-mobile";
import { useToast } from "@/hooks/use-toast";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { AuthService } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const REPORT_API = `${API_BASE_URL}/api/report`;

const themedCardClass = "shadow-lg border-0 bg-white/80 backdrop-blur-sm overflow-hidden";
const themedCardHeaderClass = "bg-black text-white rounded-t-lg p-3";
const fieldLabelClass = "text-sm font-medium text-gray-700";
const fieldTriggerClass =
  "h-10 w-full border-gray-300 hover:border-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

const normalizeBatchName = (name) => {
  const trimmed = String(name || "").trim();
  if (!trimmed || trimmed === "Primary Batch") return "Primary";
  return trimmed;
};

const resolveLotBalanceForBatch = (allocations, batch) => {
  if (!Array.isArray(allocations) || !allocations.length) return "";
  const target = normalizeBatchName(batch);
  const match = allocations.find(
    (row) => normalizeBatchName(row.batch_name) === target
  );
  if (match) {
    if (match.balance != null && match.balance !== "") {
      return String(match.balance);
    }
    return match.current_balance_full || match.current_balance || "";
  }
  if (target !== "Primary") return "";
  const primary = allocations.find(
    (row) => normalizeBatchName(row.batch_name) === "Primary"
  );
  if (!primary) return "";
  if (primary.balance != null && primary.balance !== "") {
    return String(primary.balance);
  }
  return primary.current_balance_full || primary.current_balance || "";
};

const isColorLabTestParam = (param) =>
  String(param?.parameter_name ?? "").trim().toLowerCase() === "color";

const makeExtraImageKey = () =>
  `img-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const sanitizeLabTestColorValue = (rawValue) => {
  const text = String(rawValue ?? "");
  return text.replace(/[^a-zA-Z0-9 ]/g, "").slice(0, 20);
};

const validateLabTestValue = (param, value) => {
  if (isColorLabTestParam(param)) {
    if (param.is_validation_required && (!value || String(value).trim() === "")) {
      return "Please enter a value";
    }
    return null;
  }

  if (!param.is_validation_required || !value || value.trim() === "") {
    return null;
  }
  const numValue = parseFloat(value);
  if (Number.isNaN(numValue)) {
    return "Please enter a valid number";
  }
  if (param.min_value != null && numValue < param.min_value) {
    return `Value must be at least ${param.min_value} ${param.unit || ""}`;
  }
  if (param.max_value != null && numValue > param.max_value) {
    return `Value must be at most ${param.max_value} ${param.unit || ""}`;
  }
  return null;
};

const sanitizeLabTestNumericValue = (rawValue) => {
  const text = String(rawValue ?? "");
  let cleaned = text.replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    cleaned = `${cleaned.slice(0, dotIndex + 1)}${cleaned.slice(dotIndex + 1).replace(/\./g, "")}`;
  }
  const [intPart, decimalPart] = cleaned.split(".");
  const limitedIntPart = (intPart || "").slice(0, 3);
  if (cleaned.includes(".")) {
    return `${limitedIntPart}.${decimalPart || ""}`;
  }
  return limitedIntPart;
};

const formatCountableTotal = (value) => {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)));
};

const getValidationStatus = (param) => {
  if (!param.is_validation_required) {
    return { status: "none", text: "No Validation", icon: CheckCircle, color: "text-gray-500" };
  }
  if (param.min_value && param.max_value) {
    return {
      status: "range",
      text: `${param.min_value} - ${param.max_value} ${param.unit || ""}`,
      icon: AlertTriangle,
      color: "text-blue-500",
    };
  }
  return {
    status: "required",
    text: "Validation Required",
    icon: AlertTriangle,
    color: "text-orange-500",
  };
};

export default function AddItemTesting() {
  const [, setLocation] = useLocation();
  const searchString = useSearch();
  const searchParams = new URLSearchParams(
    typeof searchString === "string"
      ? searchString
      : typeof window !== "undefined"
        ? window.location.search
        : ""
  );
  const testingIdParam = searchParams.get("testing_id");
  const testingId = testingIdParam ? parseInt(testingIdParam, 10) : null;
  const isEditMode = !!testingId && !Number.isNaN(testingId);

  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isMobile = useIsMobile();
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  const { hasPermission, isLoading: permissionsLoading } = useUserPermissions();
  const canCreate = hasPermission("item_testing", "create");
  const canUpdate = hasPermission("item_testing", "update");
  const allowed = isEditMode ? canUpdate : canCreate;

  const [godownId, setGodownId] = useState("");
  const [stockItemId, setStockItemId] = useState("");
  const [batchName, setBatchName] = useState("Primary");
  const [stockBalance, setStockBalance] = useState("");
  const [testerRemarks, setTesterRemarks] = useState("");
  const [itemSearch, setItemSearch] = useState("");
  const [debouncedItemSearch, setDebouncedItemSearch] = useState("");
  const [stockItemOpen, setStockItemOpen] = useState(false);
  const [godownOpen, setGodownOpen] = useState(false);
  const [godownSearch, setGodownSearch] = useState("");
  const [itemGroupOpen, setItemGroupOpen] = useState(false);
  const [itemGroupSearch, setItemGroupSearch] = useState("");

  const [selectedItemGroup, setSelectedItemGroup] = useState(null);
  const [selectedLabTestParamIds, setSelectedLabTestParamIds] = useState([]);
  const [labTestValues, setLabTestValues] = useState({});
  const [isLabTestPopupOpen, setIsLabTestPopupOpen] = useState(false);
  const [popupSelectedParams, setPopupSelectedParams] = useState([]);
  const [labTestValidationErrors, setLabTestValidationErrors] = useState({});
  const [extraImages, setExtraImages] = useState([]);
  const [imagesTouched, setImagesTouched] = useState(false);
  const editPopulatedRef = useRef(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedItemSearch(itemSearch), 300);
    return () => clearTimeout(timer);
  }, [itemSearch]);

  const { data: godowns = [], isLoading: godownsLoading } = useQuery({
    queryKey: ["item-testing-godowns-form"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${API_BASE_URL}/api/get-godowns/`);
      const payload = await response.json();
      return payload?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && allowed,
  });

  const selectedGodown = useMemo(
    () => godowns.find((g) => String(g.id) === String(godownId)),
    [godowns, godownId]
  );

  const filteredGodowns = useMemo(() => {
    const term = godownSearch.trim().toLowerCase();
    const sorted = [...godowns].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
    if (!term) return sorted;
    return sorted.filter((godown) => (godown.name || "").toLowerCase().includes(term));
  }, [godowns, godownSearch]);

  const handleGodownSelect = (id) => {
    setGodownId(String(id));
    setStockItemId("");
    setBatchName("Primary");
    setStockBalance("");
    setItemSearch("");
    setGodownOpen(false);
    setGodownSearch("");
  };

  const handleGodownClear = () => {
    setGodownId("");
    setStockItemId("");
    setBatchName("Primary");
    setStockBalance("");
    setItemSearch("");
    setGodownSearch("");
  };

  const { data: stockItems = [], isLoading: stockItemsLoading } = useQuery({
    queryKey: ["item-testing-stock-items", godownId, debouncedItemSearch],
    queryFn: async () => {
      const godownName = selectedGodown?.name || "";
      const body = {
        list_mode: "default",
        is_active: true,
        new_page: 1,
        per_page: 100,
        godown_name: godownName,
        godown: godownName,
      };
      const trimmed = debouncedItemSearch.trim();
      if (trimmed) body.search = trimmed;
      const response = await apiRequest("POST", `${API_BASE_URL}/api/stock-items-list/`, body);
      const payload = await response.json();
      if (payload?.status && Number(payload.status) >= 400) {
        throw new Error(payload.message || payload?.error || "Failed to load stock items");
      }
      return Array.isArray(payload?.data) ? payload.data : [];
    },
    enabled: !!AuthService.getAccessToken() && !!selectedGodown?.name && allowed,
  });

  const selectedStockItem = useMemo(
    () => stockItems.find((item) => String(item.id) === String(stockItemId)),
    [stockItems, stockItemId]
  );

  const { data: batchOptions = [], isLoading: batchesLoading } = useQuery({
    queryKey: ["item-testing-batches", godownId, stockItemId],
    queryFn: async () => {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/item-lot-details/`, {
        stock_item_id: parseInt(stockItemId, 10),
        godown_name: selectedGodown?.name || "",
      });
      const payload = await response.json();
      if (payload?.error) {
        throw new Error(payload.error);
      }
      const allocations = payload?.batch_allocations || [];
      const names = allocations
        .map((row) => normalizeBatchName(row.batch_name))
        .filter(Boolean);
      const unique = [...new Set(names)];
      return unique.length ? unique : ["Primary"];
    },
    enabled:
      !!AuthService.getAccessToken()
      && !!selectedGodown?.name
      && !!stockItemId
      && allowed,
  });

  useEffect(() => {
    if (!stockItemId || batchesLoading) return;
    const options = batchOptions.length ? batchOptions : ["Primary"];
    setBatchName((current) => (options.includes(current) ? current : options[0]));
  }, [stockItemId, godownId, batchOptions, batchesLoading]);

  const { data: liveStockBalance, isFetching: stockBalanceLoading } = useQuery({
    queryKey: [
      "item-testing-stock-balance",
      godownId,
      stockItemId,
      batchName,
      selectedGodown?.name,
    ],
    queryFn: async () => {
      const response = await apiRequest("POST", `${API_BASE_URL}/api/item-lot-details/`, {
        stock_item_id: parseInt(stockItemId, 10),
        godown_name: selectedGodown?.name || "",
        item_name: selectedStockItem?.name || "",
      });
      const payload = await response.json();
      if (payload?.error) {
        throw new Error(payload.error);
      }
      return resolveLotBalanceForBatch(payload?.batch_allocations || [], batchName);
    },
    enabled:
      !!AuthService.getAccessToken()
      && !!selectedGodown?.name
      && !!stockItemId
      && !!batchName
      && allowed,
  });

  useEffect(() => {
    if (liveStockBalance === undefined) return;
    setStockBalance(String(liveStockBalance || ""));
  }, [liveStockBalance]);

  const { data: itemGroups = [], isLoading: itemGroupsLoading } = useQuery({
    queryKey: ["item-testing-item-groups"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${REPORT_API}/test-params-groups/`);
      const payload = await response.json();
      return payload?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && allowed,
  });

  const filteredItemGroups = useMemo(() => {
    const term = itemGroupSearch.trim().toLowerCase();
    const sorted = [...itemGroups].sort((a, b) =>
      (a.name || "").localeCompare(b.name || "")
    );
    if (!term) return sorted;
    return sorted.filter((group) => (group.name || "").toLowerCase().includes(term));
  }, [itemGroups, itemGroupSearch]);

  const { data: labTestParams = [], isLoading: labTestParamsLoading } = useQuery({
    queryKey: ["item-testing-lab-params"],
    queryFn: async () => {
      const response = await apiRequest("GET", `${REPORT_API}/lab-test-params/`);
      const payload = await response.json();
      return payload?.data || [];
    },
    enabled: !!AuthService.getAccessToken() && allowed,
  });

  const { data: editDetail, isLoading: editLoading } = useQuery({
    queryKey: ["item-testing-edit", testingId],
    queryFn: async () => {
      const response = await apiRequest(
        "GET",
        `${REPORT_API}/get-stock-item-testings/${testingId}/`
      );
      const payload = await response.json();
      if (!response.ok || (payload?.status && Number(payload.status) >= 400)) {
        throw new Error(payload?.error || payload?.message || "Failed to load entry");
      }
      return payload?.data;
    },
    enabled: isEditMode && allowed,
  });

  const getFilteredLabTestParams = useCallback(() => {
    if (!selectedItemGroup) return [];
    return labTestParams.filter(
      (param) =>
        param.item_groups
        && param.item_groups.some((group) => group.id === selectedItemGroup.id)
    );
  }, [labTestParams, selectedItemGroup]);

  const applyAllParamsForGroup = useCallback(
    (group) => {
      if (!group) return;
      const ids = labTestParams
        .filter(
          (param) =>
            param.item_groups
            && param.item_groups.some((g) => g.id === group.id)
        )
        .map((param) => param.id);
      setSelectedLabTestParamIds(ids);
      setPopupSelectedParams(ids);
      setLabTestValues((prev) => {
        const next = {};
        ids.forEach((paramId) => {
          next[paramId] = prev[paramId] ?? { value: "", image: "", remarks: "" };
        });
        return next;
      });
      setLabTestValidationErrors({});
    },
    [labTestParams]
  );

  const handleItemGroupChange = (group, options = { autoSelectAll: true }) => {
    setSelectedItemGroup(group);
    if (!group) {
      setPopupSelectedParams([]);
      setSelectedLabTestParamIds([]);
      setLabTestValues({});
      setLabTestValidationErrors({});
      return;
    }
    if (options.autoSelectAll) {
      applyAllParamsForGroup(group);
    } else {
      setPopupSelectedParams([]);
    }
  };

  const handleItemGroupClear = () => {
    handleItemGroupChange(null);
    setItemGroupSearch("");
  };

  const handleOpenLabTestPopup = () => {
    setIsLabTestPopupOpen(true);
    setPopupSelectedParams([...selectedLabTestParamIds]);
  };

  const handleCloseLabTestPopup = () => {
    setIsLabTestPopupOpen(false);
  };

  const handlePopupParamToggle = (paramId) => {
    setPopupSelectedParams((prev) =>
      prev.includes(paramId) ? prev.filter((id) => id !== paramId) : [...prev, paramId]
    );
  };

  const handleApplyLabTestSelection = () => {
    const applied = popupSelectedParams || [];
    setSelectedLabTestParamIds(applied);
    setLabTestValues((prev) => {
      const next = { ...prev };
      applied.forEach((paramId) => {
        if (!next[paramId]) {
          next[paramId] = { value: "", image: "", remarks: "" };
        }
      });
      Object.keys(next).forEach((key) => {
        const id = Number(key);
        if (!applied.includes(id)) {
          delete next[id];
        }
      });
      return next;
    });
    handleCloseLabTestPopup();
  };

  const handleRemoveLabTestParam = (paramId) => {
    setSelectedLabTestParamIds((prev) => prev.filter((id) => id !== paramId));
    setLabTestValues((prev) => {
      const next = { ...prev };
      delete next[paramId];
      return next;
    });
    setLabTestValidationErrors((prev) => {
      const next = { ...prev };
      delete next[String(paramId)];
      return next;
    });
  };

  const handleLabTestValueChange = (paramId, value) => {
    const param = labTestParams.find((p) => p.id === paramId);
    const sanitizedValue =
      param && isColorLabTestParam(param)
        ? sanitizeLabTestColorValue(value)
        : sanitizeLabTestNumericValue(value);
    setLabTestValues((prev) => ({
      ...prev,
      [paramId]: { ...(prev[paramId] || { image: "", remarks: "" }), value: sanitizedValue },
    }));

    if (param) {
      const error = validateLabTestValue(param, sanitizedValue);
      setLabTestValidationErrors((prev) => {
        if (error) return { ...prev, [String(paramId)]: error };
        const next = { ...prev };
        delete next[String(paramId)];
        return next;
      });
      if (error) {
        toast({
          title: "Validation Error",
          description: error,
          variant: "destructive",
          duration: 2000,
        });
      }
    }
  };

  const handleLabTestImageChange = (paramId, imageBase64) => {
    setLabTestValues((prev) => ({
      ...prev,
      [paramId]: { ...(prev[paramId] || { value: "", remarks: "" }), image: imageBase64 },
    }));
  };

  const handleLabTestRemarksChange = (paramId, remarks) => {
    setLabTestValues((prev) => ({
      ...prev,
      [paramId]: { ...(prev[paramId] || { value: "", image: "" }), remarks },
    }));
  };

  const handleExtraImageUpload = (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target?.result || "";
        if (!dataUrl) return;
        setExtraImages((prev) => [
          ...prev,
          {
            key: makeExtraImageKey(),
            preview: dataUrl,
            payload: dataUrl,
            isNew: true,
          },
        ]);
        setImagesTouched(true);
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  const handleRemoveExtraImage = (key) => {
    setExtraImages((prev) => prev.filter((item) => item.key !== key));
    setImagesTouched(true);
  };

  useEffect(() => {
    editPopulatedRef.current = false;
  }, [testingId]);

  useEffect(() => {
    if (!editDetail || !labTestParams.length || editPopulatedRef.current) return;

    setGodownId(String(editDetail.godown_id || ""));
    setStockItemId(String(editDetail.stock_item_id || ""));
    setBatchName(editDetail.batch_name || "Primary");
    setStockBalance(editDetail.stock_balance || "");
    setTesterRemarks(editDetail.tester_remarks || "");

    const headerImages = (editDetail.images || []).map((img) => ({
      key: `existing-${img.id}`,
      preview: img.image || "",
      payload: img.image || "",
      isNew: false,
    }));
    setExtraImages(headerImages);
    setImagesTouched(false);

    const rows = editDetail.test_params || [];
    const paramIds = rows.map((p) => p.test_param_id);
    const values = {};
    rows.forEach((p) => {
      values[p.test_param_id] = {
        value: p.value || "",
        remarks: p.remarks || "",
        ...(p.test_image ? { test_image: p.test_image } : {}),
      };
    });

    if (paramIds.length > 0) {
      const firstParam = labTestParams.find((p) => p.id === paramIds[0]);
      const groupFromParam = firstParam?.item_groups?.[0];
      if (groupFromParam) {
        const fullGroup = itemGroups.find((g) => g.id === groupFromParam.id) || groupFromParam;
        handleItemGroupChange(fullGroup, { autoSelectAll: true });
        setLabTestValues((prev) => {
          const merged = { ...values };
          Object.keys(prev).forEach((key) => {
            const paramId = Number(key);
            if (prev[paramId]?.image) {
              merged[paramId] = { ...merged[paramId], ...prev[paramId] };
            }
          });
          return merged;
        });
        editPopulatedRef.current = true;
        return;
      }
    }

    setSelectedLabTestParamIds(paramIds);
    setLabTestValues(values);
    editPopulatedRef.current = true;
  }, [editDetail, labTestParams, itemGroups]);

  useEffect(() => {
    if (isEditMode || !selectedStockItem || !itemGroups.length) return;
    const groupingStr = String(
      selectedStockItem.item_groupings || selectedStockItem.item_grouping || ""
    );
    if (!groupingStr.trim()) return;
    const parts = groupingStr.split(",").map((s) => s.trim()).filter(Boolean);
    const match = itemGroups.find((g) =>
      parts.some((p) => p.toLowerCase() === String(g.name || "").toLowerCase())
    );
    if (match) {
      handleItemGroupChange(match, { autoSelectAll: true });
    }
  }, [selectedStockItem?.id, itemGroups, labTestParams, isEditMode]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      const response = await apiRequest("POST", `${REPORT_API}/stock-item-testing/`, payload);
      const data = await response.json();
      if (!response.ok || (data?.status && Number(data.status) >= 400)) {
        throw new Error(data?.error || data?.message || "Save failed");
      }
      return data;
    },
    onSuccess: async (data) => {
      await queryClient.invalidateQueries({ queryKey: ["stock-item-testings"] });
      await queryClient.refetchQueries({ queryKey: ["stock-item-testings"] });
      toast({
        title: "Success",
        description: data?.message || "Saved successfully",
        variant: "success",
      });
      setLocation("/item-testing");
    },
    onError: (err) => {
      toast({
        title: "Error",
        description: err.message || "Failed to save",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!godownId || !stockItemId) {
      toast({
        title: "Validation",
        description: "Godown and stock item are required.",
        variant: "destructive",
      });
      return;
    }

    if (!selectedItemGroup) {
      toast({
        title: "Validation",
        description: "Select an item group before adding test parameters.",
        variant: "destructive",
      });
      return;
    }

    const filledParamIds = selectedLabTestParamIds.filter((paramId) => {
      const value = String(labTestValues[paramId]?.value ?? "").trim();
      return value !== "";
    });

    const validationErrors = {};
    filledParamIds.forEach((paramId) => {
      const param = labTestParams.find((p) => p.id === paramId);
      const entry = labTestValues[paramId] || {};
      const value = String(entry.value ?? "").trim();
      if (!param) return;
      const valueError = validateLabTestValue(param, value);
      if (valueError) validationErrors[String(paramId)] = valueError;
      if (param.is_image_required && !entry.image && !entry.test_image) {
        validationErrors[String(paramId)] = "Image is required for this parameter";
      }
    });
    if (Object.keys(validationErrors).length > 0) {
      setLabTestValidationErrors(validationErrors);
      toast({
        title: "Validation",
        description: "Fix errors in test parameter values before submitting.",
        variant: "destructive",
      });
      return;
    }

    const selectedGroupId = Number(selectedItemGroup?.id);
    const countableInSelection = selectedLabTestParamIds.filter((paramId) => {
      const param = labTestParams.find((p) => p.id === paramId);
      if (!param?.is_countable) return false;
      return (
        Array.isArray(param.item_groups)
        && param.item_groups.some((g) => Number(g.id) === selectedGroupId)
      );
    });
    const filledCountableIds = countableInSelection.filter((paramId) =>
      filledParamIds.includes(paramId)
    );

    if (
      filledCountableIds.length > 0
      && filledCountableIds.length === countableInSelection.length
    ) {
      const hasInvalidNumeric = filledCountableIds.some((paramId) => {
        const raw = String(labTestValues[paramId]?.value ?? "").trim();
        return Number.isNaN(parseFloat(raw));
      });
      if (hasInvalidNumeric) {
        toast({
          title: "Validation Error",
          description: "Enter valid numeric values for countable parameters.",
          variant: "destructive",
        });
        return;
      }
      const totalCountable = filledCountableIds.reduce((sum, paramId) => {
        return sum + parseFloat(String(labTestValues[paramId]?.value ?? ""));
      }, 0);
      if (Math.abs(totalCountable - 100) > 0.001) {
        toast({
          title: "Validation Error",
          description: `Countable parameters total is ${totalCountable}%. It must be exactly 100%.`,
          variant: "destructive",
        });
        return;
      }
    }

    const test_params = filledParamIds.map((paramId) => {
      const entry = labTestValues[paramId] || {};
      const param = labTestParams.find((p) => p.id === paramId);
      const value = param && isColorLabTestParam(param)
        ? sanitizeLabTestColorValue(entry.value)
        : String(entry.value ?? "").trim();
      return {
        test_param_id: paramId,
        value,
        remarks: entry.remarks || "",
        ...(entry.image ? { image: entry.image } : {}),
        ...(entry.test_image && !entry.image ? { test_image: entry.test_image } : {}),
      };
    });

    if (test_params.length === 0) {
      toast({
        title: "Validation",
        description: "Add at least one test parameter with a value.",
        variant: "destructive",
      });
      return;
    }

    const payload = {
      godown_id: parseInt(godownId, 10),
      stock_item_id: parseInt(stockItemId, 10),
      batch_name: batchName.trim() || "Primary",
      stock_balance: stockBalance.trim() || "",
      tester_remarks: testerRemarks,
      test_params,
    };
    if (isEditMode) payload.testing_id = testingId;

    const imagesPayload = extraImages
      .map((item) => item.payload)
      .filter((value) => value && String(value).trim());
    if (imagesPayload.length > 0 || imagesTouched) {
      payload.images = imagesPayload;
    }

    saveMutation.mutate(payload);
  };

  const filteredPopupParams = getFilteredLabTestParams();

  if (permissionsLoading || (isEditMode && editLoading)) {
    return (
      <div className="flex h-screen">
        <CommonLoader />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Access denied</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                You do not have permission to {isEditMode ? "update" : "create"} item testing entries.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setLocation("/item-testing")}>
                Back to list
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (isEditMode && editDetail && editDetail.status !== "pending") {
    return (
      <div className="flex h-screen bg-gray-50">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center p-6">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Cannot edit</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Only pending entries can be updated.
              </p>
              <Button className="mt-4" variant="outline" onClick={() => setLocation("/item-testing")}>
                Back to list
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-50 relative">
      {saveMutation.isPending && (
        <CommonLoader text={isEditMode ? "Updating item testing..." : "Saving item testing..."} />
      )}
      <Sidebar />
      {isMobile && (
        <MobileSidebar
          isOpen={isMobileSidebarOpen}
          onClose={() => setIsMobileSidebarOpen(false)}
        />
      )}

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <header className="bg-white border-b px-4 sm:px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            {isMobile && (
              <Button variant="ghost" size="icon" onClick={() => setIsMobileSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setLocation("/item-testing")}
              className="border-gray-300"
            >
              <ChevronLeft className="h-4 w-4 mr-1" />
              Back
            </Button>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <TestTube className="h-6 w-6 text-blue-600" />
                {isEditMode ? `Edit testing #${testingId}` : "New item testing"}
              </h1>
              <p className="text-sm text-gray-600 hidden sm:block">
                Record stock item quality testing for a godown batch
              </p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-100 p-4 sm:p-6 min-h-0">
          <form onSubmit={handleSubmit} className="w-full max-w-7xl mx-auto space-y-6">
            <Card className={themedCardClass}>
              <CardHeader className={themedCardHeaderClass}>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <FileText className="h-5 w-5" />
                  Scope
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Godown *</Label>
                    <Popover
                      open={godownOpen}
                      onOpenChange={(open) => {
                        setGodownOpen(open);
                        if (!open) setGodownSearch("");
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          disabled={godownsLoading}
                          className={cn(
                            fieldTriggerClass,
                            "justify-between font-normal",
                            !godownId && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            {selectedGodown?.name
                              || (godownsLoading ? "Loading godowns..." : "Select godown")}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[max(16rem,var(--radix-popover-trigger-width))] max-w-[min(28rem,95vw)] p-0"
                        align="start"
                      >
                        <Command shouldFilter={false} className="relative">
                          <CommandInput
                            placeholder="Search godown..."
                            value={godownSearch}
                            onValueChange={setGodownSearch}
                            className={godownId || godownSearch ? "pr-10" : undefined}
                          />
                          {(godownId || godownSearch) && (
                            <button
                              type="button"
                              className="absolute right-3 top-0 z-10 flex h-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                              title="Clear godown"
                              aria-label="Clear godown"
                              onMouseDown={(e) => e.preventDefault()}
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleGodownClear();
                              }}
                            >
                              <X className="h-4 w-4" />
                            </button>
                          )}
                          <CommandList>
                            <CommandEmpty>
                              {godownsLoading ? "Loading..." : "No godown found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {filteredGodowns.map((godown) => (
                                <CommandItem
                                  key={godown.id}
                                  value={String(godown.id)}
                                  onSelect={() => handleGodownSelect(godown.id)}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4 shrink-0",
                                      String(godownId) === String(godown.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  <span className="truncate">{godown.name}</span>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Stock item *</Label>
                    <Popover open={stockItemOpen} onOpenChange={setStockItemOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          role="combobox"
                          disabled={!godownId || stockItemsLoading}
                          className={cn(
                            fieldTriggerClass,
                            "justify-between font-normal",
                            !stockItemId && "text-muted-foreground"
                          )}
                        >
                          <span className="truncate">
                            {selectedStockItem?.name
                              || (stockItemsLoading ? "Loading items..." : "Select item")}
                          </span>
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
                        <Command shouldFilter={false}>
                          <CommandInput
                            placeholder="Search item..."
                            value={itemSearch}
                            onValueChange={setItemSearch}
                          />
                          <CommandList>
                            <CommandEmpty>
                              {stockItemsLoading ? "Loading..." : "No item found."}
                            </CommandEmpty>
                            <CommandGroup>
                              {stockItems.map((item) => (
                                <CommandItem
                                  key={item.id}
                                  value={String(item.id)}
                                  onSelect={() => {
                                    setStockItemId(String(item.id));
                                    setBatchName("Primary");
                                    setStockBalance("");
                                    setStockItemOpen(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      String(stockItemId) === String(item.id)
                                        ? "opacity-100"
                                        : "opacity-0"
                                    )}
                                  />
                                  {item.name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Batch *</Label>
                    <Select
                      value={batchName}
                      onValueChange={setBatchName}
                      disabled={!stockItemId || batchesLoading}
                    >
                      <SelectTrigger className={fieldTriggerClass}>
                        <SelectValue
                          placeholder={
                            batchesLoading
                              ? "Loading batches..."
                              : !stockItemId
                                ? "Select item first"
                                : "Select batch"
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {batchOptions.map((batch) => (
                          <SelectItem key={batch} value={batch}>
                            {batch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Stock balance</Label>
                    <Input
                      readOnly
                      value={
                        stockBalanceLoading
                          ? "Loading..."
                          : stockBalance || "—"
                      }
                      className={cn(fieldTriggerClass, "bg-gray-50 cursor-default")}
                      title="Auto-fetched from godown, item, and batch"
                    />
                  </div>

                  <div className="space-y-1.5 min-w-0">
                    <Label className={fieldLabelClass}>Testing remarks</Label>
                    <Input
                      value={testerRemarks}
                      onChange={(e) => setTesterRemarks(e.target.value)}
                      placeholder="Optional remarks"
                      className={fieldTriggerClass}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className={themedCardClass}>
              <CardHeader className={themedCardHeaderClass}>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <ImageIcon className="h-5 w-5" />
                  Testing Images
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 space-y-4">
                <p className="text-sm text-muted-foreground">
                  Optional photos for this testing entry (uploaded separately from parameter
                  sample images).
                </p>
                <div className="flex flex-wrap items-center gap-3">
                  <input
                    id="extra-testing-images-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleExtraImageUpload}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    className="border-gray-300"
                    onClick={() =>
                      document.getElementById("extra-testing-images-input")?.click()
                    }
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Add image
                  </Button>
                  {extraImages.length > 0 && (
                    <span className="text-sm text-gray-600">
                      {extraImages.length} image{extraImages.length === 1 ? "" : "s"} selected
                    </span>
                  )}
                </div>
                {extraImages.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                    {extraImages.map((item) => (
                      <div
                        key={item.key}
                        className="relative rounded-lg border border-gray-200 bg-white overflow-hidden group"
                      >
                        <img
                          src={item.preview}
                          alt="Testing upload preview"
                          className="w-full h-32 object-cover bg-gray-50"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="absolute top-2 right-2 h-7 w-7 bg-white/90 border-red-200 text-red-600 hover:bg-red-50"
                          onClick={() => handleRemoveExtraImage(item.key)}
                          title="Remove image"
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                        {!item.isNew && (
                          <span className="absolute bottom-2 left-2 text-[10px] bg-black/70 text-white px-1.5 py-0.5 rounded">
                            Saved
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground italic">No images added yet.</p>
                )}
              </CardContent>
            </Card>

            <Card className={themedCardClass}>
              <CardHeader className={themedCardHeaderClass}>
                <CardTitle className="flex items-center gap-2 text-base font-semibold">
                  <FlaskConical className="h-5 w-5" />
                  Lab Test Parameters
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 sm:p-5 space-y-6">
                <div className="flex flex-col md:flex-row md:items-end gap-4">
                  <div className="flex-1 space-y-2 min-w-0">
                  <Label className={fieldLabelClass}>Item group *</Label>
                  <Popover
                    open={itemGroupOpen}
                    onOpenChange={(open) => {
                      setItemGroupOpen(open);
                      if (!open) setItemGroupSearch("");
                    }}
                  >
                    <PopoverTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        role="combobox"
                        aria-expanded={itemGroupOpen}
                        disabled={itemGroupsLoading}
                        className={cn(
                          fieldTriggerClass,
                          "justify-between font-normal",
                          !selectedItemGroup && "text-muted-foreground"
                        )}
                      >
                        <span className="truncate">
                          {selectedItemGroup?.name
                            || (itemGroupsLoading ? "Loading groups..." : "Select item group")}
                        </span>
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-[max(16rem,var(--radix-popover-trigger-width))] max-w-[min(28rem,95vw)] p-0"
                      align="start"
                    >
                      <Command shouldFilter={false} className="relative">
                        <CommandInput
                          placeholder="Search item group..."
                          value={itemGroupSearch}
                          onValueChange={setItemGroupSearch}
                          className={selectedItemGroup || itemGroupSearch ? "pr-10" : undefined}
                        />
                        {(selectedItemGroup || itemGroupSearch) && (
                          <button
                            type="button"
                            className="absolute right-3 top-0 z-10 flex h-11 items-center justify-center rounded-sm text-muted-foreground hover:text-foreground"
                            title="Clear item group"
                            aria-label="Clear item group"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleItemGroupClear();
                            }}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        )}
                        <CommandList>
                          <CommandEmpty>
                            {itemGroupsLoading ? "Loading..." : "No item group found."}
                          </CommandEmpty>
                          <CommandGroup>
                            {filteredItemGroups.map((group) => (
                              <CommandItem
                                key={group.id}
                                value={`${group.name}-${group.id}`}
                                onSelect={() => {
                                  handleItemGroupChange(group);
                                  setItemGroupOpen(false);
                                  setItemGroupSearch("");
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4 shrink-0",
                                    selectedItemGroup?.id != null
                                      && String(selectedItemGroup.id) === String(group.id)
                                      ? "opacity-100"
                                      : "opacity-0"
                                  )}
                                />
                                <span className="truncate">{group.name}</span>
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                  {selectedItemGroup && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Package className="h-4 w-4" />
                      <span>
                        Parameters for: <strong>{selectedItemGroup.name}</strong>
                      </span>
                    </div>
                  )}
                  </div>

                  {selectedItemGroup && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <Dialog
                        open={isLabTestPopupOpen}
                        onOpenChange={(open) => {
                          if (open) handleOpenLabTestPopup();
                          else handleCloseLabTestPopup();
                        }}
                      >
                        <DialogTrigger asChild>
                          <Button
                            type="button"
                            size="sm"
                            className="bg-black hover:bg-gray-800 text-white"
                          >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Test Parameter
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                          <DialogHeader>
                            <DialogTitle className="flex items-center gap-2">
                              <FlaskConical className="h-5 w-5" />
                              Select parameters — {selectedItemGroup.name}
                            </DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <Label className="text-sm font-medium">Available parameters</Label>
                              <Button
                                type="button"
                                size="sm"
                                onClick={() => {
                                  const allParamIds = filteredPopupParams.map((param) => param.id);
                                  const allSelected = allParamIds.every((id) =>
                                    popupSelectedParams.includes(id)
                                  );
                                  setPopupSelectedParams(allSelected ? [] : allParamIds);
                                }}
                                className="text-xs px-3 py-1 h-7"
                              >
                                {(() => {
                                  const allParamIds = filteredPopupParams.map((param) => param.id);
                                  const allSelected = allParamIds.every((id) =>
                                    popupSelectedParams.includes(id)
                                  );
                                  return allSelected ? "Deselect All" : "Select All";
                                })()}
                              </Button>
                            </div>
                            {labTestParamsLoading ? (
                              <div className="text-center py-4">
                                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-purple-600 mx-auto" />
                                <p className="text-xs text-gray-600 mt-2">Loading parameters...</p>
                              </div>
                            ) : filteredPopupParams.length === 0 ? (
                              <p className="text-sm text-muted-foreground py-4 text-center">
                                No parameters configured for this item group.
                              </p>
                            ) : (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-60 overflow-y-auto">
                                {filteredPopupParams.map((param) => {
                                  const validation = getValidationStatus(param);
                                  const ValidationIcon = validation.icon;
                                  const isSelected = popupSelectedParams.includes(param.id);
                                  return (
                                    <div
                                      key={param.id}
                                      role="button"
                                      tabIndex={0}
                                      className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                                        isSelected
                                          ? "border-purple-500 bg-purple-50"
                                          : "border-gray-200 hover:border-purple-300"
                                      }`}
                                      onClick={() => handlePopupParamToggle(param.id)}
                                      onKeyDown={(ev) => {
                                        if (ev.key === "Enter" || ev.key === " ") {
                                          handlePopupParamToggle(param.id);
                                        }
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                          <Checkbox
                                            checked={isSelected}
                                            onCheckedChange={() => handlePopupParamToggle(param.id)}
                                          />
                                          <FlaskConical className="h-4 w-4 text-purple-500" />
                                          <span className="text-sm font-medium">
                                            {param.parameter_name}
                                          </span>
                                          {param.unit && (
                                            <Badge
                                              variant="outline"
                                              className="text-[10px] bg-purple-50 text-purple-700 border-purple-200"
                                            >
                                              {param.unit}
                                            </Badge>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1">
                                          <ValidationIcon className={`h-3 w-3 ${validation.color}`} />
                                          {param.is_image_required && (
                                            <Camera className="h-3 w-3 text-blue-500" />
                                          )}
                                        </div>
                                      </div>
                                      {param.remarks && (
                                        <p className="text-xs text-gray-500 mt-1 ml-6">{param.remarks}</p>
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                            <div className="flex justify-end gap-2 pt-4 border-t">
                              <Button type="button" variant="outline" onClick={handleCloseLabTestPopup}>
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleApplyLabTestSelection}
                                disabled={!popupSelectedParams.length}
                              >
                                Apply Selection ({popupSelectedParams.length})
                              </Button>
                            </div>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <Badge variant="secondary" className="text-sm bg-purple-100 text-purple-800">
                        {selectedLabTestParamIds.length} selected
                      </Badge>
                    </div>
                  )}
                </div>

                {!selectedItemGroup && (
                  <p className="text-sm text-muted-foreground">
                    Select an item group to load test parameters.
                  </p>
                )}

                {selectedItemGroup
                  && !labTestParamsLoading
                  && getFilteredLabTestParams().length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No test parameters are configured for <strong>{selectedItemGroup.name}</strong>.
                  </p>
                )}

                {selectedItemGroup
                  && selectedLabTestParamIds.length > 0
                  && !labTestParamsLoading && (
                  <p className="text-sm text-muted-foreground">
                    Fill values below. Parameters left empty will not be saved.
                  </p>
                )}
                {selectedLabTestParamIds.length > 0 && (
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 border border-green-200 rounded-lg p-4 space-y-3">
                    <h6 className="text-sm font-semibold text-gray-800 flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      Test Values & Results
                    </h6>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                      {[...selectedLabTestParamIds]
                        .sort((a, b) => {
                          const paramA = labTestParams.find((p) => p.id === a);
                          const paramB = labTestParams.find((p) => p.id === b);
                          const aCountable = paramA?.is_countable ? 1 : 0;
                          const bCountable = paramB?.is_countable ? 1 : 0;
                          return aCountable - bCountable;
                        })
                        .map((paramId) => {
                          const param = labTestParams.find((p) => p.id === paramId);
                          if (!param) return null;

                          const currentTest = labTestValues[paramId] || {};
                          const isColorParam = isColorLabTestParam(param);

                          return (
                            <div
                              key={paramId}
                              className={`border rounded-md p-3 flex flex-col gap-2 shadow-sm ${
                                param.is_countable
                                  ? "bg-blue-50 border-blue-200"
                                  : "bg-white border-gray-200"
                              }`}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-1.5 min-w-0">
                                  <FlaskConical className="h-4 w-4 text-purple-500 shrink-0" />
                                  <span className="font-medium text-xs truncate">
                                    {param.parameter_name}
                                  </span>
                                  {param.unit && (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] bg-purple-50 text-purple-700 border-purple-200 shrink-0"
                                    >
                                      ({param.unit})
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleRemoveLabTestParam(paramId)}
                                  className="text-white hover:text-white h-6 w-6 p-0 bg-black hover:bg-gray-800 border-black shrink-0"
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>

                              {param.is_validation_required
                                && param.min_value
                                && param.max_value && (
                                <div className="bg-blue-50 border border-blue-200 rounded p-1.5">
                                  <p className="text-[11px] text-blue-700">
                                    <strong>Range:</strong> {param.min_value} - {param.max_value}{" "}
                                    {param.unit || ""}
                                  </p>
                                </div>
                              )}

                              <div className="grid grid-cols-2 gap-2 items-end">
                                <div className="space-y-1 min-w-0">
                                  <Label className="text-[11px] font-medium text-gray-700 block">
                                    Test Value *
                                  </Label>
                                  <div className="relative">
                                  {param.is_image_required && (
                                    <>
                                      <input
                                        id={`lab-image-${paramId}`}
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => {
                                          const file = e.target.files?.[0];
                                          if (file) {
                                            const reader = new FileReader();
                                            reader.onload = (event) => {
                                              handleLabTestImageChange(
                                                paramId,
                                                event.target?.result || ""
                                              );
                                            };
                                            reader.readAsDataURL(file);
                                          }
                                        }}
                                        className="hidden"
                                      />
                                      <label
                                        htmlFor={`lab-image-${paramId}`}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex items-center justify-center h-5 w-5 rounded text-gray-500 hover:text-purple-600 hover:bg-purple-50 cursor-pointer z-10"
                                        title={
                                          currentTest?.image || currentTest?.test_image
                                            ? "Change lab sample image"
                                            : "Upload lab sample image"
                                        }
                                      >
                                        <Camera className="h-3.5 w-3.5" />
                                      </label>
                                    </>
                                  )}
                                  <Input
                                    placeholder={
                                      isColorParam
                                        ? "Letters, numbers & spaces (max 20)"
                                        : "Enter value"
                                    }
                                    value={currentTest.value || ""}
                                    onChange={(e) =>
                                      handleLabTestValueChange(paramId, e.target.value)
                                    }
                                    onKeyDown={(e) => {
                                      if (isColorParam) {
                                        if (
                                          e.key.length === 1 &&
                                          !/^[a-zA-Z0-9 ]$/.test(e.key)
                                        ) {
                                          e.preventDefault();
                                        }
                                        return;
                                      }
                                      if (["e", "E", "+", "-"].includes(e.key)) {
                                        e.preventDefault();
                                      }
                                    }}
                                    onBlur={(e) => {
                                      const sanitizedValue = isColorParam
                                        ? sanitizeLabTestColorValue(e.target.value)
                                        : sanitizeLabTestNumericValue(e.target.value);
                                      if (sanitizedValue !== e.target.value) {
                                        handleLabTestValueChange(paramId, sanitizedValue);
                                      }
                                      const error = validateLabTestValue(param, sanitizedValue);
                                      setLabTestValidationErrors((prev) => {
                                        if (error) return { ...prev, [String(paramId)]: error };
                                        const next = { ...prev };
                                        delete next[String(paramId)];
                                        return next;
                                      });
                                    }}
                                    type="text"
                                    inputMode={isColorParam ? "text" : "decimal"}
                                    maxLength={isColorParam ? 20 : 8}
                                    className={cn(
                                      fieldTriggerClass,
                                      "text-sm",
                                      param.is_image_required && "pr-8",
                                      labTestValidationErrors[String(paramId)]
                                        && "border-red-500 focus:border-red-500 focus:ring-red-500"
                                    )}
                                  />
                                  </div>
                                  {(currentTest.image || currentTest.test_image) && (
                                    <p className="text-[10px] text-green-600 font-medium">
                                      Image uploaded
                                    </p>
                                  )}
                                  {labTestValidationErrors[String(paramId)] && (
                                    <p className="text-[10px] text-red-600 flex items-center gap-1 leading-tight">
                                      <AlertTriangle className="h-3 w-3 shrink-0" />
                                      {labTestValidationErrors[String(paramId)]}
                                    </p>
                                  )}
                                </div>

                                <div className="space-y-1 min-w-0">
                                  <Label className="text-[11px] font-medium text-gray-700 block">
                                    Remarks
                                  </Label>
                                  <Input
                                    placeholder="Optional"
                                    value={currentTest.remarks || ""}
                                    onChange={(e) =>
                                      handleLabTestRemarksChange(paramId, e.target.value)
                                    }
                                    className={cn(fieldTriggerClass, "text-sm")}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>

                    {(() => {
                      const countableParamIds = selectedLabTestParamIds.filter((paramId) => {
                        const param = labTestParams.find((p) => p.id === paramId);
                        return Boolean(param?.is_countable);
                      });
                      if (countableParamIds.length === 0) return null;

                      const totalCountable = countableParamIds.reduce((sum, paramId) => {
                        const parsed = Number.parseFloat(
                          String(labTestValues[paramId]?.value ?? "").trim()
                        );
                        return Number.isNaN(parsed) ? sum : sum + parsed;
                      }, 0);

                      return (
                        <div className="pt-1 border-t border-green-200">
                          <p className="text-sm font-semibold text-blue-700">
                            Countables : {formatCountableTotal(totalCountable)}/100
                          </p>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end gap-3 pb-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation("/item-testing")}
                className="border-gray-300"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-black hover:bg-gray-800 text-white min-w-[120px]"
              >
                <Save className="h-4 w-4 mr-2" />
                {saveMutation.isPending ? "Saving..." : isEditMode ? "Update" : "Submit"}
              </Button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
