import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDrawPolygon } from "@fortawesome/free-solid-svg-icons";
import { Tool } from "./editor/tools";
import {
  MousePointer,
  MousePointerClick,
  Square,
  Circle,
  Hand,
} from "lucide-react";
import { useBoundStore } from "./store/store";

interface ToolButtonProps {
  tooltipText: string;
  icon: React.ReactNode;
  tool: Tool;
}

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
    tooltipText: "Hand · H",
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
    icon: <Circle className="w-2 h-5" />,
    tool: Tool.ellipse,
  },
  [Tool.polygon]: {
    tooltipText: "Polygon · P",
    icon: <FontAwesomeIcon icon={faDrawPolygon} />,
    tool: Tool.polygon,
  },
};

export const Toolbar = () => {
  return (
    <div className="absolute bottom-4 flex gap-4 justify-center p-2 rounded-lg bg-white">
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
  const onClick = () => setTool(props.tool);

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger onClick={onClick}>
          <div className="">{props.icon}</div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{props.tooltipText}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
