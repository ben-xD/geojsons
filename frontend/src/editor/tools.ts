import {
  DrawRectangleMode,
  ViewMode,
  DrawEllipseByBoundingBoxMode,
  DrawLineStringMode,
  DrawPolygonByDraggingMode,
  DrawPolygonMode,
  DrawPointMode,
  ModifyMode,
} from "@deck.gl-community/editable-layers";
import { DrawLineStringByDraggingMode } from "@/editor/CustomEditModes/DrawLineStringByDragging";
import { DrawCircleByDiameterNoTooltips } from "@/editor/CustomEditModes/DrawCircleByDiameterNoTooltips";
import { ImmediateDragTransformMode } from "@/editor/CustomEditModes/ImmediateDragTransformMode";

export const Tool = {
  select: "select",
  edit: "edit",
  rectangle: "rectangle",
  circle: "circle",
  ellipse: "ellipse",
  marker: "marker",
  catMarker: "catMarker",
  polygon: "polygon",
  drawPolygonByDragging: "drawPolygonByDragging",
  pencil: "pencil",
  line: "line",
  boxSelect: "boxSelect",
} as const;

export type Tool = keyof typeof Tool;

export const toolsWithCrosshairCursor = new Set<Tool>([
  Tool.rectangle,
  Tool.circle,
  Tool.ellipse,
  Tool.marker,
  Tool.catMarker,
  Tool.polygon,
  Tool.drawPolygonByDragging,
  Tool.pencil,
  Tool.line,
]);

export interface ToolConfig {
  tooltipText: string;
  keys: string[];
}

export const toolToConfig: Partial<Record<Tool, ToolConfig>> = {
  select: {
    tooltipText: "Select · V",
    keys: ["v"],
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
  boxSelect: {
    tooltipText: "Box Select · B",
    keys: ["b"],
  },
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const getEditModeForTool = (tool: Tool): any => {
  switch (tool) {
    case Tool.select:
      return ImmediateDragTransformMode;
    case Tool.edit:
      return ModifyMode;
    case Tool.rectangle:
      return DrawRectangleMode;
    case Tool.circle:
      return DrawCircleByDiameterNoTooltips;
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
    case Tool.boxSelect:
      return ViewMode;
    default:
      tool satisfies never;
  }
  return ViewMode;
};
