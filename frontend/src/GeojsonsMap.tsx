import { useCallback, useEffect, useRef, useState } from "react";
import Map, { AttributionControl, MapRef } from "react-map-gl/maplibre";
import DeckGL, {
  DeckGLRef,
  DeckProps,
  Layer,
  PickingInfo,
} from "deck.gl/typed";
import type { Feature, FeatureCollection } from "geojson";
import { EditableGeoJsonLayer } from "@nebula.gl/layers";

// Following some random github issue to fix styling
import "maplibre-gl/dist/maplibre-gl.css";
// Following https://szhsin.github.io/react-menu#context-menu
import "@szhsin/react-menu/dist/index.css";
import { useKeyPressedDown } from "./hooks/useKeyPressedDown.tsx";
import { MapLibreEvent } from "maplibre-gl";
import { MjolnirGestureEvent } from "mjolnir.js";
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

const createSvgUrl = (svg: string) => `data:image/svg+xml,${svg}`;

const markerSizeInPx = 36;

const markerSvg =
  createSvgUrl(`<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C12 22 20 16 20 10C20 7.87827 19.1571 5.84344 17.6569 4.34315C16.1566 2.84285 14.1217 2 12 2C9.87827 2 7.84344 2.84285 6.34315 4.34315C4.84285 5.84344 4 7.87827 4 10C4 16 12 22 12 22ZM15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10Z" fill="black"/>
</svg>
`);

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

// declaration merge to override contructor for EditableGeoJsonLayer. Unfortunately the types say
// EditableGeoJsonLayer constructor takes 0 args.
// This didn't help fix error for SelectionLayer: `error TS2554: Expected 0 arguments, but got 1.`
// declare module "@nebula.gl/layers" {
//   interface EditableGeoJsonLayer {
//     new: (
//       props: EditableGeojsonLayerProps<FeatureCollection>
//     ) => EditableGeoJsonLayer;
//   }

//   interface SelectionLayerProps extends CompositeLayerProps {
//     layerIds: string[];
//     onSelect: (info: PickingInfo[]) => boolean;
//     selectionType: string | null;
//   }

//   interface SelectionLayer<D> {
//     new: (props: SelectionLayerProps) => SelectionLayer<D>;
//   }
// }

