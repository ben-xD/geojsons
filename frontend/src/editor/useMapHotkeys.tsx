import { useHotkeys } from "react-hotkeys-hook";
import {
  useBoundStore,
  useRedoStackSize,
  useUndoStackSize,
} from "../store/store";
import { Tool } from "./tools";

export const useMapHotkeys = () => {
  const setTool = useBoundStore((state) => state.setTool);
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

  useHotkeys(["v"], () => setTool(Tool.select));
  useHotkeys(["e"], () => setTool(Tool.edit));
  useHotkeys(["h"], () => setTool(Tool.hand));

  useHotkeys(["g"], () => setTool(Tool.polygon));
  useHotkeys(["d"], () => setTool(Tool.drawPolygonByDragging));

  useHotkeys(["l"], () => setTool(Tool.line));
  useHotkeys(["r"], () => setTool(Tool.rectangle));
  useHotkeys(["p"], () => setTool(Tool.pencil));
  useHotkeys(["m"], () => setTool(Tool.marker));
  useHotkeys(["o"], () => setTool(Tool.circle));
  useHotkeys(["shift+o"], () => setTool(Tool.ellipse));

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
