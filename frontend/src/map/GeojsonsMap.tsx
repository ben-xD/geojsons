import { useCallback, useEffect, useRef, useState } from "react";
import Map, { type MapRef, type ViewState } from "react-map-gl/maplibre";
import { DeckGL, type DeckGLRef, type Layer, type PickingInfo } from "deck.gl";
import type { Feature, FeatureCollection } from "@/data/validator/geojson.ts";
import { EditableGeoJsonLayer, SelectionLayer } from "@deck.gl-community/editable-layers";

// CSS for maplibre-gl and react-menu are imported in index.css with layer(base)
// so that Tailwind utilities take precedence over them.
import { useKeyPressedDown } from "../hooks/useKeyPressedDown.tsx";
import type { MapLibreEvent } from "maplibre-gl";
import type maplibregl from "maplibre-gl";
import { MjolnirGestureEvent } from "mjolnir.js";
import { ContextMenu } from "../components/Context/ContextMenu.tsx";
import { useMapHotkeys } from "../editor/useMapHotkeys.tsx";
import { useStore, useEditingMode } from "../store/store.ts";
import { primaryTentativeFillRgba, primaryTentativeLineRgba, featureColors } from "../tokens/colors.ts";
import { Tool } from "../editor/tools.ts";
import { Toolbar } from "../Toolbar.tsx";
import { MapAttribution } from "@/map/MapAttribution.tsx";
import { BenAttribution } from "@/map/BenAttribution.tsx";
import { toolsWithCrosshairCursor } from "@/editor/tools";
import { ZoomToolbar } from "./ZoomToolbar.tsx";
import { useUserLocationLayers } from "@/map/UserLocationLayer";
import { getMapStyle } from "@/map/mapStyles";
import { MapStyleSwitcher } from "@/map/MapStyleSwitcher";
import { useHashViewState } from "@/map/useHashViewState";

const createSvgUrl = (svg: string) => `data:image/svg+xml,${svg}`;

const markerSizeInPx = 36;

// We use double height/width so they look crisp on retina displays
const createMarkerSvg = (color = "currentColor") =>
  createSvgUrl(`<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
<path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C12 22 20 16 20 10C20 7.87827 19.1571 5.84344 17.6569 4.34315C16.1566 2.84285 14.1217 2 12 2C9.87827 2 7.84344 2.84285 6.34315 4.34315C4.84285 5.84344 4 7.87827 4 10C4 16 12 22 12 22ZM15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10Z" fill="${color}"/>
</svg>
`);

const createSelectedMarkerSvg = (color = "currentColor") =>
  createSvgUrl(`<svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
  <path fill-rule="evenodd" clip-rule="evenodd" d="M12 22C12 22 20 16 20 10C20 7.87827 19.1571 5.84344 17.6569 4.34315C16.1566 2.84285 14.1217 2 12 2C9.87827 2 7.84344 2.84285 6.34315 4.34315C4.84285 5.84344 4 7.87827 4 10C4 16 12 22 12 22ZM15 10C15 11.6569 13.6569 13 12 13C10.3431 13 9 11.6569 9 10C9 8.34315 10.3431 7 12 7C13.6569 7 15 8.34315 15 10Z" fill="${color}"/>
  <rect x="2.5" y="0.5" width="19" height="23" rx="1.5" stroke="black" stroke-linejoin="round"/>
  </svg>
`);

interface IconDescription {
  url: string;
  width: number;
  height: number;
  anchorY: number;
}

const markerIconCache = new globalThis.Map<string, { marker: IconDescription; selected: IconDescription }>();

function getMarkerIcons(color: string): { marker: IconDescription; selected: IconDescription } {
  const cached = markerIconCache.get(color);
  if (cached) return cached;
  const result = {
    marker: {
      url: createMarkerSvg(color),
      width: markerSizeInPx,
      height: markerSizeInPx,
      anchorY: markerSizeInPx,
    },
    selected: {
      url: createSelectedMarkerSvg(color),
      width: markerSizeInPx,
      height: markerSizeInPx,
      anchorY: markerSizeInPx,
    },
  };
  markerIconCache.set(color, result);
  return result;
}

const defaultCatMarkerIconDescription: IconDescription = {
  url: "https://upload.wikimedia.org/wikipedia/commons/7/7c/201408_cat.png",
  width: markerSizeInPx,
  height: markerSizeInPx,
  anchorY: markerSizeInPx / 2,
};

// CursorState is not exported from deck.gl, so we define it here.
type CursorState = { isHovering: boolean; isDragging: boolean };

const editableGeojsonLayerId = "editable-geojson-layer";

// When using the @deck.gl/mapbox module, and MapboxLayer and MapboxOverlay https://deck.gl/docs/api-reference/mapbox/overview
// Mapbox is the root element and deck.gl is the child, with Mapbox handling all user inputs
// it is recommended that you use deck.gl as the root element, so we are doing the opposite.

