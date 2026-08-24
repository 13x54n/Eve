import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';

const API_BASE = process.env.EXPO_PUBLIC_API_URL;

if (!API_BASE) {
  throw new Error(
    'EXPO_PUBLIC_API_URL is not configured. Start Expo again after setting it in rider/.env.',
  );
}

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
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (error: AxiosError) => Promise.reject(error),
);