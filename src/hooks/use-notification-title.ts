import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { AuthService } from "@/lib/auth";

const API_BASE_URL = import.meta.env.VITE_BASE_URL;

// Fetch unread notification count
const fetchUnreadCount = async () => {
  const token = AuthService.getAccessToken();
  if (!token) {
    return 0;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/notifications/`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ is_read: false, mark_as_read: false }),
    });

    if (!response.ok) {
      if (response.status === 404) {
        return 0;
      }
      return 0;
    }

    const data = await response.json();
    return data.count || data.data?.length || 0;
  } catch (error) {
    console.error("Error fetching notification count:", error);
    return 0;
  }
};

export function useNotificationTitle() {
  const isAuthenticated = AuthService.isAuthenticated();

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications", "unread", "title"],
    queryFn: fetchUnreadCount,
    enabled: isAuthenticated,
    refetchInterval: 10000, // Refetch every 10 seconds
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (!isAuthenticated) {
      document.title = "GrainPro - ERP";
      return;
    }

    const baseTitle = "GrainsPro - ERP";
    if (unreadCount && unreadCount > 0) {
      document.title = `(${unreadCount}) ${baseTitle}`;
    } else {
      document.title = baseTitle;
    }
  }, [unreadCount, isAuthenticated]);

  // Also update when page becomes visible
  useEffect(() => {
    if (!isAuthenticated) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Trigger a refetch by invalidating the query
        // This will be handled by react-query's refetchOnWindowFocus
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [isAuthenticated]);
}

