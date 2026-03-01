import type { Feature, Geometry, Position } from "@/data/validator/geojson";

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

export function getFeatureCenter(feature: Feature): [number, number] | null {
  const coords = collectCoordinates(feature.geometry);
  if (coords.length === 0) return null;
  const lng = coords.reduce((s, c) => s + c[0], 0) / coords.length;
  const lat = coords.reduce((s, c) => s + c[1], 0) / coords.length;
  return [lng, lat];
}
