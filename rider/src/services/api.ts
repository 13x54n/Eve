import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { requireApiBaseUrl } from '@/lib/public-env';

const API_BASE = requireApiBaseUrl('rider');

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach access token
api.interceptors.request.use(async (config) => {
  const accessToken = await SecureStore.getItemAsync('access_token');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  if (__DEV__) {
    console.log(
      `[api] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
    );
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('access_token');
    }
    if (__DEV__) {
      console.error(
        `[api] ${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url} failed`,
        error.message,
      );
    }
    return Promise.reject(error);
  },
);