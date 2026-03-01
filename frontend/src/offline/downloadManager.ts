import { env } from "@/env";
import type { TileBackend } from "./tileBackend";
import type { TileCoord } from "./tileCoords";

const MAX_CONCURRENT = 6;
const BACKOFF_BASE_MS = 1000;
const MAX_RETRIES = 3;

function arcgisTileUrl(z: number, y: number, x: number): string {
  return `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${env.VITE_ARCGIS_API_KEY}`;
}

async function fetchTileWithRetry(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(arcgisTileUrl(z, y, x), { signal });
    if (res.ok) return res.arrayBuffer();
    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        const delay = BACKOFF_BASE_MS * 2 ** attempt;
        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
    }
    throw new Error(`Tile fetch failed: ${res.status} for ${z}/${x}/${y}`);
  }
  throw new Error("Unreachable");
}

export interface DownloadProgress {
  downloaded: number;
  total: number;
  sizeBytes: number;
}

export interface VerifyResult {
  total: number;
  present: number;
  missing: TileCoord[];
}

export async function verifyTiles(
  backend: TileBackend,
  tiles: TileCoord[],
  onProgress: (checked: number, total: number) => void,
  signal: AbortSignal,
): Promise<VerifyResult> {
  const missing: TileCoord[] = [];
  let checked = 0;
  const total = tiles.length;
  let index = 0;

  async function worker() {
    while (index < tiles.length) {
      if (signal.aborted) return;
      const i = index++;
      const tile = tiles[i];
      const exists = await backend.hasTile(tile.z, tile.x, tile.y);
      if (!exists) missing.push(tile);
      checked++;
      onProgress(checked, total);
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, total) }, () => worker());
  await Promise.all(workers);
  return { total, present: total - missing.length, missing };
}

export async function downloadTiles(
  backend: TileBackend,
  tiles: TileCoord[],
  onProgress: (progress: DownloadProgress) => void,
  signal: AbortSignal,
): Promise<void> {
  let downloaded = 0;
  let sizeBytes = 0;
  const total = tiles.length;
  let index = 0;

  async function worker() {
    while (index < tiles.length) {
      if (signal.aborted) return;
      const i = index++;
      const tile = tiles[i];
      const data = await fetchTileWithRetry(tile.z, tile.x, tile.y, signal);
      await backend.storeTile(tile.z, tile.x, tile.y, data);
      downloaded++;
      sizeBytes += data.byteLength;
      onProgress({ downloaded, total, sizeBytes });
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, total) }, () => worker());
  await Promise.all(workers);
}
