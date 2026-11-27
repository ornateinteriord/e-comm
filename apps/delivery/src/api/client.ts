import axios from 'axios';
import { useDeliveryAuthStore } from '../store/auth.store';

const PRIMARY_API_BASE = import.meta.env.VITE_API_GATEWAY_URL
  ? `${import.meta.env.VITE_API_GATEWAY_URL.replace(/\/+$/, '')}/api/v1`
  : '/api/v1';

const FALLBACK_API_BASE = import.meta.env.VITE_API_FALLBACK_URL
  ? `${import.meta.env.VITE_API_FALLBACK_URL.replace(/\/+$/, '')}/api/v1`
  : '';

let activeApiBase = PRIMARY_API_BASE;

const api = axios.create({
  baseURL: activeApiBase,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Client-Type': 'delivery',
  },
  timeout: 12000,
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

api.interceptors.request.use((config) => {
  const token = useDeliveryAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Client-Type'] = 'delivery';
  if (!config.baseURL || config.baseURL === PRIMARY_API_BASE || config.baseURL === FALLBACK_API_BASE) {
    config.baseURL = activeApiBase;
  }
  return config;
});

api.interceptors.response.use(
  (response) => {
    const usedBase = String(response.config?.baseURL || '').replace(/\/+$/, '');
    if (usedBase === PRIMARY_API_BASE || (FALLBACK_API_BASE && usedBase === FALLBACK_API_BASE)) {
      activeApiBase = usedBase;
      api.defaults.baseURL = usedBase;
    }
    return response;
  },
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '');

    // Automatic LAN fallback when localhost:4000 adb reverse tunnel disconnects (e.g. phone screen lock)
    if (!error.response && FALLBACK_API_BASE && originalRequest && !originalRequest._gatewayFallbackTried) {
      originalRequest._gatewayFallbackTried = true;
      const failedBase = String(originalRequest.baseURL || activeApiBase).replace(/\/+$/, '');
      const altBase = failedBase === PRIMARY_API_BASE ? FALLBACK_API_BASE : PRIMARY_API_BASE;
      if (altBase && altBase !== failedBase) {
        originalRequest.baseURL = altBase;
        return api(originalRequest);
      }
    }

    const isAuthEndpoint =
      requestUrl.includes('/delivery/login') ||
      requestUrl.includes('/delivery/register') ||
      requestUrl.includes('/delivery/refresh');

    if (error.response?.status === 401 && !originalRequest?._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise<string>((resolve, reject) => {
          refreshQueue.push({ resolve, reject });
        }).then((token) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          return api(originalRequest);
        });
      }

      isRefreshing = true;
      try {
        const refreshUrl = `${activeApiBase.replace(/\/+$/, '')}/delivery/refresh`;
        const storedRefreshToken = useDeliveryAuthStore.getState().refreshToken;
        const { data } = await axios.post(
          refreshUrl,
          storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'X-Client-Type': 'delivery',
            },
          },
        );
        const newToken: string = data.data.accessToken;
        const newRefreshToken: string | undefined = data.data.refreshToken;
        useDeliveryAuthStore.getState().setTokens(newToken, newRefreshToken);
        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr: any) {
        const status = refreshErr?.response?.status;
        if (status === 401 || status === 403) {
          useDeliveryAuthStore.getState().clearAuth();
          if (
            typeof window !== 'undefined' &&
            window.location.pathname !== '/login' &&
            window.location.pathname !== '/register'
          ) {
            window.location.href = '/login';
          }
        }
        refreshQueue.forEach(({ reject }) => reject(refreshErr));
        refreshQueue = [];
        return Promise.reject(refreshErr);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  },
);

export default api;
