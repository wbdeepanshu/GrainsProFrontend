import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
    Activity,
    User,
    Database,
    ArrowRight
} from "lucide-react";
import { useLocation } from "wouter";

interface RecentActivityProps {
    data?: {
        activities: Array<{
            id: number;
            sync_module: string;
            description: string;
            sync_date: string;
            sync_by: string;
            branch: string;
        }>;
        error: string | null;
    };
}

export default function RecentActivity({ data }: RecentActivityProps) {
    const [location, setLocation] = useLocation();

    const getModuleIcon = (module) => {
        switch (module?.toLowerCase()) {
            case 'stock items':
                return <Database className="h-4 w-4" />;
            case 'units':
                return <Database className="h-4 w-4" />;
            case 'godowns':
                return <Database className="h-4 w-4" />;
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

    const handleViewMore = () => {
        setLocation('/recent-activity');
    };

    // Handle error state from dashboard API
    if (data?.error) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Activity className="h-5 w-5 mr-2" />
                        Recent Activity
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-sm text-gray-600">Unable to load recent activities</p>
                    </div>
                </CardContent>
            </Card>
        );
    }

    const activities = data?.activities || [];

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                        <Activity className="h-5 w-5 mr-2" />
                        Recent Activity
                    </div>
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleViewMore}
                        className="text-blue-600 hover:text-blue-700"
                    >
                        View More
                        <ArrowRight className="h-4 w-4 ml-1" />
                    </Button>
                </CardTitle>
            </CardHeader>
            <CardContent>
                {activities.length === 0 ? (
                    <div className="text-center py-8">
                        <Activity className="h-12 w-12 mx-auto text-gray-400 mb-4" />
                        <p className="text-sm text-gray-600">No recent activities</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {activities.map((activity) => (
                            <div key={activity.id} className="flex items-center space-x-3 p-3 rounded-lg border border-gray-100 hover:bg-gray-50 transition-colors">
                                <div className="flex-shrink-0">
                                    <div className={`p-2 rounded-lg ${getModuleColor(activity.sync_module)}`}>
                                        {getModuleIcon(activity.sync_module)}
                                    </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-semibold text-gray-900 truncate">
                                            {activity.sync_module}
                                        </h4>
                                        {/* <Badge variant="outline" className="text-xs ml-2">
                                            {activity.sync_date}
                                        </Badge> */}
                                    </div>
                                    <div className="flex items-center space-x-1 mt-1">
                                        <User className="h-3 w-3 text-gray-400" />
                                        <span className="text-xs text-gray-500 ">
                                            {activity.sync_by || 'Unknown User'}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {activity.sync_date}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
}
