import { useEffect } from "react";
import { debounce } from "lodash";
import type { ViewState } from "react-map-gl/maplibre";
import { useStoreOriginal } from "../store/store";

// --- Parsing & Formatting ---

export function parseHash(hash: string): Partial<ViewState> | null {
  const match = hash.match(/^#map=([^/]+)\/([^/]+)\/([^/]+)(?:\/([^/]+)\/([^/]+))?$/);
  if (!match) return null;

  const zoom = Number(match[1]);
  const latitude = Number(match[2]);
  const longitude = Number(match[3]);
  const bearing = match[4] !== undefined ? Number(match[4]) : 0;
  const pitch = match[5] !== undefined ? Number(match[5]) : 0;

  if ([zoom, latitude, longitude, bearing, pitch].some(Number.isNaN)) return null;

  return {
    zoom: Math.max(0, Math.min(24, zoom)),
    latitude: Math.max(-90, Math.min(90, latitude)),
    longitude: Math.max(-180, Math.min(180, longitude)),
    bearing: ((((bearing % 360) + 540) % 360) - 180),
    pitch: Math.max(0, Math.min(85, pitch)),
  };
}

export function formatHash(vs: ViewState): string {
  const z = vs.zoom.toFixed(2);
  const lat = vs.latitude.toFixed(5);
  const lng = vs.longitude.toFixed(5);
  const hasBearingOrPitch = Math.round(vs.bearing) !== 0 || Math.round(vs.pitch) !== 0;
  if (hasBearingOrPitch) {
    return `#map=${z}/${lat}/${lng}/${Math.round(vs.bearing)}/${Math.round(vs.pitch)}`;
  }
  return `#map=${z}/${lat}/${lng}`;
}

// --- Pre-render bootstrap ---

export function applyHashToStore(): void {
  const parsed = parseHash(window.location.hash);
  if (!parsed) return;
  const state = useStoreOriginal.getState();
  useStoreOriginal.setState({
    viewState: { ...state.viewState, ...parsed },
  });
}

// --- React hook ---

export function useHashViewState(): void {
  useEffect(() => {
    // Write initial hash if there is none
    if (!window.location.hash.startsWith("#map=")) {
      const vs = useStoreOriginal.getState().viewState;
      history.replaceState(null, "", formatHash(vs));
    }

    let lastHash = window.location.hash;

    const debouncedUpdateHash = debounce((vs: ViewState) => {
      const newHash = formatHash(vs);
      if (newHash !== window.location.hash) {
        lastHash = newHash;
        history.replaceState(null, "", newHash);
      }
    }, 300);

    // Subscribe to store changes (outside React render cycle)
    const unsubscribe = useStoreOriginal.subscribe(
      (state) => state.viewState,
      (viewState) => {
        debouncedUpdateHash(viewState);
      },
    );

    // Listen for manual URL edits
    const onHashChange = () => {
      const currentHash = window.location.hash;
      // Ignore hash changes we caused ourselves
      if (currentHash === lastHash) return;
      lastHash = currentHash;

      const parsed = parseHash(currentHash);
      if (!parsed) return;
      const state = useStoreOriginal.getState();
      useStoreOriginal.setState({
        viewState: { ...state.viewState, ...parsed },
      });
    };

    window.addEventListener("hashchange", onHashChange);

    return () => {
      unsubscribe();
      debouncedUpdateHash.cancel();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
}
