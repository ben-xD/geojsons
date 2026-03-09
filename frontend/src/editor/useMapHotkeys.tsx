import { useHotkeys } from "react-hotkeys-hook";
import { useStore, useRedoStackSize, useUndoStackSize } from "../store/store";
import { Tool, toolToConfig } from "./tools";

const useKeyboardConfig = (tool: Tool, enabled: boolean) => {
  const setTool = useStore((state) => state.setTool);
  const keys = toolToConfig[tool]?.keys;
  useHotkeys(keys ?? [], () => setTool(tool), { enabled: enabled && !!keys });
};

export const useMapHotkeys = () => {
  const undo = useStore((state) => state.undo);
  const fc = useStore((state) => state.featureCollection);
  const setSelectedFeatureIndexes = useStore((state) => state.setSelectedFeatureIndexes);
  const undoStackSize = useUndoStackSize();
  const redoStackSize = useRedoStackSize();
  const redo = useStore((state) => state.redo);
  const deleteSelectedFeatures = useStore((state) => state.deleteSelectedFeatures);
  const editLocked = useStore((state) => state.editLocked);

  // Select/box-select always allowed
  useKeyboardConfig(Tool.select, true);
  useKeyboardConfig(Tool.boxSelect, true);

  // Drawing tools disabled when locked
  useKeyboardConfig(Tool.polygon, !editLocked);
  useKeyboardConfig(Tool.drawPolygonByDragging, !editLocked);
  useKeyboardConfig(Tool.line, !editLocked);
  useKeyboardConfig(Tool.rectangle, !editLocked);
  useKeyboardConfig(Tool.pencil, !editLocked);
  useKeyboardConfig(Tool.marker, !editLocked);
  useKeyboardConfig(Tool.circle, !editLocked);
  useKeyboardConfig(Tool.catMarker, !editLocked);
  useKeyboardConfig(Tool.ellipse, !editLocked);

  useHotkeys(["backspace", "delete"], () => deleteSelectedFeatures(), {
    enabled: !editLocked,
  });
  useHotkeys(["meta+z"], () => {
    if (undoStackSize > 0) undo();
  });
  useHotkeys(["shift+meta+z"], () => {
    if (redoStackSize > 0) redo();
  });

  useHotkeys(["meta+a"], () => {
    setSelectedFeatureIndexes(fc.features.map((_f, i) => i));
  });
};
