import { immer } from "zustand/middleware/immer";
import { getNebulaModeForTool } from "../editor/tools";
import { create, StateCreator } from "zustand";
import { devtools } from "zustand/middleware";
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

//  TODO make TS config stricter

// Slices pattern in this file follows the pattern in https://github.com/pmndrs/zustand/issues/508#issuecomment-955722581

// If we need computed properties, consider https://github.com/pmndrs/zustand/issues/132#issuecomment-1120467721 or a middleware: https://github.com/cmlarsen/zustand-middleware-computed-state

// It was weird getting types to work with Zustand + middleware (immer, devtools). After waking up the next day, it just worked. 🫠️.
// see https://github.com/pmndrs/zustand/discussions/2195
// see https://docs.pmnd.rs/zustand/guides/typescript
// see https://github.com/pmndrs/zustand/discussions/1281

// Slices are just smaller stores. Technically, they are still stores. So you can call them either.
// See https://docs.pmnd.rs/zustand/guides/slices-pattern#usage-with-typescript

export type State = FeatureEditorSlice & ReorderFeatureSlice;

export type GeojsonsStateCreator<T> = StateCreator<State, Mutators, [], T>;

export type Mutators = [["zustand/immer", never], ["zustand/devtools", never]];

// reminder: use devtools as the last middleware as suggested on https://github.com/pmndrs/zustand/blob/HEAD/docs/guides/typescript.md
// > because devtools mutates the setState and adds a type parameter on it, which could get lost if other middlewares (like immer) also mutate setState before devtools.
export const useStoreOriginal = create<State>()(
  immer(
    devtools((...a) => ({
      ...createFeatureEditorSlice(...a),
      ...createReorderFeatureSlice(...a),
    })),
  ),
);

// This follows https://docs.pmnd.rs/zustand/guides/auto-generating-selectors
// Just allows a slighter shorter way of getting properties and actions (auto generated selectors)
// You can use it like `const tool = useStore.use.tool()` instead of
// `const tool = useStore((state) => state.tool);`
// The zustand docs would call this useBoundStore, to avoid confusion with useStore exported by zustand.
// See discord conversation: https://discord.com/channels/740090768164651008/740093228904218657/1215437737491042304
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
