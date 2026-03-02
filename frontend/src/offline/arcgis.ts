import { env } from "@/env";

export const ARCGIS_TILE_HOST = "ibasemaps-api.arcgis.com";
export const ARCGIS_TILE_PATH_PREFIX = "/arcgis/rest/services/World_Imagery/MapServer/tile";

export const ARCGIS_RESOURCE_HOSTS = [
  "ibasemaps-api.arcgis.com",
  "basemaps-api.arcgis.com",
  "basemapstyles-api.arcgis.com",
  "static.arcgis.com",
  "www.arcgis.com",
] as const;

export function arcgisTileCacheKeyUrl(z: number, x: number, y: number): string {
  return `https://${ARCGIS_TILE_HOST}${ARCGIS_TILE_PATH_PREFIX}/${z}/${y}/${x}`;
}

export function arcgisTileUrl(z: number, x: number, y: number): string {
  return `${arcgisTileCacheKeyUrl(z, x, y)}?token=${env.VITE_ARCGIS_API_KEY}`;
}
