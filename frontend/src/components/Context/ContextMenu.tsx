import {
  ClickEvent,
  ControlledMenu,
  ControlledMenuProps,
  MenuItem,
  SubMenu,
} from "@szhsin/react-menu";
import { useBoundStore } from "../../store/store";

export const ContextMenu = (props: ControlledMenuProps) => {
  const deleteCurrentSelectedFeatures = useBoundStore(
    (state) => state.deleteSelectedFeatures,
  );
  const bringSelectionForward = useBoundStore(
    (state) => state.bringSelectionForward,
  );
  const bringSelectionToFront = useBoundStore.use.bringSelectionToFront();
  // const bringSelectionToFront = useBoundStore(
  //   (state) => state.bringSelectionToFront,
  // );
  const sendSelectionBackward = useBoundStore(
    (state) => state.sendSelectionBackward,
  );
  const sendSelectionToBack = useBoundStore(
    (state) => state.sendSelectionToBack,
  );

  const onDelete = (event: ClickEvent) => {
    deleteCurrentSelectedFeatures();
    event.syntheticEvent.preventDefault();
  };

  return (
    <ControlledMenu {...props}>
      <MenuItem>Cut</MenuItem>
      <MenuItem>Copy</MenuItem>
      <MenuItem>Paste</MenuItem>
      <SubMenu label="Reorder">
        <MenuItem onClick={bringSelectionToFront}>Bring to front</MenuItem>
        <MenuItem onClick={bringSelectionForward}>Bring forward</MenuItem>
        <MenuItem onClick={sendSelectionBackward}>Send backward</MenuItem>
        <MenuItem onClick={sendSelectionToBack}>Send to back</MenuItem>
      </SubMenu>
      <MenuItem onClick={onDelete}>Delete</MenuItem>
    </ControlledMenu>
  );
};
