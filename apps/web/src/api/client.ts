import axios from 'axios';
import { useAuthStore } from '../store/auth.store';
import { resolveDummyApiFallback } from '../data/dummyData';

const api = axios.create({
  baseURL: '/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
  timeout: 15000,
});

let isRefreshing = false;
let refreshQueue: Array<(token: string) => void> = [];

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => {
    // If backend service responds with 200 but empty data (unseeded DB), fall back to dummy data
    const url = response.config?.url || '';
    const cleanUrl = url.replace(/^https?:\/\/[^/]+/, '').replace(/^\/?api\/v1/, '');
    const [path] = cleanUrl.split('?');

    if ((path === '/products' || path === '/products/') && response.data?.data?.items?.length === 0) {
      const fallback = resolveDummyApiFallback(url);
      if (fallback) response.data = fallback;
    } else if ((path === '/categories' || path === '/categories/') && Array.isArray(response.data?.data) && response.data.data.length === 0) {
      const fallback = resolveDummyApiFallback(url);
      if (fallback) response.data = fallback;
    } else if (path === '/search' && response.data?.data?.products?.length === 0) {
      const fallback = resolveDummyApiFallback(url);
      if (fallback) response.data = fallback;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const url = originalRequest?.url || '';

    // If backend services have an issue (network offline, 404, 500, 502, 503, 504), serve static dummy catalog
    const fallback = resolveDummyApiFallback(url);
    if (fallback) {
      console.warn(`[Catalog Fallback] Backend service issue on ${url}. Serving static dummy catalog data.`);
      return {
        data: fallback,
        status: 200,
        statusText: 'OK (Static Dummy Fallback)',
        headers: {},
        config: originalRequest,
      };
    }

    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise<string>((resolve) => {
          refreshQueue.push(resolve);
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      isRefreshing = true;
      try {
        const { data } = await axios.post('/api/v1/auth/refresh', {}, { withCredentials: true });
        const newToken: string = data.data.accessToken;
        useAuthStore.getState().setAccessToken(newToken);
        refreshQueue.forEach((resolve) => resolve(newToken));
        refreshQueue = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch {
        useAuthStore.getState().clearAuth();
        refreshQueue = [];
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
