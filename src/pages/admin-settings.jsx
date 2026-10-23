import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { Search, Settings, ChevronsUpDown, Check, Key, X } from "lucide-react";
import { fetchAndStoreAdminSettings, storeAdminSettings } from "@/lib/adminSettings";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useUserPermissions } from "@/hooks/useUserPermissions";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

export default function AdminSettings() {
    const [, setLocation] = useLocation();
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [modulePopoverOpen, setModulePopoverOpen] = useState(false);
    const [togglingSettingId, setTogglingSettingId] = useState(null);
    const [filters, setFilters] = useState({ module_id: "", search: "" });

    const { toast } = useToast();
    const isMobile = useIsMobile();
    const queryClient = useQueryClient();
    const user = AuthService.getUserData();
    const { hasModuleAccess } = useUserPermissions();
    const canAccessAdminSettings = hasModuleAccess("admin_settings");

    const { data: profile, isLoading: isLoadingProfile } = useQuery({
        queryKey: ["user-profile-admin-settings"],
        queryFn: async () => {
            const response = await fetch(`${API_BASE_URL}/api/user-profile/`, {
                method: "GET",
                headers: AuthService.getAuthHeaders(),
            });
            if (!response.ok) {
                throw new Error("Failed to load profile");
            }
            const data = await response.json();
            return data.data || {};
        },
        enabled: !!user?.user_id && canAccessAdminSettings,
    });

    const organizationId = profile?.organization_id;
    const organizationName = profile?.organization || "";

    const fetchModules = async () => {
        const response = await fetch(`${API_BASE_URL}/api/get-access-modules/`, {
            method: "GET",
            headers: AuthService.getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 200) {
            throw new Error(data.message || "Failed to load access modules");
        }
        return data.data || [];
    };

    const fetchOrgAdminSettings = async () => {
        const response = await fetch(`${API_BASE_URL}/api/superadmin/get-admin-settings/`, {
            method: "GET",
            headers: AuthService.getAuthHeaders(),
        });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.status !== 200) {
            throw new Error(data.error || data.message || "Failed to load organization settings");
        }
        storeAdminSettings(data.data || [], data.user_info ?? null);
        return data.data || [];
    };

    const { data: modules = [] } = useQuery({
        queryKey: ["admin-settings-modules", user?.user_id],
        queryFn: fetchModules,
        enabled: !!user?.user_id && canAccessAdminSettings,
    });

    const {
        data: orgAdminSettings = [],
        isLoading: isLoadingSettings,
    } = useQuery({
        queryKey: ["org-admin-settings", organizationId],
        queryFn: fetchOrgAdminSettings,
        enabled: canAccessAdminSettings && !!organizationId,
    });

    const selectedModuleLabel = useMemo(() => {
        if (!filters.module_id) return "All Modules";
        const mod = modules.find((m) => String(m.id) === String(filters.module_id));
        return mod?.name || "All Modules";
    }, [filters.module_id, modules]);

    const toggleSettingMutation = useMutation({
        mutationFn: async ({ id, is_disabled }) => {
            const response = await fetch(`${API_BASE_URL}/api/superadmin/admin-settings/allocate/`, {
                method: "POST",
                headers: AuthService.getAuthHeaders(),
                body: JSON.stringify({
                    user_id: user?.user_id,
                    id,
                    is_disabled,
                    organization_id: organizationId != null ? String(organizationId) : undefined,
                }),
            });
            const data = await response.json();
            if (!response.ok || data.status !== 200) {
                throw new Error(data.error || data.message || `HTTP error! status: ${response.status}`);
            }
            return data;
        },
        onMutate: async ({ id, is_disabled }) => {
            await queryClient.cancelQueries({ queryKey: ["org-admin-settings", organizationId] });
            const previous = queryClient.getQueryData(["org-admin-settings", organizationId]);
            queryClient.setQueryData(["org-admin-settings", organizationId], (current) =>
                (current || []).map((setting) =>
                    setting.id === id
                        ? { ...setting, is_disabled, is_enabled: !is_disabled }
                        : setting
                )
            );
            return { previous };
        },
        onSuccess: async (data) => {
            toast({
                title: "Success",
                description: data.message || "Setting updated successfully",
            });
            await queryClient.invalidateQueries({ queryKey: ["org-admin-settings"] });
            await fetchAndStoreAdminSettings();
        },
        onError: (error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(["org-admin-settings", organizationId], context.previous);
            }
            toast({
                title: "Error",
                description: error.message || "Failed to update setting",
                variant: "destructive",
            });
        },
        onSettled: () => {
            setTogglingSettingId(null);
        },
    });

    const handleSetSettingStatus = (setting, shouldDisable) => {
        if (!organizationId) {
            toast({
                title: "Validation Error",
                description: "Organization is not available for your account",
                variant: "destructive",
            });
            return;
        }

        const isCurrentlyEnabled =
            setting.is_enabled !== undefined && setting.is_enabled !== null
                ? Boolean(setting.is_enabled)
                : !Boolean(setting.is_disabled);

        if (shouldDisable && !isCurrentlyEnabled) return;
        if (!shouldDisable && isCurrentlyEnabled) return;

        setTogglingSettingId(setting.id);
        toggleSettingMutation.mutate({
            id: setting.id,
            is_disabled: shouldDisable,
        });
    };

    const isSettingEnabled = (setting) =>
        setting.is_enabled !== undefined && setting.is_enabled !== null
            ? Boolean(setting.is_enabled)
            : !Boolean(setting.is_disabled);

    const filteredOrgSettings = useMemo(() => {
        const search = filters.search.trim().toLowerCase();
        return orgAdminSettings.filter((setting) => {
            if (filters.module_id && String(setting.module_id) !== String(filters.module_id)) {
                return false;
            }
            if (!search) return true;
            const key = setting.key_name || setting.key || "";
            return (
                setting.name?.toLowerCase().includes(search) ||
                key.toLowerCase().includes(search) ||
                setting.description?.toLowerCase().includes(search) ||
                setting.module_name?.toLowerCase().includes(search)
            );
        });
    }, [orgAdminSettings, filters]);

    const orgSettingsByModule = useMemo(() => {
        const groups = {};
        filteredOrgSettings.forEach((setting) => {
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
    }, [filteredOrgSettings]);

    if (!canAccessAdminSettings) {
        return (
            <div className="flex h-screen bg-gray-50">
                {isMobile ? (
                    <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
                ) : (
                    <Sidebar />
                )}
                <div className="flex-1 flex items-center justify-center p-6">
                    <Card className="max-w-md w-full">
                        <CardHeader>
                            <CardTitle>Access denied</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <p className="text-gray-600">
                                You do not have permission to access admin settings.
                            </p>
                            <Button variant="outline" onClick={() => setLocation("/dashboard")}>
                                Go to Dashboard
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    if (isLoadingProfile) {
        return (
            <div className="flex h-screen bg-gray-50">
                {!isMobile && <Sidebar />}
                <div className="flex-1 flex items-center justify-center">
                    <CommonLoader />
                </div>
            </div>
        );
    }

    if (!organizationId) {
        return (
            <div className="flex h-screen bg-gray-50">
                {isMobile ? (
                    <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
                ) : (
                    <Sidebar />
                )}
                <div className="flex-1 flex items-center justify-center p-6">
                    <Card className="max-w-md w-full">
                        <CardHeader>
                            <CardTitle>Organization required</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-600">
                                Your account is not linked to an organization. Admin settings cannot be loaded.
                            </p>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {isMobile ? (
                <MobileSidebar isOpen={isMobileSidebarOpen} onClose={() => setIsMobileSidebarOpen(false)} />
            ) : (
                <Sidebar />
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            {isMobile && (
                                <Button variant="ghost" size="sm" onClick={() => setIsMobileSidebarOpen(true)}>
                                    ☰
                                </Button>
                            )}
                            <Settings className="h-6 w-6 text-blue-600" />
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
                                {organizationName && (
                                    <p className="text-sm text-gray-500">{organizationName}</p>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-4 sm:p-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col gap-1">
                                <CardTitle>Organization Settings</CardTitle>
                                <p className="text-sm text-gray-500">
                                    Enable or disable settings for {organizationName || "your organization"}.
                                    Status shows the current state; use the check to enable or cross to disable.
                                </p>
                            </div>
                        </CardHeader>
                        <CardContent>
                            <div className="mb-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <Label>Filter by Module</Label>
                                    <Popover open={modulePopoverOpen} onOpenChange={setModulePopoverOpen}>
                                        <PopoverTrigger asChild>
                                            <Button
                                                type="button"
                                                variant="outline"
                                                role="combobox"
                                                aria-expanded={modulePopoverOpen}
                                                className="w-full h-10 justify-between font-normal"
                                            >
                                                <span className="truncate">{selectedModuleLabel}</span>
                                                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent
                                            className="w-[--radix-popover-trigger-width] p-0 z-50"
                                            align="start"
                                            side="bottom"
                                            sideOffset={4}
                                        >
                                            <Command>
                                                <CommandInput placeholder="Search modules..." />
                                                <CommandList>
                                                    <CommandEmpty>
                                                        {modules.length === 0
                                                            ? "No modules found."
                                                            : "No modules match your search."}
                                                    </CommandEmpty>
                                                    <CommandGroup>
                                                        <ScrollArea className="h-64">
                                                            <CommandItem
                                                                value="all modules"
                                                                onSelect={() => {
                                                                    setFilters({ ...filters, module_id: "" });
                                                                    setModulePopoverOpen(false);
                                                                }}
                                                                className="flex items-center gap-3 cursor-pointer px-3 py-2"
                                                            >
                                                                <Check
                                                                    className={cn(
                                                                        "h-4 w-4 shrink-0",
                                                                        !filters.module_id
                                                                            ? "opacity-100 text-gray-600"
                                                                            : "opacity-0"
                                                                    )}
                                                                />
                                                                <span className="font-medium text-gray-900">
                                                                    All Modules
                                                                </span>
                                                            </CommandItem>
                                                            {modules.map((module) => {
                                                                const moduleId = module.id.toString();
                                                                const isSelected =
                                                                    String(filters.module_id) === moduleId;
                                                                return (
                                                                    <CommandItem
                                                                        key={module.id}
                                                                        value={`${module.name} ${moduleId}`}
                                                                        onSelect={() => {
                                                                            setFilters({
                                                                                ...filters,
                                                                                module_id: moduleId,
                                                                            });
                                                                            setModulePopoverOpen(false);
                                                                        }}
                                                                        className="flex items-center gap-3 cursor-pointer px-3 py-2"
                                                                    >
                                                                        <Check
                                                                            className={cn(
                                                                                "h-4 w-4 shrink-0",
                                                                                isSelected
                                                                                    ? "opacity-100 text-gray-600"
                                                                                    : "opacity-0"
                                                                            )}
                                                                        />
                                                                        <span className="font-medium text-gray-900 truncate">
                                                                            {module.name}
                                                                        </span>
                                                                    </CommandItem>
                                                                );
                                                            })}
                                                        </ScrollArea>
                                                    </CommandGroup>
                                                </CommandList>
                                            </Command>
                                        </PopoverContent>
                                    </Popover>
                                </div>
                                <div>
                                    <Label>Search</Label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 h-4 w-4" />
                                        <Input
                                            placeholder="Search by key, name, module..."
                                            value={filters.search}
                                            onChange={(e) =>
                                                setFilters({ ...filters, search: e.target.value })
                                            }
                                            className="pl-10"
                                        />
                                    </div>
                                </div>
                            </div>

                            {isLoadingSettings ? (
                                <CommonLoader />
                            ) : filteredOrgSettings.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">No settings found</div>
                            ) : (
                                <div className="space-y-6">
                                    {orgSettingsByModule.map((moduleGroup) => (
                                        <div
                                            key={moduleGroup.moduleName}
                                            className="rounded-lg border border-gray-200 overflow-hidden"
                                        >
                                            <div className="bg-gray-50 dark:bg-gray-800/50 px-4 py-3 border-b border-gray-200">
                                                <h3 className="text-base font-semibold text-gray-900 dark:text-white flex items-center gap-2 flex-wrap">
                                                    <span>{moduleGroup.moduleName}</span>
                                                    <span className="text-xs font-normal text-gray-500">
                                                        ({moduleGroup.settings.length} setting
                                                        {moduleGroup.settings.length !== 1 ? "s" : ""})
                                                    </span>
                                                </h3>
                                            </div>
                                            <Table>
                                                <TableHeader>
                                                    <TableRow className="hover:bg-transparent">
                                                        <TableHead className="w-12 whitespace-nowrap py-2">#</TableHead>
                                                        <TableHead className="py-2">Setting</TableHead>
                                                        <TableHead className="w-24 whitespace-nowrap py-2 text-center">
                                                            Status
                                                        </TableHead>
                                                        <TableHead className="w-28 whitespace-nowrap py-2 text-center">
                                                            Update
                                                        </TableHead>
                                                        <TableHead className="w-14 whitespace-nowrap py-2 text-center">
                                                            Key
                                                        </TableHead>
                                                    </TableRow>
                                                </TableHeader>
                                                <TableBody>
                                                    {moduleGroup.settings.map((setting, index) => {
                                                        const settingKey = setting.key_name || setting.key;
                                                        const isEnabled = isSettingEnabled(setting);
                                                        const isToggling = togglingSettingId === setting.id;
                                                        const isBusy =
                                                            isToggling || toggleSettingMutation.isPending;
                                                        const displayDescription =
                                                            setting.description?.trim() || "";
                                                        const settingTitle =
                                                            setting.name?.trim() || displayDescription || "—";
                                                        const settingSubtitle =
                                                            setting.name?.trim() &&
                                                            displayDescription &&
                                                            displayDescription !== setting.name.trim()
                                                                ? displayDescription
                                                                : "";
                                                        return (
                                                            <TableRow key={setting.id} className="align-middle">
                                                                <TableCell className="py-2 text-sm font-medium text-gray-700">
                                                                    {index + 1}
                                                                </TableCell>
                                                                <TableCell className="py-2 whitespace-normal">
                                                                    <p className="text-sm font-semibold text-gray-900 leading-snug">
                                                                        {settingTitle}
                                                                    </p>
                                                                    {settingSubtitle && (
                                                                        <p className="text-sm text-gray-800 mt-0.5 leading-snug">
                                                                            {settingSubtitle}
                                                                        </p>
                                                                    )}
                                                                </TableCell>
                                                                <TableCell className="py-2 text-center">
                                                                    <Badge
                                                                        variant="outline"
                                                                        className={cn(
                                                                            "text-xs font-medium whitespace-nowrap",
                                                                            isEnabled
                                                                                ? "bg-green-50 text-green-700 border-green-300"
                                                                                : "bg-red-50 text-red-700 border-red-300"
                                                                        )}
                                                                    >
                                                                        {isEnabled ? "Enabled" : "Disabled"}
                                                                    </Badge>
                                                                </TableCell>
                                                                <TableCell className="py-2 text-center">
                                                                    <div className="inline-flex rounded-md border border-gray-200 overflow-hidden shadow-sm">
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            disabled={isBusy || isEnabled}
                                                                            onClick={() =>
                                                                                handleSetSettingStatus(setting, false)
                                                                            }
                                                                            className={cn(
                                                                                "h-8 px-2.5 rounded-none border-0",
                                                                                isEnabled
                                                                                    ? "bg-green-600 text-white hover:bg-green-600 cursor-default"
                                                                                    : "text-green-700 hover:bg-green-50"
                                                                            )}
                                                                            aria-label={`Enable ${setting.name}`}
                                                                            title="Enable"
                                                                        >
                                                                            <Check className="h-4 w-4" />
                                                                        </Button>
                                                                        <Button
                                                                            type="button"
                                                                            size="sm"
                                                                            variant="ghost"
                                                                            disabled={isBusy || !isEnabled}
                                                                            onClick={() =>
                                                                                handleSetSettingStatus(setting, true)
                                                                            }
                                                                            className={cn(
                                                                                "h-8 px-2.5 rounded-none border-0 border-l border-gray-200",
                                                                                !isEnabled
                                                                                    ? "bg-red-600 text-white hover:bg-red-600 cursor-default"
                                                                                    : "text-red-700 hover:bg-red-50"
                                                                            )}
                                                                            aria-label={`Disable ${setting.name}`}
                                                                            title="Disable"
                                                                        >
                                                                            <X className="h-4 w-4" />
                                                                        </Button>
                                                                    </div>
                                                                </TableCell>
                                                                <TableCell className="py-2 text-center">
                                                                    {settingKey ? (
                                                                        <Popover>
                                                                            <PopoverTrigger asChild>
                                                                                <Button
                                                                                    type="button"
                                                                                    variant="ghost"
                                                                                    size="icon"
                                                                                    className="h-8 w-8 shrink-0 text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                                                                                    aria-label={`View key for ${setting.name}`}
                                                                                >
                                                                                    <Key className="h-4 w-4" />
                                                                                </Button>
                                                                            </PopoverTrigger>
                                                                            <PopoverContent
                                                                                className="w-auto max-w-sm p-3"
                                                                                align="end"
                                                                                side="top"
                                                                            >
                                                                                {setting.name ? (
                                                                                    <>
                                                                                        <p className="text-xs text-muted-foreground mb-1">
                                                                                            Setting
                                                                                        </p>
                                                                                        <p className="text-sm font-medium mb-2">
                                                                                            {setting.name}
                                                                                        </p>
                                                                                    </>
                                                                                ) : null}
                                                                                <p className="text-xs text-muted-foreground mb-1">
                                                                                    Setting key
                                                                                </p>
                                                                                <p className="text-sm font-mono break-all">
                                                                                    {settingKey}
                                                                                </p>
                                                                            </PopoverContent>
                                                                        </Popover>
                                                                    ) : (
                                                                        "—"
                                                                    )}
                                                                </TableCell>
                                                            </TableRow>
                                                        );
                                                    })}
                                                </TableBody>
                                            </Table>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </main>
            </div>
        </div>
    );
}
