import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/store/store";
import { getFeatureCenter } from "@/geo/featureCenter";
import { reverseGeocode } from "@/map/geocode";
import { getMapStyle } from "@/map/mapStyles";
import type { Feature } from "@/data/validator/geojson";

function isUnnamed(feature: Feature): boolean {
  return !feature.properties?.name && !feature.properties?.title;
}

export function useGeocodeAllFeatures() {
  const features = useStore.use.featureCollection().features;
  const geocodeFeature = useStore.use.geocodeFeature();
  const mapStyleId = useStore.use.mapStyleId();

  const [isGeocoding, setIsGeocoding] = useState(false);
  const [completed, setCompleted] = useState(0);
  const [total, setTotal] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const unnamedCount = features.filter(
    (f) => f.id && isUnnamed(f) && getFeatureCenter(f) !== null,
  ).length;

  const startGeocoding = useCallback(async () => {
    const state = useStore.getState();
    const provider = getMapStyle(state.mapStyleId).provider;
    const currentFeatures = state.featureCollection.features;

    const toGeocode = currentFeatures.filter(
      (f) => f.id && isUnnamed(f) && getFeatureCenter(f) !== null,
    );

    if (toGeocode.length === 0) return;

    const controller = new AbortController();
    abortRef.current = controller;
    setIsGeocoding(true);
    setCompleted(0);
    setTotal(toGeocode.length);

    for (let i = 0; i < toGeocode.length; i++) {
      if (controller.signal.aborted) break;

      const feature = toGeocode[i];
      const center = getFeatureCenter(feature)!;
      try {
        const name = await reverseGeocode(
          center[1],
          center[0],
          provider,
          controller.signal,
        );
        if (!controller.signal.aborted) {
          geocodeFeature(String(feature.id), name);
          setCompleted(i + 1);
        }
      } catch {
        // AbortError or network failure — skip
      }
    }

    abortRef.current = null;
    setIsGeocoding(false);
  }, [geocodeFeature, mapStyleId]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  // Cancel on unmount
  useEffect(() => () => abortRef.current?.abort(), []);

  return { unnamedCount, isGeocoding, completed, total, startGeocoding, cancel };
}
