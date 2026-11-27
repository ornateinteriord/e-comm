import axios from 'axios';
import { useSellerAuthStore, useStoreAuthStore } from '../store/auth.store';

const API_BASE =
  import.meta.env.VITE_API_GATEWAY_URL
    ? `${import.meta.env.VITE_API_GATEWAY_URL}/api/v1`
    : '/api/v1';

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
    'X-Requested-With': 'XMLHttpRequest',
    'X-Client-Type': 'seller',
  },
  timeout: 20000,
});

let isRefreshing = false;
let refreshQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = [];

api.interceptors.request.use((config) => {
  const token = useSellerAuthStore.getState().token || useStoreAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Client-Type'] = 'seller';
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const requestUrl = String(originalRequest?.url || '');
    const isAuthEndpoint =
      requestUrl.includes('/seller/login') ||
      requestUrl.includes('/seller/register') ||
      requestUrl.includes('/seller/refresh') ||
      requestUrl.includes('/store/login') ||
      requestUrl.includes('/store/register') ||
      requestUrl.includes('/store/refresh');

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
          ? `${import.meta.env.VITE_API_GATEWAY_URL}/api/v1/seller/refresh`
          : '/api/v1/seller/refresh';
        const storedRefreshToken = useSellerAuthStore.getState().refreshToken;
        const { data } = await axios.post(
          refreshUrl,
          storedRefreshToken ? { refreshToken: storedRefreshToken } : {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
              'X-Requested-With': 'XMLHttpRequest',
              'X-Client-Type': 'seller',
            },
          },
        );
        const newToken: string = data.data.accessToken;
        const newRefreshToken: string | undefined = data.data.refreshToken;
        useSellerAuthStore.getState().setTokens(newToken, newRefreshToken);
        refreshQueue.forEach(({ resolve }) => resolve(newToken));
        refreshQueue = [];
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest);
      } catch (refreshErr: any) {
        const status = refreshErr?.response?.status;
        if (status === 401 || status === 403) {
          useSellerAuthStore.getState().clearAuth();
          if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
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

