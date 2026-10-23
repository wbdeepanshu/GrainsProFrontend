import { useState, useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
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
import { Search, Plus, Settings, Menu, Pencil } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import CommonLoader from "@/components/common/loader";
import SuperAdminSidebar from "@/components/layout/superadmin-sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;
const SUPERADMIN_BASE = `${API_BASE_URL}/api/superadmin`;

function getToken() {
    return localStorage.getItem("superadmin_token");
}

function getSuperAdminUser() {
    try {
        const raw = localStorage.getItem("superadmin_user");
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function superAdminHeaders() {
    const token = getToken();
    return {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
}

export default function SuperAdminSettings() {
    const [, setLocation] = useLocation();
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [editingSetting, setEditingSetting] = useState(null);
    const [editForm, setEditForm] = useState({ module_id: "", description: "" });
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [newSetting, setNewSetting] = useState({
        name: "",
        module_id: "",
        description: "",
        is_live: true,
    });

    const { toast } = useToast();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();
    const superAdminUser = getSuperAdminUser();

    useEffect(() => {
        if (!getToken() || !superAdminUser?.user_id) {
            setLocation("/superadmin/login");
        }
    }, [setLocation, superAdminUser?.user_id]);

    const fetchAdminSettings = async () => {
        const params = new URLSearchParams({
            user_id: superAdminUser.user_id,
            per_page: "500",
        });
        const response = await fetch(
            `${SUPERADMIN_BASE}/admin-settings/list/?${params.toString()}`,
            { method: "GET", headers: superAdminHeaders() }
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 200) {
            throw new Error(data.error || data.message || "Failed to load settings");
        }
        return data.data || [];
    };

    const fetchModules = async () => {
        const response = await fetch(`${SUPERADMIN_BASE}/super-admin/modules/`, {
            method: "GET",
            headers: superAdminHeaders(),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 200) {
            throw new Error(data.message || "Failed to load modules");
        }
        return data.data || [];
    };

    const {
        data: adminSettings = [],
        isLoading: isLoadingSettings,
    } = useQuery({
        queryKey: ["superadmin-admin-settings-catalog"],
        queryFn: fetchAdminSettings,
        enabled: !!superAdminUser?.user_id && !!getToken(),
    });

    const { data: modules = [] } = useQuery({
        queryKey: ["superadmin-admin-settings-modules"],
        queryFn: fetchModules,
        enabled: !!getToken(),
    });

    const createSettingMutation = useMutation({
        mutationFn: async (settingData) => {
            const response = await fetch(`${SUPERADMIN_BASE}/admin-settings/create/`, {
                method: "POST",
                headers: superAdminHeaders(),
                body: JSON.stringify({
                    user_id: superAdminUser.user_id,
                    ...settingData,
                }),
            });
            const data = await response.json();
            if (!response.ok || data.status !== 200) {
                throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
            }
            return data;
        },
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: data.message || "Admin setting created successfully",
            });
            setIsCreateDialogOpen(false);
            setNewSetting({ name: "", module_id: "", description: "", is_live: true });
            queryClient.invalidateQueries({ queryKey: ["superadmin-admin-settings-catalog"] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to create admin setting",
                variant: "destructive",
            });
        },
    });

    const updateSettingMutation = useMutation({
        mutationFn: async ({ id, module_id, description }) => {
            const response = await fetch(`${SUPERADMIN_BASE}/admin-settings/${id}/update/`, {
                method: "PUT",
                headers: superAdminHeaders(),
                body: JSON.stringify({
                    user_id: superAdminUser.user_id,
                    module_id,
                    description,
                }),
            });
            const data = await response.json();
            if (!response.ok || data.status !== 200) {
                throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
            }
            return data;
        },
        onSuccess: (data) => {
            toast({
                title: "Success",
                description: data.message || "Admin setting updated successfully",
            });
            setIsEditDialogOpen(false);
            setEditingSetting(null);
            queryClient.invalidateQueries({ queryKey: ["superadmin-admin-settings-catalog"] });
        },
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to update admin setting",
                variant: "destructive",
            });
        },
    });

    const handleCreateSetting = () => {
        if (!newSetting.name || !newSetting.module_id) {
            toast({
                title: "Validation Error",
                description: "Name and Module are required",
                variant: "destructive",
            });
            return;
        }
        createSettingMutation.mutate(newSetting);
    };

    const openEditDialog = (setting) => {
        setEditingSetting(setting);
        setEditForm({
            module_id: setting.module_id != null ? String(setting.module_id) : "",
            description: setting.description || "",
        });
        setIsEditDialogOpen(true);
    };

    const handleUpdateSetting = () => {
        if (!editingSetting?.id) return;
        if (!editForm.module_id) {
            toast({
                title: "Validation Error",
                description: "Module is required",
                variant: "destructive",
            });
            return;
        }
        updateSettingMutation.mutate({
            id: editingSetting.id,
            module_id: editForm.module_id,
            description: editForm.description,
        });
    };

    const filteredSettings = adminSettings.filter(
        (setting) =>
            setting.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            setting.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            setting.key_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            setting.module_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const settingsByModule = useMemo(() => {
        const groups = {};
        filteredSettings.forEach((setting) => {
            const moduleName = setting.module_name || "Uncategorized";
            if (!groups[moduleName]) {
                groups[moduleName] = [];
            }
            groups[moduleName].push(setting);
        });
        return Object.entries(groups)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([moduleName, settings]) => ({
                moduleName,
                settings: [...settings].sort((a, b) =>
                    String(a.name || "").localeCompare(String(b.name || ""))
                ),
            }));
    }, [filteredSettings]);

    return (
        <div className="flex h-screen bg-gray-50">
            {isMobile ? (
                <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
            ) : (
                <SuperAdminSidebar />
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="flex items-center gap-3">
                        {isMobile && (
                            <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)}>
                                <Menu className="h-5 w-5" />
                            </Button>
                        )}
                        <Settings className="h-6 w-6 text-blue-600" />
                        <div>
                            <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
                            <p className="text-sm text-gray-500">Manage global admin setting definitions</p>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                                <CardTitle>Settings Catalog</CardTitle>
                                <div className="flex flex-col sm:flex-row gap-2">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                        <Input
                                            placeholder="Search settings..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 w-full sm:w-64"
                                        />
                                    </div>
                                    <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                                        <DialogTrigger asChild>
                                            <Button>
                                                <Plus className="h-4 w-4 mr-2" />
                                                Create Setting
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="max-w-md">
                                            <DialogHeader>
                                                <DialogTitle>Create Admin Setting</DialogTitle>
                                            </DialogHeader>
                                            <div className="space-y-4 mt-4">
                                                <div>
                                                    <Label htmlFor="name">Name *</Label>
                                                    <Input
                                                        id="name"
                                                        value={newSetting.name}
                                                        onChange={(e) =>
                                                            setNewSetting({ ...newSetting, name: e.target.value })
                                                        }
                                                        placeholder="Enter setting name"
                                                    />
                                                </div>
                                                <div>
                                                    <Label htmlFor="module">Module *</Label>
                                                    <Select
                                                        value={newSetting.module_id}
                                                        onValueChange={(value) =>
                                                            setNewSetting({ ...newSetting, module_id: value })
                                                        }
                                                    >
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="Select module" />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {modules.map((module) => (
                                                                <SelectItem
                                                                    key={module.id}
                                                                    value={module.id.toString()}
                                                                >
                                                                    {module.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                </div>
                                                <div>
                                                    <Label htmlFor="description">Description</Label>
                                                    <Textarea
                                                        id="description"
                                                        value={newSetting.description}
                                                        onChange={(e) =>
                                                            setNewSetting({
                                                                ...newSetting,
                                                                description: e.target.value,
                                                            })
                                                        }
                                                        placeholder="Enter description"
                                                    />
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        id="is_live"
                                                        checked={newSetting.is_live}
                                                        onCheckedChange={(checked) =>
                                                            setNewSetting({ ...newSetting, is_live: !!checked })
                                                        }
                                                    />
                                                    <Label htmlFor="is_live">Is Live</Label>
                                                </div>
                                                <div className="flex justify-end gap-2">
                                                    <Button
                                                        variant="outline"
                                                        onClick={() => setIsCreateDialogOpen(false)}
                                                    >
                                                        Cancel
                                                    </Button>
                                                    <Button
                                                        onClick={handleCreateSetting}
                                                        disabled={createSettingMutation.isPending}
                                                    >
                                                        {createSettingMutation.isPending ? "Creating..." : "Create"}
                                                    </Button>
                                                </div>
                                            </div>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>
                        </CardHeader>
                        <CardContent>
                            {isLoadingSettings ? (
                                <CommonLoader />
                            ) : filteredSettings.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No settings found</div>
                            ) : (
                                <div className="space-y-6">
                                    {settingsByModule.map((group) => (
                                        <div
                                            key={group.moduleName}
                                            className="rounded-lg border border-gray-200 overflow-hidden"
                                        >
                                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200">
                                                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                                                    <span>{group.moduleName}</span>
                                                    <span className="text-xs font-normal text-gray-500">
                                                        ({group.settings.length} setting
                                                        {group.settings.length !== 1 ? "s" : ""})
                                                    </span>
                                                </h3>
                                            </div>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow>
                                                        <TableHead className="w-16">Sr. No.</TableHead>
                                                        <TableHead>Name</TableHead>
                                                        <TableHead>Key</TableHead>
                                                        <TableHead>Description</TableHead>
                                                        <TableHead>Status</TableHead>
                                                        <TableHead className="w-20 text-right">Actions</TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {group.settings.map((setting, index) => (
                                                        <TableRow key={setting.id}>
                                                            <TableCell>{index + 1}</TableCell>
                                                            <TableCell className="font-medium">
                                                                {setting.name}
                                                            </TableCell>
                                                            <TableCell className="text-sm text-gray-500 font-mono">
                                                                {setting.key_name || setting.key}
                                                            </TableCell>
                                                            <TableCell className="text-sm text-gray-500 max-w-xs truncate">
                                                                {setting.description || "—"}
                                                            </TableCell>
                                                            <TableCell>
                                                                {setting.is_live ? (
                                                                    <Badge className="bg-green-500">Live</Badge>
                                                                ) : (
                                                                    <Badge className="bg-red-500">Inactive</Badge>
                                                                )}
                                                            </TableCell>
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    variant="ghost"
                                                                    size="sm"
                                                                    onClick={() => openEditDialog(setting)}
                                                                    aria-label={`Edit ${setting.name}`}
                                                                >
                                                                    <Pencil className="h-4 w-4" />
                                                                </Button>
                                                            </TableCell>
                                                        </TableRow>
                                                    ))}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    <Dialog
                        open={isEditDialogOpen}
                        onOpenChange={(open) => {
                            setIsEditDialogOpen(open);
                            if (!open) setEditingSetting(null);
                        }}
                    >
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle>Edit Admin Setting</DialogTitle>
                            </DialogHeader>
                            {editingSetting && (
                                <div className="space-y-4 mt-4">
                                    <div>
                                        <Label>Name</Label>
                                        <Input value={editingSetting.name} disabled />
                                    </div>
                                    <div>
                                        <Label>Key</Label>
                                        <Input
                                            value={editingSetting.key_name || editingSetting.key || ""}
                                            disabled
                                            className="font-mono"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">Key cannot be changed</p>
                                    </div>
                                    <div>
                                        <Label htmlFor="edit-module">Module *</Label>
                                        <Select
                                            value={editForm.module_id}
                                            onValueChange={(value) =>
                                                setEditForm({ ...editForm, module_id: value })
                                            }
                                        >
                                            <SelectTrigger id="edit-module">
                                                <SelectValue placeholder="Select module" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {modules.map((module) => (
                                                    <SelectItem
                                                        key={module.id}
                                                        value={module.id.toString()}
                                                    >
                                                        {module.name}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </div>
                                    <div>
                                        <Label htmlFor="edit-description">Description</Label>
                                        <Textarea
                                            id="edit-description"
                                            value={editForm.description}
                                            onChange={(e) =>
                                                setEditForm({
                                                    ...editForm,
                                                    description: e.target.value,
                                                })
                                            }
                                            placeholder="Enter description"
                                        />
                                    </div>
                                    <div className="flex justify-end gap-2">
                                        <Button
                                            variant="outline"
                                            onClick={() => {
                                                setIsEditDialogOpen(false);
                                                setEditingSetting(null);
                                            }}
                                        >
                                            Cancel
                                        </Button>
                                        <Button
                                            onClick={handleUpdateSetting}
                                            disabled={updateSettingMutation.isPending}
                                        >
                                            {updateSettingMutation.isPending ? "Updating..." : "Update"}
                                        </Button>
                                    </div>
                                </div>
                            )}
                        </DialogContent>
                    </Dialog>
                </main>
            </div>
        </div>
    );
}
