import throttle from "lodash.throttle";
import {
  type ClickEvent,
  type DraggingEvent,
  DrawLineStringMode,
  type LineString,
  type ModeProps,
  type StartDraggingEvent,
  type StopDraggingEvent,
  getPickedEditHandle,
} from "@deck.gl-community/editable-layers";
import { DebouncedFunc } from "lodash";

//
// Using `any` for the FeatureCollection generic because @deck.gl-community/editable-layers
// has inconsistent types between GeoJsonEditMode (uses FeatureCollection) and
// DrawLineStringMode (uses SimpleFeatureCollection for some methods).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DragHandler = (event: DraggingEvent, props: ModeProps<any>) => void;

type ThrottledDragHandler = DebouncedFunc<DragHandler>;

export class DrawLineStringByDraggingMode extends DrawLineStringMode {
  handleDraggingThrottled: ThrottledDragHandler | DragHandler | null | undefined = null;

  // Override the default behavior of DrawLineStringMode to not add a point when the user clicks on the map
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleClick(_event: ClickEvent, _props: ModeProps<any>) {
    return;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleStartDragging(event: StartDraggingEvent, props: ModeProps<any>) {
    event.cancelPan();
    if (props.modeConfig && props.modeConfig.throttleMs) {
      this.handleDraggingThrottled = throttle(this.handleDraggingAux, props.modeConfig.throttleMs);
    } else {
      this.handleDraggingThrottled = this.handleDraggingAux;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleStopDragging(event: StopDraggingEvent, props: ModeProps<any>) {
    this.addClickSequence(event);
    const clickSequence = this.getClickSequence();
    if (this.handleDraggingThrottled && "cancel" in this.handleDraggingThrottled) {
      this.handleDraggingThrottled.cancel();
    }

    if (clickSequence.length > 2) {
      const lineStringToAdd: LineString = {
        type: "LineString",
        coordinates: clickSequence,
      };

      this.resetClickSequence();

      const editAction = this.getAddFeatureAction(lineStringToAdd, props.data);
      if (editAction) {
        props.onEdit(editAction);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  handleDraggingAux(event: DraggingEvent, _props: ModeProps<any>) {
    const { picks } = event;
    const clickedEditHandle = getPickedEditHandle(picks);

    if (!clickedEditHandle) {
      // Don't add another point right next to an existing one.
      this.addClickSequence(event);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  override handleDragging(event: DraggingEvent, props: ModeProps<any>) {
    if (this.handleDraggingThrottled) {
      this.handleDraggingThrottled(event, props);
    }
  }
}
