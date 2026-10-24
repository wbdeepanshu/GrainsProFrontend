import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { 
    Search, 
    Plus, 
    Pencil,
    Activity, 
    FlaskConical,
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    Menu, 
    Clock,
    User,
    Building,
    ChevronLeft,
    ChevronRight,
    Filter,
    RefreshCw,
    Image as ImageIcon,
    X
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { uploadMediaFile } from "@/lib/media_upload_api";

const MONTH_OPTIONS = [
    { value: "1", label: "January" },
    { value: "2", label: "February" },
    { value: "3", label: "March" },
    { value: "4", label: "April" },
    { value: "5", label: "May" },
    { value: "6", label: "June" },
    { value: "7", label: "July" },
    { value: "8", label: "August" },
    { value: "9", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
];

const getCurrentMonthYear = () => {
    const now = new Date();
    return {
        month: String(now.getMonth() + 1),
        year: String(now.getFullYear()),
    };
};

const buildYearOptions = () => {
    const currentYear = new Date().getFullYear();
    const years = [];
    for (let y = currentYear; y >= currentYear - 5; y -= 1) {
        years.push({ value: String(y), label: String(y) });
    }
    return years;
};

const YEAR_OPTIONS = buildYearOptions();

const formatCurrentTime = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, "0");
    const minutes = String(now.getMinutes()).padStart(2, "0");
    const seconds = String(now.getSeconds()).padStart(2, "0");
    return `${hours}:${minutes}:${seconds}`;
};

const getParamType = (param) => String(param?.param_type || "").trim().toLowerCase();

const isNumericParamType = (param) => {
    const paramType = getParamType(param);
    return !paramType || paramType === "auto_fill";
};

/** Batch header owns start/end time; hide matching machine params from the params grid. */
const isBatchHeaderOwnedParam = (param) => {
    const paramType = getParamType(param);
    if (paramType === "start_time") return true;
    const name = String(param?.parameter_name || "").trim().toLowerCase();
    return name === "start time" || name === "end time" || name === "item details";
};

const formatBatchStatusLabel = (status) => {
    if (status === "in_progress") return "In Progress";
    if (status === "completed") return "Completed";
    return "Open";
};

