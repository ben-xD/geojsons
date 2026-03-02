import type { OfflineRegion } from "@/offline/tileBackend";
import type { GeojsonsStateCreator } from "./store";

export type OfflineTileBackendType = "indexeddb" | "node";

export interface DownloadProgress {
  downloaded: number;
  total: number;
  sizeBytes: number;
}

export interface OfflineTileSlice {
  offlineTileBackend: OfflineTileBackendType;
  setOfflineTileBackend: (backend: OfflineTileBackendType) => void;
  preferOffline: boolean;
  setPreferOffline: (prefer: boolean) => void;
  offlineRegionsByBackend: Record<OfflineTileBackendType, OfflineRegion[]>;
  setOfflineRegions: (backend: OfflineTileBackendType, regions: OfflineRegion[]) => void;
  addOfflineRegion: (backend: OfflineTileBackendType, region: OfflineRegion) => void;
  updateOfflineRegion: (
    backend: OfflineTileBackendType,
    id: string,
    updates: Partial<OfflineRegion>,
  ) => void;
  removeOfflineRegion: (backend: OfflineTileBackendType, id: string) => void;
  activeDownloadsByBackend: Record<OfflineTileBackendType, Record<string, DownloadProgress>>;
  setDownloadProgress: (
    backend: OfflineTileBackendType,
    id: string,
    downloaded: number,
    total: number,
    sizeBytes?: number,
  ) => void;
  removeDownload: (backend: OfflineTileBackendType, id: string) => void;
}

export const createOfflineTileSlice: GeojsonsStateCreator<OfflineTileSlice> = (set) => ({
  offlineTileBackend: "indexeddb",
  setOfflineTileBackend: (backend) =>
    set((state) => {
      state.offlineTileBackend = backend;
    }),
  preferOffline: false,
  setPreferOffline: (prefer) =>
    set((state) => {
      state.preferOffline = prefer;
    }),
  offlineRegionsByBackend: { indexeddb: [], node: [] },
  setOfflineRegions: (backend, regions) =>
    set((state) => {
      state.offlineRegionsByBackend[backend] = regions;
    }),
  addOfflineRegion: (backend, region) =>
    set((state) => {
      state.offlineRegionsByBackend[backend].push(region);
    }),
  updateOfflineRegion: (backend, id, updates) =>
    set((state) => {
      const idx = state.offlineRegionsByBackend[backend].findIndex((r) => r.id === id);
      if (idx !== -1) {
        Object.assign(state.offlineRegionsByBackend[backend][idx], updates);
      }
    }),
  removeOfflineRegion: (backend, id) =>
    set((state) => {
      state.offlineRegionsByBackend[backend] = state.offlineRegionsByBackend[backend].filter(
        (r) => r.id !== id,
      );
    }),
  activeDownloadsByBackend: { indexeddb: {}, node: {} },
  setDownloadProgress: (backend, id, downloaded, total, sizeBytes) =>
    set((state) => {
      state.activeDownloadsByBackend[backend][id] = {
        downloaded,
        total,
        sizeBytes: sizeBytes ?? state.activeDownloadsByBackend[backend][id]?.sizeBytes ?? 0,
      };
    }),
  removeDownload: (backend, id) =>
    set((state) => {
      delete state.activeDownloadsByBackend[backend][id];
    }),
});
