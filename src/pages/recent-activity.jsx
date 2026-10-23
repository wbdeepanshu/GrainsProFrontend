import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AuthService } from "@/lib/auth";
import { 
    Activity, 
    Search, 
    RefreshCw, 
    User, 
    Building, 
    MapPin, 
    Clock, 
    Database,
    Filter,
    ChevronDown,
    ChevronUp,
    ChevronLeft,
    ChevronRight,
    Eye,
    Calendar
} from "lucide-react";
import CommonLoader from "@/components/common/loader";
import Sidebar from "@/components/layout/sidebar";
import MobileSidebar from "@/components/layout/mobile-sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export default function RecentActivity() {
    const [searchTerm, setSearchTerm] = useState("");
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState(null);
    const [isDetailsDialogOpen, setIsDetailsDialogOpen] = useState(false);

    const { toast } = useToast();
    const isMobile = useIsMobile();

    // Fetch Tally sync logs
    const fetchTallySyncLogs = async () => {
        const token = AuthService.getAccessToken();
        if (!token) {
            throw new Error("No authentication token found");
        }

        const API_BASE_URL = import.meta.env.VITE_BASE_URL;
        const params = new URLSearchParams();
        params.append('page', page.toString());
        params.append('page_size', pageSize.toString());

        const response = await fetch(`${API_BASE_URL}/api/recent-activity/?${params.toString()}`, {
            method: 'GET',
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        if (result.status !== 200) {
            throw new Error(result.message || 'Failed to fetch Tally sync logs');
        }

        return result;
    };

    const { data: activityData, isLoading, error, refetch } = useQuery({
        queryKey: ['recent-activity', page, pageSize],
        queryFn: fetchTallySyncLogs,
        refetchInterval: 30000, // Refetch every 30 seconds
        retry: 3,
        onError: (error) => {
            toast({
                title: "Error",
                description: error.message || "Failed to fetch recent activity",
                variant: "destructive",
            });
        }
    });

    const handleRefresh = () => {
        refetch();
        toast({
            title: "Refreshed",
            description: "Recent activity data has been refreshed",
        });
    };

    const handlePageChange = (newPage) => {
        setPage(newPage);
    };

    const handlePageSizeChange = (newPageSize) => {
        setPageSize(parseInt(newPageSize));
        setPage(1); // Reset to first page when changing page size
    };

    const handleViewDetails = (log) => {
        setSelectedLog(log);
        setIsDetailsDialogOpen(true);
    };

    const filteredLogs = activityData?.data?.filter(log => {
        if (!searchTerm) return true;
        const searchLower = searchTerm.toLowerCase();
        return (
            log.sync_module?.toLowerCase().includes(searchLower) ||
            log.description?.toLowerCase().includes(searchLower) ||
            log.sync_by?.toLowerCase().includes(searchLower) ||
            log.branch?.toLowerCase().includes(searchLower)
        );
    }) || [];

    const getModuleIcon = (module) => {
        switch (module?.toLowerCase()) {
            case 'stock items':
                return <Database className="h-4 w-4" />;
            case 'units':
                return <Database className="h-4 w-4" />;
            case 'godowns':
                return <Building className="h-4 w-4" />;
            case 'voucher types':
                return <Database className="h-4 w-4" />;
            default:
                return <Activity className="h-4 w-4" />;
        }
    };

    const getModuleColor = (module) => {
        switch (module?.toLowerCase()) {
            case 'stock items':
                return 'bg-blue-100 text-blue-800';
            case 'units':
                return 'bg-green-100 text-green-800';
            case 'godowns':
                return 'bg-purple-100 text-purple-800';
            case 'voucher types':
                return 'bg-orange-100 text-orange-800';
            default:
                return 'bg-gray-100 text-gray-800';
        }
    };

    if (isLoading) {
        return (
            <div className="flex h-screen">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
                    <CommonLoader />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex h-screen">
                <Sidebar />
                <div className="flex-1 flex items-center justify-center">
                    <Card className="w-96">
                        <CardContent className="pt-6">
                            <div className="text-center">
                                <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                <h3 className="text-lg font-semibold mb-2">Error Loading Activity</h3>
                                <p className="text-gray-600 mb-4">{error.message}</p>
                                <Button onClick={handleRefresh} variant="outline">
                                    <RefreshCw className="h-4 w-4 mr-2" />
                                    Try Again
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-screen bg-gray-50">
            {isMobile ? (
                <MobileSidebar 
                    isOpen={isMobileSidebarOpen} 
                    onClose={() => setIsMobileSidebarOpen(false)} 
                />
            ) : (
                <Sidebar />
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                            {isMobile && (
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setIsMobileSidebarOpen(true)}
                                    className="md:hidden"
                                >
                                    <Activity className="h-5 w-5" />
                                </Button>
                            )}
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Recent Activity</h1>
                                <p className="text-sm text-gray-600">
                                    Tally synchronization logs and system activities
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Button onClick={handleRefresh} variant="outline" size="sm">
                                <RefreshCw className="h-4 w-4 mr-2" />
                                Refresh
                            </Button>
                        </div>
                    </div>
                </div>

                {/* Filters and Search */}
                <div className="bg-white border-b border-gray-200 px-6 py-4">
                    <div className="flex flex-col sm:flex-row gap-4">
                        <div className="flex-1">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                                <Input
                                    placeholder="Search by module, description, user, or branch..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                        </div>
                        <div className="flex items-center space-x-2">
                            <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                                <SelectTrigger className="w-32">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="10">10 items</SelectItem>
                                    <SelectItem value="25">25 items</SelectItem>
                                    <SelectItem value="50">50 items</SelectItem>
                                    <SelectItem value="100">100 items</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-6">
                    {activityData && (
                        <div className="space-y-6">
                            {/* Summary Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center">
                                            <Activity className="h-8 w-8 text-blue-600" />
                                            <div className="ml-4">
                                                <p className="text-sm font-medium text-gray-600">Total Activities</p>
                                                <p className="text-2xl font-bold text-gray-900">{activityData?.pagination?.total_count || 0}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center">
                                            <User className="h-8 w-8 text-green-600" />
                                            <div className="ml-4">
                                                <p className="text-sm font-medium text-gray-600">User Role</p>
                                                <p className="text-lg font-semibold text-gray-900">{activityData?.user_role?.name}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                                <Card>
                                    <CardContent className="pt-6">
                                        <div className="flex items-center">
                                            <Filter className="h-8 w-8 text-purple-600" />
                                            <div className="ml-4">
                                                <p className="text-sm font-medium text-gray-600">Filter Applied</p>
                                                <p className="text-lg font-semibold text-gray-900 capitalize">
                                                    {activityData?.filter_applied?.replace('_', ' ')}
                                                </p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Activity Logs */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center justify-between">
                                        <div className="flex items-center">
                                            <Activity className="h-5 w-5 mr-2" />
                                            Activity Logs
                                            {filteredLogs.length !== activityData?.data?.length && (
                                                <Badge variant="secondary" className="ml-2">
                                                    {filteredLogs.length} of {activityData?.data?.length}
                                                </Badge>
                                            )}
                                        </div>
                                        <div className="text-sm text-gray-500">
                                            Page {activityData?.pagination?.current_page} of {activityData?.pagination?.total_pages}
                                        </div>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {filteredLogs.length === 0 ? (
                                        <div className="text-center py-8">
                                            <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                                            <h3 className="text-lg font-semibold text-gray-900 mb-2">No Activities Found</h3>
                                            <p className="text-gray-600">
                                                {searchTerm ? "No activities match your search criteria." : "No recent activities to display."}
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {filteredLogs.map((log) => (
                                                <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center space-x-3 flex-1">
                                                            <div className="flex-shrink-0">
                                                                <div className={`p-2 rounded-lg ${getModuleColor(log.sync_module)}`}>
                                                                    {getModuleIcon(log.sync_module)}
                                                                </div>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center space-x-2 mb-1">
                                                                    <h3 className="text-sm font-semibold text-gray-900">
                                                                        {log.sync_module}
                                                                    </h3>

                                                                    <h3 className="text-sm font-semibold text-gray-900">
                                                                        {log.sync_date}
                                                                    </h3>

                                                                </div>
                                                                <div className="flex items-center space-x-4 text-xs text-gray-500">
                                                                    <div className="flex items-center space-x-1">
                                                                        <User className="h-3 w-3" />
                                                                        <span>{log.sync_by || 'Unknown User'}</span>
                                                                    </div>

                                                                </div>
                                                            </div>
                                                        </div>
                                                        <Button
                                                            variant="outline"
                                                            size="sm"
                                                            onClick={() => handleViewDetails(log)}
                                                            className="flex-shrink-0"
                                                        >
                                                            <Eye className="h-4 w-4 mr-1" />
                                                            View Details
                                                        </Button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    
                                    {/* Pagination Controls */}
                                    {activityData?.pagination && activityData.pagination.total_pages > 1 && (
                                        <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-200">
                                            <div className="text-sm text-gray-500">
                                                Showing {activityData.pagination.start_index} to {activityData.pagination.end_index} of {activityData.pagination.total_count} results
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handlePageChange(page - 1)}
                                                    disabled={!activityData.pagination.has_previous}
                                                >
                                                    <ChevronLeft className="h-4 w-4" />
                                                    Previous
                                                </Button>
                                                <div className="flex items-center space-x-1">
                                                    {Array.from({ length: Math.min(5, activityData.pagination.total_pages) }, (_, i) => {
                                                        const pageNum = Math.max(1, Math.min(activityData.pagination.total_pages - 4, page - 2)) + i;
                                                        if (pageNum > activityData.pagination.total_pages) return null;
                                                        return (
                                                            <Button
                                                                key={pageNum}
                                                                variant={pageNum === page ? "default" : "outline"}
                                                                size="sm"
                                                                onClick={() => handlePageChange(pageNum)}
                                                                className="w-8 h-8 p-0"
                                                            >
                                                                {pageNum}
                                                            </Button>
                                                        );
                                                    })}
                                                </div>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    onClick={() => handlePageChange(page + 1)}
                                                    disabled={!activityData.pagination.has_next}
                                                >
                                                    Next
                                                    <ChevronRight className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    )}
                </div>
            </div>

            {/* Details Dialog */}
            <Dialog open={isDetailsDialogOpen} onOpenChange={setIsDetailsDialogOpen}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="flex items-center">
                            <Activity className="h-5 w-5 mr-2" />
                            Activity Details
                        </DialogTitle>
                    </DialogHeader>
                    {selectedLog && (
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Activity Module</label>
                                    <div className="flex items-center space-x-2 mt-1">
                                        <div className={`p-1 rounded ${getModuleColor(selectedLog.sync_module)}`}>
                                            {getModuleIcon(selectedLog.sync_module)}
                                        </div>
                                        <span className="text-sm font-semibold">{selectedLog.sync_module}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Activity Date</label>
                                    <div className="flex items-center space-x-1 mt-1">
                                        <Calendar className="h-4 w-4 text-gray-400" />
                                        <span className="text-sm">{selectedLog.sync_date}</span>
                                    </div>
                                </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Action By</label>
                                    <div className="flex items-center space-x-1 mt-1">
                                        <User className="h-4 w-4 text-gray-400" />
                                        <span className="text-sm">{selectedLog.sync_by || 'Unknown User'}</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-sm font-medium text-gray-600">Branch</label>
                                    <div className="flex items-center space-x-1 mt-1">
                                        <MapPin className="h-4 w-4 text-gray-400" />
                                        <span className="text-sm">{selectedLog.branch || 'No Branch'}</span>
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="text-sm font-medium text-gray-600">Description</label>
                                <div className="mt-1 p-3 border bg-white-50 rounded-lg">
                                    <p className="text-sm text-black">
                                        {selectedLog.description || 'No description available'}
                                    </p>
                                </div>
                            </div>


                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}
