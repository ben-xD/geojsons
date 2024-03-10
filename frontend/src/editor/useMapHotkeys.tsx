import { useHotkeys } from "react-hotkeys-hook";
import {
  useBoundStore,
  useRedoStackSize,
  useUndoStackSize,
} from "../store/store";
import { Tool, toolToConfig } from "./tools";

const useKeyboardConfig = (tool: Tool) => {
  const setTool = useBoundStore((state) => state.setTool);
  useHotkeys(toolToConfig[tool].keys, () => setTool(tool));
};

export const useMapHotkeys = () => {
  const undo = useBoundStore((state) => state.undo);
  const fc = useBoundStore((state) => state.featureCollection);
  const setSelectedFeatureIndexes = useBoundStore(
    (state) => state.setSelectedFeatureIndexes
  );
  const undoStackSize = useUndoStackSize();
  const redoStackSize = useRedoStackSize();
  const redo = useBoundStore((state) => state.redo);
  const deleteSelectedFeatures = useBoundStore(
    (state) => state.deleteSelectedFeatures
  );

  useKeyboardConfig(Tool.select);
  useKeyboardConfig(Tool.edit);
  useKeyboardConfig(Tool.hand);

  useKeyboardConfig(Tool.polygon);
  useKeyboardConfig(Tool.drawPolygonByDragging);

  useKeyboardConfig(Tool.line);
  useKeyboardConfig(Tool.rectangle);
  useKeyboardConfig(Tool.pencil);
  useKeyboardConfig(Tool.marker);
  useKeyboardConfig(Tool.circle);
  useKeyboardConfig(Tool.catMarker);
  useKeyboardConfig(Tool.ellipse);

  useHotkeys(["backspace", "delete"], () => deleteSelectedFeatures());
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
