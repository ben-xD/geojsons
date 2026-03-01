import { useStore } from "@/store/store";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Minus, Plus, Target } from "lucide-react";
import { cn } from "@/lib/utils.ts";
import { useCallback, useEffect, useRef } from "react";
import { FlyToInterpolator } from "deck.gl";

const iconSizePx = 16;

export const ZoomToolbar = () => {
  const zoomIn = useStore.use.zoomIn();
  const zoomOut = useStore.use.zoomOut();
  const setUserLocation = useStore.use.setUserLocation();
  const isUserLocated = !!useStore.use.userLocation();
  const locate = useStore.use.locate();
  const setLocate = useStore.use.setLocate();
  const setViewState = useStore.use.setViewState();

  const watchPositionIdRef = useRef<number | undefined>(undefined);
  const hasFlownToRef = useRef(false);

  const flyToLocation = useCallback(
    (latitude: number, longitude: number) => {
      const viewState = useStore.getState().viewState;
      setViewState({
        ...viewState,
        latitude,
        longitude,
        zoom: 14,
        transitionDuration: 1500,
        transitionInterpolator: new FlyToInterpolator(),
      } as typeof viewState);
    },
    [setViewState],
  );

  const cancelWatch = useCallback(() => {
    if (watchPositionIdRef.current === undefined) return;
    navigator.geolocation.clearWatch(watchPositionIdRef.current);
    watchPositionIdRef.current = undefined;
  }, []);

  const startWatch = useCallback(() => {
    cancelWatch();
    hasFlownToRef.current = false;
    watchPositionIdRef.current = navigator.geolocation.watchPosition((position) => {
      const { latitude, longitude, accuracy, heading } = position.coords;
      setUserLocation({ latitude, longitude, accuracy, heading });
      if (!hasFlownToRef.current) {
        hasFlownToRef.current = true;
        flyToLocation(latitude, longitude);
      }
    });
  }, [cancelWatch, setUserLocation, flyToLocation]);

  const onToggleLocation = () => {
    if (isUserLocated) {
      // Stop tracking
      cancelWatch();
      setUserLocation(undefined);
      setLocate(false);
    } else {
      // Start tracking
      startWatch();
      setLocate(true);
    }
  };

  // Auto-start tracking on mount if preference is persisted
  useEffect(() => {
    if (locate) {
      startWatch();
    }
    return cancelWatch;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const viewState = useStore.use.viewState();

  return (
    <div className="flex-col top-2 md:top-auto md:bottom-4 flex-wrap absolute text-foreground right-2 flex justify-center rounded-xl bg-card drop-shadow-2xl shadow-xl border border-border">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              className={cn(
                "p-2 rounded-lg m-1 transition-all ease-in-out hover:enabled:bg-primary/10 active:enabled:bg-primary active:enabled:text-primary-foreground disabled:text-muted-foreground/50",
                { "bg-primary text-primary-foreground hover:bg-primary/90": isUserLocated },
              )}
              onClick={onToggleLocation}
            >
              <Target size={iconSizePx} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Your location</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              disabled={viewState.zoom >= 20}
              className={cn(
                "p-2 rounded-lg m-1 transition-all ease-in-out hover:enabled:bg-primary/10 active:enabled:bg-primary active:enabled:text-primary-foreground disabled:text-muted-foreground/50",
              )}
              onClick={zoomIn}
            >
              <Plus size={iconSizePx} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Zoom in</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              disabled={viewState.zoom <= 0}
              onClick={zoomOut}
              className={cn(
                "p-2 rounded-lg m-1 transition-all ease-in-out hover:enabled:bg-primary/10 active:enabled:bg-primary active:enabled:text-primary-foreground disabled:text-muted-foreground/50",
              )}
            >
              <Minus size={iconSizePx} />
            </button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Zoom out</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};
