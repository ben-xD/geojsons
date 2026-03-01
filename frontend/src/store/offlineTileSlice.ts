import type { OfflineRegion } from "@/offline/tileBackend";
import type { GeojsonsStateCreator } from "./store";

export interface OfflineTileSlice {
  offlineTileBackend: "indexeddb" | "node";
  setOfflineTileBackend: (backend: "indexeddb" | "node") => void;
  showOfflineTiles: boolean;
  setShowOfflineTiles: (show: boolean) => void;
  maxDownloadBytes: number;
  setMaxDownloadBytes: (bytes: number) => void;
  offlineRegions: OfflineRegion[];
  setOfflineRegions: (regions: OfflineRegion[]) => void;
  addOfflineRegion: (region: OfflineRegion) => void;
  updateOfflineRegion: (id: string, updates: Partial<OfflineRegion>) => void;
  removeOfflineRegion: (id: string) => void;
  activeDownloads: Record<string, { downloaded: number; total: number; sizeBytes: number }>;
  setDownloadProgress: (id: string, downloaded: number, total: number, sizeBytes?: number) => void;
  removeDownload: (id: string) => void;
}

export const createOfflineTileSlice: GeojsonsStateCreator<OfflineTileSlice> = (set) => ({
  offlineTileBackend: "indexeddb",
  setOfflineTileBackend: (backend) =>
    set((state) => {
      state.offlineTileBackend = backend;
    }),
  showOfflineTiles: false,
  setShowOfflineTiles: (show) =>
    set((state) => {
      state.showOfflineTiles = show;
    }),
  maxDownloadBytes: 500 * 1024 * 1024, // 500 MB
  setMaxDownloadBytes: (bytes) =>
    set((state) => {
      state.maxDownloadBytes = bytes;
    }),
  offlineRegions: [],
  setOfflineRegions: (regions) =>
    set((state) => {
      state.offlineRegions = regions;
    }),
  addOfflineRegion: (region) =>
    set((state) => {
      state.offlineRegions.push(region);
    }),
  updateOfflineRegion: (id, updates) =>
    set((state) => {
      const idx = state.offlineRegions.findIndex((r) => r.id === id);
      if (idx !== -1) {
        Object.assign(state.offlineRegions[idx], updates);
      }
    }),
  removeOfflineRegion: (id) =>
    set((state) => {
      state.offlineRegions = state.offlineRegions.filter((r) => r.id !== id);
    }),
  activeDownloads: {},
  setDownloadProgress: (id, downloaded, total, sizeBytes) =>
    set((state) => {
      state.activeDownloads[id] = { downloaded, total, sizeBytes: sizeBytes ?? state.activeDownloads[id]?.sizeBytes ?? 0 };
    }),
  removeDownload: (id) =>
    set((state) => {
      delete state.activeDownloads[id];
    }),
});
