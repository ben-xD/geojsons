import { useCallback, useRef, useState } from "react";
import Map, { AttributionControl, MapRef } from "react-map-gl/maplibre";
import { default as EditableGeoJsonLayer } from "@nebula.gl/layers/src/layers/editable-geojson-layer";
import { GeoJsonLayer } from "deck.gl/typed";
import DeckGL, { DeckGLRef, DeckProps, PickingInfo } from "deck.gl/typed";
import type { Feature, FeatureCollection } from "geojson";
import { polygonOverScotlandCollection } from "./mockData/featureCollections";

// Following some random github issue to fix styling
import "maplibre-gl/dist/maplibre-gl.css";
// Following https://szhsin.github.io/react-menu#context-menu
import "@szhsin/react-menu/dist/index.css";
import { useKeyPressedDown } from "./hooks/useKeyPressedDown.tsx";
import { MapLibreEvent } from "maplibre-gl";
import { MjolnirGestureEvent } from "mjolnir.js";
import { EditableGeojsonLayerProps } from "@nebula.gl/layers/dist-types/layers/editable-geojson-layer";
import { ContextMenu } from "./components/Context/ContextMenu.tsx";
import { SelectionLayer } from "@nebula.gl/layers";
import { useMapHotkeys } from "./editor/useMapHotkeys";
import { useBoundStore } from "./store/store.ts";
import { useEditingMode } from "./store/store";
import {
  primaryTentativeFillRgba,
  primaryTentativeLineRgba,
} from "./tokens/colors";
import { Tool } from "./editor/tools.ts";
import { Toolbar } from "./Toolbar.tsx";

// reusable version of Parameters<NonNullable<DeckProps["getCursor"]>>[0]
// This is because DeckProps["getCursor"] is a function with a parameter `state: CursorState`, but `CursorState` is not exported.
type DeckPropCallbackParameter1<T extends keyof DeckProps> = Parameters<
  NonNullable<DeckProps[T]>
>[0];

const editableGeojsonLayerId = "editable-geojson-layer-ben";

// When using the @deck.gl/mapbox module, and MapboxLayer and MapboxOverlay https://deck.gl/docs/api-reference/mapbox/overview
// Mapbox is the root element and deck.gl is the child, with Mapbox handling all user inputs
// it is recommended that you use deck.gl as the root element, so we are doing the opposite.

// To debug deck.gl, run the following in the browser console, as per https://deck.gl/docs/developer-guide/debugging.
// However, it makes the shapes dissapear and an error (`luma.gl: assertion failed.`)
// deck.log.enable();
// deck.log.level = 3; // or 1 or 2

const initialViewState = {
  longitude: -0.08648816636906795,
  latitude: 51.519898434555685,
  zoom: 5,
};

