import { Feature, FeatureCollection } from "@/data/validator/geojson";
import { Tool } from "../editor/tools";
import { StateCreator } from "zustand";
import { arraysEqual } from "../arrays/areArraysEqual";
import { Mutators, State } from "./store";
import { v4 as uuidv4 } from "uuid";
import { emptyFeatureCollection } from "@/data/featureCollection";
import { ViewState } from "react-map-gl/dist/esm/types";

export type UserAction =
  | { type: "featureCollection"; collection: FeatureCollection }
  | { type: "selection"; selectedFeatureIndexes: number[] }
  | {
      type: "reordering"; // changing both feature collection and the selected indexes
      collection: FeatureCollection;
      selectedFeatureIndexes: number[];
    };

export interface FeatureEditorSlice {
  enabled: boolean;
  tool: Tool;
  selectedFeatureIndexes: number[];
  featureCollection: FeatureCollection;
  pickable: boolean;
  setPickable: (pickable: boolean) => void;
  isMapDraggable: boolean;
  setIsMapDraggable: (isMapDraggable: boolean) => void;
  isDoubleClickZoomEnabled: boolean;
  setTool: (tool: Tool) => void;
  deleteSelectedFeatures: () => void;
  updateFeatureCollection: (collection: FeatureCollection) => void;
  setSelectedFeatureIndexes: (selectedFeatureIndexes: number[]) => void;
  undo: () => void;
  redo: () => void;
  undoStack: UserAction[];
  redoStack: UserAction[];
  viewState: ViewState;
  setViewState: (viewState: ViewState) => void;
}

// TODO prompt redo stack will be cleared when doing an action?
export const createFeatureEditorSlice: StateCreator<
  State,
  Mutators,
  [],
  FeatureEditorSlice
