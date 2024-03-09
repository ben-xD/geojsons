import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tool } from "./editor/tools";
import {
  MousePointer,
  MousePointerClick,
  Square,
  Circle,
  Hand,
  Pencil,
  MapPin, Cat,
} from "lucide-react";
import { useBoundStore } from "./store/store";
import PolygonIcon from "../src/icons/polygon.svg?react";
import PolygonPencilIcon from "../src/icons/polygonPencil.svg?react";
import LineStringIcon from "../src/icons/linestring.svg?react";
import EllipseIcon from "../src/icons/ellipse.svg?react";
import React from "react";
import {cn} from "@/lib/utils.ts";

interface ToolButtonProps {
  tooltipText: string;
  icon: React.ReactNode;
  tool: Tool;
}

// SHow highlighted tool
// TODO avoid inconsistent keyboard shortcuts
// TODO size different map icons differently
const toolButtonPropsByTool: Record<Tool, ToolButtonProps> = {
  [Tool.select]: {
    tooltipText: "Select · V",
    icon: <MousePointer />,
    tool: Tool.select,
  },
  [Tool.edit]: {
    tooltipText: "Edit · E",
    icon: <MousePointerClick />,
    tool: Tool.edit,
  },
  [Tool.hand]: {
    tooltipText: "Hand · H or hold spacebar",
    icon: <Hand />,
    tool: Tool.hand,
  },
  [Tool.rectangle]: {
    tooltipText: "Rectangle · R",
    icon: <Square />,
    tool: Tool.rectangle,
  },
  [Tool.circle]: {
    tooltipText: "Circle · R",
    icon: <Circle />,
    tool: Tool.circle,
  },
  [Tool.ellipse]: {
    tooltipText: "Ellipse · Shift + O",
    icon: <EllipseIcon width={24} height={24}/>,
    tool: Tool.ellipse,
  },
  [Tool.polygon]: {
    tooltipText: "Polygon · G",
    icon: <PolygonIcon width={24} height={24} />,
    tool: Tool.polygon,
  },
  [Tool.drawPolygonByDragging]: {
    tooltipText: "Draw Polygon by Dragging · D",
    icon: <PolygonPencilIcon width={24} height={24} />,
    tool: Tool.drawPolygonByDragging,
  },
  [Tool.pencil]: {
    tooltipText: "Pencil · P",
    icon: <Pencil />,
    tool: Tool.pencil,
  },
  [Tool.line]: {
    tooltipText: "Line · L",
    icon: <LineStringIcon width={24} height={24} />,
    tool: Tool.line,
  },
  [Tool.marker]: {
    tooltipText: "Marker · M",
    icon: <MapPin />,
    tool: Tool.marker,
  },
  [Tool.catMarker]: {
    tooltipText: "Cat · C",
    icon: <Cat />,
    tool: Tool.catMarker,
  },
};

export const Toolbar = () => {
  return (
    <div className="absolute bottom-4 flex justify-center rounded-xl bg-white drop-shadow-2xl shadow-xl border border-1 border-slate-300">
      {Object.values(toolButtonPropsByTool).map((tool) => (
        <ToolView
          key={tool.tool}
          icon={tool.icon}
          tooltipText={tool.tooltipText}
          tool={tool.tool}
        />
      ))}
    </div>
  );
};

const ToolView = (props: {
  icon: React.ReactNode;
  tooltipText: string;
  tool: Tool;
}) => {
  const setTool = useBoundStore.use.setTool();
  const tool = useBoundStore.use.tool();
  const isSelected = tool === props.tool;

  const onClick = () => setTool(props.tool);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger onClick={onClick} className="text-slate-700">
          <div className={cn("p-2 rounded-lg m-1 transition-all ease-in-out", {"bg-blue-500 text-white": isSelected})}>{props.icon}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{props.tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
