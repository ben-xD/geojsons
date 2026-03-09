import { FlyToInterpolator, WebMercatorViewport } from "deck.gl";
import { useStore } from "@/store/store";
import type { Feature, Geometry, Position } from "@/data/validator/geojson";

const FIT_BOUNDS_PADDING_RATIO = 0.2;
const TRANSITION_DURATION = 1500;
let flyToTimer: ReturnType<typeof setTimeout> | undefined;

export function flyToBbox(bbox: [number, number, number, number]) {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const viewport = new WebMercatorViewport({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  const padding = Math.round(
    Math.min(window.innerWidth, window.innerHeight) * FIT_BOUNDS_PADDING_RATIO,
  );
  const { longitude, latitude, zoom } = viewport.fitBounds(
    [
      [minLng, minLat],
      [maxLng, maxLat],
    ],
    { padding },
  );
  flyToPoint(latitude, longitude, zoom);
}

export function flyToPoint(latitude: number, longitude: number, zoom = 14) {
  const viewState = useStore.getState().viewState;
  const setViewState = useStore.getState().setViewState;
  setViewState({
    ...viewState,
    latitude,
    longitude,
    zoom,
    transitionDuration: TRANSITION_DURATION,
    transitionInterpolator: new FlyToInterpolator(),
  } as typeof viewState);

  // After the transition, commit the final position without transition
  // properties so the store/hash stay clean and DeckGL won't accidentally
  // re-trigger an old transition on a future re-render.
  clearTimeout(flyToTimer);
  flyToTimer = setTimeout(() => {
    const current = useStore.getState().viewState;
    setViewState({
      longitude: current.longitude,
      latitude: current.latitude,
      zoom: current.zoom,
      bearing: current.bearing,
      pitch: current.pitch,
      padding: current.padding,
    } as typeof current);
  }, TRANSITION_DURATION + 100);
}

function collectCoordinates(geometry: Geometry): Position[] {
  switch (geometry.type) {
    case "Point":
      return [geometry.coordinates];
    case "MultiPoint":
    case "LineString":
      return geometry.coordinates;
    case "MultiLineString":
    case "Polygon":
      return geometry.coordinates.flat();
    case "MultiPolygon":
      return geometry.coordinates.flat(2);
    case "GeometryCollection":
      return geometry.geometries.flatMap(collectCoordinates);
    default: {
      const _exhaustive: never = geometry;
      return _exhaustive;
    }
  }
}

function bboxFromCoordinates(coords: Position[]): [number, number, number, number] {
  let minLng = Infinity,
    minLat = Infinity,
    maxLng = -Infinity,
    maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function flyToFeature(feature: Feature) {
  if (feature.geometry.type === "Point") {
    const [lng, lat] = feature.geometry.coordinates;
    flyToPoint(lat, lng);
    return;
  }
  const coords = collectCoordinates(feature.geometry);
  if (coords.length === 0) return;
  flyToBbox(bboxFromCoordinates(coords));
}
