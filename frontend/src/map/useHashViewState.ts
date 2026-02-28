import { useEffect } from "react";
import { debounce } from "lodash";
import type { ViewState } from "react-map-gl/maplibre";
import type { MapStyleId } from "./mapStyles";
import { useStoreOriginal } from "../store/store";

// --- Parsing & Formatting ---

interface HashState {
  viewState: Partial<ViewState>;
  mapStyleId?: MapStyleId;
}

const validMapStyleIds = new Set<string>([
  "maptiler-vector",
  "maptiler-satellite",
  "mapbox-vector",
  "mapbox-satellite",
]);

function parseHashParams(hash: string): Map<string, string> {
  const params = new Map<string, string>();
  // Strip leading #
  const body = hash.startsWith("#") ? hash.slice(1) : hash;
  for (const segment of body.split("&")) {
    const eq = segment.indexOf("=");
    if (eq !== -1) {
      params.set(segment.slice(0, eq), segment.slice(eq + 1));
    }
  }
  return params;
}

export function parseHash(hash: string): HashState | null {
  const params = parseHashParams(hash);
  const mapValue = params.get("map");
  if (!mapValue) return null;

  const parts = mapValue.split("/");
  if (parts.length < 3) return null;

  const zoom = Number(parts[0]);
  const latitude = Number(parts[1]);
  const longitude = Number(parts[2]);
  const bearing = parts[3] !== undefined ? Number(parts[3]) : 0;
  const pitch = parts[4] !== undefined ? Number(parts[4]) : 0;

  if ([zoom, latitude, longitude, bearing, pitch].some(Number.isNaN)) return null;

  const styleValue = params.get("style");
  const mapStyleId = styleValue && validMapStyleIds.has(styleValue)
    ? (styleValue as MapStyleId)
    : undefined;

  return {
    viewState: {
      zoom: Math.max(0, Math.min(24, zoom)),
      latitude: Math.max(-90, Math.min(90, latitude)),
      longitude: Math.max(-180, Math.min(180, longitude)),
      bearing: ((((bearing % 360) + 540) % 360) - 180),
      pitch: Math.max(0, Math.min(85, pitch)),
    },
    mapStyleId,
  };
}

export function formatHash(vs: ViewState, mapStyleId: MapStyleId): string {
  const z = vs.zoom.toFixed(2);
  const lat = vs.latitude.toFixed(5);
  const lng = vs.longitude.toFixed(5);
  const hasBearingOrPitch = Math.round(vs.bearing) !== 0 || Math.round(vs.pitch) !== 0;
  const mapPart = hasBearingOrPitch
    ? `map=${z}/${lat}/${lng}/${Math.round(vs.bearing)}/${Math.round(vs.pitch)}`
    : `map=${z}/${lat}/${lng}`;
  return `#${mapPart}&style=${mapStyleId}`;
}

// --- Pre-render bootstrap ---

export function applyHashToStore(): void {
  const parsed = parseHash(window.location.hash);
  if (!parsed) return;
  const state = useStoreOriginal.getState();
  useStoreOriginal.setState({
    viewState: { ...state.viewState, ...parsed.viewState },
    ...(parsed.mapStyleId && { mapStyleId: parsed.mapStyleId }),
  });
}

// --- React hook ---

export function useHashViewState(): void {
  useEffect(() => {
    // Write initial hash if there is none
    if (!parseHashParams(window.location.hash).has("map")) {
      const { viewState, mapStyleId } = useStoreOriginal.getState();
      history.replaceState(null, "", formatHash(viewState, mapStyleId));
    }

    let lastHash = window.location.hash;

    const debouncedUpdateHash = debounce((vs: ViewState, styleId: MapStyleId) => {
      const newHash = formatHash(vs, styleId);
      if (newHash !== window.location.hash) {
        lastHash = newHash;
        history.replaceState(null, "", newHash);
      }
    }, 300);

    // Subscribe to store changes (outside React render cycle)
    const unsubViewState = useStoreOriginal.subscribe(
      (state) => state.viewState,
      (viewState) => {
        debouncedUpdateHash(viewState, useStoreOriginal.getState().mapStyleId);
      },
    );

    const unsubMapStyle = useStoreOriginal.subscribe(
      (state) => state.mapStyleId,
      (mapStyleId) => {
        // Update hash immediately when style changes (no need to debounce)
        const vs = useStoreOriginal.getState().viewState;
        const newHash = formatHash(vs, mapStyleId);
        if (newHash !== window.location.hash) {
          lastHash = newHash;
          history.replaceState(null, "", newHash);
        }
      },
    );

    // Listen for manual URL edits
    const onHashChange = () => {
      const currentHash = window.location.hash;
      if (currentHash === lastHash) return;
      lastHash = currentHash;

      const parsed = parseHash(currentHash);
      if (!parsed) return;
      const state = useStoreOriginal.getState();
      useStoreOriginal.setState({
        viewState: { ...state.viewState, ...parsed.viewState },
        ...(parsed.mapStyleId && { mapStyleId: parsed.mapStyleId }),
      });
    };

    window.addEventListener("hashchange", onHashChange);

    return () => {
      unsubViewState();
      unsubMapStyle();
      debouncedUpdateHash.cancel();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
}
