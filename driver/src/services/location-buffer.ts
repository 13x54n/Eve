import { OfflineStorage } from "@/lib/offline-storage";
import { sendDriverLocation } from "./socket";

export type BufferedLocation = {
  latitude: number;
  longitude: number;
  timestamp: number;
};

const MAX_BUFFER_SIZE = 100;
const LOCATION_EXPIRY_MS = 300000;

class LocationBuffer {
  private buffer: BufferedLocation[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    const stored = await OfflineStorage.get<BufferedLocation[]>("LOCATION_BUFFER");
    if (stored) {
      const now = Date.now();
      this.buffer = stored.filter(
        (loc) => now - loc.timestamp < LOCATION_EXPIRY_MS
      );
      if (this.buffer.length !== stored.length) {
        await this.persistBuffer();
      }
    }
    this.initialized = true;
  }

  async addLocation(latitude: number, longitude: number): Promise<void> {
    const location: BufferedLocation = {
      latitude,
      longitude,
      timestamp: Date.now(),
    };

    this.buffer.push(location);

    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer = this.buffer.slice(-MAX_BUFFER_SIZE);
    }

    await this.persistBuffer();
  }

  async sendLocation(latitude: number, longitude: number, isOnline: boolean): Promise<void> {
    if (isOnline) {
      try {
        sendDriverLocation(latitude, longitude);
        console.log("[LocationBuffer] Sent location via socket");
      } catch (error) {
        console.warn("[LocationBuffer] Failed to send via socket, buffering", error);
        await this.addLocation(latitude, longitude);
      }
    } else {
      await this.addLocation(latitude, longitude);
      console.log("[LocationBuffer] Offline, buffered location");
    }
  }

  async flush(isOnline: boolean): Promise<number> {
    if (!isOnline || this.buffer.length === 0) {
      return 0;
    }

    console.log(`[LocationBuffer] Flushing ${this.buffer.length} buffered locations`);

    const locationsToSend = [...this.buffer];
    this.buffer = [];
    await this.persistBuffer();

    let sentCount = 0;
    for (const location of locationsToSend) {
      try {
        sendDriverLocation(location.latitude, location.longitude);
        sentCount++;
      } catch (error) {
        console.error("[LocationBuffer] Failed to send buffered location", error);
        this.buffer.push(location);
      }
    }

    if (this.buffer.length > 0) {
      await this.persistBuffer();
    }

    console.log(`[LocationBuffer] Successfully sent ${sentCount}/${locationsToSend.length} locations`);
    return sentCount;
  }

  getBufferSize(): number {
    return this.buffer.length;
  }

  async clear(): Promise<void> {
    this.buffer = [];
    await OfflineStorage.remove("LOCATION_BUFFER");
  }

  private async persistBuffer(): Promise<void> {
    try {
      await OfflineStorage.set("LOCATION_BUFFER", this.buffer);
    } catch (error) {
      console.error("[LocationBuffer] Failed to persist buffer", error);
    }
  }
}

export const locationBuffer = new LocationBuffer();
