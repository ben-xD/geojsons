import { GeojsonsStateCreator } from "./store";
import { applyReordering } from "./featureEditorSlice";

export interface ReorderFeatureSlice {
  bringSelectionToFront: () => void;
  bringSelectionForward: () => void;
  sendSelectionToBack: () => void;
  sendSelectionBackward: () => void;
}

// const splitFeatures = (
//   collection: FeatureCollection,
//   selectedFeatureIndexes: number[]
// ) => {
//   const unselectedFeatures = collection.features.filter(
//     (feature, index) => !selectedFeatureIndexes.includes(index)
//   );
//   const selectedFeatures = collection.features.filter((feature, index) =>
//     selectedFeatureIndexes.includes(index)
//   );
//   return { unselectedFeatures, selectedFeatures };
// };

// Supports multiple features selected
// Forwards is actually the end of the array (because that's how deck.gl arranges them, last on top).

// TODO add to undo stack
export const createReorderFeatureSlice: GeojsonsStateCreator<
  ReorderFeatureSlice
> = (set, get) => ({
  bringSelectionToFront: () =>
    set((state) => {
      if (state.selectedFeatureIndexes.length !== 1) return;
      const features = state.featureCollection.features;
      const selectedIndex = state.selectedFeatureIndexes[0];
      const selectedFeature = features.splice(selectedIndex, 1)[0];
      features.push(selectedFeature);
      state.selectedFeatureIndexes = [features.length - 1];
      applyReordering(
        get(),
        state.featureCollection,
        state.selectedFeatureIndexes,
      );
    }),
  bringSelectionForward: () =>
    set((state) => {
      if (state.selectedFeatureIndexes.length !== 1) return;
      const index = state.selectedFeatureIndexes[0];
      const nextIndex = index + 1;
      const features = state.featureCollection.features;
      if (nextIndex < state.featureCollection.features.length) {
        const selectedFeature = features[index];
        features[index] = features[nextIndex];
        features[nextIndex] = selectedFeature;
        state.selectedFeatureIndexes = [nextIndex];
        applyReordering(
          get(),
          state.featureCollection,
          state.selectedFeatureIndexes,
        );
      }
    }),
  sendSelectionToBack: () =>
    set((state) => {
      if (state.selectedFeatureIndexes.length !== 1) return;
      const features = state.featureCollection.features;
      const selectedIndex = state.selectedFeatureIndexes[0];
      const selectedFeature = features.splice(selectedIndex, 1)[0];
      features.unshift(selectedFeature);
      state.selectedFeatureIndexes = [0];
      applyReordering(
        get(),
        state.featureCollection,
        state.selectedFeatureIndexes,
      );
    }),
  sendSelectionBackward: () =>
    set((state) => {
      if (state.selectedFeatureIndexes.length !== 1) return;
      const index = state.selectedFeatureIndexes[0];
      const nextIndex = index - 1;
      const features = state.featureCollection.features;
      if (nextIndex >= 0) {
        const selectedFeature = features[index];
        features[index] = features[nextIndex];
        features[nextIndex] = selectedFeature;
        state.selectedFeatureIndexes = [nextIndex];
        applyReordering(
          get(),
          state.featureCollection,
          state.selectedFeatureIndexes,
        );
      }
    }),
});
