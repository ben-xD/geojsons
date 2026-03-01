import { openDB, type IDBPDatabase } from "idb";
import type { TileBackend, OfflineRegion, StorageStats } from "./tileBackend";
import { v4 as uuidv4 } from "uuid";

const DB_NAME = "offline-tiles";
const DB_VERSION = 1;

interface OfflineTilesDB {
  tiles: { key: string; value: ArrayBuffer };
  regions: { key: string; value: OfflineRegion; indexes: {} };
}

function tileKey(z: number, x: number, y: number): string {
  return `${z}/${x}/${y}`;
}

let dbPromise: Promise<IDBPDatabase<OfflineTilesDB>> | undefined;

function getDb(): Promise<IDBPDatabase<OfflineTilesDB>> {
  if (!dbPromise) {
    dbPromise = openDB<OfflineTilesDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains("tiles")) {
          db.createObjectStore("tiles");
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
    const db = await getDb();
    const data = await db.get("tiles", tileKey(z, x, y));
    return data ?? null;
  },

  async hasTile(z, x, y) {
    const db = await getDb();
    const key = await db.getKey("tiles", tileKey(z, x, y));
    return key !== undefined;
  },

  async storeTile(z, x, y, data) {
    const db = await getDb();
    await db.put("tiles", data, tileKey(z, x, y));
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
    await db.delete("regions", id);
  },

  async getStorageStats(): Promise<StorageStats> {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      return { used: est.usage ?? 0, quota: est.quota };
    }
    return { used: 0 };
  },
};