> = (set) => ({
  enabled: true,
  tool: Tool.hand,
  isMapDraggable: false,
  setIsMapDraggable: (isMapDraggable: boolean) =>
    set((state) => {
      state.isMapDraggable = isMapDraggable;
    }),
  isDoubleClickZoomEnabled: true,
  setTool: (tool: Tool) =>
    set(
      (state) => {
        state.tool = tool;
        state.isDoubleClickZoomEnabled = tool === Tool.hand;
      },
      false,
      { type: "setTool" }
    ),
  pickable: true,
  setPickable: (pickable: boolean) =>
    set((state) => {
      state.pickable = pickable;
    }),
  featureCollection: emptyFeatureCollection,
  // featureCollection: testFeatureCollection,
  selectedFeatureIndexes: [],
  undoStack: [],
  redoStack: [],
  deleteSelectedFeatures: () =>
    set(
      (state) => {
        const features = state.featureCollection.features.filter(
          (_f, i) => !state.selectedFeatureIndexes.includes(i)
        );
        console.log(`final features`, features.length);
        applyFeatureCollectionUpdate(state, {
          ...state.featureCollection,
          features,
        });
        // Doesn't change it:
        // get().updateFeatureCollection({ ...state.featureCollection, features });
      },
      false,
      { type: "deleteSelectedFeatures" }
    ),
  updateFeatureCollection: (data: FeatureCollection) =>
    set(
      (state) => {
        applyFeatureCollectionUpdate(state, data);
      },
      false,
      { type: "updateFeatureCollection" }
    ),
  setSelectedFeatureIndexes: (indexes: number[]) =>
    set(
      (state) => {
        if (arraysEqual(indexes, state.selectedFeatureIndexes)) return;
        state.undoStack = [
          ...state.undoStack,
          {
            type: "selection",
            selectedFeatureIndexes: state.selectedFeatureIndexes,
          },
        ];
        state.selectedFeatureIndexes = indexes;
        state.tool = Tool.select;
        // if (state.tool !== Tool.select && state.tool !== Tool.edit) {
        //   state.tool = Tool.select;
        // }
      },
      false,
      { type: "setSelectedFeatureIndexes" }
    ),
  undo: () =>
    set(
      (state) => {
        const lastItem = state.undoStack.pop();
        if (lastItem) {
          if (lastItem.type === "featureCollection") {
            state.redoStack = [
              ...state.redoStack,
              {
                type: "featureCollection",
                collection: state.featureCollection,
              },
            ];
            state.featureCollection = lastItem.collection;
            state.selectedFeatureIndexes = state.selectedFeatureIndexes.filter(
              (value) => value < lastItem?.collection?.features?.length
            );
          } else if (lastItem.type === "selection") {
            state.tool = Tool.select;
            state.redoStack = [
              ...state.redoStack,
              {
                type: "selection",
                selectedFeatureIndexes: state.selectedFeatureIndexes,
              },
            ];
            state.selectedFeatureIndexes = lastItem.selectedFeatureIndexes;
          } else if (lastItem.type === "reordering") {
            state.redoStack = [
              ...state.redoStack,
              {
                type: "reordering",
                selectedFeatureIndexes: state.selectedFeatureIndexes,
                collection: state.featureCollection,
              },
            ];
            state.featureCollection = lastItem.collection;
            state.selectedFeatureIndexes = lastItem.selectedFeatureIndexes;
          } else {
            lastItem satisfies never;
          }
        }
      },
      false,
      { type: "undo" }
    ),
  redo: () =>
    set(
      (state) => {
        const lastItem = state.redoStack.pop();
        if (lastItem) {
          if (lastItem.type === "featureCollection") {
            state.undoStack = [
              ...state.undoStack,
              {
                type: "featureCollection",
                collection: state.featureCollection,
              },
            ];
            state.featureCollection = lastItem.collection;
            state.selectedFeatureIndexes = state.selectedFeatureIndexes.filter(
              (value) => value < lastItem?.collection?.features?.length
            );
          } else if (lastItem.type === "selection") {
            state.tool = Tool.select;
            state.undoStack = [
              ...state.undoStack,
              {
                type: "selection",
                selectedFeatureIndexes: state.selectedFeatureIndexes,
              },
            ];
            state.selectedFeatureIndexes = lastItem.selectedFeatureIndexes;
          } else if (lastItem.type === "reordering") {
            state.undoStack = [
              ...state.undoStack,
              {
                type: "reordering",
                selectedFeatureIndexes: state.selectedFeatureIndexes,
                collection: state.featureCollection,
              },
            ];
            state.selectedFeatureIndexes = lastItem.selectedFeatureIndexes;
            state.featureCollection = lastItem.collection;
          } else {
            lastItem satisfies never;
          }
        }
      },
      false,
      { type: "redo" }
    ),
  viewState: {
    longitude: -0.08648816636906795,
    latitude: 51.519898434555685,
    zoom: 1,
    pitch: 0,
    bearing: 0,
    padding: {
      top: 0,
      right: 0,
      bottom: 0,
      left: 0,
    },
  },
  setViewState: (viewState: ViewState) =>
    set((state) => {
      state.viewState = viewState;
    }),
});

const createFeatureId = () => `feature-${uuidv4()}`;

export const applyFeatureCollectionUpdate = (
  state: FeatureEditorSlice,
  next: FeatureCollection
) => {
  const features = next.features.map<Feature>((f) => ({
    id: createFeatureId(),
    ...f,
  }));
  state.undoStack = [
    ...state.undoStack,
    {
      type: "featureCollection",
      collection: state.featureCollection,
    },
  ];
  state.redoStack = [];
  if (next.features.length === 0) {
    state.selectedFeatureIndexes = [];
  } else if (next.features.length !== state.featureCollection.features.length) {
    // If new feature was added, select it
    // If feature was removed, select the last item in the list
    state.selectedFeatureIndexes = [Math.max(next.features.length - 1, 0)];
    state.tool = Tool.select;
  }
  state.featureCollection = { ...next, features };
};

export const applyReordering = (
  state: FeatureEditorSlice,
  newCollection: FeatureCollection,
  newSelectedFeatureIndexes: number[]
) => {
  const features = newCollection.features.map<Feature>((f, i) => ({
    id: state.featureCollection.features[i].id,
    ...f,
  }));
  state.undoStack = [
    ...state.undoStack,
    {
      type: "reordering",
      collection: state.featureCollection,
      selectedFeatureIndexes: newSelectedFeatureIndexes,
    },
  ];
  state.redoStack = [];
  state.featureCollection = { ...newCollection, features };
};
