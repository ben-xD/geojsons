import * as v from "valibot";

export const envSchema = v.object({
  VITE_MAPTILER_API_KEY: v.pipe(v.string(), v.minLength(1)),
  VITE_MAPBOX_API_KEY: v.pipe(v.string(), v.minLength(1)),
  VITE_ARCGIS_API_KEY: v.pipe(v.string(), v.minLength(1)),
  VITE_TILE_SERVER_URL: v.optional(v.string(), "http://localhost:3456"),
});
