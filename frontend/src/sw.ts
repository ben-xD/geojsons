/// <reference lib="webworker" />

import { clientsClaim } from "workbox-core";
import { precacheAndRoute } from "workbox-precaching";

declare let self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<string | { revision: string | null; url: string }>;
};

type OfflineTileBackend = "indexeddb" | "node";

interface OfflinePreferencesMessage {
  type: "OFFLINE_PREFERENCES";
  payload: {
    preferOffline: boolean;
    offlineTileBackend: OfflineTileBackend;
  };
}

const ARCGIS_TILE_CACHE_HOST = "ibasemaps-api.arcgis.com";
const ARCGIS_TILE_HOSTS = new Set(["ibasemaps-api.arcgis.com", "basemaps-api.arcgis.com"]);
const ARCGIS_TILE_PATH_RE =
  /^\/arcgis\/rest\/services\/World_Imagery\/MapServer\/tile\/(\d+)\/(\d+)\/(\d+)$/;
const ARCGIS_RESOURCE_HOSTS = new Set([
  "ibasemaps-api.arcgis.com",
  "basemaps-api.arcgis.com",
  "basemapstyles-api.arcgis.com",
  "static.arcgis.com",
  "www.arcgis.com",
]);

const TILE_CACHE_NAME = "arcgis-world-imagery-tiles-v1";
const RESOURCE_CACHE_NAME = "arcgis-style-assets-v1";
const NETWORK_TIMEOUT_MS = 5000;
const TILE_SERVER_URL =
  (import.meta.env.VITE_TILE_SERVER_URL as string | undefined) ?? "http://localhost:3456";

let preferOffline = false;
let offlineTileBackend: OfflineTileBackend = "indexeddb";

self.skipWaiting();
clientsClaim();
precacheAndRoute(self.__WB_MANIFEST);

self.addEventListener("message", (event: ExtendableMessageEvent) => {
  const data = event.data as OfflinePreferencesMessage | undefined;
  if (!data || data.type !== "OFFLINE_PREFERENCES") return;
  preferOffline = data.payload.preferOffline;
  offlineTileBackend = data.payload.offlineTileBackend;
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (isArcgisTileRequest(url)) {
    event.respondWith(
      handleArcgisTileRequest(request, url).catch((error: unknown) =>
        gatewayTimeoutResponse("tile", request.url, error),
      ),
    );
    return;
  }

  if (isArcgisResourceRequest(url)) {
    event.respondWith(
      handleArcgisResourceRequest(request, url).catch((error: unknown) =>
        gatewayTimeoutResponse("resource", request.url, error),
      ),
    );
  }
});

function sanitizeUrlForHeader(rawUrl: string): string {
  try {
    const url = new URL(rawUrl);
    return `${url.origin}${url.pathname}`;
  } catch {
    return "invalid-url";
  }
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return String(error);
}

function gatewayTimeoutResponse(
  kind: "tile" | "resource",
  requestUrl: string,
  error: unknown,
): Response {
  return new Response("Upstream unavailable", {
    status: 504,
    statusText: "Gateway Timeout",
    headers: {
      "Content-Type": "text/plain",
      "X-Geojsons-SW-Error": errorMessage(error).slice(0, 180),
      "X-Geojsons-SW-Path": sanitizeUrlForHeader(requestUrl),
      "X-Geojsons-SW-Kind": kind,
    },
  });
}

function normalizeBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function isArcgisTileRequest(url: URL): boolean {
  return ARCGIS_TILE_HOSTS.has(url.hostname) && ARCGIS_TILE_PATH_RE.test(url.pathname);
}

function isArcgisResourceRequest(url: URL): boolean {
  if (!ARCGIS_RESOURCE_HOSTS.has(url.hostname)) return false;
  if (isArcgisTileRequest(url)) return false;

  const pathname = url.pathname.toLowerCase();
  const normalizedPathname = pathname.endsWith("/") ? pathname.slice(0, -1) : pathname;
  if (
    normalizedPathname.includes("/arcgis/rest/services/") &&
    (normalizedPathname.endsWith("/mapserver") || normalizedPathname.endsWith("/vectortileserver"))
  ) {
    return true;
  }

  return (
    pathname.endsWith(".json") ||
    pathname.endsWith(".pbf") ||
    pathname.endsWith(".png") ||
    pathname.includes("/sprites/") ||
    pathname.includes("/glyphs/") ||
    pathname.includes("/fonts/") ||
    pathname.includes("/styles/")
  );
}

function buildNodeTileUrl(url: URL): string | null {
  const match = url.pathname.match(ARCGIS_TILE_PATH_RE);
  if (!match) return null;
  const [, z, y, x] = match;

  const searchParams = new URLSearchParams();
  if (preferOffline) {
    searchParams.set("cachedOnly", "1");
  }

  const baseUrl = normalizeBaseUrl(TILE_SERVER_URL);
  const query = searchParams.toString();
  return `${baseUrl}/${z}/${x}/${y}${query ? `?${query}` : ""}`;
}

function buildNodeResourceUrl(url: URL): string {
  const searchParams = new URLSearchParams({ url: url.toString() });
  if (preferOffline) {
    searchParams.set("cachedOnly", "1");
  }

  const baseUrl = normalizeBaseUrl(TILE_SERVER_URL);
  return `${baseUrl}/resource?${searchParams.toString()}`;
}

