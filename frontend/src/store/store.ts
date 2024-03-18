import { immer } from "zustand/middleware/immer";
import { getNebulaModeForTool } from "../editor/tools";
import { create, StateCreator } from "zustand";
import {
  createJSONStorage,
  devtools,
  persist,
  subscribeWithSelector,
} from "zustand/middleware";
import {
  GeoJsonEditMode,
  RotateMode,
  ScaleMode,
  TransformMode,
  ViewMode,
} from "@nebula.gl/edit-modes";
import {
  createReorderFeatureSlice,
  ReorderFeatureSlice,
} from "./reorderFeatureSlice";
import {
  FeatureEditorSlice,
  createFeatureEditorSlice,
} from "./featureEditorSlice";
import { createSelectors } from "./createSelectors";

// Consider reading https://docs.pmnd.rs/zustand/guides/typescript
// Slices are just smaller stores. Technically, they are still stores. So you can call them either.
// See https://docs.pmnd.rs/zustand/guides/slices-pattern#usage-with-typescript
// Slices pattern in this file follows the pattern in https://github.com/pmndrs/zustand/issues/508#issuecomment-955722581
// Also see
// - https://github.com/pmndrs/zustand/discussions/2195
// - https://github.com/pmndrs/zustand/discussions/1281

// If we need computed properties, implement custom hooks that use useStore().
// - Using a nested `computed` object following https://github.com/pmndrs/zustand/issues/132#issuecomment-1120467721 doesn't work with immer because `get()` is returns undefined state
// - 3rd party middleware is quite old, and unclear if it will work: https://github.com/cmlarsen/zustand-middleware-computed-state

export type State = FeatureEditorSlice & ReorderFeatureSlice;

export type GeojsonsStateCreator<T> = StateCreator<State, Mutators, [], T>;

export type Mutators = [
  ["zustand/devtools", never],
  ["zustand/subscribeWithSelector", never],
  ["zustand/persist", unknown],
  ["zustand/immer", never],
];

const unpersistedProperties = ["userLocation"];

const applicationLocalStorageName = "geojsons.com";
// reminder: use devtools as the last middleware as suggested on https://github.com/pmndrs/zustand/blob/HEAD/docs/guides/typescript.md. Daishi (the maintainer) suggests following Tests over docs, if they're inconsistent.
// > because devtools mutates the setState and adds a type parameter on it, which could get lost if other middlewares (like immer) also mutate setState before devtools.
// Extra: We could add the subscribeWithSelector middleware to subscribe to changes outside of react components. See https://github.com/pmndrs/zustand/issues/930#issuecomment-1991359077
// The zustand docs would call this useBoundStore/useBoundStoreOriginal, to avoid confusion with useStore exported by zustand.
// See discord conversation: https://discord.com/channels/740090768164651008/740093228904218657/1215437737491042304
export const useStoreOriginal = create<State>()(
  devtools(
    subscribeWithSelector(
      persist(
        immer((...a) => ({
          ...createFeatureEditorSlice(...a),
          ...createReorderFeatureSlice(...a),
        })),
        {
          name: applicationLocalStorageName,
          partialize: (state) =>
            Object.fromEntries(
              Object.entries(state).filter(
                ([key]) => !unpersistedProperties.includes(key),
              ),
            ),
        },
      ),
    ),
  ),
);

// This follows https://docs.pmnd.rs/zustand/guides/auto-generating-selectors
// Just allows a slighter shorter/simpler way of getting properties
// and actions (auto generated selectors). You can use it like
// `const tool = useStore.use.tool()` instead of
// `const tool = useStore((state) => state.tool);`
export const useStore = createSelectors(useStoreOriginal);

const modesRequiringFeatures = new Set<typeof GeoJsonEditMode>([
  RotateMode,
  TransformMode,
  ScaleMode,
]);

export const useEditingMode = () => {
  // If we didn't use `createSelectors`, we'd need to do e.g.:
  // const tool = useStore((state) => state.tool);
  // const selectedFeatureIndexes = useStore(
  //   (state) => state.selectedFeatureIndexes
  // );
  const tool = useStore.use.tool();
  const selectedFeatureIndexes = useStore.use.selectedFeatureIndexes();
  const nebulaMode = getNebulaModeForTool(tool);
  const preventModeMisuse =
    selectedFeatureIndexes.length === 0 &&
    modesRequiringFeatures.has(nebulaMode);
  return preventModeMisuse ? ViewMode : nebulaMode;
};

export const useUndoStackSize = () =>
  useStore((state) => state.undoStack.length);
export const useRedoStackSize = () =>
  useStore((state) => state.redoStack.length);

export const resetStateAndReloadPage = (): void => {
  useStore.persist.clearStorage();
  window.location.reload();
};

// Example usage of subscribeWithSelector feature:
// useStore.subscribe(
//   (state) => state.undoStack,
//   (undoStack, previousUndoStack) => {
//     console.log("useStore.subscribe undoStack", undoStack);
//   }
// );