export const GeojsonsMap = () => {
  useMapHotkeys();
  const editingMode = useEditingMode();
  const tool = useBoundStore.use.tool();
  const fc = useBoundStore.use.featureCollection();
  const updateFc = useBoundStore.use.updateFeatureCollection();
  const pickable = useBoundStore.use.pickable();
  const setPickable = useBoundStore.use.setPickable();
  const selectedFeatureIndexes = useBoundStore.use.selectedFeatureIndexes();
  const setSelectedFeatureIndexes =
    useBoundStore.use.setSelectedFeatureIndexes();
  const isMapDraggable = useBoundStore.use.isMapDraggable();
  const setIsMapDraggable = useBoundStore.use.setIsMapDraggable();

  const isDraggingRef = useRef(false);
  const [draggedFc, setDraggedFc] = useState<FeatureCollection | undefined>();
  const featureCollectionRef = useRef<FeatureCollection>();

  const [isContextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuAnchorPoint, setContextMenuAnchorPoint] = useState<{
    x: number;
    y: number;
  }>({ x: 100, y: 100 });
  const deckGlRef = useRef<DeckGLRef>(null);
  // const hoveredFeature = useRef<Feature>();

  const geojsonLayer = new GeoJsonLayer({
    opacity: 0.1,
    data: polygonOverScotlandCollection,
    id: "geojson-layer-ben",
    getFillColor: [255, 0, 0],
    pickable: false,
    onClick: (pickInfo, hammerInput) => {
      console.log("click", { pickInfo, hammerInput, fc });
    },
  });

  const [hoveredFeatureIndex, setHoveredFeatureIndex] = useState<number>();
  // The types for nebula aren't very good yet
  const editableGeojsonLayerProps: EditableGeojsonLayerProps<FeatureCollection> =
    {
      opacity: 1,
      id: editableGeojsonLayerId,
      data: draggedFc ?? fc,
      getFillColor: (feature: Feature, isSelected: boolean) => {
        if (isSelected) {
          return [57, 62, 65, 50];
        }
        return [57, 62, 65, 25];
      },
      pickable,
      modeConfig: {
        dragToDraw: true,
        // enableSnapping: true,
      },
      getLineWidth: 1,
      getTentativeLineWidth: 1,
      getLineColor: [57, 62, 65, 200],
      // getLineColor: (feature: Feature, isSelected: boolean, mode: unknown) => {
      //   // console.log("getLineColor", {feature, isSelected, mode});
      //   // getLineColor is not called when the feature is hovered, so we can't change the color when it's hovered.
      //   // Turns out, there's a feature deck.gl called autoHighlight, see https://medium.com/vis-gl/automatic-gpu-based-object-highlighting-in-deck-gl-layers-7fe3def44c89
      //   //   if (hoveredFeature.current && feature === hoveredFeature.current) {
      //   //     return [0, 255, 0, 255];
      //   //   }
      //   if (isSelected) return [0, 157, 255, 255];
      //   return [57, 62, 65, 200];
      // },
      autoHighlight: true,
      highlightColor: [57, 62, 65, 50],
      selectedFeatureIndexes,
      mode: editingMode,
      onClick: (pickInfo: PickingInfo, hammerInput: MjolnirGestureEvent) => {
        console.log("click", { pickInfo, hammerInput, fc });
        // onClick is called even when user clicks on guide features
        if (pickInfo.isGuide) return;
        setSelectedFeatureIndexes([pickInfo.index]);

        // The types are wrong again... tapCount exists.
        if (pickInfo.picked && hammerInput.tapCount === 2) {
          console.log("enter into edit shape");
        }
      },
      onDragStart: () => (isDraggingRef.current = true),
      onDragEnd: () => {
        console.log("onDragEnd");
        isDraggingRef.current = false;
        if (featureCollectionRef.current) {
          setDraggedFc(undefined);
          updateFc(featureCollectionRef.current);
          featureCollectionRef.current = undefined;
        }
      },
      onHover: (info: PickingInfo) => {
        if (info.picked) {
          // console.log(`Hovering on ${info.index}`, info, event);
          setHoveredFeatureIndex(info.index);
        } else {
          // console.log(`Hovering not picked`, info, event);
          setHoveredFeatureIndex(undefined);
        }
      },
      _subLayerProps: {
        geojson: {
          pointType: "icon",
          updateTriggers: {
            getIcon: [selectedFeatureIndexes, hoveredFeatureIndex],
          },
          getIcon: (feature: Feature) => {
            const index = fc.features.indexOf(feature);
            const hovered = hoveredFeatureIndex === index;
            // console.log({ index, hovered });
            if (selectedFeatureIndexes.includes(index)) {
              return {
                url: "https://avatars1.githubusercontent.com/u/7025232?v=4",
                width: 128,
                height: 128,
                anchorY: 128 / 2,
              };
            } else if (hovered) {
              // return a different icon when hovered
            }
            return {
              url: "https://upload.wikimedia.org/wikipedia/commons/7/7c/201408_cat.png",
              width: 128,
              height: 128,
              anchorY: 128 / 2,
            };
          },

          iconSizeScale: 1,
          getIconSize: 100,
        },
      },
      // types say it takes a function with 4 args, but actually it gets a single object argument, with 4 properties
      // onEdit: (
      //   updatedData: any | undefined,
      //   editType: string | undefined,
      //   featureIndexes: number[] | undefined,
      //   editContext: any | undefined
      //   // updatedData: FeatureCollection,
      //   // editType: string,
      //   // featureIndexes: number[],
      //   // editContext: any | null
      // ) => {

      onEdit: ({ updatedData, editType, featureIndexes, editContext }) => {
        if (isDraggingRef.current) {
          featureCollectionRef.current = updatedData;
          setDraggedFc(updatedData);
          return;
        }
        if (updatedData && updatedData.features) {
          // onEdit is called even when there are no changes (clicking on the map for the first time)
          if (updatedData.features.length === fc.features.length) return;
          updateFc(updatedData);
        } else {
          console.error("onEdit called with no features", {
            updatedData,
            editType,
            featureIndexes,
            editContext,
          });
        }
      },
    };

  const editableGeojsonLayer = new EditableGeoJsonLayer(
    editableGeojsonLayerProps,
  );

  // TODO only use selection layer if "select tool" is active (to prevent drawing selection when moving features)
  // It is usually better for performance to just use visible:false instead of removing the layer.
  // Remove selectionLayer completely instead of using visible prop because visible: will still prevent
  // dragPan from being set to true.
  const isSelectionLayerEnabled =
    selectedFeatureIndexes.length === 0 &&
    !isMapDraggable &&
    (tool === "select" || tool === Tool.polygonSelect);
  const selectionType = tool === "select" ? "rectangle" : "polygon";
  const selectionLayer = new SelectionLayer({
    id: "selection",
    // visible: isSelectionLayerVisible,
    selectionType,
    // selectionType: "polygon",
    onSelect: ({ pickingInfos }) => {
      console.log(`onSelect`, { pickingInfos });
      // Even though layer is invisible, onSelect will still be called if the layer is added. However, since we remove the layer, this is not necessary. It would be necessary if we use visible: instead of removing it.
      // if (!isSelectionLayerVisible) return;
      console.log(`onSelect`, { pickingInfos });
      if (pickingInfos.length === 0) {
        setSelectedFeatureIndexes([]);
      } else {
        setSelectedFeatureIndexes(
          Array.from(pickingInfos.map((pi) => pi.index)),
        );
      }
    },
    layerIds: [editableGeojsonLayerId],
    getTentativeFillColor: () => primaryTentativeFillRgba,
    getTentativeLineColor: () => primaryTentativeLineRgba,
    getTentativeLineDashArray: () => [0, 0],
    // getlineWidth: 1,
    getTentativeLineWidth: 1,
  });

  const mapRef = useRef<MapRef>(null);
  // todo also change cursor to hand. Default to pointer.
  useKeyPressedDown({
    key: "space",
    onKeyDown: () => {
      setIsMapDraggable(true);
      setPickable(false);
    },
    onKeyUp: () => {
      setIsMapDraggable(false);
      setPickable(true);
    },
  });

  // Doesn't work nicely because getTooltip is only called when the mouse moves
  // Pressing alt whilst cursor hovers over a feature doesn't show tooltip unless you move the cursor. Even then, it would flicker.
  const isAltPressedRef = useKeyPressedDown({
    key: "Alt",
    onKeyUp: () => console.log("Alt up"),
    onKeyDown: () => console.log("Alt down"),
  });

  // not necessary for now? I just saw it in https://github.com/visgl/deck.gl/discussions/6103
  // const [glContext,setGlContext] = useState<WebGLRenderingContext>();

  const onMapLoad = useCallback((e: MapLibreEvent) => {
    console.log("Map loaded");
    const map = e.target;
    map.on("contextmenu", () => {
      console.log("contextmenu clicked");
    });
  }, []);
  // {/*"https://api.maptiler.com/maps/outdoor-v2/style.json?key=LlETYKEJwgxoM6pCNChm",*/}
  // When you use DeckGL as the parent, you are using DeckGL's controller.
  // It has identical implementation as react-map-gl's controller, but different defaults for
  // backward-compatibility reasons.
  // Disabling browser context menu with an extra div. See https://github.com/visgl/deck.gl/discussions/6103
  const getCursor = useCallback(
    (state: DeckPropCallbackParameter1<"getCursor">) => {
      // console.log(`getCursor. ${state.isDragging} ${state.isHovering}`);
      if (state.isHovering) {
        return "pointer";
      } else {
        return isMapDraggable ? "grab" : "default";
      }
    },
    [isMapDraggable],
  );

  const onClick = (info: PickingInfo, event: MjolnirGestureEvent) => {
    console.log("DeckGL onClick", { info, event });
    if (!info.picked) {
      setSelectedFeatureIndexes([]);
      // setContextMenuOpen(false);
    }
    if (info.picked && event.rightButton) {
      console.log("right clicked");
      setContextMenuOpen(true);
      const { x, y } = info;
      setContextMenuAnchorPoint({ x, y });
      // TODO Show the context menu
    }
    // Use the info.object or info.index to get the picked object and show more context
    // e.g. delete the item
  };

  // DeckGL react component's onClick still fires
  // Disable doubleClickZoom to reduce onclick latency (300ms delay added if doubleClickZoom is enabled)
  // we need the 100% height because otherwise the main div has 0px height, and the context menu is constrained to the top of the page.
  return (
    <div
      // style={{ overflow: "hidden", height: "100%" }}
      // onClick={() => console.log('div onClick')}
      onContextMenu={(e) => e.preventDefault()}
    >
      <DeckGL
        onClick={onClick}
        // onHover={(info) => {
        //   if (info.picked) {
        //     console.log('hover', {info});
        //     hoveredFeature.current = info.object;
        //   }
        // }}
        // onWebGLInitialized={setGlContext}
        // is there a nebula.gl option that will drag first time
        // onDrag={(info) => {
        //   console.log('onDrag');
        //   // TODO move item immediately
        //   // if (info.picked){
        //   //   console.log('dragging', {info});
        //   // }
        // }}
        // onHover={}
        getTooltip={(info) => {
          // if hovering over a feature
          if (info.picked && isAltPressedRef.current) {
            return {
              text: `feature ${info.index} from ${info.layer}`,
              style: { top: "10px" },
            };
          }
          return null;
        }}
        getCursor={getCursor}
        controller={{ dragPan: isMapDraggable, doubleClickZoom: false }}
        ref={deckGlRef}
        initialViewState={initialViewState}
        layers={[
          editableGeojsonLayer,
          geojsonLayer,
          isSelectionLayerEnabled ? selectionLayer : undefined,
        ]}
      >
        <Map
          onClick={() => console.log("map onclick")}
          onLoad={onMapLoad}
          ref={mapRef}
          initialViewState={initialViewState}
          style={{ width: 600, height: 400 }}
          // We render a separate component for it to allow it to be clicked. Otherwise, deck.gl prevents clicks. See https://github.com/visgl/deck.gl/issues/4165
          attributionControl={false}
          // doesn't allow dragging still...
          mapStyle="https://demotiles.maplibre.org/style.json"
        >
          {/* https://visgl.github.io/react-map-gl/docs/api-reference/attribution-control#source */}
          <AttributionControl customAttribution="Custom attribution text" />
        </Map>
      </DeckGL>
      <Toolbar />
      <ContextMenu
        onClose={() => setContextMenuOpen(false)}
        anchorPoint={contextMenuAnchorPoint}
        // state={'open'}
        state={isContextMenuOpen ? "open" : "closed"}
      />
    </div>
  );
};
