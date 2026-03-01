import { v4 as uuidv4 } from "uuid";
import { GeojsonsStateCreator } from "./store";

export interface SavedLocation {
  id: string;
  latitude: number;
  longitude: number;
  name: string;
  savedAt: number;
}

export interface SavedLocationsSlice {
  savedLocations: SavedLocation[];
  addSavedLocation: (location: Omit<SavedLocation, "id" | "savedAt">) => void;
  removeSavedLocation: (id: string) => void;
}

export const createSavedLocationsSlice: GeojsonsStateCreator<SavedLocationsSlice> = (set) => ({
  savedLocations: [],
  addSavedLocation: (location) =>
    set((state) => {
      state.savedLocations.push({
        ...location,
        id: uuidv4(),
        savedAt: Date.now(),
      });
    }),
  removeSavedLocation: (id) =>
    set((state) => {
      state.savedLocations = state.savedLocations.filter((loc) => loc.id !== id);
    }),
});
