import axios from 'axios';
import { useStoreAuthStore } from '../store/auth.store';

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
    'X-Client-Type': 'store',
  },
  timeout: 20000,
});

api.interceptors.request.use((config) => {
  const token = useStoreAuthStore.getState().token;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Client-Type'] = 'store';
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useStoreAuthStore.getState().clearAuth();
      if (typeof window !== 'undefined' && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  },
);

export default api;

