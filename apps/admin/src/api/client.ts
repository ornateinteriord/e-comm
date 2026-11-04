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
    if (error.response?.status === 403) {
      useAdminAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }

    const requestUrl = String(error.config?.url || '');
    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/refresh') ||
      requestUrl.includes('/auth/logout');

    if (error.response?.status === 401 && !error.config?._retry && !isAuthEndpoint) {
      error.config._retry = true;
      try {
        const refreshUrl = import.meta.env.VITE_API_GATEWAY_URL
          ? `${import.meta.env.VITE_API_GATEWAY_URL}/api/v1/auth/refresh`
          : '/api/v1/auth/refresh';
        const { data } = await axios.post(
          refreshUrl,
          {},
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
        useAdminAuthStore.getState().setAccessToken(newToken);
        error.config.headers.Authorization = `Bearer ${newToken}`;
        return api(error.config);
      } catch {
        useAdminAuthStore.getState().clearAuth();
      }
    }
    return Promise.reject(error);
  },
);

export default api;