// To debug deck.gl, run the following in the browser console, as per https://deck.gl/docs/developer-guide/debugging.
// However, it makes the shapes dissapear and an error (`luma.gl: assertion failed.`)
// deck.log.enable();
// deck.log.level = 3; // or 1 or 2

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

const DRAGGING_EDIT_TYPES = new Set([
  'translating', 'scaling', 'rotating', 'movePosition',
]);
const DRAG_FINISHED_EDIT_TYPES = new Set([
  'translated', 'scaled', 'rotated', 'finishMovePosition',
]);

export const GeojsonsMap = () => {
  useHashViewState();
  useMapHotkeys();
  const editingMode = useEditingMode();
  const tool = useStore.use.tool();
  const setTool = useStore.use.setTool();
  const fc = useStore.use.featureCollection();
  const updateFc = useStore.use.updateFeatureCollection();
  const pickable = useStore.use.pickable();
  const setPickable = useStore.use.setPickable();
  const selectedFeatureIndexes = useStore.use.selectedFeatureIndexes();
  const setSelectedFeatureIndexes = useStore.use.setSelectedFeatureIndexes();
  const isMapDraggable = useStore.use.isMapDraggable();
  const setIsMapDraggable = useStore.use.setIsMapDraggable();
  const isDoubleClickZoomEnabled = useStore.use.isDoubleClickZoomEnabled();
  const viewState = useStore.use.viewState();
  const setViewState = useStore.use.setViewState();
  const mapStyleId = useStore.use.mapStyleId();
  const mapStyleConfig = getMapStyle(mapStyleId);
  const colors = featureColors[mapStyleConfig.variant];
  const icons = getMarkerIcons(colors.marker);

  const [draggedFc, setDraggedFc] = useState<FeatureCollection | undefined>();
  const featureCollectionRef = useRef<FeatureCollection | undefined>(undefined);

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
        return [...colors.fillSelected];
      }
      return [...colors.fill];
    },
    pickable,
    modeConfig: {
      viewport: viewState,
      dragToDraw: true,
      screenSpace: true,
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
    getLineColor: [...colors.line],
    autoHighlight: true,
    highlightColor: [...colors.highlight],
    selectedFeatureIndexes,
    mode: editingMode,
    onClick: (pickInfo: PickingInfo, hammerInput: MjolnirGestureEvent) => {
      console.log("click", { pickInfo, hammerInput, fc });
      // onClick is called even when user clicks on guide features
      if ("isGuide" in pickInfo && pickInfo.isGuide) return;
      setSelectedFeatureIndexes([pickInfo.index]);

      // The types are wrong again... tapCount exists.
      if (pickInfo.picked && "tapCount" in hammerInput && hammerInput.tapCount === 2) {
        setTool(Tool.edit);
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
          getIcon: [selectedFeatureIndexes, hoveredFeatureIndex, mapStyleConfig.variant],
        },
        getIcon: (feature: Feature) => {
          const index = fc.features.indexOf(feature);
          if (feature.properties?.type === "cat") {
            return defaultCatMarkerIconDescription;
          } else {
            if (selectedFeatureIndexes.includes(index)) {
              return icons.selected;
            }
            return icons.marker;
          }
        },

        iconSizeScale: 1,
        getIconSize: markerSizeInPx,
      },
    },
    // types say it takes a function with 4 args, but actually it gets a single object argument, with 4 properties
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
      if (!updatedData?.features) {
        console.error("onEdit called with no features", { updatedData, editType, featureIndexes, editContext });
        return;
      }
      if (editType === 'updateTentativeFeature' || editType === 'cancelFeature') return;

      if (DRAGGING_EDIT_TYPES.has(editType)) {
        featureCollectionRef.current = updatedData;
        setDraggedFc(updatedData);
        return;
      }
      if (DRAG_FINISHED_EDIT_TYPES.has(editType)) {
        setDraggedFc(undefined);
        featureCollectionRef.current = undefined;
        updateFc(updatedData);
        return;
      }

      // Non-drag edits: addFeature, addPosition, removePosition, etc.
      if (editType === "addFeature" && tool === Tool.catMarker) {
        updatedData.features[updatedData.features.length - 1].properties = { type: "cat" };
      }
      updateFc(updatedData);
    },
  };

  const editableGeojsonLayer = new EditableGeoJsonLayer(
    // @ts-expect-error TS2554 Workaround for error `TS2554: Expected 0 arguments, but got 1.`,
    // see https://github.com/uber/nebula.gl/issues/568#issuecomment-1986910461
    editableGeojsonLayerProps,
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
  // @ts-expect-error TS2554 workaround nebula.gl types using https://github.com/uber/nebula.gl/issues/568#issuecomment-836324975
  const selectionLayer = new SelectionLayer<FeatureCollection>({
    id: "selection",
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
        setSelectedFeatureIndexes(Array.from(pickingInfos.map((pi: PickingInfo) => pi.index)));
      }
    },
    layerIds: [editableGeojsonLayerId],
    getTentativeFillColor: () => primaryTentativeFillRgba,
    getTentativeLineColor: () => primaryTentativeLineRgba,
    getTentativeLineDashArray: () => [0, 0],
    // getlineWidth: 1,
    getTentativeLineWidth: 1,
  });

  useKeyPressedDown({
    key: "space",
    onKeyDown: () => {
      setIsMapDraggable(true);
      setPickable(false);
    },
    onKeyUp: () => {
      const currentTool = useStore.getState().tool;
      setIsMapDraggable(currentTool === Tool.hand);
      setPickable(currentTool !== Tool.hand);
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

  const mapRef = useRef<MapRef>(null);

  const applyTerrain = useCallback(
    (map: maplibregl.Map) => {
      const terrainSourceId = "terrain";
      if (map.getSource(terrainSourceId)) return;
      map.addSource(terrainSourceId, {
        type: "raster-dem",
        url: mapStyleConfig.terrainSourceUrl,
      });
      map.setTerrain({ source: terrainSourceId });
    },
    [mapStyleConfig.terrainSourceUrl],
  );

  const onMapLoad = useCallback(
    (e: MapLibreEvent) => {
      const map = e.target;
      map.setMaxPitch(85);
      applyTerrain(map);
      map.on("contextmenu", () => {
        console.log("contextmenu clicked");
      });
    },
    [applyTerrain],
  );

  // Re-apply terrain when map style changes (changing mapStyle prop destroys all sources)
  useEffect(() => {
    const map = mapRef.current?.getMap();
    if (!map) return;

    const onStyleLoad = () => applyTerrain(map);
    map.on("style.load", onStyleLoad);
    return () => {
      map.off("style.load", onStyleLoad);
    };
  }, [mapStyleId, applyTerrain]);
  // {/*"https://api.maptiler.com/maps/outdoor-v2/style.json?key=LlETYKEJwgxoM6pCNChm",*/}
  // When you use DeckGL as the parent, you are using DeckGL's controller.
  // It has identical implementation as react-map-gl's controller, but different defaults for
  // backward-compatibility reasons.
  // Disabling browser context menu with an extra div. See https://github.com/visgl/deck.gl/discussions/6103
  const getCursor = useCallback(
    (state: CursorState) => {
      // console.log(`getCursor. ${state.isDragging} ${state.isHovering}`);
      if (state.isHovering) {
        return "pointer";
      } else if (toolsWithCrosshairCursor.has(tool)) {
        return "crosshair";
      } else {
        return isMapDraggable ? "grab" : "default";
      }
    },
    [isMapDraggable, tool],
  );

  const userLocationLayers = useUserLocationLayers();

  const onClick = (info: PickingInfo, event: MjolnirGestureEvent) => {
    if (!info.picked && tool === Tool.select) {
      setSelectedFeatureIndexes([]);
    }
    if (!info.picked && tool === Tool.edit && "tapCount" in event && event.tapCount === 2) {
      setSelectedFeatureIndexes([]);
      setTool(Tool.select);
    }
    if (info.picked && event.rightButton) {
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
        controller={{
          dragPan: isMapDraggable,
          doubleClickZoom: isDoubleClickZoomEnabled,
        }}
        ref={deckGlRef}
        // Use Object.assign to create a new object instead of mutating it, to avoid error: `Object is not extensible`
        initialViewState={Object.assign({}, viewState)}
        onViewStateChange={(params) =>
          setViewState(Object.assign({}, params.viewState as unknown as ViewState))
        }
        layers={[
          editableGeojsonLayer as unknown as Layer,
          isSelectionLayerEnabled ? (selectionLayer as unknown as Layer) : undefined,
          userLocationLayers,
        ]}
      >
        <Map
          ref={mapRef}
          onLoad={onMapLoad}
          onClick={() => console.log("map onclick")}
          style={{ width: 600, height: 400 }}
          attributionControl={false}
          mapStyle={mapStyleConfig.url}
        >
          {/* https://visgl.github.io/react-map-gl/docs/api-reference/attribution-control#source */}
        </Map>
      </DeckGL>
      <MapAttribution />
      <MapStyleSwitcher />
      <ZoomToolbar />
      <Toolbar />
      <BenAttribution />
      <ContextMenu
        onClose={() => setContextMenuOpen(false)}
        anchorPoint={contextMenuAnchorPoint}
        // state={'open'}
        state={isContextMenuOpen ? "open" : "closed"}
      />
    </div>
  );
};