function arcgisTileCacheKey(url: URL): string {
  return `https://${ARCGIS_TILE_CACHE_HOST}${url.pathname}`;
}

function arcgisResourceCacheKey(url: URL): string {
  const normalized = new URL(url.toString());
  normalized.searchParams.delete("token");
  normalized.searchParams.sort();
  return normalized.toString();
}

async function getCachedResponse(
  cacheName: string,
  cacheKey: string,
): Promise<Response | undefined> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(cacheKey);
  return cached ?? undefined;
}

async function putCachedResponse(
  cacheName: string,
  cacheKey: string,
  response: Response,
): Promise<void> {
  if (!response.ok) return;
  if (cacheName === TILE_CACHE_NAME) {
    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.startsWith("image/")) return;
  }
  const cache = await caches.open(cacheName);
  await cache.put(cacheKey, response.clone());
}

async function fetchWithTimeout(request: Request, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = self.setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(request, { signal: controller.signal });
  } finally {
    self.clearTimeout(timeoutId);
  }
}

async function cacheOnly(cacheName: string, cacheKey: string): Promise<Response> {
  const cached = await getCachedResponse(cacheName, cacheKey);
  if (cached) return cached;

  return new Response("Resource not cached", {
    status: 404,
    statusText: "Not Cached",
  });
}

async function networkFirst(
  request: Request,
  cacheName: string,
  cacheKey: string,
  kind: "tile" | "resource",
  timeoutMs?: number,
): Promise<Response> {
  try {
    const response =
      timeoutMs === undefined ? await fetch(request) : await fetchWithTimeout(request, timeoutMs);
    await putCachedResponse(cacheName, cacheKey, response);
    return response;
  } catch {
    const cached = await getCachedResponse(cacheName, cacheKey);
    if (cached) return cached;
    return gatewayTimeoutResponse(kind, request.url, "network-timeout-or-cache-miss");
  }
}

async function handleArcgisTileRequest(request: Request, url: URL): Promise<Response> {
  const cacheKey = arcgisTileCacheKey(url);

  if (offlineTileBackend === "node") {
    return handleNodeTileRequest(request, url, cacheKey);
  }

  if (preferOffline) {
    return cacheOnly(TILE_CACHE_NAME, cacheKey);
  }

  return networkFirst(request, TILE_CACHE_NAME, cacheKey, "tile", NETWORK_TIMEOUT_MS);
}

async function handleNodeTileRequest(
  request: Request,
  url: URL,
  cacheKey: string,
): Promise<Response> {
  const nodeUrl = buildNodeTileUrl(url);
  if (!nodeUrl) return fetch(request);

  if (preferOffline) {
    const cached = await getCachedResponse(TILE_CACHE_NAME, cacheKey);
    if (cached) return cached;

    try {
      const response = await fetchWithTimeout(
        new Request(nodeUrl, { method: "GET" }),
        NETWORK_TIMEOUT_MS,
      );
      await putCachedResponse(TILE_CACHE_NAME, cacheKey, response);
      return response;
    } catch {
      return cacheOnly(TILE_CACHE_NAME, cacheKey);
    }
  }

  const nodeRequest = new Request(nodeUrl, { method: "GET" });

  try {
    const response = await fetchWithTimeout(nodeRequest, NETWORK_TIMEOUT_MS);
    await putCachedResponse(TILE_CACHE_NAME, cacheKey, response);

    const cached = await getCachedResponse(TILE_CACHE_NAME, cacheKey);
    if (cached) return cached;
    return response;
  } catch {
    const cached = await getCachedResponse(TILE_CACHE_NAME, cacheKey);
    if (cached) return cached;
    return networkFirst(request, TILE_CACHE_NAME, cacheKey, "tile", NETWORK_TIMEOUT_MS);
  }
}

async function handleArcgisResourceRequest(request: Request, url: URL): Promise<Response> {
  const cacheKey = arcgisResourceCacheKey(url);

  if (offlineTileBackend === "node") {
    return handleNodeResourceRequest(request, url, cacheKey);
  }

  if (preferOffline) {
    return cacheOnly(RESOURCE_CACHE_NAME, cacheKey);
  }

  return networkFirst(request, RESOURCE_CACHE_NAME, cacheKey, "resource");
}

async function handleNodeResourceRequest(
  request: Request,
  url: URL,
  cacheKey: string,
): Promise<Response> {
  const proxyRequest = new Request(buildNodeResourceUrl(url), { method: "GET" });

  if (preferOffline) {
    const cached = await getCachedResponse(RESOURCE_CACHE_NAME, cacheKey);
    if (cached) return cached;

    try {
      const response = await fetchWithTimeout(proxyRequest, NETWORK_TIMEOUT_MS);
      await putCachedResponse(RESOURCE_CACHE_NAME, cacheKey, response);
      return response;
    } catch {
      return cacheOnly(RESOURCE_CACHE_NAME, cacheKey);
    }
  }

  try {
    const response = await fetchWithTimeout(proxyRequest, NETWORK_TIMEOUT_MS);
    await putCachedResponse(RESOURCE_CACHE_NAME, cacheKey, response);

    const cached = await getCachedResponse(RESOURCE_CACHE_NAME, cacheKey);
    if (cached) return cached;
    return response;
  } catch {
    const cached = await getCachedResponse(RESOURCE_CACHE_NAME, cacheKey);
    if (cached) return cached;
    return networkFirst(request, RESOURCE_CACHE_NAME, cacheKey, "resource");
  }
}
