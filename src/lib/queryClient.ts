import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AuthService } from "./auth";

// Function to handle 401 errors and redirect to login
// This will be updated after queryClient is created to include cache clearing
let handleUnauthorized = () => {
  // Clear authentication data
  AuthService.clearAuthData();
  
  // Redirect to login page
  const basePath = window.location.pathname.split('/').slice(0, -1).join('/') || '';
  const loginPath = basePath ? `${basePath}/login` : '/login';
  window.location.href = loginPath;
};

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    // Handle 401 Unauthorized errors
    if (res.status === 401) {
      handleUnauthorized();
      const text = (await res.text()) || res.statusText;
      throw new Error(`401: ${text}`);
    }
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  // Get auth headers first (includes Content-Type if token exists)
  const authHeaders = AuthService.getAuthHeaders();
  const headers: Record<string, string> = { ...authHeaders };
  
  // Override Content-Type if data is provided (for POST/PUT requests)
  if (data) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // Check for 401 before throwing
  if (res.status === 401) {
    handleUnauthorized();
    const text = (await res.text()) || res.statusText;
    throw new Error(`401: ${text}`);
  }

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    // Add authentication headers for queries
    const authHeaders = AuthService.getAuthHeaders();
    
    const res = await fetch(queryKey.join("/") as string, {
      headers: authHeaders,
      credentials: "include",
    });

    // Handle 401 errors
    if (res.status === 401) {
      if (unauthorizedBehavior === "returnNull") {
        return null;
      }
      // For "throw" behavior, redirect to login
      handleUnauthorized();
      const text = (await res.text()) || res.statusText;
      throw new Error(`401: ${text}`);
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
      onError: (error: any) => {
        // Handle 401 errors globally
        if (error?.message?.includes('401') || error?.response?.status === 401) {
          queryClient.clear(); // Clear cache before redirect
          handleUnauthorized();
        }
      },
    },
    mutations: {
      retry: false,
      onError: (error: any) => {
        // Handle 401 errors globally for mutations
        if (error?.message?.includes('401') || error?.response?.status === 401) {
          queryClient.clear(); // Clear cache before redirect
          handleUnauthorized();
        }
      },
    },
  },
});

// Update handleUnauthorized to include cache clearing now that queryClient exists
const originalHandleUnauthorized = handleUnauthorized;
handleUnauthorized = () => {
  queryClient.clear(); // Clear React Query cache
  originalHandleUnauthorized();
};
