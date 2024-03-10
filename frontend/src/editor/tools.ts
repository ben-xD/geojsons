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
  ModifyMode,
} from "@nebula.gl/edit-modes";
import { DrawLineStringByDraggingMode } from "@/editor/CustomNebulaModes/DrawLineStringByDragging";

export const Tool = {
  select: "select",
  edit: "edit",
  hand: "hand",
  rectangle: "rectangle",
  circle: "circle",
  ellipse: "ellipse",
  marker: "marker",
  catMarker: "catMarker",
  polygon: "polygon",
  drawPolygonByDragging: "drawPolygonByDragging",
  pencil: "pencil",
  line: "line",
} as const;

export type Tool = keyof typeof Tool;

export const getNebulaModeForTool = (tool: Tool): typeof GeoJsonEditMode => {
  switch (tool) {
    case Tool.select:
      return TransformMode;
    case Tool.edit:
      return ModifyMode;
    case Tool.rectangle:
      return DrawRectangleMode;
    case Tool.circle:
      return DrawCircleByDiameterMode;
    case Tool.polygon:
      return DrawPolygonMode;
    case Tool.drawPolygonByDragging:
      return DrawPolygonByDraggingMode;
    case Tool.pencil:
      return DrawLineStringByDraggingMode;
    case Tool.line:
      return DrawLineStringMode;
    case Tool.marker:
      return DrawPointMode;
    case Tool.catMarker:
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
