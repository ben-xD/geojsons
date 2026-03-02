import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { describeRoute, resolver, validator, openAPIRouteHandler } from "hono-openapi";
import { Scalar } from "@scalar/hono-api-reference";
import * as v from "valibot";
import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { bboxFromPolygon, getTilesForBbox } from "./tileCoords.js";
import { env } from "./env.js";

const PORT = env.PORT;
const ARCGIS_API_KEY = env.ARCGIS_API_KEY;
const MAX_CONCURRENT = 6;
const BACKOFF_BASE_MS = 1000;
const MAX_RETRIES = 3;
const LOG_VERBOSE = env.LOG_VERBOSE;
const ARCGIS_TILE_HOST = "ibasemaps-api.arcgis.com";
const ARCGIS_RESOURCE_HOST_ALLOWLIST = new Set([
  "ibasemaps-api.arcgis.com",
  "basemaps-api.arcgis.com",
  "basemapstyles-api.arcgis.com",
  "static.arcgis.com",
  "www.arcgis.com",
]);

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
  CREATE TABLE IF NOT EXISTS cached_resources (
    url TEXT PRIMARY KEY,
    content_type TEXT NOT NULL,
    body BLOB NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const getTileStmt = db.prepare(
  "SELECT tile_data FROM tiles WHERE zoom_level = ? AND tile_column = ? AND tile_row = ?",
);
const insertTileStmt = db.prepare(
  "INSERT OR REPLACE INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?, ?, ?, ?)",
);
const insertRegionStmt = db.prepare(
  "INSERT INTO regions (id, name, polygon, zoom_min, zoom_max, tile_count, downloaded_count, status, created_at, size_bytes) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
);
const getRegionsStmt = db.prepare("SELECT * FROM regions");
const getRegionStmt = db.prepare("SELECT * FROM regions WHERE id = ?");
const updateRegionStmt = db.prepare(
  "UPDATE regions SET downloaded_count = ?, status = ?, size_bytes = ? WHERE id = ?",
);
const deleteRegionStmt = db.prepare("DELETE FROM regions WHERE id = ?");
const getCachedResourceStmt = db.prepare(
  "SELECT content_type, body FROM cached_resources WHERE url = ?",
);
const upsertCachedResourceStmt = db.prepare(
  "INSERT OR REPLACE INTO cached_resources (url, content_type, body, updated_at) VALUES (?, ?, ?, ?)",
);

function formatLog(level: "INFO" | "WARN" | "ERROR", message: string): string {
  return `[${new Date().toISOString()}] [${level}] ${message}`;
}

function logInfo(message: string): void {
  console.log(formatLog("INFO", message));
}

function logWarn(message: string): void {
  console.warn(formatLog("WARN", message));
}

function logError(message: string): void {
  console.error(formatLog("ERROR", message));
}

function arcgisTileUrl(z: number, y: number, x: number): string {
  return `https://${ARCGIS_TILE_HOST}/arcgis/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}?token=${ARCGIS_API_KEY}`;
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

interface FetchBinaryResult {
  data: Buffer;
  contentType: string;
}

async function fetchBinaryWithRetry(
  url: string,
  signal: AbortSignal,
  headers?: HeadersInit,
): Promise<FetchBinaryResult> {
  let lastStatus = 0;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    const response = await fetch(url, { signal, headers });
    if (response.ok) {
      const contentType = response.headers.get("content-type") || "application/octet-stream";
      return { data: Buffer.from(await response.arrayBuffer()), contentType };
    }

    lastStatus = response.status;
    if (isRetryableStatus(response.status) && attempt < MAX_RETRIES) {
      if (LOG_VERBOSE) {
        logWarn(
          `upstream retryable response ${response.status} for ${url} (attempt ${attempt + 1}/${MAX_RETRIES + 1})`,
        );
      }
      await new Promise((r) => setTimeout(r, BACKOFF_BASE_MS * 2 ** attempt));
      continue;
    }
    break;
  }

  throw new Error(`Upstream fetch failed with status ${lastStatus}`);
}

async function fetchTileWithRetry(
  z: number,
  x: number,
  y: number,
  signal: AbortSignal,
): Promise<Buffer> {
  const result = await fetchBinaryWithRetry(arcgisTileUrl(z, y, x), signal);
  return result.data;
}

function parseCachedOnlyFlag(value: string | undefined): boolean {
  return value === "1" || value === "true";
}

function validateAllowlistedResourceUrl(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.port && parsed.port !== "443") return null;
  if (!ARCGIS_RESOURCE_HOST_ALLOWLIST.has(parsed.hostname)) return null;

  return parsed;
}

