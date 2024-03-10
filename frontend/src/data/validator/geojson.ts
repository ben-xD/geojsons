import { z } from "zod";

// We could've gotten types from @types/geojson, but this doesn't provide validators, to check data is valid at runtime.

export const Position = z.union([
  z.tuple([z.number(), z.number()]),
  z.tuple([z.number(), z.number(), z.number()]),
]);
export type Position = z.infer<typeof Position>;

// Geojson actual Position type is less specific: export type Position = number[]; // [number, number] | [number, number, number];
// You can compare them with:
// import {FeatureCollection as GeojsonFeatureCollection, Position as GeojsonPosition} from "geojson";
// const compare: GeojsonFeatureCollection = {} as unknown as FeatureCollection;
// const compare2: FeatureCollection = {} as unknown as GeojsonFeatureCollection;

// Allow the user to choose between coordinates having Position2D or Position3D here
export const Point = z.object({
  type: z.literal("Point"),
  coordinates: Position,
});
export type Point = z.infer<typeof Point>;

export const LineString = z.object({
  type: z.literal("LineString"),
  coordinates: z.array(Position),
});
export type LineString = z.infer<typeof LineString>;

export const Polygon = z.object({
  type: z.literal("Polygon"),
  coordinates: z.array(z.array(Position)), // Array of LinearRings
});
export type Polygon = z.infer<typeof Polygon>;

export const MultiPoint = z.object({
  type: z.literal("MultiPoint"),
  coordinates: z.array(Position),
});
export type MultiPoint = z.infer<typeof MultiPoint>;

export const MultiLineString = z.object({
  type: z.literal("MultiLineString"),
  coordinates: z.array(z.array(Position)),
});
export type MultiLineString = z.infer<typeof MultiLineString>;

export const MultiPolygon = z.object({
  type: z.literal("MultiPolygon"),
  coordinates: z.array(z.array(z.array(Position))), // Array of Arrays of LinearRings
});
export type MultiPolygon = z.infer<typeof MultiPolygon>;

export const GeometryCollection = z.object({
  type: z.literal("GeometryCollection"),
  geometries: z.array(
    z.union([
      Point,
      LineString,
      Polygon,
      MultiPoint,
      MultiLineString,
      MultiPolygon,
    ])
  ),
});
export type GeometryCollection = z.infer<typeof GeometryCollection>;

const Geometry = z.union([
  Point,
  LineString,
  Polygon,
  MultiPoint,
  MultiLineString,
  MultiPolygon,
  GeometryCollection,
]);
export type Geometry = z.infer<typeof Geometry>;

export const Feature = z.object({
  type: z.literal("Feature"),
  geometry: Geometry,
  properties: z.record(z.any()), // Simplified, can be any JSON object
  id: z.union([z.string(), z.number()]).optional(),
});
export type Feature = z.infer<typeof Feature>;

export const FeatureCollection = z.object({
  type: z.literal("FeatureCollection"),
  features: Feature.array(),
});
export type FeatureCollection = z.infer<typeof FeatureCollection>;
