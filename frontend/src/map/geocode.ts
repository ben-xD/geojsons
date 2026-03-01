import { env } from "@/env";
import type { MapProvider } from "./mapStyles";

export interface GeocodingResult {
  name: string;
  longitude: number;
  latitude: number;
  bbox?: [number, number, number, number];
}

interface MaptilerFeature {
  place_name: string;
  center: [number, number];
  bbox?: [number, number, number, number];
}

interface MapboxFeature {
  place_name: string;
  center: [number, number];
  bbox?: [number, number, number, number];
}

async function geocodeMaptiler(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  const url = `https://api.maptiler.com/geocoding/${encodeURIComponent(query)}.json?key=${env.VITE_MAPTILER_API_KEY}&limit=5`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  return (data.features as MaptilerFeature[]).map((f) => ({
    name: f.place_name,
    longitude: f.center[0],
    latitude: f.center[1],
    bbox: f.bbox,
  }));
}

async function geocodeMapbox(
  query: string,
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json?access_token=${env.VITE_MAPBOX_API_KEY}&limit=5`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  return (data.features as MapboxFeature[]).map((f) => ({
    name: f.place_name,
    longitude: f.center[0],
    latitude: f.center[1],
    bbox: f.bbox,
  }));
}

export async function geocode(
  query: string,
  provider: MapProvider,
  signal?: AbortSignal,
): Promise<GeocodingResult[]> {
  if (provider === "maptiler") return geocodeMaptiler(query, signal);
  return geocodeMapbox(query, signal);
}

async function reverseGeocodeMaptiler(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = `https://api.maptiler.com/geocoding/${longitude},${latitude}.json?key=${env.VITE_MAPTILER_API_KEY}&limit=1`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  const features = data.features as MaptilerFeature[] | undefined;
  return features?.[0]?.place_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

async function reverseGeocodeMapbox(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<string> {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${longitude},${latitude}.json?access_token=${env.VITE_MAPBOX_API_KEY}&limit=1`;
  const res = await fetch(url, { signal });
  const data = await res.json();
  const features = data.features as MapboxFeature[] | undefined;
  return features?.[0]?.place_name ?? `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
}

export async function reverseGeocode(
  latitude: number,
  longitude: number,
  provider: MapProvider,
  signal?: AbortSignal,
): Promise<string> {
  try {
    if (provider === "maptiler") return await reverseGeocodeMaptiler(latitude, longitude, signal);
    return await reverseGeocodeMapbox(latitude, longitude, signal);
  } catch {
    return `${latitude.toFixed(5)}, ${longitude.toFixed(5)}`;
  }
}
