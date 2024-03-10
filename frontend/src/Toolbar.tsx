import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Tool, toolToConfig } from "./editor/tools";
import {
  MousePointer,
  MousePointerClick,
  Square,
  Circle,
  Hand,
  MapPin,
  Cat,
  Undo,
  Redo,
} from "lucide-react";
import { useBoundStore } from "./store/store";
import PolygonIcon from "../src/icons/polygon.svg?react";
import LineStringPencilIcon from "../src/icons/lineStringPencil.svg?react";
import PolygonPencilIcon from "../src/icons/polygonPencil.svg?react";
import LineStringIcon from "../src/icons/linestring.svg?react";
import EllipseIcon from "../src/icons/ellipse.svg?react";
import React from "react";
import { cn } from "@/lib/utils.ts";

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
    tooltipText: "Rectangle",
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
    icon: <EllipseIcon width={24} height={24} />,
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
  [Tool.line]: {
    tooltipText: "Line · L",
    icon: <LineStringIcon width={24} height={24} />,
    tool: Tool.line,
  },
  [Tool.pencil]: {
    tooltipText: "Pencil · P",
    icon: <LineStringPencilIcon width={24} height={24} />,
    tool: Tool.pencil,
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
    <div className="absolute text-slate-700 bottom-4 flex justify-center rounded-xl bg-white drop-shadow-2xl shadow-xl border border-1 border-slate-300">
      {Object.values(toolButtonPropsByTool).map((tool) => (
        <ToolButton key={tool.tool} icon={tool.icon} tool={tool.tool} />
      ))}
      <div className="bg-slate-500 w-0.5 my-2 mx-2"></div>
      <UndoButton></UndoButton>
      <RedoButton></RedoButton>
    </div>
  );
};

const UndoButton = () => {
  const undo = useBoundStore.use.undo();
  return (
    <button
      onClick={undo}
      className={cn(
        "p-2 rounded-lg m-1 transition-all ease-in-out hover:bg-blue-100 active:bg-blue-500",
      )}
    >
      <Undo />
    </button>
  );
};
const RedoButton = () => {
  const redo = useBoundStore.use.redo();
  return (
    <button
      onClick={redo}
      className={cn(
        "p-2 rounded-lg m-1 transition-all ease-in-out hover:bg-blue-100 active:bg-blue-500",
      )}
    >
      <Redo />
    </button>
  );
};

function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

const ToolButton = (props: { icon: React.ReactNode; tool: Tool }) => {
  const setTool = useBoundStore.use.setTool();
  const currentTool = useBoundStore.use.tool();
  const isSelected = currentTool === props.tool;
  const tooltipText = toolToConfig[props.tool].tooltipText;

  const onClick = () => setTool(props.tool);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger onClick={onClick}>
          <div
            className={cn(
              "p-2 rounded-lg m-1 transition-all ease-in-out hover:bg-blue-100",
              { "bg-blue-500 text-white hover:bg-blue-600": isSelected },
            )}
          >
            {props.icon}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
