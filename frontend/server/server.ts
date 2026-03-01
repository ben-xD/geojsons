import express from "express";
import cors from "cors";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { bboxFromPolygon, getTilesForBbox } from "./tileCoords.js";

const PORT = parseInt(process.env.PORT || "3456", 10);
const ARCGIS_API_KEY = process.env.ARCGIS_API_KEY || process.env.VITE_ARCGIS_API_KEY || "";
const MAX_CONCURRENT = 6;
const BACKOFF_BASE_MS = 1000;
const MAX_RETRIES = 3;

const db = new Database("tiles.db");
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS tiles (
    zoom_level INTEGER NOT NULL,
    tile_column INTEGER NOT NULL,
    tile_row INTEGER NOT NULL,
    tile_data BLOB NOT NULL,
    UNIQUE(zoom_level, tile_column, tile_row)
  );
  CREATE TABLE IF NOT EXISTS regions (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    polygon TEXT NOT NULL,
    zoom_min INTEGER NOT NULL,
    zoom_max INTEGER NOT NULL,
    tile_count INTEGER NOT NULL DEFAULT 0,
    downloaded_count INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL,
    size_bytes INTEGER NOT NULL DEFAULT 0
  );
`);

const getTileStmt = db.prepare("SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?");
const insertTileStmt = db.prepare("INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)");
const insertRegionStmt = db.prepare("INSERT INTO regions (id, name, polygon, zoom_min, zoom_max, tile_count, downloaded_count, status, created_at, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)");
const getRegionsStmt = db.prepare("SELECT * FROM regions");
const getRegionStmt = db.prepare("SELECT * FROM regions WHERE id = ?");
const updateRegionStmt = db.prepare("UPDATE regions SET downloaded_count = ?, status = ?, size_bytes = ? WHERE id = ?");
const deleteRegionStmt = db.prepare("DELETE FROM regions WHERE id = ?");

function arcgisTileUrl(z: number, y: number, x: number): string {
  return `https://ibasemaps-api.arcgis.com/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${ARCGIS_API_KEY}`;
}

async function fetchTileWithRetry(z: number, x: number, y: number, signal: AbortSignal): Promise<Buffer> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const res = await fetch(arcgisTileUrl(z, y, x), { signal });
    if (res.ok) return Buffer.from(await res.arrayBuffer());
    if (res.status === 429 || res.status >= 500) {
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * 2 ** attempt));
        continue;
      }
    }
    throw new Error(`Tile fetch failed: ${res.status} for ${z}/${x}/${y}`);
  }
  throw new Error("Unreachable");
}

interface RegionRow {
  id: string;
  name: string;
  polygon: string;
  zoom_min: number;
  zoom_max: number;
  tile_count: number;
  downloaded_count: number;
  status: string;
  created_at: string;
  size_bytes: number;
}

function rowToRegion(row: RegionRow) {
  return {
    id: row.id,
    name: row.name,
    polygon: JSON.parse(row.polygon),
    zoomMin: row.zoom_min,
    zoomMax: row.zoom_max,
    tileCount: row.tile_count,
    downloadedCount: row.downloaded_count,
    status: row.status,
    createdAt: row.created_at,
    sizeBytes: row.size_bytes,
  };
}

const activeDownloads = new Map<string, AbortController>();

