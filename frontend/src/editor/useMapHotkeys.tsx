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
    (state) => state.setSelectedFeatureIndexes,
  );
  const undoStackSize = useUndoStackSize();
  const redoStackSize = useRedoStackSize();
  const redo = useBoundStore((state) => state.redo);
  const deleteSelectedFeatures = useBoundStore(
    (state) => state.deleteSelectedFeatures,
  );
  useHotkeys(["r"], () => setTool(Tool.rectangle));
  useHotkeys(["h"], () => setTool(Tool.hand));
  useHotkeys(["p"], () => setTool(Tool.polygon));
  useHotkeys(["l"], () => setTool(Tool.line));
  useHotkeys(["shift+p"], () => setTool(Tool.pencil));
  useHotkeys(["m"], () => setTool(Tool.marker));
  useHotkeys(["shift+o"], () => setTool(Tool.ellipse));
  useHotkeys(["o"], () => setTool(Tool.circle));
  useHotkeys(["v"], () => setTool(Tool.select));
  useHotkeys(["shift+v"], () => setTool(Tool.polygonSelect));

  useHotkeys(["backspace", "delete"], () => deleteSelectedFeatures());
  useHotkeys(["meta+z"], () => {
    if (undoStackSize > 0) undo();
  });
  useHotkeys(["shift+meta+z"], () => {
    if (redoStackSize > 0) redo();
  });

  useHotkeys(["meta+a"], () => {
    setSelectedFeatureIndexes(fc.features.map((f, i) => i));
  });
};
