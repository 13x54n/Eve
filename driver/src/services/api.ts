import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { router } from 'expo-router';
import { requireApiBaseUrl, requireAuthBaseUrl } from '@/lib/public-env';
import { OfflineStorage } from '@/lib/offline-storage';
import { actionQueue } from '@/lib/action-queue';

export const API_BASE = requireApiBaseUrl('driver');
export const AUTH_BASE = requireAuthBaseUrl('driver');

export const api = axios.create({
  baseURL: API_BASE,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

const MAX_RETRIES = 3;
const RETRY_DELAY = 1000;
const RETRY_STATUS_CODES = [408, 500, 502, 503, 504];

function shouldRetry(error: AxiosError): boolean {
  if (!error.response) {
    return true;
  }
  return RETRY_STATUS_CODES.includes(error.response.status);
}

function isSessionRequest(url?: string) {
  return (url ?? '').replace(/^\//, '') === 'auth/me';
}

async function clearLocalSession() {
  await Promise.allSettled([
    SecureStore.deleteItemAsync('access_token'),
    OfflineStorage.clear(),
    actionQueue.clear(),
  ]);
}

async function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAuthRequest(url?: string) {
  const path = (url ?? "").replace(/^\//, "");
  if (path === "auth" || path.startsWith("auth/")) {
    return true;
  }
  return /^(driver\/(login|register|auth0))(\/|$)/.test(path);
}

api.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  config.baseURL = isAuthRequest(config.url) ? AUTH_BASE : API_BASE;
  const accessToken = await SecureStore.getItemAsync('access_token');
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }

  if (!config.headers['x-retry-count']) {
    config.headers['x-retry-count'] = '0';
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
    const config = error.config as InternalAxiosRequestConfig & {
      headers: { 'x-retry-count': string };
    };

    const sessionFailure =
      isSessionRequest(config?.url) &&
      (error.response?.status === 401 || error.response?.status === 404);

    if (sessionFailure) {
      await clearLocalSession();
      try {
        router.replace('/(auth)/welcome');
      } catch {
      }
    } else if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync('access_token');
      try {
        router.replace('/(auth)/welcome');
      } catch {
      }
    }

    const retryCount = parseInt(config?.headers?.['x-retry-count'] || '0', 10);

    if (config && shouldRetry(error) && retryCount < MAX_RETRIES) {
      const newRetryCount = retryCount + 1;
      config.headers['x-retry-count'] = String(newRetryCount);

      const delay = RETRY_DELAY * Math.pow(2, retryCount);
      
      if (__DEV__) {
        console.log(
          `[api] Retry ${newRetryCount}/${MAX_RETRIES} after ${delay}ms for ${config.method?.toUpperCase()} ${config.url}`,
        );
      }

      await sleep(delay);
      return api(config);
    }

    if (__DEV__ && !sessionFailure) {
      console.error(
        `[api] ${error.config?.method?.toUpperCase()} ${error.config?.baseURL}${error.config?.url} failed`,
        error.message,
      );
    }
    return Promise.reject(error);
  },
);