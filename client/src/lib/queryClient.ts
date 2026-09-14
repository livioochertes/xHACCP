import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()).trim();
    let message = "";

    if (text) {
      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.message === "string") {
          message = parsed.message;
        } else if (typeof parsed?.error === "string") {
          message = parsed.error;
        }
      } catch {
        // Some gateways return an HTML error page instead of JSON. Do not
        // surface that page inside the checkout toast.
      }
    }

    if (!message && text && !/^<!doctype html|^<html[\s>]/i.test(text)) {
      message = text.slice(0, 300);
    }

    throw new Error(`${res.status}: ${message || res.statusText || "Request failed"}`);
  }
}

export function getMarketFromHostname(): string {
  try {
    const hostname = window.location.hostname;
    if (hostname === 'xhaccp.ro' || hostname.endsWith('.xhaccp.ro')) return 'ro';
    if (hostname === 'xhaccp.fr' || hostname.endsWith('.xhaccp.fr')) return 'fr';
    if (hostname === 'xhaccp.com' || hostname.endsWith('.xhaccp.com')) return 'com';
    return 'ro';
  } catch {
    return 'ro';
  }
}

export function getProductReviewsQueryKey(productId: number): string {
  return `/api/products/${productId}/reviews`;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const token = localStorage.getItem('token');
  const headers: Record<string, string> = data ? { "Content-Type": "application/json" } : {};
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  headers["X-Market"] = getMarketFromHostname();

  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    let url = queryKey[0] as string;
    
    // Handle query parameters
    if (queryKey.length > 1 && queryKey[1] && typeof queryKey[1] === 'object') {
      const params = new URLSearchParams();
      const queryParams = queryKey[1] as Record<string, any>;
      
      for (const [key, value] of Object.entries(queryParams)) {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      }
      
      // Add cache-busting parameter
      params.append('_t', Date.now().toString());
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
    }
    
    console.log("🌐 Making API request:", url);
    const token = localStorage.getItem('token');
    const headers: Record<string, string> = {
      "Cache-Control": "no-cache, no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "X-Market": getMarketFromHostname()
    };
    
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    
    const res = await fetch(url, {
      credentials: "include",
      cache: "no-cache",
      headers
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    const data = await res.json();
    console.log("🌐 API response received:", {
      url,
      dataLength: Array.isArray(data) ? data.length : "not array",
      firstTwo: Array.isArray(data) ? data.slice(0, 2).map(p => ({ id: p.id, name: p.name })) : "not array"
    });
    return data;
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      // Keep page navigation fast without making a long-lived copy of data.
      // Individual volatile queries can still opt into a shorter staleTime or
      // be invalidated immediately after a mutation.
      staleTime: 60 * 1000,
      gcTime: 5 * 60 * 1000,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
