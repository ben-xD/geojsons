import { FeatureCollection } from "@/data/validator/geojson";
import { useStore } from "@/store/store";
import { GeoJsonLayer } from "deck.gl/typed";

export const useUserLocationLayers = () => {
  const userLocation = useStore.use.userLocation();
  if (!userLocation) return null;

  const fc: FeatureCollection = {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [userLocation.longitude, userLocation.latitude],
        },
        properties: {},
      },
    ],
  };

  const layer = new GeoJsonLayer({
    id: "user-location-layer",
    data: fc,
    pointType: "circle",
    filled: true,
    extruded: true,
    pointRadiusMinPixels: 8,
    lineWidthScale: 1,
    lineWidthMinPixels: 2,
    getFillColor: [59, 130, 246, 255],
    getLineColor: (d) => [255, 255, 255, 255],
    getLineWidth: 0,
    getPointRadius: 0,
  });

  const accuracy = new GeoJsonLayer({
    id: "user-location-accuracy-layer",
    data: fc,
    opacity: 0.1,
    pointType: "circle",
    stroked: false,
    filled: true,
    extruded: true,
    pointRadiusMinPixels: 8,
    lineWidthScale: 1,
    lineWidthMinPixels: 2,
    getFillColor: [59, 130, 246, 255],
    getLineWidth: 0,
    getPointRadius: userLocation.accuracy,
  });

  return [accuracy, layer];
};
