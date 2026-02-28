import { z } from "zod";

export const envSchema = z.object({
  VITE_MAPTILER_API_KEY: z.string().min(1),
  VITE_MAPBOX_API_KEY: z.string().min(1),
  VITE_ARCGIS_API_KEY: z.string().min(1),
});
