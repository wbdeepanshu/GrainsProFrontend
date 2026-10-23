import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, Plus, FlaskConical, CheckCircle, XCircle, AlertTriangle, Menu, Image, Package, Edit, Trash2, ChevronsUpDown } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

export default function LabTestParams() {
    const normalizeCountingValidation = (value) => (
        value === "countable" ? "countable" : "non_countable"
    );

    const [searchTerm, setSearchTerm] = useState("");
    const [groupFilter, setGroupFilter] = useState(null);
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isCreateItemGroupDialogOpen, setIsCreateItemGroupDialogOpen] = useState(false);
    const [editingParam, setEditingParam] = useState(null);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [newItemGroup, setNewItemGroup] = useState({
        name: "",
        remarks: ""
    });
    const [selectedCreateGroupId, setSelectedCreateGroupId] = useState("");
    const [selectedEditGroupId, setSelectedEditGroupId] = useState("");
    const [createItemGroupOpen, setCreateItemGroupOpen] = useState(false);
    const [createItemGroupSearch, setCreateItemGroupSearch] = useState("");
    const [newParams, setNewParams] = useState([{
        parameter_name: "",
        sequence: "",
        is_validation_required: false,
        is_image_required: false,
        is_required: "none",
        test_type: "both",
        min_value: "",
        max_value: "",
        unit: "",
        remarks: "non_countable",
        item_group_ids: []
    }]);
    const [itemGroups, setItemGroups] = useState([]);

    const { toast } = useToast();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();
    const { hasCreatePermission, hasUpdatePermission, hasDeletePermission } = useUserPermissions();

    // Fetch lab test parameters
    const fetchLabTestParams = async () => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(API_BASE_URL + "/api/report/lab-test-params/", {
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

    // Fetch item groups
    const fetchItemGroups = async () => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const response = await fetch(API_BASE_URL + "/api/report/test-params-groups/", {
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

    const {
        data: labTestParams = [],
        isLoading,
        error,
        refetch
    } = useQuery({
        queryKey: ['lab-test-params'],
        queryFn: fetchLabTestParams,
        enabled: !!AuthService.getAccessToken(),
    });

    const {
        data: itemGroupsData = [],
        isLoading: isLoadingItemGroups,
        error: itemGroupsError
    } = useQuery({
        queryKey: ['item-groups'],
        queryFn: fetchItemGroups,
        enabled: !!AuthService.getAccessToken(),
    });

    // Create lab test parameters mutation
    const createLabTestParamsMutation = useMutation({
        mutationFn: async (parameters) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + "/api/report/create-lab-test/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ parameters }),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: `Successfully created ${data.created_count} lab test parameter(s)`,
            });
            queryClient.invalidateQueries(['lab-test-params']);
            setIsCreateDialogOpen(false);
            setNewParams([{
                parameter_name: "",
                sequence: "",
                is_validation_required: false,
                is_image_required: false,
                is_required: "none",
                test_type: "both",
                min_value: "",
                max_value: "",
                unit: "",
                remarks: "non_countable",
                item_group_ids: []
            }]);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Update lab test parameter mutation
    const updateLabTestParamMutation = useMutation({
        mutationFn: async ({ paramId, paramData }) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + `/api/report/update-lab-test/${paramId}/`, {
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
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: "Lab test parameter updated successfully",
            });
            queryClient.invalidateQueries(['lab-test-params']);
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

    // Delete lab test parameter mutation
    const deleteLabTestParamMutation = useMutation({
        mutationFn: async (paramId) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + `/api/report/delete-lab-test/${paramId}/`, {
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
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: "Lab test parameter deleted successfully",
            });
            queryClient.invalidateQueries(['lab-test-params']);
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    // Create item group mutation
    const createItemGroupMutation = useMutation({
        mutationFn: async (itemGroupData) => {
            const token = AuthService.getAccessToken();
            if (!token) {
                throw new Error("No authentication token found");
            }

            const API_BASE_URL = import.meta.env.VITE_BASE_URL;
            const response = await fetch(API_BASE_URL + "/api/report/item-group/", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(itemGroupData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
            }

            return response.json();
        },
        onSuccess: (data) => {
            const createdId = data?.data?.id;
            toast({
                title: "Success",
                description: data?.message || "Item group created successfully",
            });
            queryClient.invalidateQueries({ queryKey: ['item-groups'] });
            setIsCreateItemGroupDialogOpen(false);
            setNewItemGroup({ name: "", remarks: "" });
            if (createdId) {
                const idStr = String(createdId);
                setSelectedCreateGroupId(idStr);
                if (isEditDialogOpen && editingParam) {
                    setSelectedEditGroupId(idStr);
                    setEditingParam({
                        ...editingParam,
                        item_group_ids: [Number(createdId)],
                    });
                }
            }
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message,
                variant: "destructive",
            });
        },
    });

    useEffect(() => {
        if (error) {
            toast({
                title: "Error loading lab test parameters",
                description: error.message,
                variant: "destructive",
            });
        }
    }, [error, toast]);

    useEffect(() => {
        if (itemGroupsData) {
            setItemGroups(itemGroupsData);
        }
    }, [itemGroupsData]);

    useEffect(() => {
        if (itemGroupsError) {
            toast({
                title: "Error loading item groups",
                description: itemGroupsError.message,
                variant: "destructive",
            });
        }
    }, [itemGroupsError, toast]);

    // Filter parameters based on search term and group filter
    const filteredParams = labTestParams.filter(param => {
        const matchesSearch =
            param.parameter_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (param.unit && param.unit.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (param.remarks && param.remarks.toLowerCase().includes(searchTerm.toLowerCase()));
        if (!matchesSearch) return false;
        if (!groupFilter) return false;
        const groupId = Number(groupFilter);
        const hasGroup =
            (param.item_group_ids && param.item_group_ids.includes(groupId)) ||
            (param.item_groups && param.item_groups.some(g => Number(g.id) === groupId));
        return !!hasGroup;
    });

    const handleAddNewParam = () => {
        setNewParams([...newParams, {
            parameter_name: "",
            sequence: "",
            is_validation_required: false,
            is_image_required: false,
            is_required: "none",
            test_type: "both",
            min_value: "",
            max_value: "",
            unit: "",
            remarks: "non_countable",
            item_group_ids: selectedCreateGroupId ? [Number(selectedCreateGroupId)] : []
        }]);
    };

    const handleRemoveParam = (index) => {
        if (newParams.length > 1) {
            setNewParams(newParams.filter((_, i) => i !== index));
        }
    };

    const handleParamChange = (index, field, value) => {
        const updatedParams = [...newParams];
        updatedParams[index] = { ...updatedParams[index], [field]: value };
        
        // Clear min/max values when validation is disabled
        if (field === 'is_validation_required' && !value) {
            updatedParams[index].min_value = "";
            updatedParams[index].max_value = "";
        }
        
        setNewParams(updatedParams);
    };

    const handleEditParam = (param) => {
        const firstGroupId =
            Array.isArray(param.item_group_ids) && param.item_group_ids.length > 0
                ? String(param.item_group_ids[0])
                : "";
        setEditingParam({
            ...param,
            sequence: param.sequence ?? "",
            remarks: normalizeCountingValidation(param.remarks),
            item_group_ids: param.item_group_ids || []
        });
        setSelectedEditGroupId(firstGroupId);
        setIsEditDialogOpen(true);
    };

    const handleDeleteParam = (paramId) => {
        if (window.confirm("Are you sure you want to delete this lab test parameter? This action cannot be undone.")) {
            deleteLabTestParamMutation.mutate(paramId);
        }
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
        if (!selectedEditGroupId) {
            toast({
                title: "Validation Error",
                description: "Please select one item group before updating parameter",
                variant: "destructive",
            });
            return;
        }

        const paramData = {
            parameter_name: editingParam.parameter_name,
            sequence:
                editingParam.sequence !== "" && editingParam.sequence !== null && editingParam.sequence !== undefined
                    ? parseInt(editingParam.sequence, 10)
                    : null,
            is_validation_required: editingParam.is_validation_required,
            is_image_required: editingParam.is_image_required,
            is_required: editingParam.is_required || "none",
            test_type: editingParam.test_type || "both",
            min_value: editingParam.min_value ? parseFloat(editingParam.min_value) : null,
            max_value: editingParam.max_value ? parseFloat(editingParam.max_value) : null,
            unit: editingParam.unit || null,
            remarks: normalizeCountingValidation(editingParam.remarks),
            item_group_ids: [Number(selectedEditGroupId)]
        };

        // Debug: see exactly what we send to backend when updating a lab test parameter
        // eslint-disable-next-line no-console
        console.log("Updating lab test parameter payload:", {
            paramId: editingParam.id,
            paramData
        });

        updateLabTestParamMutation.mutate({
            paramId: editingParam.id,
            paramData
        });
    };

    const handleCreateItemGroup = () => {
        if (!newItemGroup.name.trim()) {
            toast({
                title: "Validation Error",
                description: "Item group name is required",
                variant: "destructive",
            });
            return;
        }

        createItemGroupMutation.mutate(newItemGroup);
    };

    const handleCreateParams = () => {
        if (!selectedCreateGroupId) {
            toast({
                title: "Validation Error",
                description: "Please select one item group before entering parameter details",
                variant: "destructive",
            });
            return;
        }

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
            sequence:
                param.sequence !== "" && param.sequence !== null && param.sequence !== undefined
                    ? parseInt(param.sequence, 10)
                    : null,
            min_value: param.min_value ? parseFloat(param.min_value) : null,
            max_value: param.max_value ? parseFloat(param.max_value) : null,
            unit: param.unit || null,
            remarks: normalizeCountingValidation(param.remarks),
            item_group_ids: [Number(selectedCreateGroupId)],
        }));

        createLabTestParamsMutation.mutate(processedParams);
    };

    const getValidationStatus = (param) => {
        if (!param.is_validation_required) {
            return { status: "none", text: "No Validation", icon: CheckCircle, color: "text-gray-500" };
        }
        if (param.min_value && param.max_value) {
            return { status: "range", text: `${param.min_value} - ${param.max_value} ${param.unit || ''}`, icon: AlertTriangle, color: "text-blue-500" };
        }

        return { status: "required", text: "Validation Required", icon: AlertTriangle, color: "text-orange-500" };
    };


    useEffect(() => {
        if (!isCreateDialogOpen) return;
        if (groupFilter && groupFilter !== "") {
            setSelectedCreateGroupId(String(groupFilter));
            return;
        }
        setSelectedCreateGroupId("");
    }, [isCreateDialogOpen, groupFilter]);

    if (isLoading) {
        return <CommonLoader text="Loading lab test parameters..." />;
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
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Test Parameters</h1>
                        <div className="w-10" />
                    </div>
                )}

                <div className="flex-1 p-6 overflow-auto">
                    <div className="mb-6">
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Lab Test Parameters</h1>
                        <p className="text-gray-600 dark:text-gray-400 mt-2">Manage laboratory testing parameters and validation rules</p>
                    </div>

                    {/* Search and Create Section */}
                    <Card className="mb-6">
                        <CardContent className="p-4">
                            <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
                                <div className="flex flex-1 flex-wrap gap-4 items-center max-w-2xl">
                                    <div className="relative flex-1 min-w-[200px] max-w-md">
                                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                        <Input
                                            placeholder="Search parameters..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10"
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <Badge variant="secondary" className="text-lg font-semibold">
                                        {filteredParams.length} parameters
                                    </Badge>

                                    <Dialog open={isCreateItemGroupDialogOpen} onOpenChange={setIsCreateItemGroupDialogOpen}>

                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Package className="h-5 w-5" />
                                                    Create Item Group
                                                </DialogTitle>
                                            </DialogHeader>

                                            <div className="space-y-4">
                                                <div className="space-y-2">
                                                    <Label htmlFor="item-group-name">Item Group Name *</Label>
                                                    <Input
                                                        id="item-group-name"
                                                        value={newItemGroup.name}
                                                        onChange={(e) => setNewItemGroup({
                                                            ...newItemGroup,
                                                            name: e.target.value
                                                        })}
                                                        onKeyDown={(e) => {
                                                            if (e.key === "Enter") {
                                                                e.preventDefault();
                                                                handleCreateItemGroup();
                                                            }
                                                        }}
                                                        placeholder="e.g., Grains, Pulses, Spices"
                                                        autoFocus
                                                    />
                                                </div>

                                               <div className="flex justify-end gap-2">
                                                    <Button variant="outline" onClick={() => setIsCreateItemGroupDialogOpen(false)}>
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={handleCreateItemGroup}
                                                        disabled={createItemGroupMutation.isPending}
                                                    >
                                                        {createItemGroupMutation.isPending ? "Creating..." : "Create Item Group"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>

                                    {hasCreatePermission("inward") && (
                                        <Dialog
                                            open={isCreateDialogOpen}
                                            onOpenChange={(open) => {
                                                setIsCreateDialogOpen(open);
                                                if (!open) {
                                                    setCreateItemGroupOpen(false);
                                                    setCreateItemGroupSearch("");
                                                }
                                            }}
                                        >
                                            <DialogTrigger asChild>
                                                <Button className="flex items-center gap-2">
                                                    <Plus className="h-4 w-4" />
                                                    Create Parameters
                                                </Button>
                                            </DialogTrigger>
                                        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <FlaskConical className="h-5 w-5" />
                                                    Create Lab Test Parameters
                                                </DialogTitle>
                                            </DialogHeader>

                                            <div className="space-y-6">
                                                <Card className="p-4">
                                                    <div className="space-y-2">
                                                        <Label htmlFor="create-item-group">Item Group *</Label>
                                                        <div className="flex gap-2">
                                                            <Popover
                                                                open={createItemGroupOpen}
                                                                onOpenChange={(open) => {
                                                                    setCreateItemGroupOpen(open);
                                                                    if (!open) setCreateItemGroupSearch("");
                                                                }}
                                                            >
                                                                <PopoverTrigger asChild>
                                                                    <Button
                                                                        id="create-item-group"
                                                                        variant="outline"
                                                                        role="combobox"
                                                                        aria-expanded={createItemGroupOpen}
                                                                        className="flex-1 justify-between font-normal"
                                                                        disabled={isLoadingItemGroups}
                                                                    >
                                                                        <span className="truncate">
                                                                            {isLoadingItemGroups
                                                                                ? "Loading groups..."
                                                                                : selectedCreateGroupId
                                                                                  ? itemGroups.find(
                                                                                      (g) => String(g.id) === String(selectedCreateGroupId)
                                                                                    )?.name || "Select one item group"
                                                                                  : "Select one item group"}
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
                                                                            placeholder="Search item group..."
                                                                            value={createItemGroupSearch}
                                                                            onValueChange={setCreateItemGroupSearch}
                                                                        />
                                                                        <CommandList className="!max-h-[none] overflow-visible p-0">
                                                                            <CommandEmpty>No item group found.</CommandEmpty>
                                                                            <CommandGroup className="overflow-visible p-0">
                                                                                <div
                                                                                    className="max-h-64 overflow-y-auto overflow-x-hidden overscroll-contain"
                                                                                    style={{ minHeight: 0 }}
                                                                                    onWheel={(e) => e.stopPropagation()}
                                                                                >
                                                                                    {itemGroups
                                                                                        .filter((group) =>
                                                                                            !createItemGroupSearch.trim()
                                                                                                ? true
                                                                                                : (group.name || "")
                                                                                                    .toLowerCase()
                                                                                                    .includes(createItemGroupSearch.toLowerCase())
                                                                                        )
                                                                                        .map((group) => (
                                                                                            <CommandItem
                                                                                                key={`create-group-${group.id}`}
                                                                                                value={`${group.name}-${group.id}`}
                                                                                                onSelect={() => {
                                                                                                    setSelectedCreateGroupId(String(group.id));
                                                                                                    setCreateItemGroupOpen(false);
                                                                                                    setCreateItemGroupSearch("");
                                                                                                }}
                                                                                                className="cursor-pointer"
                                                                                            >
                                                                                                <span className="font-medium">{group.name}</span>
                                                                                            </CommandItem>
                                                                                        ))}
                                                                                </div>
                                                                            </CommandGroup>
                                                                        </CommandList>
                                                                    </Command>
                                                                </PopoverContent>
                                                            </Popover>
                                                            <Button
                                                                type="button"
//
                                                                size="icon"
                                                                className="shrink-0"
                                                                title="Create new item group"
                                                                onClick={() => setIsCreateItemGroupDialogOpen(true)}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        {!selectedCreateGroupId && (
                                                            <p className="text-xs text-gray-500">
                                                                Select one item group to start creating parameters.
                                                            </p>
                                                        )}
                                                    </div>
                                                </Card>

                                                {selectedCreateGroupId && newParams.map((param, index) => (
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
                                                                    <XCircle className="h-4 w-4" />
                                                                </Button>
                                                            )}
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                            <div className="space-y-2 md:col-span-6">
                                                                <Label htmlFor={`param-name-${index}`}>Parameter Name *</Label>
                                                                <Input
                                                                    id={`param-name-${index}`}
                                                                    value={param.parameter_name}
                                                                    onChange={(e) => handleParamChange(index, 'parameter_name', e.target.value)}
                                                                    placeholder="e.g., Moisture Content"
                                                                />
                                                            </div>

                                                            <div className="space-y-2 md:col-span-3">
                                                                <Label htmlFor={`param-unit-${index}`}>Unit</Label>
                                                                <Input
                                                                    id={`param-unit-${index}`}
                                                                    value={param.unit}
                                                                    onChange={(e) => handleParamChange(index, 'unit', e.target.value)}
                                                                    placeholder="e.g., %, g/kg, pH"
                                                                />
                                                            </div>

                                                            <div className="space-y-2 md:col-span-3">
                                                                <Label htmlFor={`param-sequence-${index}`}>Sequence</Label>
                                                                <Input
                                                                    id={`param-sequence-${index}`}
                                                                    type="number"
                                                                    value={param.sequence}
                                                                    onChange={(e) => handleParamChange(index, 'sequence', e.target.value)}
                                                                    placeholder="e.g., 1"
                                                                />
                                                            </div>

                                                            <div className="space-y-2 md:col-span-4">
                                                                <Label htmlFor={`param-counting-validation-${index}`} className="leading-snug">
                                                                    Counting Validation *
                                                                </Label>
                                                                <Select
                                                                    value={normalizeCountingValidation(param.remarks)}
                                                                    onValueChange={(value) => handleParamChange(index, 'remarks', value)}
                                                                >
                                                                    <SelectTrigger id={`param-counting-validation-${index}`} className="w-full h-10">
                                                                        <SelectValue placeholder="Select counting validation" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="non_countable">Non Countable</SelectItem>
                                                                        <SelectItem value="countable">Countable</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2 md:col-span-4">
                                                                <Label htmlFor={`param-test-type-${index}`}>Test Type *</Label>
                                                                <Select
                                                                    value={param.test_type || "both"}
                                                                    onValueChange={(value) => handleParamChange(index, 'test_type', value)}
                                                                >
                                                                    <SelectTrigger id={`param-test-type-${index}`} className="w-full h-10">
                                                                        <SelectValue placeholder="Select test type" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="pre_test">Pre Test</SelectItem>
                                                                        <SelectItem value="post_test">Post Test</SelectItem>
                                                                        <SelectItem value="both">Both Pre and Post Test</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2 md:col-span-4">
                                                                <Label htmlFor={`param-is-required-${index}`}>Is Required *</Label>
                                                                <Select
                                                                    value={param.is_required || "none"}
                                                                    onValueChange={(value) => handleParamChange(index, 'is_required', value)}
                                                                >
                                                                    <SelectTrigger id={`param-is-required-${index}`} className="w-full h-10">
                                                                        <SelectValue placeholder="Select requirement" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="pre_test">Required in Pre Test only</SelectItem>
                                                                        <SelectItem value="post_test">Required in Post Test only</SelectItem>
                                                                        <SelectItem value="both">Required in Both Pre and Post Test</SelectItem>
                                                                        <SelectItem value="none">Not Required</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="md:col-span-12 flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`param-validation-${index}`}
                                                                    checked={param.is_validation_required}
                                                                    onCheckedChange={(checked) => handleParamChange(index, 'is_validation_required', checked)}
                                                                />
                                                                <Label htmlFor={`param-validation-${index}`} className="text-sm">
                                                                    Enable validation (requires min/max values)
                                                                </Label>
                                                            </div>

                                                            {param.is_validation_required && (
                                                                <>
                                                                    <div className="space-y-2 md:col-span-6">
                                                                        <Label htmlFor={`param-min-${index}`}>Minimum Value</Label>
                                                                        <Input
                                                                            id={`param-min-${index}`}
                                                                            type="number"
                                                                            step="0.001"
                                                                            value={param.min_value}
                                                                            onChange={(e) => handleParamChange(index, 'min_value', e.target.value)}
                                                                            placeholder="e.g., 10.5"
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-2 md:col-span-6">
                                                                        <Label htmlFor={`param-max-${index}`}>Maximum Value</Label>
                                                                        <Input
                                                                            id={`param-max-${index}`}
                                                                            type="number"
                                                                            step="0.001"
                                                                            value={param.max_value}
                                                                            onChange={(e) => handleParamChange(index, 'max_value', e.target.value)}
                                                                            placeholder="e.g., 15.0"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}

                                                            <div className="md:col-span-12 flex items-center space-x-2">
                                                                <Checkbox
                                                                    id={`param-image-${index}`}
                                                                    checked={param.is_image_required}
                                                                    onCheckedChange={(checked) => handleParamChange(index, 'is_image_required', checked)}
                                                                />
                                                                <Label htmlFor={`param-image-${index}`} className="text-sm">
                                                                    Image required for this parameter
                                                                </Label>
                                                            </div>
                                                        </div>
                                                    </Card>
                                                ))}

                                                <div className="flex justify-between">
                                                    <Button
                                                        variant="outline"
                                                        onClick={handleAddNewParam}
                                                        disabled={!selectedCreateGroupId}
                                                    >
                                                        <Plus className="h-4 w-4 mr-2" />
                                                        Add Another Parameter
                                                    </Button>

                                                    <div className="flex gap-2">
                                                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            onClick={handleCreateParams}
                                                            disabled={createLabTestParamsMutation.isPending}
                                                        >
                                                            {createLabTestParamsMutation.isPending ? "Creating..." : "Create Parameters"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                    )}

                                    {/* Edit Dialog */}
                                    <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
                                        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                                            <DialogHeader>
                                                <DialogTitle className="flex items-center gap-2">
                                                    <Edit className="h-5 w-5" />
                                                    Edit Lab Test Parameter
                                                </DialogTitle>
                                            </DialogHeader>

                                            {editingParam && (
                                                <div className="space-y-6">
                                                    <Card className="p-4">
                                                        <div className="space-y-2 mb-4">
                                                            <Label htmlFor="edit-item-group">Item Group *</Label>
                                                            <div className="flex gap-2">
                                                            <Select
                                                                value={selectedEditGroupId}
                                                                onValueChange={(value) => {
                                                                    setSelectedEditGroupId(value);
                                                                    setEditingParam({
                                                                        ...editingParam,
                                                                        item_group_ids: [Number(value)]
                                                                    });
                                                                }}
                                                            >
                                                                <SelectTrigger id="edit-item-group" className="flex-1">
                                                                    <SelectValue placeholder="Select one item group" />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {itemGroups.map((group) => (
                                                                        <SelectItem key={`edit-group-${group.id}`} value={String(group.id)}>
                                                                            {group.name}
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                            <Button
                                                                type="button"
                                                                variant="outline"
                                                                size="icon"
                                                                className="shrink-0"
                                                                title="Create new item group"
                                                                onClick={() => setIsCreateItemGroupDialogOpen(true)}
                                                            >
                                                                <Plus className="h-4 w-4" />
                                                            </Button>
                                                        </div>
                                                        </div>

                                                        {selectedEditGroupId ? (
                                                        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                                                            <div className="space-y-2 md:col-span-6">
                                                                <Label htmlFor="edit-param-name">Parameter Name *</Label>
                                                                <Input
                                                                    id="edit-param-name"
                                                                    value={editingParam.parameter_name}
                                                                    onChange={(e) => setEditingParam({
                                                                        ...editingParam,
                                                                        parameter_name: e.target.value
                                                                    })}
                                                                    placeholder="e.g., Moisture Content"
                                                                />
                                                            </div>

                                                            <div className="space-y-2 md:col-span-2">
                                                                <Label htmlFor="edit-param-unit">Unit</Label>
                                                                <Input
                                                                    id="edit-param-unit"
                                                                    value={editingParam.unit}
                                                                    onChange={(e) => setEditingParam({
                                                                        ...editingParam,
                                                                        unit: e.target.value
                                                                    })}
                                                                    placeholder="e.g., %, g/kg, pH"
                                                                />
                                                            </div>

                                                            <div className="space-y-2 md:col-span-2">
                                                                <Label htmlFor="edit-param-sequence">Sequence</Label>
                                                                <Input
                                                                    id="edit-param-sequence"
                                                                    type="number"
                                                                    value={editingParam.sequence}
                                                                    onChange={(e) => setEditingParam({
                                                                        ...editingParam,
                                                                        sequence: e.target.value
                                                                    })}
                                                                    placeholder="e.g., 1"
                                                                />
                                                            </div>

                                                            <div className="space-y-2 md:col-span-2">
                                                                <Label htmlFor="edit-param-counting-validation">Counting Validation *</Label>
                                                                <Select
                                                                    value={normalizeCountingValidation(editingParam.remarks)}
                                                                    onValueChange={(value) => setEditingParam({
                                                                        ...editingParam,
                                                                        remarks: value
                                                                    })}
                                                                >
                                                                    <SelectTrigger id="edit-param-counting-validation">
                                                                        <SelectValue placeholder="Select counting validation" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="non_countable">Non Countable</SelectItem>
                                                                        <SelectItem value="countable">Countable</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2 md:col-span-6">
                                                                <Label htmlFor="edit-param-test-type">Test Type *</Label>
                                                                <Select
                                                                    value={editingParam.test_type || "both"}
                                                                    onValueChange={(value) => setEditingParam({
                                                                        ...editingParam,
                                                                        test_type: value
                                                                    })}
                                                                >
                                                                    <SelectTrigger id="edit-param-test-type">
                                                                        <SelectValue placeholder="Select test type" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="pre_test">Pre Test</SelectItem>
                                                                        <SelectItem value="post_test">Post Test</SelectItem>
                                                                        <SelectItem value="both">Both Pre and Post Test</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="space-y-2 md:col-span-6">
                                                                <Label htmlFor="edit-param-is-required">Is Required *</Label>
                                                                <Select
                                                                    value={editingParam.is_required || "none"}
                                                                    onValueChange={(value) => setEditingParam({
                                                                        ...editingParam,
                                                                        is_required: value
                                                                    })}
                                                                >
                                                                    <SelectTrigger id="edit-param-is-required">
                                                                        <SelectValue placeholder="Select requirement" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="pre_test">Required in Pre Test only</SelectItem>
                                                                        <SelectItem value="post_test">Required in Post Test only</SelectItem>
                                                                        <SelectItem value="both">Required in Both Pre and Post Test</SelectItem>
                                                                        <SelectItem value="none">Not Required</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>

                                                            <div className="md:col-span-12 flex items-center space-x-2">
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

                                                            {editingParam.is_validation_required && (
                                                                <>
                                                                    <div className="space-y-2 md:col-span-6">
                                                                        <Label htmlFor="edit-param-min">Minimum Value</Label>
                                                                        <Input
                                                                            id="edit-param-min"
                                                                            type="number"
                                                                            step="0.001"
                                                                            value={editingParam.min_value}
                                                                            onChange={(e) => setEditingParam({
                                                                                ...editingParam,
                                                                                min_value: e.target.value
                                                                            })}
                                                                            placeholder="e.g., 10.5"
                                                                        />
                                                                    </div>

                                                                    <div className="space-y-2 md:col-span-6">
                                                                        <Label htmlFor="edit-param-max">Maximum Value</Label>
                                                                        <Input
                                                                            id="edit-param-max"
                                                                            type="number"
                                                                            step="0.001"
                                                                            value={editingParam.max_value}
                                                                            onChange={(e) => setEditingParam({
                                                                                ...editingParam,
                                                                                max_value: e.target.value
                                                                            })}
                                                                            placeholder="e.g., 15.0"
                                                                        />
                                                                    </div>
                                                                </>
                                                            )}

                                                            <div className="md:col-span-12 flex items-center space-x-2">
                                                                <Checkbox
                                                                    id="edit-param-image"
                                                                    checked={editingParam.is_image_required}
                                                                    onCheckedChange={(checked) => setEditingParam({
                                                                        ...editingParam,
                                                                        is_image_required: checked
                                                                    })}
                                                                />
                                                                <Label htmlFor="edit-param-image" className="text-sm">
                                                                    Image required for this parameter
                                                                </Label>
                                                            </div>
                                                        </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-500">
                                                                Select one item group to edit this parameter.
                                                            </p>
                                                        )}
                                                    </Card>

                                                    <div className="flex justify-end gap-2">
                                                        <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                                                            Cancel
                                                        </Button>
                                                        <Button
                                                            onClick={handleUpdateParam}
                                                            disabled={updateLabTestParamMutation.isPending}
                                                        >
                                                            {updateLabTestParamMutation.isPending ? "Updating..." : "Update Parameter"}
                                                        </Button>
                                                    </div>
                                                </div>
                                            )}
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Item Group Cards Filter */}
                    <Card className="mb-6">
                        <CardHeader className="pb-2">
                            <CardTitle className="text-base flex items-center gap-2">
                                <Package className="h-4 w-4" />
                                Item Groups
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {groupFilter === null && (
                                <p className="text-sm text-gray-500 mb-3">
                                    Select an item group card to view test parameters.
                                </p>
                            )}
                            {isLoadingItemGroups ? (
                                <div className="text-sm text-gray-500">Loading item groups...</div>
                            ) : (
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setGroupFilter("")}
                                        className={`text-left rounded-lg border p-3 transition-colors ${
                                            groupFilter === ""
                                                ? "border-black bg-black text-white"
                                                : "border-gray-200 bg-white hover:border-gray-300 dark:bg-gray-900"
                                        }`}
                                    >
                                        <div className="text-sm font-semibold">All Groups</div>
                                        <div className="text-xs opacity-80 mt-1">Show all test parameters</div>
                                    </button>
                                    {(itemGroupsData || []).map((group) => {
                                        const isSelected = String(groupFilter) === String(group.id);
                                        return (
                                            <button
                                                key={group.id}
                                                type="button"
                                                onClick={() => setGroupFilter(String(group.id))}
                                                className={`text-left rounded-lg border p-3 transition-colors ${
                                                    isSelected
                                                        ? "border-black bg-black text-white"
                                                        : "border-gray-200 bg-white hover:border-gray-300 dark:bg-gray-900"
                                                }`}
                                            >
                                                <div className="text-sm font-semibold truncate">{group.name}</div>
                                                <div className="text-xs opacity-80 mt-1">Filter by this group</div>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Parameters Table */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center space-x-2">
                                <FlaskConical className="h-5 w-5" />
                                <span>Lab Test Parameters</span>
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {filteredParams.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>#</TableHead>
                                                <TableHead>Sequence</TableHead>
                                                <TableHead>Parameter</TableHead>
                                                <TableHead>Unit</TableHead>
                                                <TableHead>Test Type</TableHead>
                                                <TableHead>Is Required</TableHead>
                                                <TableHead>Validation</TableHead>
                                                <TableHead>Image Required</TableHead>

                                                <TableHead>Actions</TableHead>
                                                {/* <TableHead>Status</TableHead> */}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredParams.map((param, index) => {
                                                const validation = getValidationStatus(param);
                                                const ValidationIcon = validation.icon;
                                                const ImageIcon = Image;

                                                return (
                                                    <TableRow key={param.id}>
                                                        <TableCell>{index + 1}</TableCell>
                                                        <TableCell>
                                                            {param.sequence ?? "-"}
                                                        </TableCell>
                                                        <TableCell className="font-medium">
                                                            <div className="flex items-center space-x-2">
                                                                <FlaskConical className="h-4 w-4 text-blue-500" />
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
                                                            <Badge variant="outline">
                                                                {param.test_type === "pre_test" ? "Pre Test" :
                                                                 param.test_type === "post_test" ? "Post Test" :
                                                                 param.test_type === "both" ? "Both" : "-"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            <Badge variant="outline">
                                                                {param.is_required === "pre_test" ? "Pre Test Only" :
                                                                 param.is_required === "post_test" ? "Post Test Only" :
                                                                 param.is_required === "both" ? "Both" :
                                                                 param.is_required === "none" ? "Not Required" : "-"}
                                                            </Badge>
                                                        </TableCell>
                                                        <TableCell>
                                                            {param.min_value && param.max_value ? (
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
                                                            <Badge variant={param.is_image_required ? "default" : "outline"}>
                                                                <div className="flex items-center space-x-1">
                                                                    {param.is_image_required ? (
                                                                        <CheckCircle className="h-3 w-3" />
                                                                    ) : (
                                                                        <XCircle className="h-3 w-3" />
                                                                    )}
                                                                    <span>{param.is_image_required ? "Yes" : "No"}</span>
                                                                </div>
                                                            </Badge>
                                                        </TableCell>
                                                        
                                                        <TableCell>
                                                            <div className="flex items-center space-x-2">
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleEditParam(param)}
                                                                    className="h-8 w-8 p-0"
                                                                    disabled={!hasUpdatePermission("inward")}
                                                                >
                                                                    <Edit className="h-4 w-4" />
                                                                </Button>
                                                                <Button
                                                                    variant="outline"
                                                                    size="sm"
                                                                    onClick={() => handleDeleteParam(param.id)}
                                                                    className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                                                    disabled={!hasDeletePermission("inward") || deleteLabTestParamMutation.isPending}
                                                                >
                                                                    <Trash2 className="h-4 w-4" />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                        {/* <TableCell>
                                                            <Badge variant={param.is_active ? "default" : "secondary"}>
                                                                {param.is_active ? "Active" : "Inactive"}
                                                            </Badge>
                                                        </TableCell> */}
                                                    </TableRow>
                                                );
                                            })}
                                        </TableBody>
                                    </Table>
                                </div>
                            ) : (
                                <div className="text-center py-12">
                                    <FlaskConical className="mx-auto h-12 w-12 text-gray-400" />
                                    <h3 className="mt-2 text-sm font-semibold text-gray-900 dark:text-white">No parameters found</h3>
                                    <p className="mt-1 text-sm text-gray-500">
                                        {(searchTerm || groupFilter) ? "No parameters match your search or group filter." : "Get started by creating your first lab test parameter."}
                                    </p>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
