import { useStore } from "@/store/store";
import { useState, useCallback } from "react";
import { MapPin, Search, Trash2 } from "lucide-react";
import { reverseGeocode } from "@/map/geocode";
import { getMapStyle } from "@/map/mapStyles";
import { flyToPoint } from "@/map/flyTo";

export const SavedLocationsPanel = () => {
  const savedLocations = useStore.use.savedLocations();
  const addSavedLocation = useStore.use.addSavedLocation();
  const removeSavedLocation = useStore.use.removeSavedLocation();
  const mapStyleId = useStore.use.mapStyleId();

  const [search, setSearch] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const saveCurrentLocation = useCallback(async () => {
    setIsSaving(true);
    const { latitude, longitude } = useStore.getState().viewState;
    const provider = getMapStyle(mapStyleId).provider;
    const name = await reverseGeocode(latitude, longitude, provider);
    addSavedLocation({ latitude, longitude, name });
    setIsSaving(false);
  }, [addSavedLocation, mapStyleId]);

  const filtered = search
    ? savedLocations.filter((loc) => loc.name.toLowerCase().includes(search.toLowerCase()))
    : savedLocations;

  return (
    <div className="flex flex-col h-full overflow-hidden p-2 gap-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground" size={14} />
          <input
            type="text"
            placeholder="Search locations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-7 pr-2 py-1.5 text-sm rounded-md border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>
        <button
          onClick={saveCurrentLocation}
          disabled={isSaving}
          className="px-3 py-1.5 text-sm rounded-md bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 shrink-0"
        >
          {isSaving ? "Saving..." : "Save current"}
        </button>
      </div>

      <div className="flex-1 overflow-auto flex flex-col gap-1">
        {savedLocations.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No saved locations. Use the pin tool or click "Save current" to save the map center.
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground">
            No locations matching "{search}".
          </div>
        ) : (
          filtered.map((loc) => (
            <div
              key={loc.id}
              className="flex items-center gap-2 px-3 py-2 rounded-md text-sm hover:bg-muted cursor-pointer group"
              onClick={() => flyToPoint(loc.latitude, loc.longitude)}
            >
              <MapPin size={14} className="text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="truncate">{loc.name}</div>
                <div className="text-xs text-muted-foreground">
                  {loc.latitude.toFixed(5)}, {loc.longitude.toFixed(5)}
                </div>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  removeSavedLocation(loc.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-destructive/10 hover:text-destructive transition-all"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
