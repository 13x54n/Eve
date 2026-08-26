import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const DEFAULT_API_BASE =
  Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api'
    : 'http://localhost:3000/api';

export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_BASE;

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  try {
    const accessToken = await SecureStore.getItemAsync('driver_access_token');
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
  } catch {
    // Secure store access fallback
  }

  if (__DEV__) {
    console.log(
      `[Driver API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`,
    );
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => {
    if (__DEV__) {
      console.warn(
        `[Driver API Error] ${error.config?.method?.toUpperCase()} ${error.config?.url} failed:`,
        error.response?.data || error.message,
      );
    }
    return Promise.reject(error);
  },
);
