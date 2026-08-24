// services/auth.ts
import { api } from './api';
import * as SecureStore from 'expo-secure-store';

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

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload);
  await SecureStore.setItemAsync('access_token', data.accessToken);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/register', payload);
  await SecureStore.setItemAsync('access_token', data.accessToken);
  return data;
}

export async function logout() {
  await SecureStore.deleteItemAsync('access_token');
}

export async function getSessionUser() {
  const { data } = await api.get<{ user: AuthResponse['user'] }>('/auth/me');
  return data.user;
}