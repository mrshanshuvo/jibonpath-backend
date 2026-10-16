import { EventEmitter } from "events";
import { redisClient } from "../../config/redis";

export interface TelemetryTick {
  dispatchId: string;
  lat: number;
  lng: number;
  heading?: number;
  speedKmh?: number;
  stage?: string;
  updatedAt: string;
}

class TelemetryStore {
  private inMemoryCache = new Map<string, TelemetryTick>();
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(500);
  }

  /**
   * Save a telemetry coordinate update.
   * Caches in-memory for zero latency and syncs with Redis (TTL: 120s) if available.
   */
  async setTelemetry(tick: TelemetryTick): Promise<void> {
    this.inMemoryCache.set(tick.dispatchId, tick);

    // Broadcast immediately to SSE subscribers
    this.emitter.emit(`telemetry:${tick.dispatchId}`, tick);

    // Optional Redis cache persistence with 120-second TTL
    if (redisClient && redisClient.status === "ready") {
      try {
        await redisClient.set(
          `dispatch:${tick.dispatchId}:telemetry`,
          JSON.stringify(tick),
          "EX",
          120,
        );
      } catch (err) {
        // Silently continue if Redis write encounters error; in-memory has it
      }
    }
  }

  /**
   * Retrieve latest telemetry tick for a dispatch.
   */
  async getLatestTelemetry(dispatchId: string): Promise<TelemetryTick | null> {
    const memoryTick = this.inMemoryCache.get(dispatchId);
    if (memoryTick) return memoryTick;

    if (redisClient && redisClient.status === "ready") {
      try {
        const raw = await redisClient.get(`dispatch:${dispatchId}:telemetry`);
        if (raw) {
          const parsed = JSON.parse(raw) as TelemetryTick;
          this.inMemoryCache.set(dispatchId, parsed);
          return parsed;
        }
      } catch (err) {
        // Fallback to null
      }
    }

    return null;
  }

  /**
   * Subscribe to real-time coordinates for a dispatch via EventEmitter.
   * Returns an unsubscribe function for clean resource disposal.
   */
  subscribeTelemetry(
    dispatchId: string,
    listener: (tick: TelemetryTick) => void,
  ): () => void {
    const eventName = `telemetry:${dispatchId}`;
    this.emitter.on(eventName, listener);

    return () => {
      this.emitter.off(eventName, listener);
    };
  }

  /**
   * Clear cache for a completed dispatch
   */
  clear(dispatchId: string) {
    this.inMemoryCache.delete(dispatchId);
    if (redisClient && redisClient.status === "ready") {
      redisClient.del(`dispatch:${dispatchId}:telemetry`).catch(() => {});
    }
  }
}

export const telemetryStore = new TelemetryStore();
