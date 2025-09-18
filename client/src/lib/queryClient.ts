import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { AuthManager } from "./auth";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  let headers = {
    ...AuthManager.getAuthHeaders(),
    ...(data ? { "Content-Type": "application/json" } : {}),
  };

  let res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  // If we get 401/403, try to refresh the token and retry once
  if ((res.status === 401 || res.status === 403) && AuthManager.getRefreshToken()) {
    const refreshed = await AuthManager.refreshAccessToken();
    if (refreshed) {
      // Retry the request with the new token
      headers = {
        ...AuthManager.getAuthHeaders(),
        ...(data ? { "Content-Type": "application/json" } : {}),
      };
      
      res = await fetch(url, {
        method,
        headers,
        body: data ? JSON.stringify(data) : undefined,
        credentials: "include",
      });
    }
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
    let res = await fetch(queryKey.join("/") as string, {
      headers: AuthManager.getAuthHeaders(),
      credentials: "include",
    });

    // If we get 401/403, try to refresh the token and retry once
    if ((res.status === 401 || res.status === 403) && AuthManager.getRefreshToken()) {
      const refreshed = await AuthManager.refreshAccessToken();
      if (refreshed) {
        // Retry the query with the new token
        res = await fetch(queryKey.join("/") as string, {
          headers: AuthManager.getAuthHeaders(),
          credentials: "include",
        });
      }
    }

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
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
    },
    mutations: {
      retry: false,
    },
  },
});
