import { api } from './api';
import * as SecureStore from 'expo-secure-store';

export const ACCESS_TOKEN_KEY = 'access_token';

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    role: 'RIDER' | 'DRIVER' | 'ADMIN';
    name: string;
    email: string | null;
    phone: string | null;
    city: string | null;
    accountStatus: string;
    ethereumWallet?: string | null;
    solanaWallet?: string | null;
    isActive: boolean;
    createdAt: string;
    pushNotificationsEnabled?: boolean;
  };
}

export async function exchangePrivy(input: {
  identityToken: string;
  ethereumWallet?: string;
  solanaWallet?: string;
}): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/driver/privy', input);
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
  return data;
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY, {
    keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
}

export async function logout() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function getSessionUser() {
  const { data } = await api.get<{ user: AuthResponse['user'] }>('/auth/me');
  return data.user;
}

export async function updateProfile(payload: {
  name: string;
  email?: string | null;
  phone: string | null;
  pushNotificationsEnabled?: boolean;
}) {
  const { data } = await api.patch<{ user: AuthResponse['user'] }>('/auth/me', payload);
  return data.user;
}