export default function MachineReports() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPlantId, setSelectedPlantId] = useState("all");
    const [pendingMachine, setPendingMachine] = useState(null);
    const [pendingPlantId, setPendingPlantId] = useState("");
    const [isPlantSelectDialogOpen, setIsPlantSelectDialogOpen] = useState(false);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [editingEntryId, setEditingEntryId] = useState(null);
    const [editingParamEntryId, setEditingParamEntryId] = useState(null);
    const [isAddingToBatch, setIsAddingToBatch] = useState(false);
    const [isEndingBatch, setIsEndingBatch] = useState(false);
    const [selectedReport, setSelectedReport] = useState(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [filters, setFilters] = useState({
        machine_id: "",
    });
    const [selectedReportDate, setSelectedReportDate] = useState("");
    const defaultPeriod = getCurrentMonthYear();
    const [selectedMonth, setSelectedMonth] = useState(defaultPeriod.month);
    const [selectedYear, setSelectedYear] = useState(defaultPeriod.year);
    const [hasError, setHasError] = useState(false);
    
    // Form state for creating new performance entry
    const [formData, setFormData] = useState({
        machine_id: "",
        plant_id: "",
        item_details: "",
        operator_name: "",
        start_time: "",
        end_time: "",
        remarks: "",
        image_url: "",
        performance_data: []
    });
    const [selectedMachineParams, setSelectedMachineParams] = useState([]);
    const [predefinedValuesByParam, setPredefinedValuesByParam] = useState({});
    const [isLoadingParams, setIsLoadingParams] = useState(false);
    const [isUploadingImage, setIsUploadingImage] = useState(false);
    
    // Verification form state
    const [verificationData, setVerificationData] = useState({
        is_verified: false,
        admin_remarks: ""
    });
    const [isVerifying, setIsVerifying] = useState(false);

    const { toast } = useToast();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();

    // Get user permissions
    const { 
        hasReadPermission,
        hasCreatePermission,
        hasUpdatePermission,
        hasDeletePermission,
        hasModuleAccess,
        isLoading: permissionsLoading 
    } = useUserPermissions();

    // Fetch machine performance reports
    const fetchMachineReports = async () => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const params = new URLSearchParams({
            page: currentPage.toString(),
            page_size: pageSize.toString(),
            ...(filters.machine_id && { machine_id: filters.machine_id }),
            ...(selectedPlantId && selectedPlantId !== "all" && { plant_id: selectedPlantId }),
            ...(selectedReportDate && { report_date: selectedReportDate }),
            ...(filters.machine_id && !selectedReportDate && {
                month: selectedMonth,
                year: selectedYear,
            }),
        });

        const response = await fetch(API_BASE_URL + `/api/process/get-machine-performance/?${params}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data;
    };

    // Fetch machine plants for plant-wise filter
    const fetchMachinePlants = async () => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(API_BASE_URL + "/api/process/machine-plants/", {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.data || [];
    };

    // Fetch machine details for filter dropdown
    const fetchMachines = async () => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const payload = {};
        if (selectedPlantId && selectedPlantId !== "all") {
            payload.plant_id = selectedPlantId;
        }
        const response = await fetch(API_BASE_URL + "/api/process/machines/", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.data || [];
    };

    // Fetch specific report details
    const fetchReportDetails = async (reportId) => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(API_BASE_URL + `/api/process/get-machine-performance/${reportId}/`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data.data;
    };

    // Create / update machine performance via unified 3-mode API
    const createPerformanceEntry = async (entryData) => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(API_BASE_URL + "/api/process/machine-performance/", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify(entryData)
        });

        let data = null;
        try {
            data = await response.json();
        } catch (_) {
            data = null;
        }

        if (!response.ok) {
            const err = new Error(
                data?.message || data?.error || `HTTP error! status: ${response.status}`
            );
            err.payload = data;
            err.status = response.status;
            throw err;
        }

        return data;
    };

    // Queries
    const { data: reportsData, isLoading, error, refetch } = useQuery({
        queryKey: ['machineReports', currentPage, pageSize, filters, selectedPlantId, selectedReportDate, selectedMonth, selectedYear],
        queryFn: fetchMachineReports,
        enabled: !!filters.machine_id,
        retry: 1,
        onError: (error) => {
            console.error('Error fetching machine reports:', error);
        }
    });

    const { data: plants = [], error: plantsError } = useQuery({
        queryKey: ['machinePlants'],
        queryFn: fetchMachinePlants,
        retry: 1,
        onError: (error) => {
            console.error('Error fetching machine plants:', error);
        }
    });

    const { data: machines = [], error: machinesError } = useQuery({
        queryKey: ['machines', selectedPlantId],
        queryFn: fetchMachines,
        retry: 1,
        onError: (error) => {
            console.error('Error fetching machines:', error);
        }
    });

    const { data: reportDetails, isLoading: isLoadingDetails } = useQuery({
        queryKey: ['reportDetails', selectedReport?.id],
        queryFn: () => fetchReportDetails(selectedReport.id),
        enabled: !!selectedReport?.id,
        retry: 1,
    });

    // Mutations
    const verifyReportMutation = useMutation({
        mutationFn: async ({ reportId, isVerified, adminRemarks }) => {
            const token = AuthService.getAccessToken();
            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            
            const response = await fetch(API_BASE_URL + `/api/process/verify-machine-performance/${reportId}/`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    is_verified: isVerified,
                    admin_remarks: adminRemarks
                })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries(['machineReports']);
            queryClient.invalidateQueries(['reportDetails']);
            toast({
                title: "Success",
                description: "Report verification updated successfully",
                variant: "success",
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to update report verification",
                variant: "destructive",
            });
        }
    });

    const createEntryMutation = useMutation({
        mutationFn: createPerformanceEntry,
        onSuccess: (data, variables) => {
            queryClient.invalidateQueries(['machineReports']);
            queryClient.invalidateQueries(['reportDetails']);
            toast({
                title: "Success",
                description: data?.message
                    || (variables?.end_time
                        ? "Machine closed successfully"
                        : variables?.performance_data
                            ? "Performance data saved successfully"
                            : "Machine started successfully"),
                variant: "success",
            });
            setIsCreateDialogOpen(false);
            resetForm();
        },
        onError: (error) => {
            const payload = error?.payload;
            if (payload?.already_started) {
                toast({
                    title: "Machine already started",
                    description: payload.message || error.message,
                    variant: "destructive",
                });
                const existingId = payload.entry_id || payload.data?.id;
                if (existingId) {
                    const report = payload.data || { id: existingId };
                    handleOpenEditDialog({
                        ...report,
                        id: existingId,
                        batch_status: payload.batch_status || report.batch_status || "in_progress",
                    });
                }
                return;
            }
            toast({
                title: "Error",
                description: error.message || "Failed to save performance entry",
                variant: "destructive",
            });
        }
    });

    // Handlers
    const handleSearch = (value) => {
        setSearchTerm(value);
    };

    const filteredMachines = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return machines;
        return machines.filter((machine) => {
            const name = String(machine.machine_name || "").toLowerCase();
            const branch = String(machine.branch_name || "").toLowerCase();
            const plant = String(machine.plant_names || machine.plant_name || "").toLowerCase();
            const id = String(machine.id ?? "");
            return (
                name.includes(term) ||
                branch.includes(term) ||
                plant.includes(term) ||
                id.includes(term)
            );
        });
    }, [machines, searchTerm]);

    const handlePlantFilterChange = (value) => {
        setSelectedPlantId(value || "all");
        setFilters((prev) => ({ ...prev, machine_id: "" }));
        setSelectedReportDate("");
        setCurrentPage(1);
    };

    const getMachinePlantOptions = (machine) => {
        if (!machine) return plants;
        if (Array.isArray(machine.plants) && machine.plants.length) {
            return machine.plants;
        }
        if (Array.isArray(machine.plant_ids) && machine.plant_ids.length) {
            const ids = new Set(machine.plant_ids.map(String));
            return plants.filter((p) => ids.has(String(p.id)));
        }
        return plants;
    };

    const handleMachineCardClick = (machine) => {
        const isSelected = String(filters.machine_id || "") === String(machine.id);
        if (isSelected) {
            handleFilterChange("machine_id", undefined);
            setSelectedPlantId("all");
            return;
        }
        const plantOptions = getMachinePlantOptions(machine);
        setPendingMachine(machine);
        setPendingPlantId(plantOptions.length === 1 ? String(plantOptions[0].id) : "");
        setIsPlantSelectDialogOpen(true);
    };

    const handleConfirmMachinePlant = () => {
        if (!pendingMachine) return;
        if (!pendingPlantId) {
            toast({
                title: "Plant required",
                description: "Please select a plant for this machine",
                variant: "destructive",
            });
            return;
        }
        setSelectedPlantId(String(pendingPlantId));
        handleFilterChange("machine_id", String(pendingMachine.id));
        setIsPlantSelectDialogOpen(false);
        setPendingMachine(null);
        setPendingPlantId("");
    };

    const handleFilterChange = (key, value) => {
        // Ensure we don't pass empty strings to Select components
        const safeValue = value === "" ? undefined : value;
        setFilters(prev => ({ ...prev, [key]: safeValue }));
        if (key === 'machine_id') {
            setSelectedReportDate("");
            const period = getCurrentMonthYear();
            setSelectedMonth(period.month);
            setSelectedYear(period.year);
        }
        setCurrentPage(1);
    };

    const handleMonthYearChange = (field, value) => {
        if (field === "month") {
            setSelectedMonth(value);
        } else {
            setSelectedYear(value);
        }
        setSelectedReportDate("");
        setCurrentPage(1);
    };

    const handleBackToMonthOverview = () => {
        setSelectedReportDate("");
        setCurrentPage(1);
    };

    const handleViewDetails = (report) => {
        setSelectedReport(report);
        // Reset verification form
        setVerificationData({
            is_verified: report.is_verified || false,
            admin_remarks: report.admin_remarks || ""
        });
        setIsDetailsDialogOpen(true);
    };

    const handleVerifyReport = (reportId, isVerified, adminRemarks = "") => {
        verifyReportMutation.mutate({ reportId, isVerified, adminRemarks });
    };

    const handleVerifyFromDetails = async () => {
        if (!selectedReport) return;
        
        setIsVerifying(true);
        try {
            await verifyReportMutation.mutateAsync({
                reportId: selectedReport.id,
                isVerified: verificationData.is_verified,
                adminRemarks: verificationData.admin_remarks
            });
            
            // Reset verification form
            setVerificationData({
                is_verified: false,
                admin_remarks: ""
            });
            
            // Close details dialog
            setIsDetailsDialogOpen(false);
        } catch (error) {
            // Error is already handled by the mutation
        } finally {
            setIsVerifying(false);
        }
    };

    const handlePageChange = (newPage) => {
        setCurrentPage(newPage);
    };

    const handleRefresh = () => {
        refetch();
    };

    // Form handlers
    const resetForm = () => {
        setFormData({
            machine_id: "",
            plant_id: "",
            item_details: "",
            operator_name: "",
            start_time: formatCurrentTime(),
            end_time: "",
            remarks: "",
            image_url: "",
            performance_data: []
        });
        setSelectedMachineParams([]);
        setPredefinedValuesByParam({});
        setIsLoadingParams(false);
        setIsUploadingImage(false);
        setEditingEntryId(null);
        setEditingParamEntryId(null);
        setIsAddingToBatch(false);
        setIsEndingBatch(false);
    };

    const handleParamImageUpload = async (event) => {
        const file = event.target.files?.[0];
        event.target.value = "";
        if (!file) return;
        if (!file.type?.startsWith("image/")) {
            toast({
                title: "Invalid file",
                description: "Please select an image file",
                variant: "destructive",
            });
            return;
        }
        setIsUploadingImage(true);
        try {
            const url = await uploadMediaFile(file, "machine_params");
            setFormData((prev) => ({ ...prev, image_url: url || "" }));
            toast({
                title: "Image uploaded",
                description: "Image URL attached to this params entry",
            });
        } catch (error) {
            toast({
                title: "Upload failed",
                description: error?.message || "Could not upload image",
                variant: "destructive",
            });
        } finally {
            setIsUploadingImage(false);
        }
    };

    const handleFormChange = (field, value) => {
        if (field === 'machine_id') {
            setFormData(prev => ({ ...prev, machine_id: value, plant_id: "" }));
            if (value) {
                fetchMachineParameters(value);
            } else {
                setSelectedMachineParams([]);
                setPredefinedValuesByParam({});
            }
            return;
        }
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const formPlantOptions = useMemo(() => {
        const machine = machines.find((m) => String(m.id) === String(formData.machine_id));
        if (machine?.plants?.length) {
            return machine.plants;
        }
        if (machine?.plant_ids?.length) {
            const ids = new Set(machine.plant_ids.map(String));
            return plants.filter((p) => ids.has(String(p.id)));
        }
        return plants;
    }, [machines, plants, formData.machine_id]);

    // Fetch machine parameters when machine is selected
    const fetchMachineParameters = async (machineId, existingValues = {}) => {
        setIsLoadingParams(true);
        try {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + "/api/process/machines/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ machine_id: parseInt(machineId) })
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (data.status === 200 && data.data) {
                const machineData = data.data;
                if (machineData.parameters && machineData.parameters.length > 0) {
                    const formParams = machineData.parameters
                        .filter((param) => !isBatchHeaderOwnedParam(param))
                        .slice()
                        .sort((a, b) => {
                            const seqA = Number(a.sequence ?? 0);
                            const seqB = Number(b.sequence ?? 0);
                            if (seqA !== seqB) return seqA - seqB;
                            return (a.id || 0) - (b.id || 0);
                        });
                    setSelectedMachineParams(formParams);
                    const predefinedParams = formParams.filter(
                        (param) => getParamType(param) === "pre_defined"
                    );
                    const predefinedMap = {};
                    await Promise.all(predefinedParams.map(async (param) => {
                        try {
                            const valuesRes = await fetch(
                                `${API_BASE_URL}/api/process/machine-param-predefined-values/?machine_param_id=${param.id}`,
                                {
                                    method: "GET",
                                    headers: {
                                        "Authorization": `Bearer ${token}`,
                                        "Content-Type": "application/json",
                                    },
                                }
                            );
                            if (!valuesRes.ok) {
                                predefinedMap[param.id] = [];
                                return;
                            }
                            const valuesData = await valuesRes.json();
                            predefinedMap[param.id] = Array.isArray(valuesData.data) ? valuesData.data : [];
                        } catch (err) {
                            predefinedMap[param.id] = [];
                        }
                    }));
                    setPredefinedValuesByParam(predefinedMap);

                    const initialPerformanceData = formParams.map((param) => {
                        const existingValue = existingValues[param.id] ?? existingValues[String(param.id)] ?? "";
                        return {
                            machine_param_id: param.id,
                            value: existingValue || ""
                        };
                    });
                    setFormData(prev => ({
                        ...prev,
                        start_time: prev.start_time || formatCurrentTime(),
                        performance_data: initialPerformanceData
                    }));
                } else {
                    setSelectedMachineParams([]);
                    setPredefinedValuesByParam({});
                    setFormData(prev => ({ ...prev, performance_data: [] }));
                }
            } else {
                setSelectedMachineParams([]);
                setPredefinedValuesByParam({});
                setFormData(prev => ({ ...prev, performance_data: [] }));
            }
        } catch (error) {
            console.error('Error fetching machine parameters:', error);
            toast({
                title: "Error",
                description: "Failed to fetch machine parameters",
                variant: "destructive",
            });
            setSelectedMachineParams([]);
            setPredefinedValuesByParam({});
            setFormData(prev => ({ ...prev, performance_data: [] }));
        } finally {
            setIsLoadingParams(false);
        }
    };

    const handlePerformanceDataChange = (paramId, field, value) => {
        setFormData(prev => ({
            ...prev,
            performance_data: prev.performance_data.map(item =>
                item.machine_param_id === paramId
                    ? { ...item, [field]: value }
                    : item
            )
        }));
    };

    const renderParamValueInput = (param, performanceItem) => {
        const paramType = getParamType(param);
        const currentValue = performanceItem?.value || "";
        const inputId = `value-${param.id}`;

        if (paramType === "boolean") {
            return (
                <Select
                    value={currentValue || undefined}
                    onValueChange={(value) => handlePerformanceDataChange(param.id, "value", value)}
                >
                    <SelectTrigger id={inputId}>
                        <SelectValue placeholder="Select Yes or No" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="Yes">Yes</SelectItem>
                        <SelectItem value="No">No</SelectItem>
                    </SelectContent>
                </Select>
            );
        }

        if (paramType === "pre_defined") {
            const options = predefinedValuesByParam[param.id] || [];
            return (
                <Select
                    value={currentValue || undefined}
                    onValueChange={(value) => handlePerformanceDataChange(param.id, "value", value)}
                >
                    <SelectTrigger id={inputId}>
                        <SelectValue placeholder={`Select ${param.parameter_name}`} />
                    </SelectTrigger>
                    <SelectContent>
                        {options.length > 0 ? (
                            options.map((option) => (
                                <SelectItem key={option.id || option.value} value={String(option.value)}>
                                    {option.value}
                                </SelectItem>
                            ))
                        ) : (
                            <SelectItem value="__none__" disabled>
                                No predefined values found
                            </SelectItem>
                        )}
                    </SelectContent>
                </Select>
            );
        }

        if (paramType === "start_time") {
            return (
                <Input
                    id={inputId}
                    value={currentValue || formatCurrentTime()}
                    readOnly
                    className="bg-gray-50"
                />
            );
        }

        if (paramType === "timer") {
            return (
                <Input
                    id={inputId}
                    type="time"
                    step="1"
                    value={currentValue}
                    onChange={(e) => handlePerformanceDataChange(param.id, "value", e.target.value)}
                />
            );
        }

        return (
            <Input
                id={inputId}
                placeholder={`Enter ${param.parameter_name}`}
                value={currentValue}
                onChange={(e) => handlePerformanceDataChange(param.id, "value", e.target.value)}
                className={param.is_validation_required ? "border-orange-300" : ""}
            />
        );
    };

    const handleCreateEntry = () => {
        if (!formData.machine_id) {
            toast({
                title: "Validation Error",
                description: "Please select a machine",
                variant: "destructive",
            });
            return;
        }

        const machineId = parseInt(formData.machine_id, 10);
        const plantPayload = formData.plant_id
            ? { plant_id: parseInt(formData.plant_id, 10) }
            : { plant_id: null };

        // Mode 2: End machine — { entry_id, machine_id, plant_id, end_time }
        if (isEndingBatch && editingEntryId) {
            const endTime = String(formData.end_time || "").trim();
            if (!endTime) {
                toast({
                    title: "Validation Error",
                    description: "End time is required to close the machine",
                    variant: "destructive",
                });
                return;
            }
            createEntryMutation.mutate({
                entry_id: editingEntryId,
                machine_id: machineId,
                ...plantPayload,
                end_time: endTime,
            });
            return;
        }

        // Mode 3: Save params — { entry_id, machine_id, plant_id, performance_data }
        if (isAddingToBatch && editingEntryId) {
            const requiredParamsMissing = selectedMachineParams.some((param) => {
                if (!param.is_required) return false;
                const perf = formData.performance_data.find((item) => item.machine_param_id === param.id);
                return !perf || !String(perf.value || "").trim();
            });
            if (requiredParamsMissing) {
                toast({
                    title: "Validation Error",
                    description: "Please fill in all required parameter values",
                    variant: "destructive",
                });
                return;
            }

            for (const param of selectedMachineParams) {
                if (!param.is_validation_required || !isNumericParamType(param)) continue;
                const perf = formData.performance_data.find((item) => item.machine_param_id === param.id);
                const rawValue = String(perf?.value || "").trim();
                if (!rawValue) continue;

                const numericValue = Number(rawValue);
                if (Number.isNaN(numericValue)) {
                    toast({
                        title: "Validation Error",
                        description: `${param.parameter_name} must be a numeric value`,
                        variant: "destructive",
                    });
                    return;
                }
                const min = param.min_value !== null && param.min_value !== undefined ? Number(param.min_value) : null;
                const max = param.max_value !== null && param.max_value !== undefined ? Number(param.max_value) : null;
                if (min !== null && numericValue < min) {
                    toast({
                        title: "Validation Error",
                        description: `${param.parameter_name} should be >= ${min}${param.unit ? ` ${param.unit}` : ""}`,
                        variant: "destructive",
                    });
                    return;
                }
                if (max !== null && numericValue > max) {
                    toast({
                        title: "Validation Error",
                        description: `${param.parameter_name} should be <= ${max}${param.unit ? ` ${param.unit}` : ""}`,
                        variant: "destructive",
                    });
                    return;
                }
            }

            const performanceData = formData.performance_data
                .filter((item) => String(item.value || "").trim())
                .map((item) => ({
                    machine_param_id: item.machine_param_id,
                    value: String(item.value || "").trim(),
                }));
            if (!performanceData.length) {
                toast({
                    title: "Validation Error",
                    description: "Please enter at least one parameter value",
                    variant: "destructive",
                });
                return;
            }

            const imageUrl = String(formData.image_url || "").trim();
            createEntryMutation.mutate({
                entry_id: editingEntryId,
                machine_id: machineId,
                ...plantPayload,
                ...(editingParamEntryId ? { param_entry_id: editingParamEntryId } : {}),
                ...(formData.remarks ? { remarks: formData.remarks } : {}),
                ...(imageUrl
                    ? { images: [{ image_url: imageUrl }] }
                    : {}),
                performance_data: performanceData,
            });
            return;
        }

        // Mode 1: Start machine — { machine_id, plant_id, item_details, operator_name, start_time, remarks? }
        if (!String(formData.start_time || "").trim()) {
            toast({
                title: "Validation Error",
                description: "Start time is required to start the machine",
                variant: "destructive",
            });
            return;
        }

        createEntryMutation.mutate({
            machine_id: machineId,
            ...plantPayload,
            item_details: String(formData.item_details || "").trim() || null,
            operator_name: String(formData.operator_name || "").trim() || null,
            start_time: String(formData.start_time || "").trim(),
            remarks: formData.remarks || null,
        });
    };

    const handleOpenCreateDialog = () => {
        const machineId = filters.machine_id ? String(filters.machine_id) : "";
        const plantId =
            selectedPlantId && selectedPlantId !== "all" ? String(selectedPlantId) : "";

        resetForm();
        setIsAddingToBatch(false);
        setIsEndingBatch(false);
        setFormData((prev) => ({
            ...prev,
            machine_id: machineId,
            plant_id: plantId,
            start_time: formatCurrentTime(),
            end_time: "",
            performance_data: [],
        }));
        setIsCreateDialogOpen(true);
    };

    const resolveEndTimeAfterStart = (startTime, preferredEndTime) => {
        const endTime = String(preferredEndTime || formatCurrentTime()).trim();
        const start = String(startTime || "").trim();
        if (!start || !endTime) return endTime || formatCurrentTime();
        // If times are equal (same second), bump end by 1s so same-day close is valid.
        if (endTime === start || endTime === start.slice(0, 5)) {
            const parts = endTime.split(":").map((p) => parseInt(p, 10));
            if (parts.length >= 2 && parts.every((n) => !Number.isNaN(n))) {
                let [h, m, s = 0] = parts;
                s += 1;
                if (s >= 60) {
                    s = 0;
                    m += 1;
                }
                if (m >= 60) {
                    m = 0;
                    h = (h + 1) % 24;
                }
                return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
            }
        }
        return endTime;
    };

    const handleOpenEndDialog = async (report) => {
        const machineId = String(filters.machine_id || report.machine || "");
        if (!machineId || !report?.id) {
            toast({
                title: "Error",
                description: "Machine entry is required to end this batch",
                variant: "destructive",
            });
            return;
        }

        if (report.end_time) {
            toast({
                title: "Already closed",
                description: "This machine entry is already closed. Please start the machine for another entry.",
                variant: "destructive",
            });
            return;
        }

        setEditingEntryId(report.id);
        setEditingParamEntryId(null);
        setIsAddingToBatch(false);
        setIsEndingBatch(true);
        let header = {
            machine_id: machineId,
            plant_id: report.plant_id ? String(report.plant_id) : "",
            item_details: report.item_details || "",
            operator_name: report.operator_name || "",
            start_time: report.start_time || "",
            end_time: resolveEndTimeAfterStart(report.start_time, formatCurrentTime()),
            remarks: report.remarks || "",
            image_url: "",
            performance_data: [],
        };
        try {
            const details = await fetchReportDetails(report.id);
            if (details?.end_time) {
                toast({
                    title: "Already closed",
                    description: "This machine entry is already closed. Please start the machine for another entry.",
                    variant: "destructive",
                });
                setIsEndingBatch(false);
                setEditingEntryId(null);
                queryClient.invalidateQueries(["machineReports"]);
                return;
            }
            const startTime = details?.start_time || header.start_time || "";
            header = {
                ...header,
                plant_id: details?.plant_id ? String(details.plant_id) : header.plant_id,
                item_details: details?.item_details ?? header.item_details,
                operator_name: details?.operator_name ?? header.operator_name,
                start_time: startTime,
                end_time: resolveEndTimeAfterStart(startTime, formatCurrentTime()),
                remarks: details?.remarks || header.remarks || "",
                image_url: "",
            };
        } catch (error) {
            console.error("Error loading batch header for end machine:", error);
        }
        setFormData(header);
        setIsCreateDialogOpen(true);
    };

    const isBatchInProgress = (report) => {
        const batchStatus = report?.batch_status || (
            report?.start_time && !report?.end_time
                ? "in_progress"
                : report?.start_time && report?.end_time
                    ? "completed"
                    : "open"
        );
        return batchStatus === "in_progress" || batchStatus === "In Progress";
    };

    const openParamEntryDialog = async (report, paramEntry = null) => {
        const machineId = String(filters.machine_id || report.machine || "");
        if (!machineId) {
            toast({
                title: "Error",
                description: "Machine is required to edit this entry",
                variant: "destructive",
            });
            return;
        }

        if (!isBatchInProgress(report)) {
            toast({
                title: "Batch completed",
                description: "This machine entry is closed. Please start the machine for another entry.",
                variant: "destructive",
            });
            return;
        }

        setEditingEntryId(report.id);
        setEditingParamEntryId(paramEntry?.id || null);
        setIsAddingToBatch(true);
        setIsEndingBatch(false);

        const existingImageUrl =
            paramEntry?.image_url
            || (Array.isArray(paramEntry?.images) && paramEntry.images[0]?.image_url)
            || "";

        let header = {
            machine_id: machineId,
            plant_id: report.plant_id ? String(report.plant_id) : "",
            item_details: report.item_details || "",
            operator_name: report.operator_name || "",
            start_time: report.start_time || "",
            end_time: "",
            remarks: paramEntry?.remarks || report.remarks || "",
            image_url: existingImageUrl || "",
            performance_data: [],
        };
        try {
            const details = await fetchReportDetails(report.id);
            header = {
                ...header,
                plant_id: details?.plant_id ? String(details.plant_id) : header.plant_id,
                item_details: details?.item_details ?? header.item_details,
                operator_name: details?.operator_name ?? header.operator_name,
                start_time: details?.start_time || header.start_time || "",
                end_time: "",
                remarks: paramEntry?.remarks || details?.remarks || header.remarks || "",
                image_url: existingImageUrl || "",
            };
        } catch (error) {
            console.error("Error loading batch header for param entry:", error);
        }
        setFormData(header);
        setIsCreateDialogOpen(true);
        await fetchMachineParameters(machineId, paramEntry?.parameter_values || {});
    };

    const handleOpenEditDialog = async (report) => {
        // Add a new params reading under the in-progress batch.
        await openParamEntryDialog(report, null);
    };

    const handleEditParamEntry = async (report, entry) => {
        // Edit an existing params row while the machine is still in progress.
        await openParamEntryDialog(report, entry);
    };

    const getVerificationStatus = (report) => {
        if (report.is_verified) {
            return { status: "verified", text: "Verified", icon: CheckCircle, color: "text-green-600 bg-green-100" };
        }
        return { status: "pending", text: "Pending", icon: AlertTriangle, color: "text-orange-600 bg-orange-100" };
    };

    const formatDateTime = (dateTimeString) => {
        if (!dateTimeString) return "N/A";
        const text = String(dateTimeString).trim();
        // API already returns dd-mm-yyyy HH:mm — show as-is
        if (/^\d{2}-\d{2}-\d{4}/.test(text)) {
            return text;
        }
        const date = new Date(text);
        if (Number.isNaN(date.getTime())) return text || "N/A";
        return date.toLocaleString();
    };

    const formatTime = (timeString) => {
        if (!timeString) return "N/A";
        return timeString;
    };

    // Error boundary for component errors
    if (hasError) {
        return (
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                {!isMobile && <Sidebar />}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Something went wrong</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">An unexpected error occurred. Please try refreshing the page.</p>
                        <Button onClick={() => window.location.reload()}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Refresh Page
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    if (error && filters.machine_id) {
        return (
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                {!isMobile && <Sidebar />}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Reports</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{error.message}</p>
                        <Button onClick={handleRefresh}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    // Check permissions
    if (permissionsLoading) {
        return (
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                {!isMobile && <Sidebar />}
                <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <CommonLoader text="Loading permissions..." />
                </div>
            </div>
        );
    }

    if (!hasReadPermission("machine_performance")) {
        return (
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                {!isMobile && <Sidebar />}
                <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <div className="bg-red-50 border border-red-200 rounded-lg p-8 max-w-md">
                            <div className="flex items-center justify-center w-12 h-12 mx-auto mb-4 bg-red-100 rounded-full">
                                <Activity className="h-6 w-6 text-red-600" />
                            </div>
                            <h3 className="text-lg font-semibold text-red-800 mb-2">Access Denied</h3>
                            <p className="text-red-600 mb-4">
                                You don't have permission to view machine performance reports. Contact your administrator for access.
                            </p>
                            <Button onClick={() => window.history.back()} variant="outline">
                                Go Back
                            </Button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    const reports = reportsData?.data || [];
    const dayWiseCounts = reportsData?.day_wise_counts || [];
    const selectedMachineInfo = reportsData?.selected_machine || null;
    const parameterColumns = (reportsData?.parameter_columns || []).filter((col) => {
        const label = String(col?.label || "").trim().toLowerCase();
        return label !== "start time" && label !== "end time" && label !== "item details";
    });
    const summary = reportsData?.summary || {};
    const pagination = reportsData?.pagination || {};
    const monthLabel = reportsData?.month_label || "";
    const showMonthOverview = Boolean(filters.machine_id && !selectedReportDate);
    try {
        return (
        <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
            {!isMobile && <Sidebar />}
            <MobileSidebar
                isOpen={isMobileSidebarOpen}
                onClose={() => setIsMobileSidebarOpen(false)}
            />

            <div className="flex-1 flex flex-col overflow-hidden">
                {isMobile && (
                    <div className="bg-white dark:bg-gray-800 shadow-sm border-b p-4 flex items-center justify-between">
                        <button
                            onClick={() => setIsMobileSidebarOpen(true)}
                            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md"
                        >
                            <Menu className="h-6 w-6" />
                        </button>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Machine Reports</h1>
                        <Button onClick={handleOpenCreateDialog} size="sm">
                            <Plus className="h-4 w-4" />
                        </Button>
                    </div>
                )}

                <div className="flex-1 p-6 overflow-auto">
                    <div className="mb-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Machine Performance Reports</h1>
                                <p className="text-gray-600 dark:text-gray-400 mt-2">View and manage machine performance reports</p>
                            </div>
                            <div className="flex justify-end sm:justify-start">
                                <div className="flex items-center gap-2">
                                    <Button onClick={handleOpenCreateDialog} size="sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Start Machine
                                    </Button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Search and Filters Section */}
                    {!filters.machine_id && (
                        <Card className="mb-6">
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Filter className="h-5 w-5 mr-2" />
                                    Search & Filters
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="search">Search</Label>
                                        <div className="relative">
                                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                            <Input
                                                id="search"
                                                placeholder="Search by machine name, branch, plant..."
                                                value={searchTerm}
                                                onChange={(e) => handleSearch(e.target.value)}
                                                className="pl-10"
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label htmlFor="plant-filter">Plant</Label>
                                        <Select
                                            value={selectedPlantId}
                                            onValueChange={handlePlantFilterChange}
                                        >
                                            <SelectTrigger id="plant-filter">
                                                <SelectValue placeholder="All Plants" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Plants</SelectItem>
                                                {plantsError ? null : plants.map((plant) => (
                                                    <SelectItem key={plant.id} value={String(plant.id)}>
                                                        {plant.plant_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                        {plantsError && (
                                            <p className="text-xs text-red-500">Error loading plants</p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <Label>Machine</Label>
                                    </div>
                                    {machinesError ? (
                                        <div className="text-sm text-red-500">Error loading machines</div>
                                    ) : machines.length === 0 ? (
                                        <div className="text-sm text-gray-500">No machines available</div>
                                    ) : filteredMachines.length === 0 ? (
                                        <div className="text-sm text-gray-500">No machines match your search</div>
                                    ) : (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                            {filteredMachines.map((machine) => {
                                                const isSelected = String(filters.machine_id || "") === String(machine.id);
                                                return (
                                                    <Card
                                                        key={machine.id}
                                                        className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                                                            isSelected
                                                                ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                                                : ""
                                                        }`}
                                                        onClick={() => handleMachineCardClick(machine)}
                                                    >
                                                        <CardContent className="p-3">
                                                            <div className="flex items-start justify-between gap-2">
                                                                <div>
                                                                    <p className="font-medium text-sm">{machine.machine_name}</p>
                                                                    <p className="text-xs text-gray-500 mt-1">
                                                                        {machine.branch_name || "No branch"}
                                                                    </p>
                                                                    {(machine.plant_names || machine.plant_name) && (
                                                                        <p className="text-xs text-gray-500">
                                                                            Plant: {machine.plant_names || machine.plant_name}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                                {isSelected && (
                                                                    <Badge className="text-xs bg-blue-600 text-white">Selected</Badge>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {filters.machine_id && (
                        <Card className="mb-6">
                            <CardContent className="py-4">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <p className="text-xs text-gray-500">Selected Machine</p>
                                        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                                            {selectedMachineInfo?.machine_name || "Machine"}
                                        </h2>
                                        {selectedMachineInfo?.branch_name && (
                                            <p className="text-sm text-gray-500">{selectedMachineInfo.branch_name}</p>
                                        )}
                                        {selectedPlantId && selectedPlantId !== "all" && (
                                            <p className="text-sm text-blue-700 mt-1">
                                                Plant:{" "}
                                                {plants.find((p) => String(p.id) === String(selectedPlantId))?.plant_name
                                                    || "Selected"}
                                            </p>
                                        )}
                                    </div>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => {
                                            handleFilterChange("machine_id", undefined);
                                            setSelectedPlantId("all");
                                            setSelectedReportDate("");
                                            const period = getCurrentMonthYear();
                                            setSelectedMonth(period.month);
                                            setSelectedYear(period.year);
                                            setSearchTerm("");
                                        }}
                                    >
                                        Back to Machine Selection
                                    </Button>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Reports / Day-wise View */}
                    {!filters.machine_id ? (
                        <Card>
                            <CardContent>
                                <div className="text-center py-10">
                                    <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                                        Select a Machine
                                    </h3>
                                    <p className="text-gray-600 dark:text-gray-400">
                                        Choose one machine to view day-wise report entry counts.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    ) : showMonthOverview ? (
                        <>
                        <Card className="mb-4">
                            <CardContent className="py-3">
                                <div className="flex flex-wrap items-end gap-3">
                                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                                        <Filter className="h-4 w-4" />
                                        Period
                                    </div>
                                    <div className="w-[140px]">
                                        <Select value={selectedMonth} onValueChange={(v) => handleMonthYearChange("month", v)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Month" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {MONTH_OPTIONS.map((m) => (
                                                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-[100px]">
                                        <Select value={selectedYear} onValueChange={(v) => handleMonthYearChange("year", v)}>
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="Year" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {YEAR_OPTIONS.map((y) => (
                                                    <SelectItem key={y.value} value={y.value}>{y.label}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div className="w-[180px]">
                                        <Select
                                            value={selectedPlantId}
                                            onValueChange={(v) => {
                                                setSelectedPlantId(v || "all");
                                                setCurrentPage(1);
                                            }}
                                        >
                                            <SelectTrigger className="h-9">
                                                <SelectValue placeholder="All Plants" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                <SelectItem value="all">All Plants</SelectItem>
                                                {plants.map((plant) => (
                                                    <SelectItem key={plant.id} value={String(plant.id)}>
                                                        {plant.plant_name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <span className="text-sm text-gray-500 pb-1">
                                        {monthLabel || "Monthly summary"}
                                    </span>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="mb-4">
                            <CardHeader className="py-3">
                                <CardTitle className="text-base">
                                    Monthly Summary
                                    {selectedMachineInfo?.machine_name ? ` — ${selectedMachineInfo.machine_name}` : ""}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                                    <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
                                        <p className="text-xs text-blue-700">Total Entries</p>
                                        <p className="text-xl font-semibold text-blue-900">{summary.total_entries ?? 0}</p>
                                    </div>
                                    <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                                        <p className="text-xs text-green-700">Machine</p>
                                        <p className="text-sm font-medium text-green-900 truncate">
                                            {selectedMachineInfo?.machine_name || "—"}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3">
                                        <p className="text-xs text-amber-700">Branch</p>
                                        <p className="text-sm font-medium text-amber-900 truncate">
                                            {selectedMachineInfo?.branch_name || "—"}
                                        </p>
                                    </div>
                                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                                        <p className="text-xs text-slate-700">Period</p>
                                        <p className="text-sm font-medium text-slate-900">{monthLabel || "—"}</p>
                                    </div>
                                </div>
                                {summary.parameter_averages?.length > 0 ? (
                                    <div>
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Average parameters (month)
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                                            {summary.parameter_averages.map((avg) => (
                                                <div
                                                    key={`month-avg-${avg.param_id}`}
                                                    className="rounded-md border border-purple-200 bg-purple-50 px-3 py-2"
                                                >
                                                    <p className="text-xs text-purple-700 truncate">{avg.key}</p>
                                                    <p className="text-sm font-semibold text-purple-900">
                                                        {avg.average ?? "N/A"}
                                                        {avg.unit ? ` ${avg.unit}` : ""}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">No parameter data for this month.</p>
                                )}
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center">
                                    <Activity className="h-5 w-5 mr-2" />
                                    Day-wise Entry Counts
                                    {selectedMachineInfo?.machine_name ? ` - ${selectedMachineInfo.machine_name}` : ""}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {dayWiseCounts.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Entries Found</h3>
                                        <p className="text-gray-600 dark:text-gray-400">
                                            No day-wise entries available for the selected machine.
                                        </p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>Date</TableHead>
                                                    <TableHead>Entries Count</TableHead>
                                                    <TableHead>Action</TableHead>
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {dayWiseCounts.map((row) => (
                                                    <TableRow key={row.report_date}>
                                                        <TableCell className="font-medium">{row.report_date}</TableCell>
                                                        <TableCell>{row.entries_count}</TableCell>
                                                        <TableCell>
                                                            <Button
                                                                variant="outline"
                                                                size="sm"
                                                                onClick={() => {
                                                                    setSelectedReportDate(row.report_date);
                                                                    setCurrentPage(1);
                                                                }}
                                                            >
                                                                View Entries
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                        </>
                    ) : (
                        <Card>
                            <CardHeader>
                                <div className="flex items-center justify-between flex-wrap gap-2">
                                    <CardTitle className="flex items-center">
                                        <Activity className="h-5 w-5 mr-2" />
                                        Performance Reports ({selectedReportDate})
                                        {selectedMachineInfo?.machine_name ? ` - ${selectedMachineInfo.machine_name}` : ""}
                                    </CardTitle>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <div className="w-[180px]">
                                            <Select
                                                value={selectedPlantId}
                                                onValueChange={(v) => {
                                                    setSelectedPlantId(v || "all");
                                                    setCurrentPage(1);
                                                }}
                                            >
                                                <SelectTrigger className="h-9">
                                                    <SelectValue placeholder="All Plants" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="all">All Plants</SelectItem>
                                                    {plants.map((plant) => (
                                                        <SelectItem key={plant.id} value={String(plant.id)}>
                                                            {plant.plant_name}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleBackToMonthOverview}
                                        >
                                            Back to Monthly View
                                        </Button>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                    <Card className="border-blue-200 bg-blue-50">
                                        <CardContent className="p-4">
                                            <p className="text-sm text-blue-700">Total Entries</p>
                                            <p className="text-2xl font-semibold text-blue-900">{summary.total_entries || 0}</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-green-200 bg-green-50">
                                        <CardContent className="p-4">
                                            <p className="text-sm text-green-700">Machine</p>
                                            <p className="text-lg font-medium text-green-900">{selectedMachineInfo?.machine_name || "-"}</p>
                                        </CardContent>
                                    </Card>
                                    <Card className="border-amber-200 bg-amber-50">
                                        <CardContent className="p-4">
                                            <p className="text-sm text-amber-700">Branch</p>
                                            <p className="text-lg font-medium text-amber-900">{selectedMachineInfo?.branch_name || "-"}</p>
                                        </CardContent>
                                    </Card>
                                </div>

                                {summary.parameter_averages?.length > 0 && (
                                    <div className="mb-6">
                                        <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                                            Average parameters (day)
                                        </p>
                                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
                                            {summary.parameter_averages.map((avg) => (
                                                <Card key={`avg-${avg.param_id}`} className="border-purple-200 bg-purple-50">
                                                    <CardContent className="p-3">
                                                        <p className="text-xs text-purple-700">{avg.key}</p>
                                                        <p className="text-base font-semibold text-purple-900">
                                                            {avg.average ?? "N/A"}{avg.unit ? ` ${avg.unit}` : ""}
                                                        </p>
                                                    </CardContent>
                                                </Card>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {reports.length === 0 ? (
                                    <div className="text-center py-8">
                                        <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Reports Found</h3>
                                        <p className="text-gray-600 dark:text-gray-400">
                                            No entries found for {selectedReportDate}.
                                        </p>
                                    </div>
                                ) : (
                                    <>
                                        <div className="space-y-4">
                                            {reports.map((report, rowIndex) => {
                                                const serialNo = ((pagination.current_page || 1) - 1) * (pagination.page_size || 10) + rowIndex + 1;
                                                const batchStatus = report.batch_status || (
                                                    report.start_time && !report.end_time
                                                        ? "in_progress"
                                                        : report.start_time && report.end_time
                                                            ? "completed"
                                                            : "open"
                                                );
                                                const paramEntries = Array.isArray(report.param_entries)
                                                    ? report.param_entries
                                                    : [];
                                                return (
                                                    <Card
                                                        key={report.id}
                                                        className={
                                                            batchStatus === "in_progress"
                                                                ? "border border-blue-500 bg-blue-50/20"
                                                                : "border border-gray-200"
                                                        }
                                                    >
                                                        <CardHeader className="pb-3">
                                                            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                                                                <div className="space-y-1">
                                                                    <CardTitle className="text-base">
                                                                        Batch #{serialNo}
                                                                        {report.item_details ? ` — ${report.item_details}` : ""}
                                                                    </CardTitle>
                                                                    <div className="flex flex-wrap gap-2 items-center text-sm">
                                                                        <span className="inline-flex items-center rounded-md border border-indigo-200 bg-indigo-50 px-2.5 py-1 font-medium text-indigo-800">
                                                                            Plant: {report.plant_name || "-"}
                                                                        </span>
                                                                        <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-800">
                                                                            Operator: {report.operator_name || "-"}
                                                                        </span>
                                                                        <span className="inline-flex items-center rounded-md border border-sky-200 bg-sky-50 px-2.5 py-1 font-medium text-sky-800">
                                                                            Start: {formatTime(report.start_time)}
                                                                        </span>
                                                                        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 font-medium text-amber-900">
                                                                            End: {formatTime(report.end_time)}
                                                                        </span>
                                                                        <span className="text-gray-600 px-1">
                                                                            Params entries: {report.param_entries_count ?? paramEntries.length}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex items-center gap-2">
                                                                    <Badge
                                                                        className={
                                                                            batchStatus === "in_progress"
                                                                                ? "text-blue-700 bg-blue-100"
                                                                                : batchStatus === "completed"
                                                                                    ? "text-green-700 bg-green-100"
                                                                                    : "text-gray-700 bg-gray-100"
                                                                        }
                                                                    >
                                                                        {formatBatchStatusLabel(batchStatus)}
                                                                    </Badge>
                                                                    {batchStatus === "in_progress" && (
                                                                        <>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => handleOpenEditDialog(report)}
                                                                            >
                                                                                <Plus className="h-4 w-4 mr-1" />
                                                                                Add Params
                                                                            </Button>
                                                                            <Button
                                                                                variant="outline"
                                                                                size="sm"
                                                                                onClick={() => handleOpenEndDialog(report)}
                                                                            >
                                                                                <Clock className="h-4 w-4 mr-1" />
                                                                                End Machine
                                                                            </Button>
                                                                        </>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        </CardHeader>
                                                        <CardContent className="pt-0">
                                                            <div className="overflow-x-auto">
                                                                <Table>
                                                                    <TableHeader>
                                                                        <TableRow>
                                                                            <TableHead>Sr.</TableHead>
                                                                            {parameterColumns.map((col) => (
                                                                                <TableHead key={`head-${report.id}-${col.param_id}`}>
                                                                                    {col.label}
                                                                                </TableHead>
                                                                            ))}
                                                                            <TableHead>Image</TableHead>
                                                                            <TableHead>Entered At</TableHead>
                                                                            {batchStatus === "in_progress" && (
                                                                                <TableHead className="text-right">Actions</TableHead>
                                                                            )}
                                                                        </TableRow>
                                                                    </TableHeader>
                                                                    <TableBody>
                                                                        {paramEntries.length === 0 ? (
                                                                            <TableRow>
                                                                                <TableCell
                                                                                    colSpan={
                                                                                        3
                                                                                        + parameterColumns.length
                                                                                        + (batchStatus === "in_progress" ? 1 : 0)
                                                                                    }
                                                                                    className="text-center text-gray-500"
                                                                                >
                                                                                    <div className="py-4 space-y-3">
                                                                                        <p>No parameter entries yet</p>
                                                                                        {batchStatus === "in_progress" && (
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                onClick={() => handleOpenEditDialog(report)}
                                                                                            >
                                                                                                <Plus className="h-4 w-4 mr-1" />
                                                                                                Add Params
                                                                                            </Button>
                                                                                        )}
                                                                                    </div>
                                                                                </TableCell>
                                                                            </TableRow>
                                                                        ) : (
                                                                            paramEntries.map((entry, entryIndex) => (
                                                                                <TableRow key={entry.id || `${report.id}-${entryIndex}`}>
                                                                                    <TableCell className="font-medium">
                                                                                        {entryIndex + 1}
                                                                                    </TableCell>
                                                                                    {parameterColumns.map((col) => (
                                                                                        <TableCell key={`val-${entry.id}-${col.param_id}`}>
                                                                                            {entry.parameter_values?.[String(col.param_id)] ? (
                                                                                                <span>
                                                                                                    {entry.parameter_values[String(col.param_id)]}
                                                                                                    {col.unit ? ` ${col.unit}` : ""}
                                                                                                </span>
                                                                                            ) : (
                                                                                                <span className="text-gray-400">-</span>
                                                                                            )}
                                                                                        </TableCell>
                                                                                    ))}
                                                                                    <TableCell>
                                                                                        {(entry.image_url || entry.images?.[0]?.image_url) ? (
                                                                                            <a
                                                                                                href={entry.image_url || entry.images[0].image_url}
                                                                                                target="_blank"
                                                                                                rel="noopener noreferrer"
                                                                                                className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                                                                                            >
                                                                                                <img
                                                                                                    src={entry.image_url || entry.images[0].image_url}
                                                                                                    alt="Entry"
                                                                                                    className="h-8 w-8 rounded object-cover border"
                                                                                                />
                                                                                            </a>
                                                                                        ) : (
                                                                                            <span className="text-gray-400">-</span>
                                                                                        )}
                                                                                    </TableCell>
                                                                                    <TableCell className="whitespace-nowrap text-muted-foreground">
                                                                                        {formatDateTime(entry.created_at)}
                                                                                    </TableCell>
                                                                                    {batchStatus === "in_progress" && (
                                                                                        <TableCell className="text-right">
                                                                                            <Button
                                                                                                variant="outline"
                                                                                                size="sm"
                                                                                                className="h-8"
                                                                                                onClick={() => handleEditParamEntry(report, entry)}
                                                                                            >
                                                                                                <Pencil className="h-3.5 w-3.5 mr-1" />
                                                                                                Edit
                                                                                            </Button>
                                                                                        </TableCell>
                                                                                    )}
                                                                                </TableRow>
                                                                            ))
                                                                        )}
                                                                    </TableBody>
                                                                </Table>
                                                                {batchStatus === "in_progress" && paramEntries.length > 0 && (
                                                                    <div className="mt-3 flex justify-end">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleOpenEditDialog(report)}
                                                                        >
                                                                            <Plus className="h-4 w-4 mr-1" />
                                                                            Add Params
                                                                        </Button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </CardContent>
                                                    </Card>
                                                );
                                            })}
                                        </div>

                                        {pagination.total_pages > 1 && (
                                            <div className="flex items-center justify-between mt-6">
                                                <div className="text-sm text-gray-700 dark:text-gray-300">
                                                    Showing {((pagination.current_page - 1) * pagination.page_size) + 1} to {Math.min(pagination.current_page * pagination.page_size, pagination.total_count)} of {pagination.total_count} results
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
                                                    <span className="text-sm text-gray-700 dark:text-gray-300">
                                                        Page {pagination.current_page} of {pagination.total_pages}
                                                    </span>
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
                    )}
                </div>
            </div>

            {/* Report Details Dialog */}
            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Activity className="h-5 w-5 mr-2" />
                            Report Details - #{selectedReport?.id}
                        </DialogTitle>
                    </DialogHeader>
                    
                    {isLoadingDetails ? (
                        <div className="flex items-center justify-center py-8">
                            <CommonLoader text="Loading report details..." />
                        </div>
                    ) : reportDetails ? (
                        <div className="space-y-6">
                            {/* Report Information */}
                            <Card>
                                <CardHeader>
                                    <CardTitle>Report Information</CardTitle>
                                </CardHeader>
                                <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Machine</Label>
                                        <p className="text-sm">{reportDetails.machine_name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Organization</Label>
                                        <p className="text-sm">{reportDetails.organization_name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Branch</Label>
                                        <p className="text-sm">{reportDetails.branch_name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Plant</Label>
                                        <p className="text-sm">{reportDetails.plant_name || "-"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Item Details</Label>
                                        <p className="text-sm">{reportDetails.item_details || "-"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Operator Name</Label>
                                        <p className="text-sm">{reportDetails.operator_name || "-"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Start Time</Label>
                                        <p className="text-sm">{formatTime(reportDetails.start_time)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">End Time</Label>
                                        <p className="text-sm">{formatTime(reportDetails.end_time)}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Batch Status</Label>
                                        <p className="text-sm">
                                            {formatBatchStatusLabel(reportDetails.batch_status)}
                                        </p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Operated By</Label>
                                        <p className="text-sm">{reportDetails.operated_by_name}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Verified By</Label>
                                        <p className="text-sm">{reportDetails.verified_by_name || "Not verified"}</p>
                                    </div>
                                    <div>
                                        <Label className="text-sm font-medium text-gray-500">Status</Label>
                                        <div className="mt-1">
                                            {getVerificationStatus(reportDetails).status === "verified" ? (
                                                <Badge className="text-green-600 bg-green-100">
                                                    <CheckCircle className="h-3 w-3 mr-1" />
                                                    Verified
                                                </Badge>
                                            ) : (
                                                <Badge className="text-orange-600 bg-orange-100">
                                                    <AlertTriangle className="h-3 w-3 mr-1" />
                                                    Pending
                                                </Badge>
                                            )}
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Remarks */}
                            {(reportDetails.remarks || reportDetails.admin_remarks) && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Remarks</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        {reportDetails.remarks && (
                                            <div>
                                                <Label className="text-sm font-medium text-gray-500">Operator Remarks</Label>
                                                <p className="text-sm mt-1 p-3 bg-gray-50 dark:bg-gray-800 rounded-md">{reportDetails.remarks}</p>
                                            </div>
                                        )}
                                        {reportDetails.admin_remarks && (
                                            <div>
                                                <Label className="text-sm font-medium text-gray-500">Admin Remarks</Label>
                                                <p className="text-sm mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">{reportDetails.admin_remarks}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Performance Data */}
                            {reportDetails.performance_data && reportDetails.performance_data.length > 0 && (
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Performance Data</CardTitle>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Parameter</TableHead>
                                                        <TableHead>Value</TableHead>
                                                        <TableHead>Unit</TableHead>
                                                        <TableHead>Remarks</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {reportDetails.performance_data.map((data) => (
                                                        <TableRow key={data.id}>
                                                            <TableCell className="font-medium">{data.parameter_name}</TableCell>
                                                            <TableCell>{data.value}</TableCell>
                                                            <TableCell>{data.unit}</TableCell>
                                                            <TableCell>{data.remarks || "N/A"}</TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    </CardContent>
                                </Card>
                            )}

                            {/* Verification Section */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center">
                                        <CheckCircle className="h-5 w-5 mr-2" />
                                        Verification
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <Label className="text-sm font-medium text-gray-500">Current Status</Label>
                                            <div className="mt-1">
                                                {reportDetails.is_verified ? (
                                                    <Badge className="text-green-600 bg-green-100">
                                                        <CheckCircle className="h-3 w-3 mr-1" />
                                                        Verified
                                                    </Badge>
                                                ) : (
                                                    <Badge className="text-orange-600 bg-orange-100">
                                                        <AlertTriangle className="h-3 w-3 mr-1" />
                                                        Pending
                                                    </Badge>
                                                )}
                                            </div>
                                        </div>
                                        
                                        <div>
                                            <Label className="text-sm font-medium text-gray-500">Verified By</Label>
                                            <p className="text-sm mt-1">{reportDetails.verified_by_name || "Not verified"}</p>
                                        </div>
                                    </div>

                                    {reportDetails.admin_remarks && (
                                        <div>
                                            <Label className="text-sm font-medium text-gray-500">Current Admin Remarks</Label>
                                            <p className="text-sm mt-1 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-md">
                                                {reportDetails.admin_remarks}
                                            </p>
                                        </div>
                                    )}

                                    {/* Verification Form */}
                                    <div className="border-t pt-4">
                                        <h4 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Update Verification</h4>
                                        
                                        <div className="space-y-4">
                                            <div className="flex items-center space-x-2">
                                                <Checkbox
                                                    id="verify-checkbox"
                                                    checked={verificationData.is_verified}
                                                    onCheckedChange={(checked) => 
                                                        setVerificationData(prev => ({ ...prev, is_verified: checked }))
                                                    }
                                                />
                                                <Label htmlFor="verify-checkbox" className="text-sm">
                                                    Mark as Verified
                                                </Label>
                                            </div>

                                            <div>
                                                <Label htmlFor="admin-remarks" className="text-sm font-medium">
                                                    Admin Remarks
                                                </Label>
                                                <Textarea
                                                    id="admin-remarks"
                                                    placeholder="Enter admin remarks (optional)"
                                                    value={verificationData.admin_remarks}
                                                    onChange={(e) => 
                                                        setVerificationData(prev => ({ ...prev, admin_remarks: e.target.value }))
                                                    }
                                                    rows={3}
                                                    className="mt-1"
                                                />
                                            </div>

                                            <div className="flex justify-end space-x-2">
                                                <Button 
                                                    variant="outline" 
                                                    size="sm"
                                                    onClick={() => setVerificationData({
                                                        is_verified: reportDetails.is_verified || false,
                                                        admin_remarks: reportDetails.admin_remarks || ""
                                                    })}
                                                    disabled={isVerifying}
                                                >
                                                    Reset
                                                </Button>
                                                <Button 
                                                    size="sm"
                                                    onClick={handleVerifyFromDetails}
                                                    disabled={isVerifying}
                                                >
                                                    {isVerifying ? (
                                                        <>
                                                            <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                                            Updating...
                                                        </>
                                                    ) : (
                                                        <>
                                                            <CheckCircle className="h-4 w-4 mr-2" />
                                                            Update Verification
                                                        </>
                                                    )}
                                                </Button>
                                            </div>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Error Loading Details</h3>
                            <p className="text-gray-600 dark:text-gray-400">Failed to load report details.</p>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            {/* Plant selection after machine card click */}
            <Dialog
                open={isPlantSelectDialogOpen}
                onOpenChange={(open) => {
                    setIsPlantSelectDialogOpen(open);
                    if (!open) {
                        setPendingMachine(null);
                        setPendingPlantId("");
                    }
                }}
            >
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle>Select Plant</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <div className="rounded-md border bg-gray-50 p-3">
                            <p className="text-xs text-gray-500">Machine</p>
                            <p className="font-medium text-sm">
                                {pendingMachine?.machine_name || "-"}
                            </p>
                            {pendingMachine?.branch_name && (
                                <p className="text-xs text-gray-500 mt-1">{pendingMachine.branch_name}</p>
                            )}
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="pending-plant">Plant *</Label>
                            <Select
                                value={pendingPlantId || "none"}
                                onValueChange={(value) =>
                                    setPendingPlantId(value === "none" ? "" : value)
                                }
                            >
                                <SelectTrigger id="pending-plant">
                                    <SelectValue placeholder="Select Plant" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="none">Select Plant</SelectItem>
                                    {getMachinePlantOptions(pendingMachine).map((plant) => (
                                        <SelectItem key={plant.id} value={String(plant.id)}>
                                            {plant.plant_name}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setIsPlantSelectDialogOpen(false);
                                    setPendingMachine(null);
                                    setPendingPlantId("");
                                }}
                            >
                                Cancel
                            </Button>
                            <Button onClick={handleConfirmMachinePlant}>
                                Continue
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create / Edit Entry Dialog */}
            <Dialog
                open={isCreateDialogOpen}
                onOpenChange={(open) => {
                    setIsCreateDialogOpen(open);
                    if (!open) resetForm();
                }}
            >
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            {isEndingBatch ? (
                                <Clock className="h-5 w-5 mr-2" />
                            ) : isAddingToBatch ? (
                                <Plus className="h-5 w-5 mr-2" />
                            ) : (
                                <Plus className="h-5 w-5 mr-2" />
                            )}
                            {isEndingBatch
                                ? "End Machine"
                                : isAddingToBatch
                                    ? (editingParamEntryId
                                        ? "Edit Params Entry"
                                        : "Add Params to In-Progress Machine")
                                    : "Start Machine"}
                        </DialogTitle>
                    </DialogHeader>
                    
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <Card>
                            <CardHeader>
                                <CardTitle>
                                    {isEndingBatch
                                        ? "Close Machine Entry"
                                        : isAddingToBatch
                                            ? "Batch Header"
                                            : "Start Machine"}
                                </CardTitle>
                                {isAddingToBatch && (
                                    <p className="text-sm text-blue-700">
                                        Machine is In Progress — header fields stay the same.
                                        Enter a new set of parameter values below.
                                    </p>
                                )}
                                {isEndingBatch && (
                                    <p className="text-sm text-orange-700">
                                        Set end time to close this machine. After closing, start the machine again for a new entry.
                                    </p>
                                )}
                                {!isAddingToBatch && !isEndingBatch && (
                                    <p className="text-sm text-gray-600">
                                        Start the machine first. Then use Add Params / End Machine on the in-progress batch.
                                    </p>
                                )}
                            </CardHeader>
                            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="machine">Machine *</Label>
                                    <Select 
                                        value={formData.machine_id || "all"} 
                                        onValueChange={(value) => handleFormChange('machine_id', value === "all" ? "" : value)}
                                        disabled={Boolean(editingEntryId) || isAddingToBatch || isEndingBatch}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select Machine" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Select Machine</SelectItem>
                                            {machines.map((machine) => (
                                                <SelectItem key={machine.id} value={machine.id.toString()}>
                                                    {machine.machine_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="plant">Plant</Label>
                                    <Select
                                        value={formData.plant_id || "all"}
                                        onValueChange={(value) => handleFormChange('plant_id', value === "all" ? "" : value)}
                                        disabled={!formData.machine_id || isAddingToBatch || isEndingBatch}
                                    >
                                        <SelectTrigger id="plant">
                                            <SelectValue placeholder="Select Plant" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="all">Select Plant</SelectItem>
                                            {formPlantOptions.map((plant) => (
                                                <SelectItem key={plant.id} value={String(plant.id)}>
                                                    {plant.plant_name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                {!isEndingBatch && (
                                    <div className="space-y-2">
                                        <Label htmlFor="item_details">Item Details</Label>
                                        <Input
                                            id="item_details"
                                            placeholder="Enter item details"
                                            value={formData.item_details}
                                            onChange={(e) => handleFormChange('item_details', e.target.value)}
                                            disabled={isAddingToBatch}
                                        />
                                    </div>
                                )}

                                {!isEndingBatch && (
                                    <div className="space-y-2">
                                        <Label htmlFor="operator_name">Operator Name</Label>
                                        <Input
                                            id="operator_name"
                                            placeholder="Enter operator name"
                                            value={formData.operator_name || ""}
                                            onChange={(e) => handleFormChange('operator_name', e.target.value)}
                                            disabled={isAddingToBatch}
                                        />
                                    </div>
                                )}

                                {!isEndingBatch && (
                                    <div className="space-y-2">
                                        <Label htmlFor="start_time">Start Time *</Label>
                                        <Input
                                            id="start_time"
                                            type="time"
                                            step="1"
                                            value={formData.start_time || ""}
                                            onChange={(e) => handleFormChange('start_time', e.target.value)}
                                            disabled={isAddingToBatch}
                                        />
                                    </div>
                                )}

                                {isEndingBatch && (
                                    <div className="space-y-2">
                                        <Label htmlFor="end_time">End Time *</Label>
                                        <Input
                                            id="end_time"
                                            type="time"
                                            step="1"
                                            value={formData.end_time || ""}
                                            onChange={(e) => handleFormChange('end_time', e.target.value)}
                                        />
                                    </div>
                                )}

                                {!isEndingBatch && (
                                    <div className="space-y-2">
                                        <Label htmlFor="remarks">Remarks</Label>
                                        <Textarea
                                            id="remarks"
                                            placeholder="Additional remarks (optional)"
                                            value={formData.remarks}
                                            onChange={(e) => handleFormChange('remarks', e.target.value)}
                                            rows={3}
                                        />
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Performance Data — only when adding params to an in-progress machine */}
                        {isAddingToBatch && (
                            formData.machine_id ? (
                                isLoadingParams ? (
                                    <Card>
                                        <CardContent className="py-8">
                                            <div className="flex items-center justify-center">
                                                <CommonLoader text="Loading machine parameters..." />
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : selectedMachineParams.length > 0 ? (
                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Performance Parameters</CardTitle>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {selectedMachineParams.map((param) => {
                                                const performanceItem = formData.performance_data.find(
                                                    item => item.machine_param_id === param.id
                                                );
                                                
                                                return (
                                                    <div
                                                        key={param.id}
                                                        className={`border rounded-md p-4 space-y-3 shadow-sm ${
                                                            param.is_validation_required
                                                                ? "bg-blue-50 border-blue-200"
                                                                : "bg-white border-gray-200"
                                                        }`}
                                                    >
                                                        <div className="flex items-center justify-between gap-2">
                                                            <div className="flex items-center gap-2">
                                                                <FlaskConical className="h-4 w-4 text-purple-500" />
                                                                <Label className="text-sm font-medium mb-0">
                                                                    {param.parameter_name} {param.is_required && <span className="text-red-500">*</span>}
                                                                </Label>
                                                            </div>
                                                            {param.unit && (
                                                                <Badge variant="outline" className="text-[10px] bg-purple-50 text-purple-700 border-purple-200">
                                                                    {param.unit}
                                                                </Badge>
                                                            )}
                                                        </div>

                                                        {param.is_validation_required && param.min_value !== null && param.max_value !== null && (
                                                            <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                                                <p className="text-[11px] text-blue-700">
                                                                    <strong>Range:</strong> {param.min_value} - {param.max_value} {param.unit || ""}
                                                                </p>
                                                            </div>
                                                        )}

                                                        <div className="space-y-1">
                                                            <Label htmlFor={`value-${param.id}`}>
                                                                Value {param.is_required && <span className="text-red-500">*</span>}
                                                            </Label>
                                                            {renderParamValueInput(param, performanceItem)}
                                                        </div>
                                                    </div>
                                                );
                                                })}
                                            </div>

                                            <div className="mt-6 border rounded-md p-4 space-y-3 bg-slate-50">
                                                <div className="flex items-center gap-2">
                                                    <ImageIcon className="h-4 w-4 text-slate-600" />
                                                    <Label className="text-sm font-medium mb-0">
                                                        Image (optional)
                                                    </Label>
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Upload an image or paste a Cloudinary URL. Stored as text and returned with the entry.
                                                </p>
                                                <div className="flex flex-col sm:flex-row gap-3 items-start">
                                                    <Input
                                                        type="file"
                                                        accept="image/*"
                                                        disabled={isUploadingImage}
                                                        onChange={handleParamImageUpload}
                                                        className="max-w-xs"
                                                    />
                                                    <Input
                                                        placeholder="Or paste image URL (https://...)"
                                                        value={formData.image_url || ""}
                                                        onChange={(e) => handleFormChange("image_url", e.target.value)}
                                                        className="flex-1"
                                                    />
                                                    {formData.image_url ? (
                                                        <Button
                                                            type="button"
                                                            variant="outline"
                                                            size="icon"
                                                            onClick={() => handleFormChange("image_url", "")}
                                                            title="Clear image"
                                                        >
                                                            <X className="h-4 w-4" />
                                                        </Button>
                                                    ) : null}
                                                </div>
                                                {isUploadingImage && (
                                                    <p className="text-xs text-blue-600">Uploading image...</p>
                                                )}
                                                {formData.image_url ? (
                                                    <div className="flex items-center gap-3">
                                                        <img
                                                            src={formData.image_url}
                                                            alt="Preview"
                                                            className="h-16 w-16 rounded border object-cover"
                                                            onError={(e) => {
                                                                e.currentTarget.style.display = "none";
                                                            }}
                                                        />
                                                        <a
                                                            href={formData.image_url}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className="text-xs text-blue-600 break-all hover:underline"
                                                        >
                                                            {formData.image_url}
                                                        </a>
                                                    </div>
                                                ) : null}
                                            </div>
                                        </CardContent>
                                    </Card>
                                ) : (
                                    <Card>
                                        <CardContent className="py-8">
                                            <div className="text-center">
                                                <AlertTriangle className="h-12 w-12 text-orange-500 mx-auto mb-4" />
                                                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">No Parameters Found</h3>
                                                <p className="text-gray-600 dark:text-gray-400">This machine doesn't have any performance parameters configured.</p>
                                            </div>
                                        </CardContent>
                                    </Card>
                                )
                            ) : (
                                <Card>
                                    <CardContent className="py-8">
                                        <div className="text-center">
                                            <Activity className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                                            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Select a Machine</h3>
                                            <p className="text-gray-600 dark:text-gray-400">Please select a machine to view its performance parameters.</p>
                                        </div>
                                    </CardContent>
                                </Card>
                            )
                        )}

                        {/* Action Buttons */}
                        <div className="flex justify-end space-x-2">
                            <Button 
                                variant="outline" 
                                onClick={() => {
                                    setIsCreateDialogOpen(false);
                                    resetForm();
                                }}
                                disabled={createEntryMutation.isPending}
                            >
                                Cancel
                            </Button>
                            <Button 
                                onClick={handleCreateEntry}
                                disabled={createEntryMutation.isPending || isUploadingImage || !formData.machine_id}
                            >
                                {createEntryMutation.isPending ? (
                                    <>
                                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                                        Saving...
                                    </>
                                ) : isEndingBatch ? (
                                    <>
                                        <Clock className="h-4 w-4 mr-2" />
                                        End Machine
                                    </>
                                ) : isAddingToBatch ? (
                                    <>
                                        {editingParamEntryId ? (
                                            <Pencil className="h-4 w-4 mr-2" />
                                        ) : (
                                            <Plus className="h-4 w-4 mr-2" />
                                        )}
                                        {editingParamEntryId ? "Update Params" : "Save Params"}
                                    </>
                                ) : (
                                    <>
                                        <Plus className="h-4 w-4 mr-2" />
                                        Start Machine
                                    </>
                                )}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
            <CommonLoader
              isLoading={Boolean(isLoading && filters.machine_id)}
              text="Loading machine reports..."
            />
        </div>
        );
    } catch (error) {
        console.error('Error rendering MachineReports component:', error);
        setHasError(true);
        return null;
    }
}
