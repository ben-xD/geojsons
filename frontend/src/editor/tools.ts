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

export interface ToolConfig {
  tooltipText: string;
  keys: string[];
}

export const toolToConfig: Record<Tool, ToolConfig> = {
  select: {
    tooltipText: "Select · V",
    keys: ["v"],
  },
  edit: {
    tooltipText: "Edit · E",
    keys: ["e"],
  },
  hand: {
    tooltipText: "Hand · H",
    keys: ["h"],
  },
  rectangle: {
    tooltipText: "Rectangle · R",
    keys: ["r"],
  },
  circle: {
    tooltipText: "Circle · O",
    keys: ["o"],
  },
  ellipse: {
    tooltipText: "Ellipse · Shift + O",
    keys: ["shift+o"],
  },
  marker: {
    tooltipText: "Marker · M",
    keys: ["m"],
  },
  catMarker: {
    tooltipText: "Cat marker · C",
    keys: ["c"],
  },
  polygon: {
    tooltipText: "Polygon · G",
    keys: ["g"],
  },
  drawPolygonByDragging: {
    tooltipText: "Polygon by dragging · D",
    keys: ["d"],
  },
  pencil: {
    tooltipText: "Pencil · P",
    keys: ["p"],
  },
  line: {
    tooltipText: "Line · L",
    keys: ["l"],
  },
};

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
