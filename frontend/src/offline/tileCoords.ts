export interface TileCoord {
  z: number;
  x: number;
  y: number;
}

export function lngLatToTile(lng: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const x = Math.floor(((lng + 180) / 360) * n);
  const latRad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n);
  return { x: Math.max(0, Math.min(n - 1, x)), y: Math.max(0, Math.min(n - 1, y)) };
}

export function bboxFromPolygon(polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon): [number, number, number, number] {
  const coords = polygon.type === "MultiPolygon"
    ? polygon.coordinates.flat(2)
    : polygon.coordinates.flat();
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    if (lng < minLng) minLng = lng;
    if (lat < minLat) minLat = lat;
    if (lng > maxLng) maxLng = lng;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLng, minLat, maxLng, maxLat];
}

export function getTilesForBbox(bbox: [number, number, number, number], zoomRange: [number, number]): TileCoord[] {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  const tiles: TileCoord[] = [];
  for (let z = zoomRange[0]; z <= zoomRange[1]; z++) {
    const topLeft = lngLatToTile(minLng, maxLat, z);
    const bottomRight = lngLatToTile(maxLng, minLat, z);
    for (let x = topLeft.x; x <= bottomRight.x; x++) {
      for (let y = topLeft.y; y <= bottomRight.y; y++) {
        tiles.push({ z, x, y });
      }
    }
  }
  return tiles;
}

const RAD = Math.PI / 180;
const EARTH_R_KM = 6371;

/** Geodesic area of a single ring in km² (trapezoidal spherical approximation). */
function ringArea(ring: number[][]): number {
  let total = 0;
  for (let i = 0, len = ring.length; i < len; i++) {
    const [lng1, lat1] = ring[i];
    const [lng2, lat2] = ring[(i + 1) % len];
    total += (lng2 - lng1) * RAD * (2 + Math.sin(lat1 * RAD) + Math.sin(lat2 * RAD));
  }
  return Math.abs((total * EARTH_R_KM * EARTH_R_KM) / 2);
}

/** Geodesic area of a Polygon or MultiPolygon in km². Holes are subtracted. */
export function polygonAreaKm2(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  const polys = geometry.type === "MultiPolygon" ? geometry.coordinates : [geometry.coordinates];
  let area = 0;
  for (const rings of polys) {
    area += ringArea(rings[0]); // outer ring
    for (let i = 1; i < rings.length; i++) {
      area -= ringArea(rings[i]); // holes
    }
  }
  return area;
}

export function estimateTileCount(bbox: [number, number, number, number], zoomRange: [number, number]): number {
  const [minLng, minLat, maxLng, maxLat] = bbox;
  let count = 0;
  for (let z = zoomRange[0]; z <= zoomRange[1]; z++) {
    const topLeft = lngLatToTile(minLng, maxLat, z);
    const bottomRight = lngLatToTile(maxLng, minLat, z);
    count += (bottomRight.x - topLeft.x + 1) * (bottomRight.y - topLeft.y + 1);
  }
  return count;
}
