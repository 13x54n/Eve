// services/auth.ts
import { api } from './api';
import * as SecureStore from 'expo-secure-store';

export const ACCESS_TOKEN_KEY = 'access_token';

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    role: 'RIDER' | 'DRIVER' | 'ADMIN';
    name: string;
    email: string;
    phone: string | null;
    isActive: boolean;
    createdAt: string;
  };
}

export interface PasswordResetRequestResponse {
  message: string;
  verificationCode?: string;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  await SecureStore.setItemAsync(ACCESS_TOKEN_KEY, data.accessToken);
  return data;
}

export async function getAccessToken() {
  return SecureStore.getItemAsync(ACCESS_TOKEN_KEY);
}

export async function logout() {
  await SecureStore.deleteItemAsync(ACCESS_TOKEN_KEY);
}

export async function getSessionUser() {
  const { data } = await api.get<{ user: AuthResponse['user'] }>('/auth/me');
  return data.user;
}

export async function requestPasswordReset(
  email: string,
): Promise<PasswordResetRequestResponse> {
  const { data } = await api.post<PasswordResetRequestResponse>(
    '/auth/forgot-password',
    { email },
  );
  return data;
}

export async function resetPassword(input: {
  email: string;
  code: string;
  password: string;
}) {
  await api.post('/auth/reset-password', input);
}