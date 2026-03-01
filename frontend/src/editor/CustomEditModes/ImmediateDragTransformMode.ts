import {
  TransformMode,
  TranslateMode,
} from "@deck.gl-community/editable-layers";
import type {
  ClickEvent,
  StartDraggingEvent,
  DraggingEvent,
  StopDraggingEvent,
  ModeProps,
  FeatureCollection,
} from "@deck.gl-community/editable-layers";

/**
 * Extends TransformMode to allow dragging a feature immediately on click,
 * without requiring it to be selected first. On drag start, if the cursor
 * is over an unselected feature, it auto-selects it and begins translating.
 */
export class ImmediateDragTransformMode extends TransformMode {
  _autoSelectedIndex: number | null = null;

  getGuides(props: ModeProps<FeatureCollection>) {
    if (props.selectedIndexes.length === 0) {
      return { type: "FeatureCollection" as const, features: [] };
    }
    return super.getGuides(props);
  }

  handleClick(event: ClickEvent, props: ModeProps<FeatureCollection>) {
    if (props.modeConfig?.isSpacePressed) return;
    const nonGuidePicks = event.picks.filter(
      (p: Record<string, unknown>) => !p.isGuide,
    );

    if (nonGuidePicks.length === 0) {
      // Clicked empty space → deselect
      if (props.selectedIndexes.length > 0) {
        props.onEdit({
          updatedData: props.data,
          editType: "autoSelect",
          editContext: { featureIndexes: [] },
        });
      }
    } else {
      // Clicked on a feature → select it
      const pickedIndex = nonGuidePicks[0].index as number;
      if (pickedIndex >= 0) {
        props.onEdit({
          updatedData: props.data,
          editType: "autoSelect",
          editContext: { featureIndexes: [pickedIndex] },
        });
      }
    }
  }

  handleStartDragging(event: StartDraggingEvent, props: ModeProps<FeatureCollection>) {
    if (props.modeConfig?.isSpacePressed) return;
    const nonGuidePicks = event.picks.filter(
      (p: Record<string, unknown>) => !p.isGuide,
    );

    if (nonGuidePicks.length > 0) {
      const pickedIndex = nonGuidePicks[0].index as number;

      if (pickedIndex >= 0 && !props.selectedIndexes.includes(pickedIndex)) {
        this._autoSelectedIndex = pickedIndex;

        // Force the TranslateMode child to allow dragging
        for (const mode of this._modes) {
          if (mode instanceof TranslateMode) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (mode as any)._isTranslatable = true;
          }
        }

        const augmentedProps = {
          ...props,
          selectedIndexes: [pickedIndex],
        };

        super.handleStartDragging(event, augmentedProps);

        // Notify the app so it can update its selection state
        props.onEdit({
          updatedData: props.data,
          editType: "autoSelect",
          editContext: { featureIndexes: [pickedIndex] },
        });
        return;
      }
    }

    this._autoSelectedIndex = null;
    super.handleStartDragging(event, props);
  }

  handleDragging(event: DraggingEvent, props: ModeProps<FeatureCollection>) {
    if (
      this._autoSelectedIndex !== null &&
      !props.selectedIndexes.includes(this._autoSelectedIndex)
    ) {
      super.handleDragging(event, {
        ...props,
        selectedIndexes: [this._autoSelectedIndex],
      });
    } else {
      super.handleDragging(event, props);
    }
  }

  handleStopDragging(event: StopDraggingEvent, props: ModeProps<FeatureCollection>) {
    if (
      this._autoSelectedIndex !== null &&
      !props.selectedIndexes.includes(this._autoSelectedIndex)
    ) {
      const augmentedProps = {
        ...props,
        selectedIndexes: [this._autoSelectedIndex],
      };
      this._autoSelectedIndex = null;
      super.handleStopDragging(event, augmentedProps);
    } else {
      this._autoSelectedIndex = null;
      super.handleStopDragging(event, props);
    }
  }
}
