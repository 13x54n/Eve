import * as SecureStore from 'expo-secure-store';
import { api } from './api';
import type { DriverProfile, DriverUser } from '../types/driver';

export interface DriverLoginPayload {
  email: string;
  password: string;
}

export interface DriverRegisterPayload {
  name: string;
  email: string;
  phone?: string;
  password: string;
  city: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number;
  vehicleColor: string;
  vehiclePlateNumber: string;
  vehicleCategory?: string;
  vehicleCapacity?: number;
}

export interface AuthResponse {
  accessToken: string;
  user: DriverUser;
  driverProfile: DriverProfile;
}

export async function loginDriver(payload: DriverLoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/driver/login', payload);
  await SecureStore.setItemAsync('driver_access_token', data.accessToken);
  return data;
}

export async function registerDriver(payload: DriverRegisterPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/driver/register', payload);
  await SecureStore.setItemAsync('driver_access_token', data.accessToken);
  return data;
}

export async function logoutDriver(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync('driver_access_token');
  } catch {
    // Ignore error on logout
  }
}

export async function getStoredDriverToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync('driver_access_token');
  } catch {
    return null;
  }
}

export async function requestPasswordReset(email: string): Promise<{ message: string; verificationCode?: string }> {
  const { data } = await api.post('/auth/forgot-password', { email });
  return data;
}

export async function resetPassword(payload: {
  email: string;
  code: string;
  password: string;
}): Promise<{ message: string }> {
  const { data } = await api.post('/auth/reset-password', payload);
  return data;
}
