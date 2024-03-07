import {
  TransformMode,
  DrawRectangleMode,
  DrawCircleByDiameterMode,
  ViewMode,
  DrawEllipseByBoundingBoxMode,
  DrawLineStringMode,
  DrawPolygonByDraggingMode,
  DrawPolygonMode,
  GeoJsonEditMode,
  DrawPointMode,
} from "@nebula.gl/edit-modes";

export const Tool = {
  select: "select",
  polygonSelect: "polygonSelect",
  hand: "hand",
  rectangle: "rectangle",
  circle: "circle",
  ellipse: "ellipse",
  marker: "marker",
  polygon: "polygon",
  pencil: "pencil",
  line: "line",
} as const;

export type Tool = keyof typeof Tool;

export const getNebulaModeForTool = (tool: Tool): typeof GeoJsonEditMode => {
  switch (tool) {
    case Tool.select:
      return TransformMode;
    case Tool.polygonSelect:
      return ViewMode;
    case Tool.rectangle:
      return DrawRectangleMode;
    case Tool.circle:
      return DrawCircleByDiameterMode;
    case Tool.polygon:
      return DrawPolygonMode;
    case Tool.pencil:
      return DrawPolygonByDraggingMode;
    case Tool.line:
      return DrawLineStringMode;
    case Tool.marker:
      return DrawPointMode;
    case Tool.ellipse:
      return DrawEllipseByBoundingBoxMode;
    case Tool.hand:
      return ViewMode;
    default:
      tool satisfies never;
  }
  return ViewMode;
};
