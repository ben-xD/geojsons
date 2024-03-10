import {
  ClickEvent,
  ControlledMenu,
  ControlledMenuProps,
  MenuItem,
  SubMenu,
} from "@szhsin/react-menu";
import { useStore } from "../../store/store";

export const ContextMenu = (props: ControlledMenuProps) => {
  const deleteCurrentSelectedFeatures = useStore(
    (state) => state.deleteSelectedFeatures
  );
  const bringSelectionForward = useStore(
    (state) => state.bringSelectionForward
  );
  const bringSelectionToFront = useStore.use.bringSelectionToFront();

  const sendSelectionBackward = useStore(
    (state) => state.sendSelectionBackward
  );
  const sendSelectionToBack = useStore((state) => state.sendSelectionToBack);

  const onDelete = (event: ClickEvent) => {
    deleteCurrentSelectedFeatures();
    event.syntheticEvent.preventDefault();
  };

  return (
    <ControlledMenu {...props}>
      {/* <MenuItem>Cut</MenuItem>
      <MenuItem>Copy</MenuItem>
      <MenuItem>Paste</MenuItem> */}
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
