import throttle from "lodash.throttle";
import {
  ClickEvent,
  DraggingEvent,
  DrawLineStringMode,
  FeatureCollection,
  LineString,
  ModeProps,
  StartDraggingEvent,
  Pick,
} from "@nebula.gl/edit-modes";
import { getPickedEditHandle } from "@nebula.gl/edit-modes";
import {
  EditHandleFeature,
  StopDraggingEvent,
} from "@nebula.gl/edit-modes/dist-types/types";
// import { StopDraggingEvent, getPickedEditHandle } from "@nebula.gl/edit-modes";

// // getPickedEditHandle is available, fix the type here using declaration merging
declare module "@nebula.gl/edit-modes" {
  export function getPickedEditHandle(
    picks: Pick[] | null | undefined
  ): EditHandleFeature | null | undefined;
}
//
/* Inspired by nebula.gl's DrawPolygonByDraggingMode */
type DraggingHandler = (
  event: DraggingEvent,
  props: ModeProps<FeatureCollection>
) => void;

export class DrawLineStringByDraggingMode extends DrawLineStringMode {
  handleDraggingThrottled: DraggingHandler | null | undefined = null;

  // Override the default behavior of DrawLineStringMode to not add a point when the user clicks on the map
  handleClick(_event: ClickEvent, _props: ModeProps<FeatureCollection>) {
    return;
  }

  handleStartDragging(
    event: StartDraggingEvent,
    props: ModeProps<FeatureCollection>
  ) {
    event.cancelPan();
    if (props.modeConfig && props.modeConfig.throttleMs) {
      this.handleDraggingThrottled = throttle(
        this.handleDraggingAux,
        props.modeConfig.throttleMs
      );
    } else {
      this.handleDraggingThrottled = this.handleDraggingAux;
    }
  }

  handleStopDragging(
    event: StopDraggingEvent,
    props: ModeProps<FeatureCollection>
  ) {
    this.addClickSequence(event);
    const clickSequence = this.getClickSequence();
    // @ts-ignore
    if (this.handleDraggingThrottled && this.handleDraggingThrottled.cancel) {
      // @ts-ignore
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

  handleDraggingAux(
    event: DraggingEvent,
    _props: ModeProps<FeatureCollection>
  ) {
    const { picks } = event;
    const clickedEditHandle = getPickedEditHandle(picks);

    if (!clickedEditHandle) {
      // Don't add another point right next to an existing one.
      this.addClickSequence(event);
    }
  }

  handleDragging(event: DraggingEvent, props: ModeProps<FeatureCollection>) {
    if (this.handleDraggingThrottled) {
      this.handleDraggingThrottled(event, props);
    }
  }
}
