import { ref } from 'vue';

const BASE_URL = import.meta.env.VITE_API_URL || '';

interface ApiOptions {
  headers?: Record<string, string>;
}

export function useApi() {
  const isLoading = ref(false);
  const error = ref<Error | null>(null);

  async function request<T>(
    method: string,
    endpoint: string,
    body?: unknown,
    options: ApiOptions = {}
  ): Promise<T> {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...options.headers,
        },
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error?.message || `HTTP ${response.status}`);
      }

      return data.data as T;
    } catch (e) {
      error.value = e as Error;
      throw e;
    } finally {
      isLoading.value = false;
    }
  }

  // 兼容旧版 apiCall 方法
  async function apiCall(endpoint: string, options?: RequestInit): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      const response = await fetch(`${BASE_URL}${endpoint}`, {
        method: options?.method || 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...(options?.headers as Record<string, string> || {}),
        },
        body: options?.body,
      });

      const data = await response.json();
      return data;
    } catch (e) {
      return { success: false, error: { message: (e as Error).message } };
    }
  }

  return {
    isLoading,
    loading: isLoading, // 别名
    error,
    apiCall,
    get: <T>(endpoint: string, options?: ApiOptions) => 
      request<T>('GET', endpoint, undefined, options),
    post: <T>(endpoint: string, body?: unknown, options?: ApiOptions) => 
      request<T>('POST', endpoint, body, options),
    put: <T>(endpoint: string, body?: unknown, options?: ApiOptions) => 
      request<T>('PUT', endpoint, body, options),
    delete: <T>(endpoint: string, options?: ApiOptions) => 
      request<T>('DELETE', endpoint, undefined, options),
  };
}
