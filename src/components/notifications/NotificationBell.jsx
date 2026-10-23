import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthService } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// Fetch notifications from API
const fetchNotifications = async (filters = {}) => {
  const token = AuthService.getAccessToken();
  if (!token) {
    throw new Error("Not authenticated");
  }

  const response = await fetch(`${API_BASE_URL}/api/notifications/`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(filters),
  });

  if (!response.ok) {
    if (response.status === 404) {
      // No notifications found - return empty array (this is expected behavior)
      return { status: 200, data: [], count: 0 };
    }
    // For other errors, try to parse error response
    try {
      const errorData = await response.json();
      if (errorData.status === 404) {
        return { status: 200, data: [], count: 0 };
      }
    } catch (e) {
      // If parsing fails, continue with error
    }
    throw new Error(`Failed to fetch notifications: ${response.statusText}`);
  }

  const data = await response.json();
  return data;
};

export default function NotificationBell({ className }) {
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { toast } = useToast();

  // Fetch notifications - only fetch unread by default (don't mark as read)
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notifications", "unread"],
    queryFn: async () => {
      try {
        // Fetch unread notifications without marking them as read
        return await fetchNotifications({ is_read: false, mark_as_read: false });
      } catch (err) {
        // If 404, return empty array (no notifications)
        if (err.message.includes("404")) {
          return { status: 200, data: [], count: 0 };
        }
        throw err;
      }
    },
    refetchInterval: 10000, // Refetch every 10 seconds for faster updates
    refetchOnWindowFocus: true, // Refetch when user switches back to the tab
    refetchOnMount: true, // Refetch when component mounts
    retry: 1,
    onSuccess: (data) => {
      if (data && data.data) {
        setUnreadCount(data.count || data.data.length || 0);
      } else {
        setUnreadCount(0);
      }
    },
  });

  // Fetch all notifications when popover is opened (mark as read when viewing)
  const { data: allNotifications, refetch: refetchAll, isLoading: isLoadingAll } = useQuery({
    queryKey: ["notifications", "all"],
    queryFn: async () => {
      try {
        // Mark notifications as read when user opens the popover to view them
        return await fetchNotifications({ mark_as_read: true });
      } catch (err) {
        // If 404, return empty array (no notifications)
        if (err.message.includes("404")) {
          return { status: 200, data: [], count: 0 };
        }
        throw err;
      }
    },
    enabled: isOpen, // Only fetch when popover is open
    retry: 1,
  });

  // Update unread count when notifications change
  useEffect(() => {
    if (data && data.data) {
      setUnreadCount(data.count || data.data.length || 0);
    }
  }, [data]);

  // Refetch notifications when page becomes visible (user switches back to tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [refetch]);

  const handleNotificationClick = (notification) => {
    if (notification.link) {
      window.location.href = notification.link;
    }
    // Refetch to update read status
    refetch();
    refetchAll();
  };

  const handlePopoverOpenChange = (open) => {
    setIsOpen(open);
    if (open) {
      // Refetch all notifications when opening
      refetchAll();
    }
  };

  const notifications = isOpen ? (allNotifications?.data || []) : (data?.data || []);
  const displayCount = isOpen ? (allNotifications?.count || notifications.length) : unreadCount;

  return (
    <Popover open={isOpen} onOpenChange={handlePopoverOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className={cn(
            "relative p-2 rounded-full transition-all duration-200",
            className || "text-white hover:bg-gray-700 hover:text-white bg-gray-800/50 border border-gray-600/50 shadow-md",
            unreadCount > 0 && !className && "bg-yellow-500/20 border-yellow-400/50 shadow-lg shadow-yellow-500/20"
          )}
        >
          <Bell className={cn(
            "h-5 w-5 transition-colors duration-200",
            unreadCount > 0 ? "text-yellow-400" : (className ? "text-gray-700" : "text-white")
          )} />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs ring-2 ring-white shadow-md"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        side="bottom"
      >
        <div className="flex items-center justify-between p-4 border-b">
          <h3 className="font-semibold text-sm">Notifications</h3>
          {displayCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {displayCount}
            </Badge>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {(isLoadingAll && isOpen) || (isLoading && !isOpen) ? (
            <div className="p-4 text-center text-sm text-gray-500">
              Loading notifications...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-sm text-red-500">
              Failed to load notifications
            </div>
          ) : notifications && notifications.length > 0 ? (
            <div className="divide-y">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    "p-4 cursor-pointer transition-colors",
                    !notification.is_read 
                      ? "bg-blue-50 hover:bg-blue-100 border-l-4 border-blue-500" 
                      : "hover:bg-gray-50"
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h4 className={cn(
                        "font-medium text-sm mb-1",
                        !notification.is_read ? "text-blue-900 font-semibold" : "text-gray-900"
                      )}>
                        {notification.subject || "Notification"}
                      </h4>
                      <p className={cn(
                        "text-xs line-clamp-2",
                        !notification.is_read ? "text-blue-800" : "text-gray-600"
                      )}>
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {notification.created_at}
                      </p>
                    </div>
                    {!notification.is_read && (
                      <div className="h-2 w-2 rounded-full bg-blue-500 flex-shrink-0 mt-1 animate-pulse" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center">
              <Bell className="h-12 w-12 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No notifications</p>
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}

