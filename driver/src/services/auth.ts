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
  phone?: string;
  city: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlateNumber: string;
  vehicleType: 'BIKE' | 'CAR';
  vehicleCapacity: number;
}

export interface AuthResponse {
  accessToken: string;
  user: {
    id: string;
    role: 'RIDER' | 'DRIVER' | 'ADMIN';
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    accountStatus: string;
    isActive: boolean;
    createdAt: string;
  };
}

export interface PasswordResetRequestResponse {
  message: string;
  verificationCode?: string;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/driver/login', payload);
  await SecureStore.setItemAsync('access_token', data.accessToken);
  return data;
}

export async function register(payload: RegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/driver/register', payload);
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