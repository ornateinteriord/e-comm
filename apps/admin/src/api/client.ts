import axios from 'axios';
import { useAdminAuthStore } from '../store/auth.store';

// Vite exposes VITE_ prefixed variables at build time.
// In production (.env.production) this is https://api-geteway.vercel.app
// In development (.env) this falls back to http://localhost:4000 via the Vite proxy.
const API_BASE =
  import.meta.env.VITE_API_GATEWAY_URL
    ? `${import.meta.env.VITE_API_GATEWAY_URL}/api/v1`
    : '/api/v1'; // dev: falls through Vite proxy → http://localhost:4000

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Client-Type': 'admin',
  },
  timeout: 20000,
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

api.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Client-Type'] = 'admin';
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const errCode = error.response?.data?.error?.code;
    if (
      error.response?.status === 403 &&
      ['CUSTOMER_ACCESS_RESTRICTED', 'ADMIN_ACCESS_RESTRICTED', 'ACCOUNT_SUSPENDED'].includes(errCode)
    ) {
      useAdminAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/logout');

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
        const refreshUrl = import.meta.env.VITE_API_GATEWAY_URL
          ? `${import.meta.env.VITE_API_GATEWAY_URL}/api/v1/auth/refresh`
          : '/api/v1/auth/refresh';
        const storedRefreshToken = useAdminAuthStore.getState().refreshToken;
        const { data } = await axios.post(
          refreshUrl,
          storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'X-Client-Type': 'admin',
            },
          },
        );
        const newToken: string = data.data.accessToken;
        const newRefreshToken: string | undefined = data.data.refreshToken;
        useAdminAuthStore.getState().setAccessToken(newToken, newRefreshToken);
        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr: any) {
        const status = refreshErr?.response?.status;
        if (status === 401 || status === 403) {
          useAdminAuthStore.getState().clearAuth();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
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
