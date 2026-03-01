export interface OfflineRegion {
  id: string;
  name: string;
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon;
  zoomMin: number;
  zoomMax: number;
  tileCount: number;
  downloadedCount: number;
  status: "pending" | "downloading" | "complete" | "error";
  createdAt: string;
  sizeBytes: number;
}

export interface StorageStats {
  used: number;       // bytes used by offline tiles
  quota?: number;     // total quota (if known)
}

export interface TileBackend {
  getTile(z: number, x: number, y: number): Promise<ArrayBuffer | null>;
  hasTile(z: number, x: number, y: number): Promise<boolean>;
  storeTile(z: number, x: number, y: number, data: ArrayBuffer): Promise<void>;
  getRegions(): Promise<OfflineRegion[]>;
  createRegion(region: Omit<OfflineRegion, "id">): Promise<string>;
  updateRegion(id: string, updates: Partial<OfflineRegion>): Promise<void>;
  deleteRegion(id: string): Promise<void>;
  getStorageStats(): Promise<StorageStats>;
}
