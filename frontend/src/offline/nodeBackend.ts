import { env } from "@/env";
import type { TileBackend, OfflineRegion, StorageStats } from "./tileBackend";

const serverUrl = env.VITE_TILE_SERVER_URL;

export const nodeBackend: TileBackend = {
  async getTile(z, x, y) {
    const res = await fetch(`${serverUrl}/${z}/${x}/${y}`);
    if (!res.ok) return null;
    return res.arrayBuffer();
  },

  async hasTile(z, x, y) {
    const res = await fetch(`${serverUrl}/${z}/${x}/${y}`, { method: "HEAD" });
    return res.ok;
  },

  async storeTile() {
    throw new Error("storeTile is handled server-side via POST /download");
  },

  async getRegions() {
    const res = await fetch(`${serverUrl}/regions`);
    if (!res.ok) throw new Error(`Failed to fetch regions: ${res.status}`);
    return res.json();
  },

  async createRegion(region) {
    const res = await fetch(`${serverUrl}/regions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(region),
    });
    if (!res.ok) throw new Error(`Failed to create region: ${res.status}`);
    const data = await res.json();
    return data.id;
  },

  async updateRegion(id, updates) {
    const res = await fetch(`${serverUrl}/regions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error(`Failed to update region: ${res.status}`);
  },

  async deleteRegion(id) {
    const res = await fetch(`${serverUrl}/regions/${id}`, { method: "DELETE" });
    if (!res.ok) throw new Error(`Failed to delete region: ${res.status}`);
  },

  async getStorageStats(): Promise<StorageStats> {
    const regions = await this.getRegions();
    const used = regions.reduce((sum, r) => sum + r.sizeBytes, 0);
    return { used };
  },
};

export async function startNodeDownload(
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon,
  name: string,
  zoomRange: [number, number],
): Promise<string> {
  const res = await fetch(`${serverUrl}/download`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ polygon, name, zoomRange }),
  });
  if (!res.ok) throw new Error(`Failed to start download: ${res.status}`);
  const data = await res.json();
  return data.id;
}

export async function pollNodeRegion(id: string): Promise<OfflineRegion> {
  const res = await fetch(`${serverUrl}/regions/${id}`);
  if (!res.ok) throw new Error(`Failed to poll region: ${res.status}`);
  return res.json();
}
