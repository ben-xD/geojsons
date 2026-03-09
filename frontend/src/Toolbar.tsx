import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Tool, toolToConfig } from "./editor/tools";
import {
  MousePointer,
  Square,
  Circle,
  MapPin,
  Cat,
  Undo,
  Redo,
  Search,
  SquareDashed,
  Sun,
  Moon,
  Monitor,
} from "lucide-react";
import { useStore, useUndoStackSize } from "./store/store";
import { useTheme } from "@/components/theme-provider";
import PolygonIcon from "../src/icons/polygon.svg?react";
import LineStringPencilIcon from "../src/icons/lineStringPencil.svg?react";
import PolygonPencilIcon from "../src/icons/polygonPencil.svg?react";
import LineStringIcon from "../src/icons/linestring.svg?react";
import EllipseIcon from "../src/icons/ellipse.svg?react";
import posthog from "posthog-js";
import React, { useState } from "react";
import { cn } from "@/lib/utils.ts";
import { useRedoStackSize } from "@/store/store";
import { SearchBar } from "@/map/SearchBar";

interface ToolButtonProps {
  tooltipText: string;
  icon: React.ReactNode;
  tool: Tool;
}

// SHow highlighted tool
// TODO avoid inconsistent keyboard shortcuts
// TODO size different map icons differently
const toolButtonPropsByTool: Partial<Record<Tool, ToolButtonProps>> = {
  [Tool.select]: {
    tooltipText: "Select · V",
    icon: <MousePointer />,
    tool: Tool.select,
  },
  [Tool.boxSelect]: {
    tooltipText: "Box Select · B",
    icon: <SquareDashed />,
    tool: Tool.boxSelect,
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
  const [searchOpen, setSearchOpen] = useState(false);

  return (
    <div className="left-0 right-0 mx-2 absolute text-foreground bottom-2 flex justify-center pointer-events-none">
      <div className="relative max-w-full pointer-events-auto">
        <SearchBar open={searchOpen} onClose={() => setSearchOpen(false)} />
        <div className="flex flex-nowrap overflow-x-auto scrollbar-hide md:flex-wrap md:overflow-x-visible rounded-xl bg-card drop-shadow-2xl shadow-xl border border-border max-w-full [&>*]:shrink-0">
          <ToolbarButton
            icon={<Search />}
            tooltipText="Search · /"
            onClick={() => setSearchOpen((prev) => !prev)}
          />
          <div className="bg-border w-0.5 my-2"></div>
          {Object.values(toolButtonPropsByTool).map((tool) => (
            <ToolbarToolButton key={tool.tool} icon={tool.icon} tool={tool.tool} />
          ))}
          <div className="bg-border w-0.5 my-2"></div>
          <UndoButton></UndoButton>
          <RedoButton></RedoButton>
          <div className="bg-border w-0.5 my-2"></div>
          <ThemeToggleButton />
        </div>
      </div>
    </div>
  );
};

const isMacDevice = navigator.userAgent.includes("Macintosh");
const metaKey = isMacDevice ? "Cmd" : "Ctrl";

const UndoButton = () => {
  const undo = useStore.use.undo();
  const canUndo = useUndoStackSize() !== 0;
  return (
    <ToolbarButton
      disabled={!canUndo}
      icon={<Undo />}
      tooltipText={`Undo · ${metaKey} + Z`}
      onClick={() => undo()}
    />
  );
};
const RedoButton = () => {
  const redo = useStore.use.redo();
  const canRedo = useRedoStackSize() !== 0;
  return (
    <ToolbarButton
      disabled={!canRedo}
      icon={<Redo />}
      tooltipText={`Redo · ${metaKey} + Shift + Z`}
      onClick={() => redo()}
    />
  );
};

const ToolbarToolButton = (props: { icon: React.ReactNode; tool: Tool }) => {
  const setTool = useStore.use.setTool();
  const editLocked = useStore.use.editLocked();
  const isViewOnly = props.tool !== Tool.select && props.tool !== Tool.boxSelect;
  const onClick = () => {
    posthog.capture("tool_selected", { tool: props.tool });
    setTool(props.tool);
  };
  const tooltipText = toolToConfig[props.tool]?.tooltipText ?? props.tool;
  const currentTool = useStore.use.tool();
  const isSelected = currentTool === props.tool;

  return (
    <ToolbarButton
      disabled={editLocked && isViewOnly}
      className={cn({
        "bg-primary text-primary-foreground hover:bg-primary/90": isSelected,
      })}
      onClick={onClick}
      icon={props.icon}
      tooltipText={tooltipText}
    />
  );
};

const themeOrder = ["light", "dark", "system"] as const;
const themeIcon = { light: <Sun />, dark: <Moon />, system: <Monitor /> };
const themeLabel = { light: "Light", dark: "Dark", system: "System" };

const ThemeToggleButton = () => {
  const { theme, setTheme } = useTheme();
  const next = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];

  return (
    <ToolbarButton
      icon={themeIcon[theme]}
      tooltipText={`${themeLabel[theme]} · Switch to ${themeLabel[next]}`}
      onClick={() => {
        posthog.capture("theme_changed", { theme: next });
        setTheme(next);
      }}
    />
  );
};

const ToolbarButton = (props: {
  icon: React.ReactNode;
  onClick: () => void;
  tooltipText: string;
  disabled?: boolean;
  className?: string;
}) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger onClick={props.onClick} asChild>
          <button
            disabled={props.disabled}
            className={cn(
              props.className,
              "p-2 rounded-lg m-1 transition-all ease-in-out hover:enabled:bg-primary/10 active:enabled:bg-primary active:enabled:text-primary-foreground disabled:text-muted-foreground/50",
            )}
          >
            {props.icon}
          </button>
        </TooltipTrigger>
        <TooltipContent>
          <p>{props.tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