export const GeojsonsMap = () => {
  useMapHotkeys();
  const editingMode = useEditingMode();
  const tool = useBoundStore.use.tool();
  const setTool = useBoundStore.use.setTool();
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

  const [hoveredFeatureIndex, setHoveredFeatureIndex] = useState<number>();
  // The types for nebula aren't very good yet. Using EditableGeojsonLayerProps<FeatureCollection> here
  // will throw error: error TS2353: Object literal may only specify known properties, and 'opacity' does not exist
  // in type 'EditableGeojsonLayerProps<FeatureCollection<Geometry, GeoJsonProperties>>'.
  // TODO type our own EditableGeojsonLayerProps correctly, because we can't use EditableGeojsonLayerProps<FeatureCollection>
  const editableGeojsonLayerProps = {
    opacity: 1,
    id: editableGeojsonLayerId,
    data: draggedFc ?? fc,
    getFillColor: (_feature: Feature, isSelected: boolean) => {
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
    getLineWidth: (feature: Feature) => {
      if (feature.geometry.type === "LineString") {
        return 4;
      }
      return 1;
    },
    getEditHandlePointColor: [0, 0, 0, 255],
    getTentativeLineWidth: 1,
    getLineColor: [57, 62, 65, 200],
    autoHighlight: true,
    highlightColor: [57, 62, 65, 50],
    selectedFeatureIndexes,
    mode: editingMode,
    onClick: (pickInfo: PickingInfo, hammerInput: MjolnirGestureEvent) => {
      console.log("click", { pickInfo, hammerInput, fc });
      // onClick is called even when user clicks on guide features
      if ("isGuide" in pickInfo && pickInfo.isGuide) return;
      setSelectedFeatureIndexes([pickInfo.index]);

      // The types are wrong again... tapCount exists.
      if (
        pickInfo.picked &&
        "tapCount" in hammerInput &&
        hammerInput.tapCount === 2
      ) {
        setTool(Tool.edit);
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
              width: markerSizeInPx,
              height: markerSizeInPx,
              anchorY: markerSizeInPx / 2,
            };
          } else if (hovered) {
            // return a different icon when hovered
          }
          if (feature.properties?.type === "cat") {
            // TODO refactor into iconDescription or Icon
            return {
              url: "https://upload.wikimedia.org/wikipedia/commons/7/7c/201408_cat.png",
              width: markerSizeInPx,
              height: markerSizeInPx,
              anchorY: markerSizeInPx / 2,
            };
          }
          return {
            url: markerSvg,
            width: markerSizeInPx,
            height: markerSizeInPx,
            anchorY: markerSizeInPx / 2,
          };
        },

        iconSizeScale: 1,
        getIconSize: markerSizeInPx,
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

    onEdit: ({
      updatedData,
      editType,
      featureIndexes,
      editContext,
    }: {
      updatedData: FeatureCollection | undefined;
      editType: string;
      featureIndexes: number[];
      editContext: Feature;
    }) => {
      console.log("onEdit", {
        updatedData,
        editType,
        featureIndexes,
        editContext,
      });
      if (isDraggingRef.current) {
        featureCollectionRef.current = updatedData;
        setDraggedFc(updatedData);
        return;
      }
      if (updatedData && updatedData.features) {
        // onEdit is called even when there are no changes (clicking on the map for the first time)
        if (updatedData.features.length === fc.features.length) return;
        if (editType === "addFeature" && tool === Tool.catMarker) {
          const newFeature =
            updatedData.features[updatedData.features.length - 1];
          newFeature.properties = { type: "cat" };
        }
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

  // workaround nebula.gl types using https://github.com/uber/nebula.gl/issues/568#issuecomment-836324975
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editableGeojsonLayer = new (EditableGeoJsonLayer as any)(
    editableGeojsonLayerProps
  );

  // TODO only use selection layer if "select tool" is active (to prevent drawing selection when moving features)
  // It is usually better for performance to just use visible:false instead of removing the layer.
  // Remove selectionLayer completely instead of using visible prop because visible: will still prevent
  // dragPan from being set to true.
  const isSelectionLayerEnabled =
    selectedFeatureIndexes.length === 0 &&
    !isMapDraggable &&
    (tool === "select" || tool === Tool.edit);
  const selectionType = tool === "select" ? "rectangle" : "polygon";
  // workaround nebula.gl types using https://github.com/uber/nebula.gl/issues/568#issuecomment-836324975
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const selectionLayer = new (SelectionLayer<FeatureCollection> as any)({
    id: "selection",
    // visible: isSelectionLayerVisible,
    selectionType,
    // selectionType: "polygon",
    onSelect: ({ pickingInfos }: { pickingInfos: PickingInfo[] }) => {
      console.log(`onSelect`, { pickingInfos });
      // Even though layer is invisible, onSelect will still be called if the layer is added. However, since we remove the layer, this is not necessary. It would be necessary if we use visible: instead of removing it.
      // if (!isSelectionLayerVisible) return;
      console.log(`onSelect`, { pickingInfos });
      if (pickingInfos.length === 0) {
        setSelectedFeatureIndexes([]);
      } else {
        setSelectedFeatureIndexes(
          Array.from(pickingInfos.map((pi: PickingInfo) => pi.index))
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

  useEffect(() => {
    setIsMapDraggable(tool === Tool.hand);
    setPickable(tool !== Tool.hand);
  }, [setIsMapDraggable, setPickable, tool]);

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
    [isMapDraggable]
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
      className="relative size-full flex flex-col items-center"
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
          editableGeojsonLayer as unknown as Layer,
          isSelectionLayerEnabled
            ? (selectionLayer as unknown as Layer)
            : undefined,
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
