import * as v from "valibot";

// We could've gotten types from @types/geojson, but this doesn't provide validators, to check data is valid at runtime.

export const Position = v.union([
  v.tuple([v.number(), v.number()]),
  v.tuple([v.number(), v.number(), v.number()]),
]);
export type Position = v.InferOutput<typeof Position>;

// Geojson actual Position type is less specific: export type Position = number[]; // [number, number] | [number, number, number];
// You can compare them with:
// import {FeatureCollection as GeojsonFeatureCollection, Position as GeojsonPosition} from "geojson";
// const compare: GeojsonFeatureCollection = {} as unknown as FeatureCollection;
// const compare2: FeatureCollection = {} as unknown as GeojsonFeatureCollection;

// Allow the user to choose between coordinates having Position2D or Position3D here
export const Point = v.object({
  type: v.literal("Point"),
  coordinates: Position,
});
export type Point = v.InferOutput<typeof Point>;

export const LineString = v.object({
  type: v.literal("LineString"),
  coordinates: v.array(Position),
});
export type LineString = v.InferOutput<typeof LineString>;

export const Polygon = v.object({
  type: v.literal("Polygon"),
  coordinates: v.array(v.array(Position)), // Array of LinearRings
});
export type Polygon = v.InferOutput<typeof Polygon>;

export const MultiPoint = v.object({
  type: v.literal("MultiPoint"),
  coordinates: v.array(Position),
});
export type MultiPoint = v.InferOutput<typeof MultiPoint>;

export const MultiLineString = v.object({
  type: v.literal("MultiLineString"),
  coordinates: v.array(v.array(Position)),
});
export type MultiLineString = v.InferOutput<typeof MultiLineString>;

export const MultiPolygon = v.object({
  type: v.literal("MultiPolygon"),
  coordinates: v.array(v.array(v.array(Position))), // Array of Arrays of LinearRings
});
export type MultiPolygon = v.InferOutput<typeof MultiPolygon>;

export const GeometryCollection = v.object({
  type: v.literal("GeometryCollection"),
  geometries: v.array(
    v.union([Point, LineString, Polygon, MultiPoint, MultiLineString, MultiPolygon]),
  ),
});
export type GeometryCollection = v.InferOutput<typeof GeometryCollection>;

const Geometry = v.union([
  Point,
  LineString,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryCollection,
]);
export type Geometry = v.InferOutput<typeof Geometry>;

export const Feature = v.object({
  type: v.literal("Feature"),
  geometry: Geometry,
  properties: v.record(v.string(), v.any()), // Simplified, can be any JSON object
  id: v.optional(v.union([v.string(), v.number()])),
});
export type Feature = v.InferOutput<typeof Feature>;

export const FeatureCollection = v.object({
  type: v.literal("FeatureCollection"),
  features: v.array(Feature),
});
export type FeatureCollection = v.InferOutput<typeof FeatureCollection>;
