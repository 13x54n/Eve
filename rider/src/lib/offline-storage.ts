import AsyncStorage from "@react-native-async-storage/async-storage";

const STORAGE_KEYS = {
  USER_PROFILE: "@rider:user_profile",
  ACTIVE_TRIP: "@rider:active_trip",
  PENDING_ACTIONS: "@rider:pending_actions",
  LAST_SYNC: "@rider:last_sync",
  CACHED_TRIPS: "@rider:cached_trips",
} as const;

export type StorageKey = keyof typeof STORAGE_KEYS;

export class OfflineStorage {
  private static getKey(key: StorageKey): string {
    return STORAGE_KEYS[key];
  }

  static async get<T>(key: StorageKey): Promise<T | null> {
    try {
      const value = await AsyncStorage.getItem(this.getKey(key));
      if (value === null) return null;
      return JSON.parse(value) as T;
    } catch (error) {
      console.error(`[OfflineStorage] Error reading ${key}:`, error);
      return null;
    }
  }

  static async set<T>(key: StorageKey, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(this.getKey(key), JSON.stringify(value));
    } catch (error) {
      console.error(`[OfflineStorage] Error writing ${key}:`, error);
      throw error;
    }
  }

  static async remove(key: StorageKey): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.getKey(key));
    } catch (error) {
      console.error(`[OfflineStorage] Error removing ${key}:`, error);
      throw error;
    }
  }

  static async clear(): Promise<void> {
    try {
      const keys = Object.values(STORAGE_KEYS);
      await Promise.all(keys.map((key) => AsyncStorage.removeItem(key)));
    } catch (error) {
      console.error("[OfflineStorage] Error clearing storage:", error);
      throw error;
    }
  }

  static async getAllKeys(): Promise<string[]> {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error("[OfflineStorage] Error getting all keys:", error);
      return [];
    }
  }
}
