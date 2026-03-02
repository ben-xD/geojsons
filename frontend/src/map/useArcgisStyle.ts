import { useEffect, useState } from "react";
// @ts-expect-error no type declarations for @esri/maplibre-arcgis
import { BasemapStyle } from "@esri/maplibre-arcgis";
import { env } from "@/env";
import type { MapStyleConfig } from "@/map/mapStyles";
import type { StyleSpecification } from "maplibre-gl";

const MAPLIBRE_SUPPORTED_LAYER_TYPES = new Set([
  "background",
  "fill",
  "line",
  "symbol",
  "raster",
  "circle",
  "fill-extrusion",
  "heatmap",
  "hillshade",
]);

/**
 * Loads ArcGIS basemap styles via @esri/maplibre-arcgis and strips layer types
 * that MapLibre GL doesn't support (e.g. "model" from Mapbox GL v2+).
 *
 * Returns the style object for ArcGIS configs, or undefined for other providers
 * (signaling that `mapStyleConfig.url` should be used instead).
 */
export function useArcgisStyle(config: MapStyleConfig): StyleSpecification | undefined {
  const [style, setStyle] = useState<StyleSpecification>();

  useEffect(() => {
    if (config.provider !== "arcgis" || !config.arcgisStylePath) {
      setStyle(undefined);
      return;
    }

    // Don't clear state between ArcGIS variants to avoid a blank flash
    let cancelled = false;

    const bs = new BasemapStyle({
      style: config.arcgisStylePath,
      token: env.VITE_ARCGIS_API_KEY,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    bs.loadStyle()
      .then((loaded: any) => {
        if (cancelled || !loaded) return;
        // Strip layer types MapLibre doesn't support (e.g. "model" from Mapbox GL v2+)
        const removed = loaded.layers.filter(
          (layer: { type: string }) => !MAPLIBRE_SUPPORTED_LAYER_TYPES.has(layer.type),
        );
        if (removed.length > 0) {
          console.warn(
            "[useArcgisStyle] Stripped unsupported layer types:",
            removed.map((l: { id: string; type: string }) => `${l.id} (${l.type})`),
          );
        }
        loaded.layers = loaded.layers.filter((layer: { type: string }) =>
          MAPLIBRE_SUPPORTED_LAYER_TYPES.has(layer.type),
        );
        setStyle(loaded as StyleSpecification);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        console.warn("[useArcgisStyle] Failed to load ArcGIS style", error);
      });

    return () => {
      cancelled = true;
    };
  }, [config.id, config.provider, config.arcgisStylePath]);

  return style;
}