async function downloadRegion(regionId: string, polygon: { type: string; coordinates: unknown }, zoomRange: [number, number]) {
  const bbox = bboxFromPolygon(polygon as Parameters<typeof bboxFromPolygon>[0]);
  const tiles = getTilesForBbox(bbox, zoomRange);

  const controller = new AbortController();
  activeDownloads.set(regionId, controller);

  let downloaded = 0;
  let totalBytes = 0;
  let index = 0;

  async function worker() {
    while (index < tiles.length) {
      if (controller.signal.aborted) return;
      const i = index++;
      const tile = tiles[i];
      try {
        const data = await fetchTileWithRetry(tile.z, tile.x, tile.y, controller.signal);
        insertTileStmt.run(tile.z, tile.x, tile.y, data);
        downloaded++;
        totalBytes += data.length;
        updateRegionStmt.run(downloaded, "downloading", totalBytes, regionId);
      } catch (err) {
        if ((err as Error).name === "AbortError") return;
        console.error(`Failed to fetch tile ${tile.z}/${tile.x}/${tile.y}:`, err);
      }
    }
  }

  try {
    const workers = Array.from({ length: Math.min(MAX_CONCURRENT, tiles.length) }, () => worker());
    await Promise.all(workers);
    if (!controller.signal.aborted) {
      updateRegionStmt.run(downloaded, "complete", totalBytes, regionId);
    }
  } catch {
    updateRegionStmt.run(downloaded, "error", totalBytes, regionId);
  } finally {
    activeDownloads.delete(regionId);
  }
}

const app = express();
app.use(cors());
app.use(express.json());

// Health check
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Serve tile
app.get("/:z/:x/:y", (req, res) => {
  const z = parseInt(req.params.z, 10);
  const x = parseInt(req.params.x, 10);
  const y = parseInt(req.params.y, 10);
  const row = getTileStmt.get(z, x, y) as { tile_data: Buffer } | undefined;
  if (!row) {
    res.status(404).send("Tile not found");
    return;
  }
  res.set("Content-Type", "image/jpeg");
  res.send(row.tile_data);
});

// Start download
app.post("/download", (req, res) => {
  const { polygon, name, zoomRange } = req.body;
  if (!polygon || !zoomRange) {
    res.status(400).json({ error: "polygon and zoomRange required" });
    return;
  }

  const id = randomUUID();
  const bbox = bboxFromPolygon(polygon);
  const tiles = getTilesForBbox(bbox, zoomRange);
  const now = new Date().toISOString();

  insertRegionStmt.run(id, name || "Untitled", JSON.stringify(polygon), zoomRange[0], zoomRange[1], tiles.length, 0, "downloading", now, 0);

  // Start download in background
  downloadRegion(id, polygon, zoomRange);

  res.json({ id, tileCount: tiles.length });
});

// List regions
app.get("/regions", (_req, res) => {
  const rows = getRegionsStmt.all() as RegionRow[];
  res.json(rows.map(rowToRegion));
});

// Get single region
app.get("/regions/:id", (req, res) => {
  const row = getRegionStmt.get(req.params.id) as RegionRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Region not found" });
    return;
  }
  res.json(rowToRegion(row));
});

// Create region (without download)
app.post("/regions", (req, res) => {
  const region = req.body;
  const id = randomUUID();
  const now = new Date().toISOString();
  insertRegionStmt.run(
    id, region.name || "Untitled", JSON.stringify(region.polygon),
    region.zoomMin || 10, region.zoomMax || 16,
    region.tileCount || 0, region.downloadedCount || 0,
    region.status || "pending", region.createdAt || now, region.sizeBytes || 0,
  );
  res.json({ id });
});

// Update region
app.patch("/regions/:id", (req, res) => {
  const row = getRegionStmt.get(req.params.id) as RegionRow | undefined;
  if (!row) {
    res.status(404).json({ error: "Region not found" });
    return;
  }
  const updates = req.body;
  updateRegionStmt.run(
    updates.downloadedCount ?? row.downloaded_count,
    updates.status ?? row.status,
    updates.sizeBytes ?? row.size_bytes,
    req.params.id,
  );
  res.json({ ok: true });
});

// Delete region
app.delete("/regions/:id", (req, res) => {
  const controller = activeDownloads.get(req.params.id);
  if (controller) controller.abort();
  deleteRegionStmt.run(req.params.id);
  res.json({ ok: true });
});

app.listen(PORT, () => {
  console.log(`Tile server running on http://localhost:${PORT}`);
});
