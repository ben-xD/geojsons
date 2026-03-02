import type { TileBackend } from "./tileBackend";
import type { TileCoord } from "./tileCoords";
import { arcgisTileUrl } from "./arcgis";

const MAX_CONCURRENT = 6;
const BACKOFF_BASE_MS = 1000;
const MAX_RETRIES = 3;

async function fetchTileWithRetry(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<ArrayBuffer> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(arcgisTileUrl(z, x, y), { signal });
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

export class QuotaExceededError extends Error {
  constructor(message = "Storage quota exceeded") {
    super(message);
    this.name = "QuotaExceededError";
  }
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
  let quotaError: Error | null = null;

  async function worker() {
    while (index < tiles.length) {
      if (signal.aborted) return;
      if (quotaError) throw quotaError;
      const i = index++;
      const tile = tiles[i];
      try {
        const data = await fetchTileWithRetry(tile.z, tile.x, tile.y, signal);
        await backend.storeTile(tile.z, tile.x, tile.y, data);
        downloaded++;
        sizeBytes += data.byteLength;
        onProgress({ downloaded, total, sizeBytes });
      } catch (err) {
        const error = err as Error;
        if (
          error.name === "QuotaExceededError" ||
          error.message?.toLowerCase().includes("quota") ||
          error.message?.toLowerCase().includes("storage") ||
          error.message?.toLowerCase().includes("disk full") ||
          error.message?.toLowerCase().includes("insufficient")
        ) {
          quotaError = new QuotaExceededError(error.message);
          throw quotaError;
        }
        throw error;
      }
    }
  }

  const workers = Array.from({ length: Math.min(MAX_CONCURRENT, total) }, () => worker());
  await Promise.all(workers);
}
