import { env } from "@/env";

export type MapProvider = "maptiler" | "mapbox";
export type MapVariant = "vector" | "satellite";
export type MapStyleId =
  | "maptiler-vector"
  | "maptiler-satellite"
  | "mapbox-vector"
  | "mapbox-satellite";

export interface MapStyleConfig {
  id: MapStyleId;
  label: string;
  provider: MapProvider;
  variant: MapVariant;
  url: string;
  terrainSourceUrl: string;
}

const maptilerKey = env.VITE_MAPTILER_API_KEY;
const mapboxKey = env.VITE_MAPBOX_API_KEY;

const mapStyles: Record<MapStyleId, MapStyleConfig> = {
  "maptiler-vector": {
    id: "maptiler-vector",
    label: "Vector",
    provider: "maptiler",
    variant: "vector",
    url: `https://api.maptiler.com/maps/landscape/style.json?key=${maptilerKey}`,
    terrainSourceUrl: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${maptilerKey}`,
  },
  "maptiler-satellite": {
    id: "maptiler-satellite",
    label: "Satellite",
    provider: "maptiler",
    variant: "satellite",
    url: `https://api.maptiler.com/maps/hybrid/style.json?key=${maptilerKey}`,
    terrainSourceUrl: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${maptilerKey}`,
  },
  "mapbox-vector": {
    id: "mapbox-vector",
    label: "Vector",
    provider: "mapbox",
    variant: "vector",
    url: "mapbox://styles/mapbox/streets-v12",
    terrainSourceUrl: `https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/tiles.json?access_token=${mapboxKey}`,
  },
  "mapbox-satellite": {
    id: "mapbox-satellite",
    label: "Satellite",
    provider: "mapbox",
    variant: "satellite",
    url: "mapbox://styles/mapbox/satellite-streets-v12",
    terrainSourceUrl: `https://api.mapbox.com/raster/v1/mapbox.mapbox-terrain-dem-v1/tiles.json?access_token=${mapboxKey}`,
  },
};

export const getMapStyle = (id: MapStyleId): MapStyleConfig => mapStyles[id];

export const mapStylesByProvider: {
  provider: MapProvider;
  label: string;
  styles: MapStyleConfig[];
}[] = [
  {
    provider: "mapbox",
    label: "Mapbox",
    styles: [mapStyles["mapbox-vector"], mapStyles["mapbox-satellite"]],
  },
  {
    provider: "maptiler",
    label: "MapTiler",
    styles: [mapStyles["maptiler-vector"], mapStyles["maptiler-satellite"]],
  },
];
