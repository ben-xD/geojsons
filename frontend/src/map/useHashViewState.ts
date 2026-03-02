import { useEffect } from "react";
import { debounce } from "lodash";
import type { ViewState } from "react-map-gl/maplibre";
import type { MapStyleId } from "./mapStyles";
import { useStoreOriginal } from "../store/store";
import type { BottomPanelTab } from "../store/featureEditorSlice";

// --- Parsing & Formatting ---

interface HashState {
  viewState: Partial<ViewState>;
  mapStyleId?: MapStyleId;
  locate?: boolean;
  activeTab?: BottomPanelTab;
}

const tabToSlug: Record<BottomPanelTab, string> = {
  "Features": "features",
  "Offline Maps": "offline",
  "GeoJSON": "geojson",
  "Settings": "settings",
};
const slugToTab: Record<string, BottomPanelTab> = Object.fromEntries(
  Object.entries(tabToSlug).map(([k, v]) => [v, k]),
) as Record<string, BottomPanelTab>;

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

  const locate = params.has("locate") ? params.get("locate") !== "0" : undefined;

  const tabValue = params.get("tab");
  const activeTab = tabValue && tabValue in slugToTab ? slugToTab[tabValue] : undefined;

  return {
    viewState: {
      zoom: Math.max(0, Math.min(24, zoom)),
      latitude: Math.max(-90, Math.min(90, latitude)),
      longitude: Math.max(-180, Math.min(180, longitude)),
      bearing: ((((bearing % 360) + 540) % 360) - 180),
      pitch: Math.max(0, Math.min(85, pitch)),
    },
    mapStyleId,
    locate,
    activeTab,
  };
}

export function formatHash(vs: ViewState, mapStyleId: MapStyleId, locate: boolean, activeTab: BottomPanelTab = "GeoJSON"): string {
  const z = vs.zoom.toFixed(2);
  const lat = vs.latitude.toFixed(5);
  const lng = vs.longitude.toFixed(5);
  const hasBearingOrPitch = Math.round(vs.bearing) !== 0 || Math.round(vs.pitch) !== 0;
  const mapPart = hasBearingOrPitch
    ? `map=${z}/${lat}/${lng}/${Math.round(vs.bearing)}/${Math.round(vs.pitch)}`
    : `map=${z}/${lat}/${lng}`;
  const locatePart = locate ? "&locate=1" : "";
  const tabPart = activeTab !== "GeoJSON" ? `&tab=${tabToSlug[activeTab]}` : "";
  return `#${mapPart}&style=${mapStyleId}${locatePart}${tabPart}`;
}

// --- Pre-render bootstrap ---

export function applyHashToStore(): void {
  const parsed = parseHash(window.location.hash);
  if (!parsed) return;
  const state = useStoreOriginal.getState();
  useStoreOriginal.setState({
    viewState: { ...state.viewState, ...parsed.viewState },
    ...(parsed.mapStyleId && { mapStyleId: parsed.mapStyleId }),
    ...(parsed.locate !== undefined && { locate: parsed.locate }),
    ...(parsed.activeTab && { activeTab: parsed.activeTab }),
  });
}

// --- React hook ---

export function useHashViewState(): void {
  useEffect(() => {
    const getHash = () => {
      const { viewState, mapStyleId, locate, activeTab } = useStoreOriginal.getState();
      return formatHash(viewState, mapStyleId, locate, activeTab);
    };

    const updateHash = (newHash: string) => {
      if (newHash !== window.location.hash) {
        lastHash = newHash;
        history.replaceState(null, "", newHash);
      }
    };

    // Write initial hash if there is none
    if (!parseHashParams(window.location.hash).has("map")) {
      history.replaceState(null, "", getHash());
    }

    let lastHash = window.location.hash;

    const debouncedUpdateHash = debounce(() => {
      updateHash(getHash());
    }, 300);

    // Subscribe to store changes (outside React render cycle)
    const unsubViewState = useStoreOriginal.subscribe(
      (state) => state.viewState,
      () => debouncedUpdateHash(),
    );

    const unsubMapStyle = useStoreOriginal.subscribe(
      (state) => state.mapStyleId,
      () => updateHash(getHash()),
    );

    const unsubLocate = useStoreOriginal.subscribe(
      (state) => state.locate,
      () => updateHash(getHash()),
    );

    const unsubActiveTab = useStoreOriginal.subscribe(
      (state) => state.activeTab,
      () => updateHash(getHash()),
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
        ...(parsed.locate !== undefined && { locate: parsed.locate }),
        ...(parsed.activeTab && { activeTab: parsed.activeTab }),
      });
    };

    window.addEventListener("hashchange", onHashChange);

    return () => {
      unsubViewState();
      unsubMapStyle();
      unsubLocate();
      unsubActiveTab();
      debouncedUpdateHash.cancel();
      window.removeEventListener("hashchange", onHashChange);
    };
  }, []);
}
