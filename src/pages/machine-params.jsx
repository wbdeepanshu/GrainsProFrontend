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
    Settings, 
    CheckCircle, 
    XCircle, 
    AlertTriangle, 
    Menu, 
    Edit, 
    Trash2,
    Activity,
    RefreshCw,
    ArrowLeft,
    FlaskConical,
    Package,
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const PARAM_TYPE_OPTIONS = [
    { value: "pre_defined", label: "Pre Defined" },
    { value: "timer", label: "Timer" },
    { value: "start_time", label: "Start Timer" },
    { value: "free_text", label: "Free Text" },
    { value: "auto_fill", label: "Auto Fill" },
    { value: "boolean", label: "Boolean" },
];

const emptyPredefinedValue = () => ({ id: null, value: "", sequence: "" });

export default function MachineParams() {
    const [searchTerm, setSearchTerm] = useState("");
    const [selectedPlantId, setSelectedPlantId] = useState("all");
    const [selectedMachine, setSelectedMachine] = useState(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateMachineDialogOpen, setIsCreateMachineDialogOpen] = useState(false);
    const [isCreatePlantDialogOpen, setIsCreatePlantDialogOpen] = useState(false);
    const [isEditPlantMappingDialogOpen, setIsEditPlantMappingDialogOpen] = useState(false);
    const [editingMachineForPlants, setEditingMachineForPlants] = useState(null);
    const [selectedPlantIdsForEdit, setSelectedPlantIdsForEdit] = useState([]);
    const [isCreateParamsDialogOpen, setIsCreateParamsDialogOpen] = useState(false);
    const [createParamsMachineId, setCreateParamsMachineId] = useState("");
    const [editingParam, setEditingParam] = useState(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [isLoadingParams, setIsLoadingParams] = useState(false);
    const [machineParams, setMachineParams] = useState([]);
    
    // Form state for creating new machine
    const [newMachine, setNewMachine] = useState({
        machine_name: "",
        capacity: "",
        performance_type: "hourly",
        branch: "",
        is_active: true
    });

    // Form state for creating new plant
    const [newPlant, setNewPlant] = useState({
        plant_name: "",
        location: "",
        is_active: true,
    });
    
    // Form state for creating new parameters (multiple)
    const [newParams, setNewParams] = useState([{
        parameter_name: "",
        is_validation_required: false,
        is_required: false,
        min_value: "",
        max_value: "",
        unit: "",
        remarks: "",
        machine_ids: []
    }]);
    
    // Form state for creating new parameter (single)
    const [newParam, setNewParam] = useState({
        parameter_name: "",
        is_validation_required: false,
        is_required: false,
        min_value: "",
        max_value: "",
        param_type: "",
        sequence: "",
        unit: "",
        remarks: ""
    });
    const [isPredefinedDialogOpen, setIsPredefinedDialogOpen] = useState(false);
    const [predefinedValues, setPredefinedValues] = useState([emptyPredefinedValue()]);
    const [predefinedContext, setPredefinedContext] = useState("create");
    const [isSavingPredefined, setIsSavingPredefined] = useState(false);

    const { toast } = useToast();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();

    const resetCreateParamsForm = () => {
        setCreateParamsMachineId("");
        setNewParams([{
            parameter_name: "",
            is_validation_required: false,
            is_required: false,
            min_value: "",
            max_value: "",
            unit: "",
            remarks: "",
            machine_ids: []
        }]);
    };

    const handleCreateParamsDialogOpenChange = (open) => {
        setIsCreateParamsDialogOpen(open);
        if (!open) {
            resetCreateParamsForm();
        }
    };

    // Fetch machine plants
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

    // Fetch machines list
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

    // Fetch machine parameters when machine is selected
    const fetchMachineParameters = async (machineId) => {
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
                setMachineParams(machineData.parameters || []);
            } else {
                setMachineParams([]);
            }
        } catch (error) {
            console.error('Error fetching machine parameters:', error);
            toast({
                title: "Error",
                description: "Failed to fetch machine parameters",
                variant: "destructive",
            });
            setMachineParams([]);
        } finally {
            setIsLoadingParams(false);
        }
    };

    // Queries
    const { data: plants = [], error: plantsError } = useQuery({
        queryKey: ['machinePlants'],
        queryFn: fetchMachinePlants,
        retry: 1,
        onError: (error) => {
            console.error('Error fetching machine plants:', error);
        }
    });

    const { data: machines = [], isLoading: isLoadingMachines, error: machinesError } = useQuery({
        queryKey: ['machines', selectedPlantId],
        queryFn: fetchMachines,
        retry: 1,
        onError: (error) => {
            console.error('Error fetching machines:', error);
        }
    });

    const filteredMachines = useMemo(() => {
        const term = searchTerm.trim().toLowerCase();
        if (!term) return machines;
        return machines.filter((machine) => {
            const name = String(machine.machine_name || "").toLowerCase();
            const branch = String(machine.branch_name || "").toLowerCase();
            const plantNames = String(machine.plant_names || "").toLowerCase();
            const perf = String(machine.performance_type || "").toLowerCase();
            const id = String(machine.id ?? "");
            return (
                name.includes(term) ||
                branch.includes(term) ||
                plantNames.includes(term) ||
                perf.includes(term) ||
                id.includes(term)
            );
        });
    }, [machines, searchTerm]);

    // Create machine mutation
    const createMachineMutation = useMutation({
        mutationFn: async (machineData) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + "/api/process/create-machine/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(machineData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: (response) => {
            toast({
                title: "Success",
                description: "Machine created successfully",
                className: "text-white",
                style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
            });
            queryClient.invalidateQueries(['machines']);
            const createdId = response?.data?.id;
            if (createdId) {
                setCreateParamsMachineId(String(createdId));
            }
            setIsCreateMachineDialogOpen(false);
            setNewMachine({
                machine_name: "",
                capacity: "",
                performance_type: "hourly",
                branch: "",
                is_active: true
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Create machine plant mutation
    const createPlantMutation = useMutation({
        mutationFn: async (plantData) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + "/api/process/create-machine-plant/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(plantData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Plant created successfully",
                className: "text-white",
                style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
            });
            queryClient.invalidateQueries(['machinePlants']);
            setIsCreatePlantDialogOpen(false);
            setNewPlant({
                plant_name: "",
                location: "",
                is_active: true,
            });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Update machine-plant mapping mutation
    const updateMachinePlantMappingMutation = useMutation({
        mutationFn: async ({ machineId, plantIds }) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(
                API_BASE_URL + `/api/process/machines/${machineId}/plants/`,
                {
                    method: "PUT",
                    headers: {
                        "Authorization": `Bearer ${token}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({ plant_ids: plantIds }),
                }
            );

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || errorData.message || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Plant mapping updated successfully",
                className: "text-white",
                style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
            });
            queryClient.invalidateQueries(['machines']);
            setIsEditPlantMappingDialogOpen(false);
            setEditingMachineForPlants(null);
            setSelectedPlantIdsForEdit([]);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Create machine parameters mutation (multiple)
    const createMachineParamsMutation = useMutation({
        mutationFn: async (paramsData) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + "/api/process/create-machine-param/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(paramsData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Machine parameters created successfully",
                className: "text-white",
                style: { backgroundColor: "#16a34a", border: "1px solid #16a34a" },
            });
            queryClient.invalidateQueries(['machines']);
            setIsCreateParamsDialogOpen(false);
            resetCreateParamsForm();
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Create machine parameter mutation (single)
    const createMachineParamMutation = useMutation({
        mutationFn: async (paramData) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + "/api/process/create-machine-param/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...paramData,
                    machine_ids: selectedMachine ? [selectedMachine.id] : []
                }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: async (response) => {
            const createdId = response?.data?.id;
            if (newParam.param_type === "pre_defined" && createdId) {
                try {
                    await savePredefinedValues(createdId, predefinedValues, false);
                } catch (error) {
                    toast({
                        title: "Parameter created",
                        description: error.message || "Parameter saved, but predefined values failed",
                        variant: "destructive",
                    });
                }
            }
            toast({
                title: "Success",
                description: "Machine parameter created successfully",
                variant: "success",
            });
            queryClient.invalidateQueries(['machines']);
            if (selectedMachine) {
                fetchMachineParameters(selectedMachine.id);
            }
            setIsCreateDialogOpen(false);
            setNewParam({
                parameter_name: "",
                is_validation_required: false,
                is_required: false,
                min_value: "",
                max_value: "",
                param_type: "",
                sequence: "",
                unit: "",
                remarks: ""
            });
            setPredefinedValues([emptyPredefinedValue()]);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Update machine parameter mutation
    const updateMachineParamMutation = useMutation({
        mutationFn: async ({ paramId, paramData }) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + `/api/process/machine-params/${paramId}/`, {
                method: "PUT",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(paramData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: async () => {
            if (editingParam?.param_type === "pre_defined" && editingParam?.id) {
                try {
                    await savePredefinedValues(editingParam.id, predefinedValues, true);
                } catch (error) {
                    toast({
                        title: "Parameter updated",
                        description: error.message || "Parameter saved, but predefined values failed",
                        variant: "destructive",
                    });
                }
            }
            toast({
                title: "Success",
                description: "Machine parameter updated successfully",
                variant: "success",
            });
            queryClient.invalidateQueries(['machines']);
            fetchMachineParameters(selectedMachine.id);
            setIsEditDialogOpen(false);
            setEditingParam(null);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Delete machine parameter mutation
    const deleteMachineParamMutation = useMutation({
        mutationFn: async (paramId) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + `/api/process/machine-params/${paramId}/`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: () => {
            toast({
                title: "Success",
                description: "Machine parameter deleted successfully",
                variant: "success",
            });
            queryClient.invalidateQueries(['machines']);
            fetchMachineParameters(selectedMachine.id);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Handlers
    const handleMachineSelect = (machine) => {
        setSelectedMachine(machine);
        fetchMachineParameters(machine.id);
    };

    const handleBackToMachines = () => {
        setSelectedMachine(null);
        setMachineParams([]);
    };

    const handleCreateParam = () => {
        if (!selectedMachine?.id) {
            toast({
                title: "Validation Error",
                description: "Please select a machine before creating a parameter",
                variant: "destructive",
            });
            return;
        }

        if (!newParam.parameter_name.trim()) {
            toast({
                title: "Validation Error",
                description: "Parameter name is required",
                variant: "destructive",
            });
            return;
        }

        const paramData = {
            parameter_name: newParam.parameter_name,
            is_validation_required: newParam.is_validation_required,
            is_required: newParam.is_required,
            min_value: newParam.min_value ? parseFloat(newParam.min_value) : null,
            max_value: newParam.max_value ? parseFloat(newParam.max_value) : null,
            param_type: newParam.param_type || null,
            sequence: newParam.sequence === "" ? 0 : parseInt(newParam.sequence, 10),
            unit: newParam.unit || null,
            remarks: newParam.remarks || null
        };

        createMachineParamMutation.mutate(paramData);
    };

    const getAuthHeaders = () => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }
        return {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
        };
    };

    const fetchPredefinedValues = async (paramId) => {
        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(
            `${API_BASE_URL}/api/process/machine-param-predefined-values/?machine_param_id=${paramId}`,
            { method: "GET", headers: getAuthHeaders() }
        );
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        const rows = Array.isArray(data.data) ? data.data : [];
        return rows.length
            ? rows.map((row) => ({
                id: row.id || null,
                value: row.value || "",
                sequence: row.sequence ?? "",
            }))
            : [emptyPredefinedValue()];
    };

    const savePredefinedValues = async (paramId, rows, replace = true) => {
        const values = (rows || [])
            .filter((row) => String(row.value || "").trim() !== "")
            .map((row, index) => ({
                ...(row.id ? { id: row.id } : {}),
                value: String(row.value).trim(),
                sequence: row.sequence === "" || row.sequence == null ? index + 1 : parseInt(row.sequence, 10),
            }));
        if (!values.length) {
            return;
        }
        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(`${API_BASE_URL}/api/process/machine-param-predefined-values/`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                machine_param_id: paramId,
                replace,
                values,
            }),
        });
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
        }
        return response.json();
    };

    const openPredefinedDialog = async (context) => {
        setPredefinedContext(context);
        if (context === "edit" && editingParam?.id) {
            try {
                const rows = await fetchPredefinedValues(editingParam.id);
                setPredefinedValues(rows);
            } catch (error) {
                toast({
                    title: "Error",
                    description: error.message || "Failed to load predefined values",
                    variant: "destructive",
                });
                setPredefinedValues([emptyPredefinedValue()]);
            }
        } else if (context === "create" && (!predefinedValues || predefinedValues.length === 0)) {
            setPredefinedValues([emptyPredefinedValue()]);
        }
        setIsPredefinedDialogOpen(true);
    };

    const handleParamTypeChange = (value, context) => {
        if (context === "create") {
            setNewParam((prev) => ({ ...prev, param_type: value }));
            if (value === "pre_defined") {
                openPredefinedDialog("create");
            }
            return;
        }
        setEditingParam((prev) => ({ ...prev, param_type: value }));
        if (value === "pre_defined") {
            openPredefinedDialog("edit");
        }
    };

    const handleEditParam = async (param) => {
        setEditingParam({
            ...param,
            min_value: param.min_value || "",
            max_value: param.max_value || "",
            param_type: param.param_type || "",
            sequence: param.sequence ?? "",
            machine_ids: selectedMachine?.id ? [selectedMachine.id] : (param.machine_ids || [])
        });
        if (param.param_type === "pre_defined" && param.id) {
            try {
                const rows = await fetchPredefinedValues(param.id);
                setPredefinedValues(rows);
            } catch (error) {
                setPredefinedValues([emptyPredefinedValue()]);
            }
        } else {
            setPredefinedValues([emptyPredefinedValue()]);
        }
        setIsEditDialogOpen(true);
    };

    const handleUpdateParam = () => {
        if (!editingParam.parameter_name.trim()) {
            toast({
                title: "Validation Error",
                description: "Parameter name is required",
                variant: "destructive",
            });
            return;
        }

        const paramData = {
            parameter_name: editingParam.parameter_name,
            is_validation_required: editingParam.is_validation_required,
            is_required: editingParam.is_required,
            min_value: editingParam.min_value ? parseFloat(editingParam.min_value) : null,
            max_value: editingParam.max_value ? parseFloat(editingParam.max_value) : null,
            param_type: editingParam.param_type || null,
            sequence: editingParam.sequence === "" ? 0 : parseInt(editingParam.sequence, 10),
            unit: editingParam.unit || null,
            remarks: editingParam.remarks || null,
            machine_ids: selectedMachine?.id ? [selectedMachine.id] : (editingParam.machine_ids || [])
        };

        updateMachineParamMutation.mutate({
            paramId: editingParam.id,
            paramData
        });
    };

    const handleDeleteParam = (paramId) => {
        if (window.confirm("Are you sure you want to delete this machine parameter? This action cannot be undone.")) {
            deleteMachineParamMutation.mutate(paramId);
        }
    };

    // New handler functions
    const handleCreateMachine = () => {
        if (!newMachine.machine_name.trim()) {
            toast({
                title: "Validation Error",
                description: "Machine name is required",
                variant: "destructive",
            });
            return;
        }

        const capacityRaw = String(newMachine.capacity ?? "").trim();
        const capacity = capacityRaw === "" ? 0 : parseFloat(capacityRaw);
        if (Number.isNaN(capacity) || capacity < 0) {
            toast({
                title: "Validation Error",
                description: "Capacity must be a valid non-negative number",
                variant: "destructive",
            });
            return;
        }

        const machineData = {
            machine_name: newMachine.machine_name,
            capacity,
            performance_type: newMachine.performance_type,
            branch: newMachine.branch || null,
            is_active: newMachine.is_active
        };

        createMachineMutation.mutate(machineData);
    };

    const handleCreatePlant = () => {
        if (!newPlant.plant_name.trim()) {
            toast({
                title: "Validation Error",
                description: "Plant name is required",
                variant: "destructive",
            });
            return;
        }

        createPlantMutation.mutate({
            plant_name: newPlant.plant_name.trim(),
            location: newPlant.location.trim() || null,
            is_active: newPlant.is_active,
        });
    };

    const openEditPlantMapping = (machine, event) => {
        if (event) {
            event.stopPropagation();
        }
        setEditingMachineForPlants(machine);
        setSelectedPlantIdsForEdit(
            (machine.plant_ids || (machine.plants || []).map((p) => p.id) || []).map(String)
        );
        setIsEditPlantMappingDialogOpen(true);
    };

    const togglePlantSelectionForEdit = (plantId) => {
        const id = String(plantId);
        setSelectedPlantIdsForEdit((prev) =>
            prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
        );
    };

    const handleSavePlantMapping = () => {
        if (!editingMachineForPlants?.id) return;
        updateMachinePlantMappingMutation.mutate({
            machineId: editingMachineForPlants.id,
            plantIds: selectedPlantIdsForEdit.map((id) => parseInt(id, 10)),
        });
    };

    const handleAddNewParam = () => {
        setNewParams([...newParams, {
            parameter_name: "",
            is_validation_required: false,
            is_required: false,
            min_value: "",
            max_value: "",
            unit: "",
            remarks: "",
            machine_ids: []
        }]);
    };

    const handleRemoveParam = (index) => {
        if (newParams.length > 1) {
            setNewParams(newParams.filter((_, i) => i !== index));
        }
    };

    const handleCreateParams = () => {
        if (!createParamsMachineId) {
            toast({
                title: "Validation Error",
                description: "Please select a machine first",
                variant: "destructive",
            });
            return;
        }

        const machineId = parseInt(createParamsMachineId, 10);

        // Validate parameters
        const validParams = newParams.filter(param => param.parameter_name.trim() !== "");

        if (validParams.length === 0) {
            toast({
                title: "Validation Error",
                description: "At least one parameter name is required",
                variant: "destructive",
            });
            return;
        }

        // Convert empty strings to null for optional fields
        const processedParams = validParams.map(param => ({
            ...param,
            min_value: param.min_value ? parseFloat(param.min_value) : null,
            max_value: param.max_value ? parseFloat(param.max_value) : null,
            unit: param.unit || null,
            remarks: param.remarks || null,
            machine_ids: [machineId]
        }));

        // Create parameters one by one
        processedParams.forEach(param => {
            createMachineParamsMutation.mutate(param);
        });
    };

    // Edit dialog machine selection handler
    const handleEditMachineChange = (machineId) => {
        const currentMachines = editingParam.machine_ids || [];
        
        if (currentMachines.includes(machineId)) {
            // Remove machine if already selected
            setEditingParam({
                ...editingParam,
                machine_ids: currentMachines.filter(id => id !== machineId)
            });
        } else {
            // Add machine if not selected
            setEditingParam({
                ...editingParam,
                machine_ids: [...currentMachines, machineId]
            });
        }
    };

    // Filter parameters based on search term; display order follows sequence
    const filteredParams = machineParams
        .filter(param =>
            param.parameter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (param.unit && param.unit.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (param.remarks && param.remarks.toLowerCase().includes(searchTerm.toLowerCase()))
        )
        .slice()
        .sort((a, b) => {
            const seqA = Number(a.sequence ?? 0);
            const seqB = Number(b.sequence ?? 0);
            if (seqA !== seqB) return seqA - seqB;
            return (a.id || 0) - (b.id || 0);
        });

    const getValidationStatus = (param) => {
        if (!param.is_validation_required) {
            return { status: "none", text: "No Validation", icon: CheckCircle, color: "text-gray-500" };
        }
        if (param.min_value && param.max_value) {
            return { status: "range", text: `${param.min_value} - ${param.max_value} ${param.unit || ''}`, icon: AlertTriangle, color: "text-blue-500" };
        }
        return { status: "required", text: "Validation Required", icon: AlertTriangle, color: "text-orange-500" };
    };

    if (isLoadingMachines) {
        return <CommonLoader text="Loading machines..." />;
    }

    if (machinesError) {
        return (
            <div className="flex h-screen bg-gray-50 dark:bg-gray-900">
                {!isMobile && <Sidebar />}
                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <AlertTriangle className="h-12 w-12 text-red-500 mx-auto mb-4" />
                        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Error Loading Machines</h2>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">{machinesError.message}</p>
                        <Button onClick={() => window.location.reload()}>
                            <RefreshCw className="h-4 w-4 mr-2" />
                            Try Again
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

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
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                            {selectedMachine ? "Machine Parameters" : "Machine Parameters"}
                        </h1>
                        <div className="w-10" />
                    </div>
                )}

                <div className="flex-1 p-6 overflow-auto">
                    {!selectedMachine ? (
                        // Machines List View
                        <>
                            <div className="mb-6">
                                <div className="flex items-center justify-between">
                                    <div>
                                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Machine Parameters</h1>
                                        <p className="text-gray-600 dark:text-gray-400 mt-2">Select a machine to view and manage its parameters</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <Button
                                            variant="outline"
                                            className="flex items-center gap-2"
                                            onClick={() => setIsCreatePlantDialogOpen(true)}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Create Plant
                                        </Button>
                                        <Button
                                            className="flex items-center gap-2"
                                            onClick={() => setIsCreateMachineDialogOpen(true)}
                                        >
                                            <Plus className="h-4 w-4" />
                                            Create Machine
                                        </Button>
                                    </div>
                                </div>
                            </div>

                            {/* Search & Plant Filter */}
                            <Card className="mb-6">
                                <CardContent className="pt-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-2">
                                            <Label htmlFor="machine-search">Search</Label>
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                                <Input
                                                    id="machine-search"
                                                    placeholder="Search by machine, branch, plant..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="plant-filter">Plant</Label>
                                            <Select
                                                value={selectedPlantId}
                                                onValueChange={(value) => setSelectedPlantId(value || "all")}
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
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Machines Table */}
                            <Card>
                                <CardContent className="pt-6">
                                    {isLoadingMachines ? (
                                        <div className="py-8"><CommonLoader /></div>
                                    ) : machinesError ? (
                                        <div className="text-sm text-red-500">Error loading machines</div>
                                    ) : filteredMachines.length === 0 ? (
                                        <div className="text-center py-12">
                                            <Settings className="mx-auto h-12 w-12 text-gray-400" />
                                            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No machines found</h3>
                                            <p className="mt-1 text-sm text-gray-500">No machines match your search or plant filter.</p>
                                        </div>
                                    ) : (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>Machine</TableHead>
                                                        <TableHead>Performance Type</TableHead>
                                                        <TableHead>Branch</TableHead>
                                                        <TableHead>Plants</TableHead>
                                                        <TableHead className="text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredMachines.map((machine) => (
                                                        <TableRow
                                                            key={machine.id}
                                                            className="cursor-pointer"
                                                            onClick={() => handleMachineSelect(machine)}
                                                        >
                                                            <TableCell className="font-medium underline">
                                                                {machine.machine_name}
                                                            </TableCell>
                                                            <TableCell>
                                                                <Badge variant="outline">
                                                                    {machine.performance_type || "hourly"}
                                                                </Badge>
                                                            </TableCell>
                                                            <TableCell>{machine.branch_name || "N/A"}</TableCell>
                                                            <TableCell>
                                                                {machine.plant_names || (
                                                                    <span className="text-gray-400">No plants mapped</span>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={(e) => openEditPlantMapping(machine, e)}
                                                                >
                                                                    <Edit className="h-3.5 w-3.5 mr-1" />
                                                                    Map Plants
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
                        // Machine Parameters View
                        <>
                            <div className="mb-6">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <Button 
                                            variant="outline" 
                                            size="sm" 
                                            onClick={handleBackToMachines}
                                            className="flex items-center"
                                        >
                                            <ArrowLeft className="h-4 w-4 mr-2" />

                                        </Button>
                                        <div>
                                            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                                {selectedMachine.machine_name} Parameters
                                            </h1>
                                            <p className="text-gray-600 dark:text-gray-400 mt-2">
                                                Manage parameters for {selectedMachine.machine_name}
                                            </p>
                                        </div>
                                    </div>
                                    <Button onClick={() => setIsCreateDialogOpen(true)} size="sm">
                                        <Plus className="h-4 w-4 mr-2" />
                                        Add Parameter
                                    </Button>
                                </div>
                            </div>

                            {/* Search Section */}
                            <Card className="mb-6">
                                <CardContent className="p-4">
                                    <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                        <div className="flex-1 max-w-md">
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                                <Input
                                                    placeholder="Search parameters..."
                                                    value={searchTerm}
                                                    onChange={(e) => setSearchTerm(e.target.value)}
                                                    className="pl-10"
                                                />
                                            </div>
                                        </div>
                                        <Badge variant="secondary" className="text-lg font-semibold">
                                            {filteredParams.length} parameters
                                        </Badge>
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Parameters Table */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center space-x-2">
                                        <Settings className="h-5 w-5" />
                                        <span>Machine Parameters</span>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {isLoadingParams ? (
                                        <div className="flex items-center justify-center py-8">
                                            <CommonLoader text="Loading parameters..." />
                                        </div>
                                    ) : filteredParams.length > 0 ? (
                                        <div className="overflow-x-auto">
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead>#</TableHead>
                                                        <TableHead>Seq</TableHead>
                                                        <TableHead>Parameter</TableHead>
                                                        <TableHead>Unit</TableHead>
                                                        <TableHead>Required</TableHead>
                                                        <TableHead>Validation</TableHead>
                                                        <TableHead>Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {filteredParams.map((param, index) => {
                                                        const validation = getValidationStatus(param);
                                                        const ValidationIcon = validation.icon;

                                                        return (
                                                            <TableRow key={param.id}>
                                                                <TableCell>{index + 1}</TableCell>
                                                                <TableCell className="tabular-nums text-muted-foreground">
                                                                    {param.sequence ?? 0}
                                                                </TableCell>
                                                                <TableCell className="font-medium">
                                                                    <div className="flex items-center space-x-2">

                                                                        <span>{param.parameter_name}</span>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {param.unit ? (
                                                                        <Badge variant="outline">{param.unit}</Badge>
                                                                    ) : (
                                                                        <span className="text-gray-400">-</span>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <Badge variant={param.is_required ? "default" : "outline"}>
                                                                        <div className="flex items-center space-x-1">
                                                                            {param.is_required ? (
                                                                                <CheckCircle className="h-3 w-3" />
                                                                            ) : (
                                                                                <XCircle className="h-3 w-3" />
                                                                            )}
                                                                            <span>{param.is_required ? "Yes" : "No"}</span>
                                                                        </div>
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell>
                                                                    {param.is_validation_required ? (
                                                                        <div className="flex items-center space-x-2">

                                                                            <span className="text-sm">{validation.text}</span>
                                                                        </div>
                                                                    ) : (
                                                                        <Badge variant="outline">
                                                                            <div className="flex items-center space-x-1">
                                                                                <XCircle className="h-3 w-3" />
                                                                                <span>No</span>
                                                                            </div>
                                                                        </Badge>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell>
                                                                    <div className="flex items-center space-x-2">
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleEditParam(param)}
                                                                            className="h-8 w-8 p-0"
                                                                        >
                                                                            <Edit className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            variant="outline"
                                                                            size="sm"
                                                                            onClick={() => handleDeleteParam(param.id)}
                                                                            className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                                            disabled={deleteMachineParamMutation.isPending}
                                                                        >
                                                                            <Trash2 className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ) : (
                                        <div className="text-center py-12">
                                            <Settings className="mx-auto h-12 w-12 text-gray-400" />
                                            <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No parameters found</h3>
                                            <p className="mt-1 text-sm text-gray-500">
                                                {searchTerm ? "No parameters match your search criteria." : "Get started by creating your first machine parameter."}
                                            </p>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </>
                    )}
                </div>
            </div>

            {/* Create Parameter Dialog */}
            <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="h-5 w-5" />
                            Create Machine Parameter
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <Card className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="param-name">Parameter Name *</Label>
                                    <Input
                                        id="param-name"
                                        value={newParam.parameter_name}
                                        onChange={(e) => setNewParam({ ...newParam, parameter_name: e.target.value })}
                                        placeholder="e.g., Temperature, Pressure"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="param-unit">Unit</Label>
                                    <Input
                                        id="param-unit"
                                        value={newParam.unit}
                                        onChange={(e) => setNewParam({ ...newParam, unit: e.target.value })}
                                        placeholder="e.g., °C, bar, rpm"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="param-type">Select Param Type</Label>
                                    <Select
                                        value={newParam.param_type || undefined}
                                        onValueChange={(value) => handleParamTypeChange(value, "create")}
                                    >
                                        <SelectTrigger id="param-type">
                                            <SelectValue placeholder="Select param type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {PARAM_TYPE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="param-sequence">Sequence</Label>
                                    <Input
                                        id="param-sequence"
                                        type="number"
                                        min="0"
                                        value={newParam.sequence}
                                        onChange={(e) => setNewParam({ ...newParam, sequence: e.target.value })}
                                        placeholder="e.g., 1"
                                    />
                                </div>

                                {newParam.param_type === "pre_defined" && (
                                    <div className="md:col-span-2">
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            onClick={() => openPredefinedDialog("create")}
                                        >
                                            Manage Predefined Values
                                            {predefinedValues.filter((row) => String(row.value || "").trim()).length > 0
                                                ? ` (${predefinedValues.filter((row) => String(row.value || "").trim()).length})`
                                                : ""}
                                        </Button>
                                    </div>
                                )}

                                <div className="md:col-span-2 flex items-center space-x-4">
                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="param-required"
                                            checked={newParam.is_required}
                                            onCheckedChange={(checked) => setNewParam({ ...newParam, is_required: checked })}
                                        />
                                        <Label htmlFor="param-required" className="text-sm">
                                            Required Parameter
                                        </Label>
                                    </div>

                                    <div className="flex items-center space-x-2">
                                        <Checkbox
                                            id="param-validation"
                                            checked={newParam.is_validation_required}
                                            onCheckedChange={(checked) => setNewParam({ 
                                                ...newParam, 
                                                is_validation_required: checked,
                                                min_value: checked ? newParam.min_value : "",
                                                max_value: checked ? newParam.max_value : ""
                                            })}
                                        />
                                        <Label htmlFor="param-validation" className="text-sm">
                                            Enable validation (requires min/max values)
                                        </Label>
                                    </div>
                                </div>

                                {newParam.is_validation_required && (
                                    <>
                                        <div className="space-y-2">
                                            <Label htmlFor="param-min">Minimum Value</Label>
                                            <Input
                                                id="param-min"
                                                type="number"
                                                step="0.001"
                                                value={newParam.min_value}
                                                onChange={(e) => setNewParam({ ...newParam, min_value: e.target.value })}
                                                placeholder="e.g., 10.5"
                                            />
                                        </div>

                                        <div className="space-y-2">
                                            <Label htmlFor="param-max">Maximum Value</Label>
                                            <Input
                                                id="param-max"
                                                type="number"
                                                step="0.001"
                                                value={newParam.max_value}
                                                onChange={(e) => setNewParam({ ...newParam, max_value: e.target.value })}
                                                placeholder="e.g., 15.0"
                                            />
                                        </div>
                                    </>
                                )}

                                <div className="md:col-span-2 space-y-2">
                                    <Label>Selected Machine</Label>
                                    <div className="border rounded-md p-3">
                                        {selectedMachine ? (
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Badge variant="outline" className="text-sm">
                                                    {selectedMachine.machine_name}
                                                    {selectedMachine.branch_name ? ` (${selectedMachine.branch_name})` : ""}
                                                </Badge>
                                            </div>
                                        ) : (
                                            <p className="text-sm text-gray-500">
                                                No machine selected. Please select a machine from the machine list first.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="md:col-span-2 space-y-2">
                                    <Label htmlFor="param-remarks">Remarks</Label>
                                    <Textarea
                                        id="param-remarks"
                                        value={newParam.remarks}
                                        onChange={(e) => setNewParam({ ...newParam, remarks: e.target.value })}
                                        placeholder="Additional notes or instructions..."
                                        rows={3}
                                    />
                                </div>
                            </div>
                        </Card>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateParam}
                                disabled={createMachineParamMutation.isPending}
                            >
                                {createMachineParamMutation.isPending ? "Creating..." : "Create Parameter"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Parameter Dialog */}
            <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Edit className="h-5 w-5" />
                            Edit Machine Parameter
                        </DialogTitle>
                    </DialogHeader>

                    {editingParam && (
                        <div className="space-y-6">
                            <Card className="p-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="edit-param-name">Parameter Name *</Label>
                                        <Input
                                            id="edit-param-name"
                                            value={editingParam.parameter_name}
                                            onChange={(e) => setEditingParam({ ...editingParam, parameter_name: e.target.value })}
                                            placeholder="e.g., Temperature, Pressure"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-param-unit">Unit</Label>
                                        <Input
                                            id="edit-param-unit"
                                            value={editingParam.unit}
                                            onChange={(e) => setEditingParam({ ...editingParam, unit: e.target.value })}
                                            placeholder="e.g., °C, bar, rpm"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-param-type">Select Param Type</Label>
                                        <Select
                                            value={editingParam.param_type || undefined}
                                            onValueChange={(value) => handleParamTypeChange(value, "edit")}
                                        >
                                            <SelectTrigger id="edit-param-type">
                                                <SelectValue placeholder="Select param type" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {PARAM_TYPE_OPTIONS.map((option) => (
                                                    <SelectItem key={option.value} value={option.value}>
                                                        {option.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor="edit-param-sequence">Sequence</Label>
                                        <Input
                                            id="edit-param-sequence"
                                            type="number"
                                            min="0"
                                            value={editingParam.sequence}
                                            onChange={(e) => setEditingParam({ ...editingParam, sequence: e.target.value })}
                                            placeholder="e.g., 1"
                                        />
                                    </div>

                                    {editingParam.param_type === "pre_defined" && (
                                        <div className="md:col-span-2">
                                            <Button
                                                type="button"
                                                variant="outline"
                                                size="sm"
                                                onClick={() => openPredefinedDialog("edit")}
                                            >
                                                Manage Predefined Values
                                                {predefinedValues.filter((row) => String(row.value || "").trim()).length > 0
                                                    ? ` (${predefinedValues.filter((row) => String(row.value || "").trim()).length})`
                                                    : ""}
                                            </Button>
                                        </div>
                                    )}

                                    <div className="md:col-span-2 flex items-center space-x-4">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="edit-param-required"
                                                checked={editingParam.is_required}
                                                onCheckedChange={(checked) => setEditingParam({ ...editingParam, is_required: checked })}
                                            />
                                            <Label htmlFor="edit-param-required" className="text-sm">
                                                Required Parameter
                                            </Label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id="edit-param-validation"
                                                checked={editingParam.is_validation_required}
                                                onCheckedChange={(checked) => setEditingParam({ 
                                                    ...editingParam, 
                                                    is_validation_required: checked,
                                                    min_value: checked ? editingParam.min_value : "",
                                                    max_value: checked ? editingParam.max_value : ""
                                                })}
                                            />
                                            <Label htmlFor="edit-param-validation" className="text-sm">
                                                Enable validation (requires min/max values)
                                            </Label>
                                        </div>
                                    </div>

                                    {editingParam.is_validation_required && (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor="edit-param-min">Minimum Value</Label>
                                                <Input
                                                    id="edit-param-min"
                                                    type="number"
                                                    step="0.001"
                                                    value={editingParam.min_value}
                                                    onChange={(e) => setEditingParam({ ...editingParam, min_value: e.target.value })}
                                                    placeholder="e.g., 10.5"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor="edit-param-max">Maximum Value</Label>
                                                <Input
                                                    id="edit-param-max"
                                                    type="number"
                                                    step="0.001"
                                                    value={editingParam.max_value}
                                                    onChange={(e) => setEditingParam({ ...editingParam, max_value: e.target.value })}
                                                    placeholder="e.g., 15.0"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="md:col-span-2 space-y-2">
                                        <Label>Selected Machine</Label>
                                        <div className="border rounded-md p-3">
                                            {selectedMachine ? (
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <Badge variant="outline" className="text-sm">
                                                        {selectedMachine.machine_name}
                                                        {selectedMachine.branch_name ? ` (${selectedMachine.branch_name})` : ""}
                                                    </Badge>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500">
                                                    No machine selected. Please select a machine from the machine list first.
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor="edit-param-remarks">Remarks</Label>
                                        <Textarea
                                            id="edit-param-remarks"
                                            value={editingParam.remarks}
                                            onChange={(e) => setEditingParam({ ...editingParam, remarks: e.target.value })}
                                            placeholder="Additional notes or instructions..."
                                            rows={3}
                                        />
                                    </div>
                                </div>
                            </Card>

                            <div className="flex justify-end gap-2">
                                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                    Cancel
                                </Button>
                                <Button
                                    onClick={handleUpdateParam}
                                    disabled={updateMachineParamMutation.isPending}
                                >
                                    {updateMachineParamMutation.isPending ? "Updating..." : "Update Parameter"}
                                </Button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>

            <Dialog open={isPredefinedDialogOpen} onOpenChange={setIsPredefinedDialogOpen}>
                <DialogContent className="max-w-xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Add Predefined Values</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        <p className="text-sm text-gray-600">
                            Add one or more values for this pre-defined parameter.
                        </p>
                        {predefinedValues.map((row, index) => (
                            <div key={`${row.id || "new"}-${index}`} className="grid grid-cols-12 gap-2 items-end">
                                <div className="col-span-7 space-y-1">
                                    <Label>Value *</Label>
                                    <Input
                                        value={row.value}
                                        onChange={(e) => {
                                            const next = [...predefinedValues];
                                            next[index] = { ...next[index], value: e.target.value };
                                            setPredefinedValues(next);
                                        }}
                                        placeholder="e.g., High"
                                    />
                                </div>
                                <div className="col-span-3 space-y-1">
                                    <Label>Sequence</Label>
                                    <Input
                                        type="number"
                                        min="0"
                                        value={row.sequence}
                                        onChange={(e) => {
                                            const next = [...predefinedValues];
                                            next[index] = { ...next[index], sequence: e.target.value };
                                            setPredefinedValues(next);
                                        }}
                                        placeholder={String(index + 1)}
                                    />
                                </div>
                                <div className="col-span-2">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-full"
                                        disabled={predefinedValues.length === 1}
                                        onClick={() => setPredefinedValues(predefinedValues.filter((_, i) => i !== index))}
                                    >
                                        Remove
                                    </Button>
                                </div>
                            </div>
                        ))}
                        <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setPredefinedValues([...predefinedValues, emptyPredefinedValue()])}
                        >
                            <Plus className="h-4 w-4 mr-1" />
                            Add Value
                        </Button>
                        <div className="flex justify-end gap-2 pt-2">
                            <Button variant="outline" onClick={() => setIsPredefinedDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                disabled={isSavingPredefined}
                                onClick={async () => {
                                    const filled = predefinedValues.filter((row) => String(row.value || "").trim());
                                    if (!filled.length) {
                                        toast({
                                            title: "Validation Error",
                                            description: "Add at least one predefined value",
                                            variant: "destructive",
                                        });
                                        return;
                                    }
                                    if (predefinedContext === "edit" && editingParam?.id) {
                                        try {
                                            setIsSavingPredefined(true);
                                            await savePredefinedValues(editingParam.id, predefinedValues, true);
                                            toast({
                                                title: "Success",
                                                description: "Predefined values saved",
                                                variant: "success",
                                            });
                                        } catch (error) {
                                            toast({
                                                title: "Error",
                                                description: error.message || "Failed to save predefined values",
                                                variant: "destructive",
                                            });
                                            return;
                                        } finally {
                                            setIsSavingPredefined(false);
                                        }
                                    }
                                    setIsPredefinedDialogOpen(false);
                                }}
                            >
                                {isSavingPredefined ? "Saving..." : "Save Values"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Edit Plant Mapping Dialog */}
            <Dialog
                open={isEditPlantMappingDialogOpen}
                onOpenChange={(open) => {
                    setIsEditPlantMappingDialogOpen(open);
                    if (!open) {
                        setEditingMachineForPlants(null);
                        setSelectedPlantIdsForEdit([]);
                    }
                }}
            >
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>
                            Map Plants
                            {editingMachineForPlants?.machine_name
                                ? ` — ${editingMachineForPlants.machine_name}`
                                : ""}
                        </DialogTitle>
                    </DialogHeader>
                    <div className="space-y-4">
                        {plants.length === 0 ? (
                            <p className="text-sm text-gray-500">
                                No plants available. Create a plant first.
                            </p>
                        ) : (
                            <div className="space-y-2 max-h-72 overflow-y-auto border rounded-md p-3">
                                {plants.map((plant) => {
                                    const checked = selectedPlantIdsForEdit.includes(String(plant.id));
                                    return (
                                        <label
                                            key={plant.id}
                                            className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer"
                                        >
                                            <Checkbox
                                                checked={checked}
                                                onCheckedChange={() => togglePlantSelectionForEdit(plant.id)}
                                            />
                                            <span className="text-sm">
                                                {plant.plant_name}
                                                {plant.location ? ` (${plant.location})` : ""}
                                            </span>
                                        </label>
                                    );
                                })}
                            </div>
                        )}
                        <div className="flex justify-end gap-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsEditPlantMappingDialogOpen(false)}
                            >
                                Cancel
                            </Button>
                            <Button
                                onClick={handleSavePlantMapping}
                                disabled={updateMachinePlantMappingMutation.isPending || !editingMachineForPlants}
                            >
                                {updateMachinePlantMappingMutation.isPending ? "Saving..." : "Save Mapping"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Plant Dialog */}
            <Dialog open={isCreatePlantDialogOpen} onOpenChange={setIsCreatePlantDialogOpen}>
                <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Plant</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <Card className="p-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="plant-name">Plant Name *</Label>
                                    <Input
                                        id="plant-name"
                                        value={newPlant.plant_name}
                                        onChange={(e) => setNewPlant({ ...newPlant, plant_name: e.target.value })}
                                        placeholder="e.g., Main Plant"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="plant-location">Location</Label>
                                    <Input
                                        id="plant-location"
                                        value={newPlant.location}
                                        onChange={(e) => setNewPlant({ ...newPlant, location: e.target.value })}
                                        placeholder="e.g., Rayapur (optional)"
                                    />
                                </div>
                            </div>
                        </Card>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsCreatePlantDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreatePlant}
                                disabled={createPlantMutation.isPending}
                            >
                                {createPlantMutation.isPending ? "Creating..." : "Create Plant"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Machine Dialog */}
            <Dialog open={isCreateMachineDialogOpen} onOpenChange={setIsCreateMachineDialogOpen}>
                <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">

                            Create Machine
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        <Card className="p-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="machine-name">Machine Name *</Label>
                                    <Input
                                        id="machine-name"
                                        value={newMachine.machine_name}
                                        onChange={(e) => setNewMachine({ ...newMachine, machine_name: e.target.value })}
                                        placeholder="e.g., Production Line 1"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="performance-type">Performance Type *</Label>
                                    <Select
                                        value={newMachine.performance_type}
                                        onValueChange={(value) => setNewMachine({ ...newMachine, performance_type: value })}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="Select performance type" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="hourly">Hourly</SelectItem>
                                            <SelectItem value="daily">Daily</SelectItem>
                                            <SelectItem value="monthly">Monthly</SelectItem>
                                            <SelectItem value="custom">Custom</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="machine-capacity">Capacity</Label>
                                    <Input
                                        id="machine-capacity"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={newMachine.capacity}
                                        onChange={(e) => setNewMachine({ ...newMachine, capacity: e.target.value })}
                                        placeholder="e.g., 100 (optional, defaults to 0)"
                                    />
                                </div>


                            </div>
                        </Card>

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => setIsCreateMachineDialogOpen(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateMachine}
                                disabled={createMachineMutation.isPending}
                            >
                                {createMachineMutation.isPending ? "Creating..." : "Create Machine"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Create Parameters Dialog */}
            <Dialog open={isCreateParamsDialogOpen} onOpenChange={handleCreateParamsDialogOpenChange}>
                <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle>Create Machine Parameters</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-6">
                        {/* Machine selection — shown first, same pattern as hamali-type-masters branch select */}
                        <Card className="p-4">
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <Label htmlFor="create-params-machine">Machine *</Label>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsCreateMachineDialogOpen(true)}
                                        className="flex items-center gap-1 h-8"
                                    >
                                        <Plus className="h-3.5 w-3.5" />
                                        Add Machine
                                    </Button>
                                </div>
                                <Select
                                    value={createParamsMachineId || undefined}
                                    onValueChange={setCreateParamsMachineId}
                                >
                                    <SelectTrigger id="create-params-machine">
                                        <SelectValue placeholder="Select machine" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {machines.length > 0 ? (
                                            machines.map((machine) => (
                                                <SelectItem key={machine.id} value={String(machine.id)}>
                                                    {machine.machine_name}
                                                    {machine.branch_name ? ` (${machine.branch_name})` : ""}
                                                </SelectItem>
                                            ))
                                        ) : (
                                            <SelectItem value="none" disabled>
                                                No machines available
                                            </SelectItem>
                                        )}
                                    </SelectContent>
                                </Select>
                                <p className="text-xs text-gray-500">
                                    Select the machine first, then add one or more parameters for it.
                                </p>
                            </div>
                        </Card>

                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                                Parameter details
                            </p>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddNewParam}
                                className="flex items-center gap-2"
                                disabled={!createParamsMachineId}
                            >
                                <Plus className="h-4 w-4" />
                                Add Parameter
                            </Button>
                        </div>

                        {!createParamsMachineId && (
                            <div className="rounded-md border border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center text-sm text-gray-500">
                                Select a machine above to start adding parameters.
                            </div>
                        )}

                        {createParamsMachineId && newParams.map((param, index) => (
                            <Card key={index} className="p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-semibold">Parameter {index + 1}</h3>
                                    {newParams.length > 1 && (
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => handleRemoveParam(index)}
                                            className="text-red-600 hover:text-red-700"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    )}
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label htmlFor={`param-name-${index}`}>Parameter Name *</Label>
                                        <Input
                                            id={`param-name-${index}`}
                                            value={param.parameter_name}
                                            onChange={(e) => {
                                                const updatedParams = [...newParams];
                                                updatedParams[index].parameter_name = e.target.value;
                                                setNewParams(updatedParams);
                                            }}
                                            placeholder="e.g., Temperature, Pressure"
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <Label htmlFor={`param-unit-${index}`}>Unit</Label>
                                        <Input
                                            id={`param-unit-${index}`}
                                            value={param.unit}
                                            onChange={(e) => {
                                                const updatedParams = [...newParams];
                                                updatedParams[index].unit = e.target.value;
                                                setNewParams(updatedParams);
                                            }}
                                            placeholder="e.g., °C, bar, rpm"
                                        />
                                    </div>

                                    <div className="md:col-span-2 flex items-center space-x-4">
                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`param-required-${index}`}
                                                checked={param.is_required}
                                                onCheckedChange={(checked) => {
                                                    const updatedParams = [...newParams];
                                                    updatedParams[index].is_required = checked;
                                                    setNewParams(updatedParams);
                                                }}
                                            />
                                            <Label htmlFor={`param-required-${index}`} className="text-sm">
                                                Required Parameter
                                            </Label>
                                        </div>

                                        <div className="flex items-center space-x-2">
                                            <Checkbox
                                                id={`param-validation-${index}`}
                                                checked={param.is_validation_required}
                                                onCheckedChange={(checked) => {
                                                    const updatedParams = [...newParams];
                                                    updatedParams[index].is_validation_required = checked;
                                                    if (!checked) {
                                                        updatedParams[index].min_value = "";
                                                        updatedParams[index].max_value = "";
                                                    }
                                                    setNewParams(updatedParams);
                                                }}
                                            />
                                            <Label htmlFor={`param-validation-${index}`} className="text-sm">
                                                Enable validation
                                            </Label>
                                        </div>
                                    </div>

                                    {param.is_validation_required && (
                                        <>
                                            <div className="space-y-2">
                                                <Label htmlFor={`param-min-${index}`}>Minimum Value</Label>
                                                <Input
                                                    id={`param-min-${index}`}
                                                    type="number"
                                                    step="0.001"
                                                    value={param.min_value}
                                                    onChange={(e) => {
                                                        const updatedParams = [...newParams];
                                                        updatedParams[index].min_value = e.target.value;
                                                        setNewParams(updatedParams);
                                                    }}
                                                    placeholder="e.g., 10.5"
                                                />
                                            </div>

                                            <div className="space-y-2">
                                                <Label htmlFor={`param-max-${index}`}>Maximum Value</Label>
                                                <Input
                                                    id={`param-max-${index}`}
                                                    type="number"
                                                    step="0.001"
                                                    value={param.max_value}
                                                    onChange={(e) => {
                                                        const updatedParams = [...newParams];
                                                        updatedParams[index].max_value = e.target.value;
                                                        setNewParams(updatedParams);
                                                    }}
                                                    placeholder="e.g., 15.0"
                                                />
                                            </div>
                                        </>
                                    )}

                                    <div className="md:col-span-2 space-y-2">
                                        <Label htmlFor={`param-remarks-${index}`}>Remarks</Label>
                                        <Textarea
                                            id={`param-remarks-${index}`}
                                            value={param.remarks}
                                            onChange={(e) => {
                                                const updatedParams = [...newParams];
                                                updatedParams[index].remarks = e.target.value;
                                                setNewParams(updatedParams);
                                            }}
                                            placeholder="Additional notes or instructions..."
                                            rows={2}
                                        />
                                    </div>
                                </div>
                            </Card>
                        ))}

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" onClick={() => handleCreateParamsDialogOpenChange(false)}>
                                Cancel
                            </Button>
                            <Button
                                onClick={handleCreateParams}
                                disabled={createMachineParamsMutation.isPending || !createParamsMachineId}
                            >
                                {createMachineParamsMutation.isPending ? "Creating..." : "Create Parameters"}
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
}
