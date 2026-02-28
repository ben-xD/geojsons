import maplibregl from "maplibre-gl";
import { env } from "@/env";

// Properties in Mapbox API style responses that aren't in the MapLibre style spec.
const MAPBOX_STYLE_METADATA_KEYS = new Set([
  "name", "created", "modified", "owner", "id", "draft", "visibility",
  "fog", "projection",
]);

/**
 * Transforms `mapbox://` protocol URLs into HTTPS URLs that MapLibre can fetch directly.
 */
function transformMapboxUrl(url: string, accessToken: string): string {
  const tokenParam = `access_token=${accessToken}`;

  // mapbox://styles/mapbox/streets-v12 → style JSON
  if (url.startsWith("mapbox://styles/")) {
    const path = url.replace("mapbox://styles/", "");
    return `https://api.mapbox.com/styles/v1/${path}?${tokenParam}`;
  }

  // mapbox://sprites/mapbox/streets-v12 → sprite sheet
  if (url.startsWith("mapbox://sprites/")) {
    const path = url.replace("mapbox://sprites/", "");
    return `https://api.mapbox.com/styles/v1/${path}/sprite?${tokenParam}`;
  }

  // mapbox://fonts/mapbox/{fontstack}/{range}.pbf → glyphs
  if (url.startsWith("mapbox://fonts/")) {
    const path = url.replace("mapbox://fonts/", "");
    return `https://api.mapbox.com/fonts/v1/${path}?${tokenParam}`;
  }

  // mapbox://tiles/mapbox.mapbox-streets-v8/{z}/{x}/{y}.vector.pbf → vector tiles
  if (url.startsWith("mapbox://tiles/")) {
    const path = url.replace("mapbox://tiles/", "");
    return `https://api.mapbox.com/v4/${path}?${tokenParam}`;
  }

  // mapbox://mapbox.mapbox-streets-v8 or composite tilesets → TileJSON
  if (url.startsWith("mapbox://")) {
    const tilesetIds = url.replace("mapbox://", "");
    return `https://api.mapbox.com/v4/${tilesetIds}.json?${tokenParam}`;
  }

  return url;
}

function isStyleRequest(url: string): boolean {
  return url.startsWith("mapbox://styles/");
}

let registered = false;

/**
 * Registers a `mapbox://` protocol handler with MapLibre GL, enabling MapLibre to load
 * Mapbox styles without needing the mapbox-gl library.
 *
 * Style requests (`mapbox://styles/...`) are fetched, cleaned of non-standard metadata,
 * and returned as JSON. All other mapbox:// resources (tiles, sprites, glyphs) are
 * fetched and returned as-is.
 *
 * Call once at app startup before any Map component renders.
 */
export function registerMapboxProtocol(): void {
  if (registered) return;
  registered = true;

  const accessToken = env.VITE_MAPBOX_API_KEY;

  maplibregl.addProtocol("mapbox", async (params, abortController) => {
    const transformedUrl = transformMapboxUrl(params.url, accessToken);
    const response = await fetch(transformedUrl, {
      signal: abortController.signal,
    });

    if (!response.ok) {
      throw new Error(`Mapbox resource fetch failed: ${response.status} ${response.statusText}`);
    }

    if (params.type === "json") {
      const data = await response.json();

      // Strip Mapbox API metadata that MapLibre's strict validator rejects
      if (isStyleRequest(params.url)) {
        for (const key of MAPBOX_STYLE_METADATA_KEYS) {
          delete data[key];
        }
      }

      // Mapbox TileJSON responses return http:// tile URLs, which browsers block
      // as mixed content when the page is served over HTTPS.
      if (Array.isArray(data.tiles)) {
        data.tiles = data.tiles.map((url: string) => url.replace("http://", "https://"));
      }

      return { data };
    }

    const data = await response.arrayBuffer();
    return { data };
  });
}
