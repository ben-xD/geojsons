import { openDB, type IDBPDatabase } from "idb";
import type { TileBackend, OfflineRegion, StorageStats } from "./tileBackend";
import { v4 as uuidv4 } from "uuid";
import { bboxFromPolygon, getTilesForBbox } from "./tileCoords";
import { arcgisTileCacheKeyUrl } from "./arcgis";

const DB_NAME = "offline-tiles";
const DB_VERSION = 2;
const TILE_CACHE_NAME = "arcgis-world-imagery-tiles-v1";

interface OfflineTilesDB {
  regions: { key: string; value: OfflineRegion; indexes: {} };
}

let dbPromise: Promise<IDBPDatabase<OfflineTilesDB>> | undefined;

function getDb(): Promise<IDBPDatabase<OfflineTilesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineTilesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (db.objectStoreNames.contains("tiles")) {
          db.deleteObjectStore("tiles");
        }
        if (!db.objectStoreNames.contains("regions")) {
          db.createObjectStore("regions", { keyPath: "id" });
        }
      },
    });
  }
  return dbPromise;
}

export const indexedDbBackend: TileBackend = {
  async getTile(z, x, y) {
    const cache = await caches.open(TILE_CACHE_NAME);
    const response = await cache.match(arcgisTileCacheKeyUrl(z, x, y));
    if (!response) return null;
    return response.arrayBuffer();
  },

  async hasTile(z, x, y) {
    const cache = await caches.open(TILE_CACHE_NAME);
    const response = await cache.match(arcgisTileCacheKeyUrl(z, x, y));
    return response !== undefined;
  },

  async storeTile(z, x, y, data) {
    const cache = await caches.open(TILE_CACHE_NAME);
    await cache.put(
      arcgisTileCacheKeyUrl(z, x, y),
      new Response(data, { headers: { "Content-Type": "image/jpeg" } }),
    );
  },

  async getRegions() {
    const db = await getDb();
    return db.getAll("regions");
  },

  async createRegion(region) {
    const db = await getDb();
    const id = uuidv4();
    const full: OfflineRegion = { ...region, id };
    await db.put("regions", full);
    return id;
  },

  async updateRegion(id, updates) {
    const db = await getDb();
    const existing = await db.get("regions", id);
    if (!existing) return;
    await db.put("regions", { ...existing, ...updates, id });
  },

  async deleteRegion(id) {
    const db = await getDb();
    const region = await db.get("regions", id);
    if (region) {
      const bbox = bboxFromPolygon(region.polygon);
      const tiles = getTilesForBbox(bbox, [region.zoomMin, region.zoomMax]);
      const cache = await caches.open(TILE_CACHE_NAME);
      await Promise.all(
        tiles.map((tile) => cache.delete(arcgisTileCacheKeyUrl(tile.z, tile.x, tile.y))),
      );
    }
    await db.delete("regions", id);
  },

  async deleteAllRegions() {
    const db = await getDb();
    await db.clear("regions");
    await caches.delete(TILE_CACHE_NAME);
  },

  async getStorageStats(): Promise<StorageStats> {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { used: est.usage ?? 0, quota: est.quota };
    }
    return { used: 0 };
  },
};
