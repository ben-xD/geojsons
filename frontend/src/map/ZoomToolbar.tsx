import { useStore } from "@/store/store";
import { Minus, Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useEffect, useRef } from "react";

const iconSizePx = 16;

export const ZoomToolbar = () => {
  const zoomIn = useStore.use.zoomIn();
  const zoomOut = useStore.use.zoomOut();
  const setUserLocation = useStore.use.setUserLocation();
  const isUserLocated = !!useStore.use.userLocation();

  const watchPositionIntervalIdRef = useRef<number>();
  const onShowUserLocation = () => {
    setUserLocation(undefined);
    cancelWatch();
    watchPositionIntervalIdRef.current = navigator.geolocation.watchPosition(
      (position) => {
        // More data on position (https://developer.mozilla.org/en-US/docs/Web/API/GeolocationCoordinates), but I only want to show the user on the map
        const { latitude, longitude, accuracy, heading } = position.coords;
        setUserLocation({ latitude, longitude, accuracy, heading });
      },
    );
  };

  const cancelWatch = () => {
    if (!watchPositionIntervalIdRef.current) return;
    navigator.geolocation.clearWatch(watchPositionIntervalIdRef.current);
  };

  useEffect(() => {
    return cancelWatch;
  }, []);

  const viewState = useStore.use.viewState();

  return (
    <div className="flex-col top-4 md:top-auto md:bottom-4 flex-wrap absolute text-slate-700 right-4 flex justify-center rounded-xl bg-white drop-shadow-2xl shadow-xl border border-1 border-slate-300">
      <button
        className={cn(
          "p-2 rounded-lg m-1 transition-all ease-in-out hover:enabled:bg-blue-100 active:enabled:bg-blue-500 disabled:text-slate-300",
          { "bg-blue-500 text-white hover:bg-blue-600": isUserLocated },
        )}
        onClick={onShowUserLocation}
      >
        <Target size={iconSizePx} />
      </button>
      <button
        disabled={viewState.zoom >= 20}
        className={cn(
          "p-2 rounded-lg m-1 transition-all ease-in-out hover:enabled:bg-blue-100 active:enabled:bg-blue-500 disabled:text-slate-300",
        )}
        onClick={zoomIn}
      >
        <Plus size={iconSizePx} />
      </button>
      <button
        disabled={viewState.zoom <= 0}
        onClick={zoomOut}
        className={cn(
          "p-2 rounded-lg m-1 transition-all ease-in-out hover:enabled:bg-blue-100 active:enabled:bg-blue-500 disabled:text-slate-300",
        )}
      >
        <Minus size={iconSizePx} />
      </button>
    </div>
  );
};
