import { env } from "@/env";

export type MapProvider = "maptiler" | "mapbox" | "arcgis";
export type MapVariant = "vector" | "satellite";
export type MapStyleId =
  | "maptiler-vector"
  | "maptiler-satellite"
  | "mapbox-vector"
  | "mapbox-satellite"
  | "arcgis-vector"
  | "arcgis-satellite";

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
const arcgisKey = env.VITE_ARCGIS_API_KEY;

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
  "arcgis-vector": {
    id: "arcgis-vector",
    label: "Vector",
    provider: "arcgis",
    variant: "vector",
    url: `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/streets?token=${arcgisKey}`,
    terrainSourceUrl: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${maptilerKey}`,
  },
  "arcgis-satellite": {
    id: "arcgis-satellite",
    label: "Satellite",
    provider: "arcgis",
    variant: "satellite",
    url: `https://basemapstyles-api.arcgis.com/arcgis/rest/services/styles/v2/styles/arcgis/imagery/standard?token=${arcgisKey}`,
    terrainSourceUrl: `https://api.maptiler.com/tiles/terrain-rgb/tiles.json?key=${maptilerKey}`,
  },
};

export const getMapStyle = (id: MapStyleId): MapStyleConfig => mapStyles[id];

export const mapStylesByProvider: {
  provider: MapProvider;
  label: string;
  styles: MapStyleConfig[];
  notRecommended?: string;
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
    notRecommended: "Low resolution satellite imagery, bad customer support",
  },
  {
    provider: "arcgis",
    label: "ArcGIS",
    styles: [mapStyles["arcgis-vector"], mapStyles["arcgis-satellite"]],
  },
];