function resourceCacheKey(url: URL): string {
  const normalized = new URL(url.toString());
  normalized.searchParams.delete("token");
  normalized.searchParams.sort();
  return normalized.toString();
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

async function downloadRegion(
  regionId: string,
  polygon: { type: string; coordinates: unknown },
  zoomRange: [number, number],
) {
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
        logError(
          `background download failed for region ${regionId} tile ${tile.z}/${tile.x}/${tile.y}: ${String(err)}`,
        );
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

// --- Valibot schemas ---

const RegionSchema = v.object({
  id: v.string(),
  name: v.string(),
  polygon: v.any(),
  zoomMin: v.number(),
  zoomMax: v.number(),
  tileCount: v.number(),
  downloadedCount: v.number(),
  status: v.string(),
  createdAt: v.string(),
  sizeBytes: v.number(),
});

const OkSchema = v.object({ ok: v.boolean() });
const ErrorSchema = v.object({ error: v.string() });
const IdSchema = v.object({ id: v.string() });

const TileParamsSchema = v.object({
  z: v.string(),
  x: v.string(),
  y: v.string(),
});

const RegionIdParamSchema = v.object({
  id: v.string(),
});

const DownloadBodySchema = v.object({
  polygon: v.any(),
  name: v.optional(v.string()),
  zoomRange: v.tuple([v.number(), v.number()]),
});

const CreateRegionBodySchema = v.object({
  name: v.optional(v.string()),
  polygon: v.any(),
  zoomMin: v.optional(v.number()),
  zoomMax: v.optional(v.number()),
  tileCount: v.optional(v.number()),
  downloadedCount: v.optional(v.number()),
  status: v.optional(v.string()),
  createdAt: v.optional(v.string()),
  sizeBytes: v.optional(v.number()),
});

const UpdateRegionBodySchema = v.object({
  downloadedCount: v.optional(v.number()),
  status: v.optional(v.string()),
  sizeBytes: v.optional(v.number()),
});

const TileQuerySchema = v.object({
  cachedOnly: v.optional(v.string()),
});

const ResourceQuerySchema = v.object({
  url: v.string(),
  cachedOnly: v.optional(v.string()),
});

// --- App ---

const app = new Hono();
app.use("*", cors());
app.use("*", async (c, next) => {
  const startedAt = Date.now();
  const requestId = c.req.header("x-request-id") || randomUUID();

  if (LOG_VERBOSE) {
    logInfo(`[${requestId}] -> ${c.req.method} ${c.req.path}`);
  }

  try {
    await next();
  } catch (error) {
    logError(`[${requestId}] unhandled error for ${c.req.method} ${c.req.path}: ${String(error)}`);
    throw error;
  } finally {
    c.res.headers.set("X-Request-Id", requestId);
    const durationMs = Date.now() - startedAt;
    if (LOG_VERBOSE || c.res.status >= 400) {
      logInfo(`[${requestId}] <- ${c.res.status} ${c.req.method} ${c.req.path} (${durationMs}ms)`);
    }
  }
});

// Health check
app.get(
  "/health",
  describeRoute({
    tags: ["Health"],
    summary: "Health check",
    responses: {
      200: {
        description: "Server is healthy",
        content: { "application/json": { schema: resolver(OkSchema) } },
      },
    },
  }),
  (c) => {
    return c.json({ ok: true });
  },
);

// Serve tile
app.get(
  "/:z/:x/:y",
  describeRoute({
    tags: ["Tiles"],
    summary: "Get a cached tile or proxy/fill from ArcGIS",
    responses: {
      200: { description: "JPEG tile image" },
      404: { description: "Tile not found" },
    },
  }),
  validator("param", TileParamsSchema),
  validator("query", TileQuerySchema),
  async (c) => {
    const requestId = c.req.header("x-request-id") || "no-request-id";
    const { z, x, y } = c.req.valid("param");
    const { cachedOnly } = c.req.valid("query");
    const shouldUseCacheOnly = parseCachedOnlyFlag(cachedOnly);
    const zi = parseInt(z, 10);
    const xi = parseInt(x, 10);
    const yi = parseInt(y, 10);
    const row = getTileStmt.get(zi, xi, yi) as { tile_data: Buffer } | undefined;
    const tileCoord = `${zi}/${xi}/${yi}`;

    if (!row) {
      if (LOG_VERBOSE) {
        logInfo(`[${requestId}] tile cache miss ${tileCoord} (cachedOnly=${shouldUseCacheOnly})`);
      }
      if (c.req.method === "HEAD" || shouldUseCacheOnly) {
        c.header("X-Geojsons-Tile-Source", "cache-miss");
        c.header("X-Geojsons-Tile", tileCoord);
        return c.text("Tile not found", 404);
      }

      try {
        const referer = c.req.header("referer");
        const headers = referer ? { Referer: referer } : undefined;
        const { data, contentType } = await fetchBinaryWithRetry(
          arcgisTileUrl(zi, yi, xi),
          c.req.raw.signal,
          headers,
        );
        insertTileStmt.run(zi, xi, yi, data);
        if (LOG_VERBOSE) {
          logInfo(`[${requestId}] tile proxied ${tileCoord} (${data.length} bytes)`);
        }
        c.header("X-Geojsons-Tile-Source", "proxy");
        c.header("X-Geojsons-Tile", tileCoord);
        return c.body(new Uint8Array(data), 200, { "Content-Type": contentType });
      } catch (error) {
        logError(`[${requestId}] tile proxy failed ${tileCoord}: ${String(error)}`);
        c.header("X-Geojsons-Tile-Source", "proxy-error");
        c.header("X-Geojsons-Tile", tileCoord);
        return c.text("Tile not found", 404);
      }
    }

    if (c.req.method === "HEAD") {
      c.header("X-Geojsons-Tile-Source", "cache");
      c.header("X-Geojsons-Tile", tileCoord);
      return c.body(null, 200, { "Content-Type": "image/jpeg" });
    }

    if (LOG_VERBOSE) {
      logInfo(`[${requestId}] tile cache hit ${tileCoord}`);
    }
    c.header("X-Geojsons-Tile-Source", "cache");
    c.header("X-Geojsons-Tile", tileCoord);
    return c.body(new Uint8Array(row.tile_data), 200, { "Content-Type": "image/jpeg" });
  },
);

// Proxy/cache ArcGIS style dependencies with strict allowlist.
app.get(
  "/resource",
  describeRoute({
    tags: ["Resources"],
    summary: "Get ArcGIS style/glyph/sprite resource with caching",
    responses: {
      200: { description: "Cached or proxied resource" },
      400: {
        description: "URL rejected by allowlist",
        content: { "application/json": { schema: resolver(ErrorSchema) } },
      },
      404: {
        description: "Resource not found in cache",
        content: { "application/json": { schema: resolver(ErrorSchema) } },
      },
      502: {
        description: "Upstream fetch failed",
        content: { "application/json": { schema: resolver(ErrorSchema) } },
      },
    },
  }),
  validator("query", ResourceQuerySchema),
  async (c) => {
    const requestId = c.req.header("x-request-id") || "no-request-id";
    const { url, cachedOnly } = c.req.valid("query");
    const validatedUrl = validateAllowlistedResourceUrl(url);
    if (!validatedUrl) {
      logWarn(`[${requestId}] rejected resource URL: ${url}`);
      c.header("X-Geojsons-Resource-Source", "rejected-url");
      return c.json({ error: "URL is not allowed" }, 400);
    }

    const upstreamUrl = validatedUrl.toString();
    const cacheKey = resourceCacheKey(validatedUrl);
    const shouldUseCacheOnly = parseCachedOnlyFlag(cachedOnly);
    const cached = getCachedResourceStmt.get(cacheKey) as
      | { content_type: string; body: Buffer }
      | undefined;

    if (LOG_VERBOSE && cached) {
      logInfo(`[${requestId}] resource cache hit ${cacheKey}`);
    }
    if (LOG_VERBOSE && !cached) {
      logInfo(`[${requestId}] resource cache miss ${cacheKey} (cachedOnly=${shouldUseCacheOnly})`);
    }

    if (!cached && c.req.method !== "HEAD" && !shouldUseCacheOnly) {
      try {
        const referer = c.req.header("referer");
        const headers = referer ? { Referer: referer } : undefined;
        const { data, contentType } = await fetchBinaryWithRetry(
          upstreamUrl,
          c.req.raw.signal,
          headers,
        );
        upsertCachedResourceStmt.run(cacheKey, contentType, data, new Date().toISOString());
        if (LOG_VERBOSE) {
          logInfo(`[${requestId}] resource proxied ${cacheKey} (${data.length} bytes)`);
        }
      } catch (error) {
        logError(`[${requestId}] resource proxy failed ${upstreamUrl}: ${String(error)}`);
      }
    }

    const finalCached = getCachedResourceStmt.get(cacheKey) as
      | { content_type: string; body: Buffer }
      | undefined;
    if (!finalCached) {
      c.header("X-Geojsons-Resource-Source", shouldUseCacheOnly ? "cache-miss" : "proxy-error");
      return c.json({ error: "Resource not found" }, shouldUseCacheOnly ? 404 : 502);
    }

    if (c.req.method === "HEAD") {
      c.header("X-Geojsons-Resource-Source", cached ? "cache" : "proxy");
      return c.body(null, 200, { "Content-Type": finalCached.content_type });
    }

    c.header("X-Geojsons-Resource-Source", cached ? "cache" : "proxy");
    return c.body(new Uint8Array(finalCached.body), 200, {
      "Content-Type": finalCached.content_type,
    });
  },
);

// Start download
app.post(
  "/download",
  describeRoute({
    tags: ["Downloads"],
    summary: "Start downloading tiles for a region",
    responses: {
      200: {
        description: "Download started",
        content: {
          "application/json": {
            schema: resolver(v.object({ id: v.string(), tileCount: v.number() })),
          },
        },
      },
      400: {
        description: "Invalid request",
        content: { "application/json": { schema: resolver(ErrorSchema) } },
      },
    },
  }),
  validator("json", DownloadBodySchema),
  async (c) => {
    const { polygon, name, zoomRange } = c.req.valid("json");

    const id = randomUUID();
    const bbox = bboxFromPolygon(polygon);
    const tiles = getTilesForBbox(bbox, zoomRange);
    const now = new Date().toISOString();

    insertRegionStmt.run(
      id,
      name || "Untitled",
      JSON.stringify(polygon),
      zoomRange[0],
      zoomRange[1],
      tiles.length,
      0,
      "downloading",
      now,
      0,
    );

    // Start download in background
    downloadRegion(id, polygon, zoomRange);

    return c.json({ id, tileCount: tiles.length });
  },
);

// List regions
app.get(
  "/regions",
  describeRoute({
    tags: ["Regions"],
    summary: "List all regions",
    responses: {
      200: {
        description: "Array of regions",
        content: {
          "application/json": { schema: resolver(v.array(RegionSchema)) },
        },
      },
    },
  }),
  (c) => {
    const rows = getRegionsStmt.all() as RegionRow[];
    return c.json(rows.map(rowToRegion));
  },
);

// Get single region
app.get(
  "/regions/:id",
  describeRoute({
    tags: ["Regions"],
    summary: "Get a region by ID",
    responses: {
      200: {
        description: "Region found",
        content: { "application/json": { schema: resolver(RegionSchema) } },
      },
      404: {
        description: "Region not found",
        content: { "application/json": { schema: resolver(ErrorSchema) } },
      },
    },
  }),
  validator("param", RegionIdParamSchema),
  (c) => {
    const row = getRegionStmt.get(c.req.valid("param").id) as RegionRow | undefined;
    if (!row) {
      return c.json({ error: "Region not found" }, 404);
    }
    return c.json(rowToRegion(row));
  },
);

// Create region (without download)
app.post(
  "/regions",
  describeRoute({
    tags: ["Regions"],
    summary: "Create a region without downloading",
    responses: {
      200: {
        description: "Region created",
        content: { "application/json": { schema: resolver(IdSchema) } },
      },
    },
  }),
  validator("json", CreateRegionBodySchema),
  async (c) => {
    const region = c.req.valid("json");
    const id = randomUUID();
    const now = new Date().toISOString();
    insertRegionStmt.run(
      id,
      region.name || "Untitled",
      JSON.stringify(region.polygon),
      region.zoomMin || 10,
      region.zoomMax || 16,
      region.tileCount || 0,
      region.downloadedCount || 0,
      region.status || "pending",
      region.createdAt || now,
      region.sizeBytes || 0,
    );
    return c.json({ id });
  },
);

// Update region
app.patch(
  "/regions/:id",
  describeRoute({
    tags: ["Regions"],
    summary: "Update a region",
    responses: {
      200: {
        description: "Region updated",
        content: { "application/json": { schema: resolver(OkSchema) } },
      },
      404: {
        description: "Region not found",
        content: { "application/json": { schema: resolver(ErrorSchema) } },
      },
    },
  }),
  validator("param", RegionIdParamSchema),
  validator("json", UpdateRegionBodySchema),
  async (c) => {
    const row = getRegionStmt.get(c.req.valid("param").id) as RegionRow | undefined;
    if (!row) {
      return c.json({ error: "Region not found" }, 404);
    }
    const updates = c.req.valid("json");
    updateRegionStmt.run(
      updates.downloadedCount ?? row.downloaded_count,
      updates.status ?? row.status,
      updates.sizeBytes ?? row.size_bytes,
      c.req.valid("param").id,
    );
    return c.json({ ok: true });
  },
);

// Delete region
app.delete(
  "/regions/:id",
  describeRoute({
    tags: ["Regions"],
    summary: "Delete a region and cancel any active download",
    responses: {
      200: {
        description: "Region deleted",
        content: { "application/json": { schema: resolver(OkSchema) } },
      },
    },
  }),
  validator("param", RegionIdParamSchema),
  (c) => {
    const { id } = c.req.valid("param");
    const controller = activeDownloads.get(id);
    if (controller) controller.abort();
    deleteRegionStmt.run(id);
    return c.json({ ok: true });
  },
);

// OpenAPI spec
app.get(
  "/openapi",
  openAPIRouteHandler(app, {
    documentation: {
      info: {
        title: "GeoJSONs Tile Server",
        version: "1.0.0",
        description: "Offline tile caching and region management API",
      },
      servers: [{ url: `http://localhost:${PORT}`, description: "Local" }],
    },
  }),
);

// Scalar API docs UI
app.get("/docs", Scalar({ url: "/openapi" }));

serve({ fetch: app.fetch, port: PORT }, () => {
  logInfo(`Tile server running on http://localhost:${PORT}`);
  logInfo(`API docs at http://localhost:${PORT}/docs`);
  logInfo(`ArcGIS API key configured: ${ARCGIS_API_KEY ? "yes" : "no"}`);
  if (LOG_VERBOSE) {
    logInfo("Verbose request logging enabled (LOG_VERBOSE=true)");
  }
});
