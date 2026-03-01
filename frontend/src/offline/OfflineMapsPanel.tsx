import { useRef, useState, useEffect } from "react";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";
import { Download, Trash2, Loader2, ShieldCheck, RefreshCw } from "lucide-react";
import { bboxFromPolygon, estimateTileCount, getTilesForBbox, polygonAreaKm2 } from "./tileCoords";
import { flyToBbox } from "@/map/flyTo";
import { downloadTiles, verifyTiles, type VerifyResult } from "./downloadManager";
import { indexedDbBackend } from "./indexedDbBackend";
import { nodeBackend } from "./nodeBackend";
import { startNodeDownload, pollNodeRegion } from "./nodeBackend";
import type { OfflineRegion, StorageStats } from "./tileBackend";
import { reverseGeocode } from "@/map/geocode";
import { getMapStyle } from "@/map/mapStyles";

const ZOOM_RANGE: [number, number] = [10, 16];
const AVG_TILE_SIZE_KB = 15;

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const OfflineMapsPanel = () => {
  const fc = useStore.use.featureCollection();
  const offlineTileBackend = useStore.use.offlineTileBackend();
  const setOfflineTileBackend = useStore.use.setOfflineTileBackend();
  const showOfflineTiles = useStore.use.showOfflineTiles();
  const setShowOfflineTiles = useStore.use.setShowOfflineTiles();
  const offlineRegions = useStore.use.offlineRegions();
  const addOfflineRegion = useStore.use.addOfflineRegion();
  const updateOfflineRegion = useStore.use.updateOfflineRegion();
  const setOfflineRegions = useStore.use.setOfflineRegions();
  const removeOfflineRegion = useStore.use.removeOfflineRegion();
  const activeDownloads = useStore.use.activeDownloads();
  const setDownloadProgress = useStore.use.setDownloadProgress();
  const removeDownload = useStore.use.removeDownload();
  const mapStyleId = useStore.use.mapStyleId();
  const maxDownloadBytes = useStore.use.maxDownloadBytes();

  const abortControllers = useRef<Record<string, AbortController>>({});
  const [geocodedNames, setGeocodedNames] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState<Record<string, { checked: number; total: number }>>({});
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
  const [storageStats, setStorageStats] = useState<StorageStats | null>(null);
  const [downloadingIndexes, setDownloadingIndexes] = useState<Set<number>>(new Set());

  // Fetch storage stats on mount, backend change, and after regions change
  useEffect(() => {
    let cancelled = false;
    const backend = offlineTileBackend === "node" ? nodeBackend : indexedDbBackend;
    backend.getStorageStats().then((stats) => {
      if (!cancelled) setStorageStats(stats);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [offlineTileBackend, offlineRegions]);

  const polygons = fc.features
    .map((f, i) => ({ feature: f, index: i }))
    .filter(
      ({ feature }) =>
        feature.geometry.type === "Polygon" || feature.geometry.type === "MultiPolygon",
    );

  // Reverse geocode polygon centers for display names
  useEffect(() => {
    const controller = new AbortController();
    const provider = getMapStyle(mapStyleId).provider;

    const toGeocode = polygons.filter(
      ({ feature, index }) =>
        !feature.properties?.name && !geocodedNames[index],
    );
    if (toGeocode.length === 0) return;

    (async () => {
      const results: Record<string, string> = {};
      for (const { feature, index } of toGeocode) {
        if (controller.signal.aborted) return;
        const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
        const [minLng, minLat, maxLng, maxLat] = bboxFromPolygon(geometry);
        const lat = (minLat + maxLat) / 2;
        const lng = (minLng + maxLng) / 2;
        try {
          results[index] = await reverseGeocode(lat, lng, provider, controller.signal);
        } catch {
          // ignore abort / network errors
        }
      }
      if (!controller.signal.aborted && Object.keys(results).length > 0) {
        setGeocodedNames((prev) => ({ ...prev, ...results }));
      }
    })();

    return () => controller.abort();
  }, [polygons.map(({ index }) => index).join(","), mapStyleId]);

  function resolvedName(feature: GeoJSON.Feature, index: number): string {
    if (feature.properties?.name) return feature.properties.name;
    if (geocodedNames[index]) return geocodedNames[index];
    return `Polygon ${index + 1}`;
  }

  const handleDownload = async (feature: GeoJSON.Feature, featureIndex: number) => {
    if (downloadingIndexes.has(featureIndex)) return;
    setDownloadingIndexes((prev) => new Set(prev).add(featureIndex));

    const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
    const bbox = bboxFromPolygon(geometry);
    const tiles = getTilesForBbox(bbox, ZOOM_RANGE);
    const name = resolvedName(feature, featureIndex);

    const region: Omit<OfflineRegion, "id"> = {
      name,
      polygon: geometry,
      zoomMin: ZOOM_RANGE[0],
      zoomMax: ZOOM_RANGE[1],
      tileCount: tiles.length,
      downloadedCount: 0,
      status: "downloading",
      createdAt: new Date().toISOString(),
      sizeBytes: 0,
    };

    const backend = offlineTileBackend === "node" ? nodeBackend : indexedDbBackend;

    if (offlineTileBackend === "node") {
      const regionId = await startNodeDownload(geometry, name, ZOOM_RANGE);
      addOfflineRegion({ ...region, id: regionId });
      setDownloadProgress(regionId, 0, tiles.length);

      const poll = setInterval(async () => {
        try {
          const updated = await pollNodeRegion(regionId);
          setDownloadProgress(regionId, updated.downloadedCount, updated.tileCount);
          updateOfflineRegion(regionId, {
            downloadedCount: updated.downloadedCount,
            sizeBytes: updated.sizeBytes,
            status: updated.status,
          });
          if (updated.status === "complete" || updated.status === "error") {
            clearInterval(poll);
            removeDownload(regionId);
            setDownloadingIndexes((prev) => { const next = new Set(prev); next.delete(featureIndex); return next; });
          }
        } catch {
          clearInterval(poll);
          setDownloadingIndexes((prev) => { const next = new Set(prev); next.delete(featureIndex); return next; });
        }
      }, 1000);
    } else {
      const regionId = await backend.createRegion(region);
      addOfflineRegion({ ...region, id: regionId });
      setDownloadProgress(regionId, 0, tiles.length);

      const controller = new AbortController();
      abortControllers.current[regionId] = controller;

      try {
        await downloadTiles(
          backend,
          tiles,
          (progress) => {
            setDownloadProgress(regionId, progress.downloaded, progress.total, progress.sizeBytes);
            updateOfflineRegion(regionId, {
              downloadedCount: progress.downloaded,
              sizeBytes: progress.sizeBytes,
            });
          },
          controller.signal,
        );
        updateOfflineRegion(regionId, { status: "complete" });
        await backend.updateRegion(regionId, { status: "complete", downloadedCount: tiles.length });
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          updateOfflineRegion(regionId, { status: "error" });
        }
      } finally {
        removeDownload(regionId);
        delete abortControllers.current[regionId];
        setDownloadingIndexes((prev) => { const next = new Set(prev); next.delete(featureIndex); return next; });
      }
    }
  };

  const handleDeleteRegion = async (regionId: string) => {
    const controller = abortControllers.current[regionId];
    if (controller) controller.abort();
    const backend = offlineTileBackend === "node" ? nodeBackend : indexedDbBackend;
    await backend.deleteRegion(regionId);
    removeOfflineRegion(regionId);
    removeDownload(regionId);
  };

  const handleDeleteAll = async () => {
    // Abort any active downloads
    for (const key of Object.keys(abortControllers.current)) {
      abortControllers.current[key].abort();
    }
    const backend = offlineTileBackend === "node" ? nodeBackend : indexedDbBackend;
    for (const region of offlineRegions) {
      try { await backend.deleteRegion(region.id); } catch { /* ignore */ }
      removeDownload(region.id);
    }
    setOfflineRegions([]);
    setVerifyResults({});
  };

  const handleVerify = async (region: OfflineRegion) => {
    const backend = offlineTileBackend === "node" ? nodeBackend : indexedDbBackend;
    const bbox = bboxFromPolygon(region.polygon);
    const tiles = getTilesForBbox(bbox, [region.zoomMin, region.zoomMax]);

    const controller = new AbortController();
    const verifyKey = `verify-${region.id}`;
    abortControllers.current[verifyKey] = controller;

    setVerifying((prev) => ({ ...prev, [region.id]: { checked: 0, total: tiles.length } }));
    setVerifyResults((prev) => { const next = { ...prev }; delete next[region.id]; return next; });

    try {
      const result = await verifyTiles(
        backend,
        tiles,
        (checked, total) => {
          setVerifying((prev) => ({ ...prev, [region.id]: { checked, total } }));
        },
        controller.signal,
      );
      setVerifyResults((prev) => ({ ...prev, [region.id]: result }));
    } catch {
      // abort or error
    } finally {
      setVerifying((prev) => { const next = { ...prev }; delete next[region.id]; return next; });
      delete abortControllers.current[verifyKey];
    }
  };

  const handleRedownloadMissing = async (region: OfflineRegion) => {
    const result = verifyResults[region.id];
    if (!result || result.missing.length === 0) return;

    const backend = offlineTileBackend === "node" ? nodeBackend : indexedDbBackend;
    const controller = new AbortController();
    abortControllers.current[region.id] = controller;

    const missingCount = result.missing.length;
    setDownloadProgress(region.id, 0, missingCount);
    updateOfflineRegion(region.id, { status: "downloading" });
    setVerifyResults((prev) => { const next = { ...prev }; delete next[region.id]; return next; });

    try {
      await downloadTiles(
        backend,
        result.missing,
        (progress) => {
          setDownloadProgress(region.id, progress.downloaded, progress.total);
          updateOfflineRegion(region.id, {
            downloadedCount: region.tileCount - missingCount + progress.downloaded,
          });
        },
        controller.signal,
      );
      updateOfflineRegion(region.id, { status: "complete", downloadedCount: region.tileCount });
      await backend.updateRegion(region.id, { status: "complete", downloadedCount: region.tileCount });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        updateOfflineRegion(region.id, { status: "error" });
      }
    } finally {
      removeDownload(region.id);
      delete abortControllers.current[region.id];
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">
      {/* Header controls — full width */}
      <div className="shrink-0 p-2 pb-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1">
            {(["indexeddb", "node"] as const).map((b) => (
              <button
                key={b}
                className={cn(
                  "rounded-md px-2 py-1 text-xs transition-colors",
                  offlineTileBackend === b
                    ? "bg-primary text-primary-foreground"
                    : "hover:bg-muted",
                )}
                onClick={() => setOfflineTileBackend(b)}
              >
                {b === "indexeddb" ? "IndexedDB" : "Node server"}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={showOfflineTiles}
              onChange={(e) => setShowOfflineTiles(e.target.checked)}
              className="accent-primary"
            />
            Show offline tiles
          </label>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Draw a polygon on the map, then download its satellite tiles (z10–z16)
          for offline use. Tiles are sourced from ArcGIS World Imagery — switch
          to the ArcGIS Satellite map style for the best match. Lower zooms
          cover large areas; higher zooms show detail at street level.
        </p>

        {offlineTileBackend === "node" && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            The Node server backend stores tiles in a local SQLite database.
            Run the server script locally before downloading.
          </p>
        )}

        {storageStats && storageStats.used > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
            <span>
              {offlineTileBackend === "indexeddb" ? "IndexedDB" : "Node server"}: {formatSize(storageStats.used)} used
            </span>
            {storageStats.quota && (
              <span>of {formatSize(storageStats.quota)}</span>
            )}
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-border">
        {/* Left — Available polygons */}
        <div className="overflow-auto scrollbar-themed p-2 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">
            Available to download
          </span>
          {polygons.length === 0 ? (
            <p className="text-muted-foreground mt-1 text-xs">
              Draw a polygon on the map to download its satellite tiles.
            </p>
          ) : (
            polygons.map(({ feature, index }) => {
              const geometry = feature.geometry as GeoJSON.Polygon | GeoJSON.MultiPolygon;
              const bbox = bboxFromPolygon(geometry);
              const count = estimateTileCount(bbox, ZOOM_RANGE);
              const estSize = count * AVG_TILE_SIZE_KB * 1024;
              const areaKm2 = polygonAreaKm2(geometry);
              const areaLabel = areaKm2 < 1
                ? `${(areaKm2 * 1e6).toFixed(0)} m²`
                : areaKm2 < 100
                  ? `${areaKm2.toFixed(1)} km²`
                  : `${areaKm2.toFixed(0)} km²`;
              const tooLarge = estSize > maxDownloadBytes;
              const isDownloading = downloadingIndexes.has(index);
              const disableDownload = tooLarge || isDownloading;
              return (
                <div
                  key={index}
                  className="flex items-center justify-between rounded-md border border-border px-3 py-2 hover:bg-muted cursor-pointer"
                  onClick={() => flyToBbox(bbox)}
                >
                  <div className="flex flex-col min-w-0">
                    <span className="truncate">{resolvedName(feature, index)}</span>
                    <span className="text-xs text-muted-foreground">
                      {areaLabel} · {count.toLocaleString()} tiles ~{formatSize(estSize)}
                    </span>
                    {tooLarge && (
                      <span className="text-xs text-red-500 dark:text-red-400">
                        Too large — max {formatSize(maxDownloadBytes)}
                      </span>
                    )}
                  </div>
                  <button
                    className={cn(
                      "ml-2 p-1.5 rounded-md transition-colors shrink-0",
                      disableDownload
                        ? "opacity-30 cursor-not-allowed"
                        : "hover:bg-muted",
                    )}
                    title={tooLarge ? "Area too large to download" : isDownloading ? "Download in progress" : `Download z${ZOOM_RANGE[0]}–${ZOOM_RANGE[1]}`}
                    disabled={disableDownload}
                    onClick={(e) => { e.stopPropagation(); handleDownload(feature, index); }}
                  >
                    {isDownloading ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Right — Downloaded regions */}
        <div className="overflow-auto scrollbar-themed p-2 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              Downloaded regions
            </span>
            {offlineRegions.length > 0 && (
              <button
                className="text-xs text-red-600 dark:text-red-400 hover:underline"
                onClick={handleDeleteAll}
              >
                Delete all
              </button>
            )}
          </div>
          {offlineRegions.length === 0 ? (
            <p className="text-muted-foreground mt-1 text-xs">
              No downloaded regions yet.
            </p>
          ) : (
            offlineRegions.map((region) => {
              const progress = activeDownloads[region.id];
              const isDownloading = !!progress;
              const pct = isDownloading
                ? Math.round((progress.downloaded / progress.total) * 100)
                : 0;
              const vProgress = verifying[region.id];
              const vResult = verifyResults[region.id];
              const isIdle = !isDownloading && !vProgress;
              const regionBbox = bboxFromPolygon(region.polygon);
              return (
                <div
                  key={region.id}
                  className="flex flex-col rounded-md border border-border px-3 py-2 hover:bg-muted cursor-pointer"
                  onClick={() => flyToBbox(regionBbox)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col min-w-0">
                      <span className="truncate">{region.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {region.tileCount.toLocaleString()} tiles
                        {region.sizeBytes > 0 && ` · ${formatSize(region.sizeBytes)}`}
                        {region.status === "error" && " · Failed"}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      {isIdle && region.status === "complete" && (
                        <button
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Verify tile integrity"
                          onClick={(e) => { e.stopPropagation(); handleVerify(region); }}
                        >
                          <ShieldCheck size={14} />
                        </button>
                      )}
                      <button
                        className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400"
                        title="Delete region"
                        onClick={(e) => { e.stopPropagation(); handleDeleteRegion(region.id); }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                  {isDownloading && (
                    <div className="mt-1.5 flex flex-col gap-1">
                      <div className="flex items-center gap-1.5">
                        <Loader2 size={12} className="animate-spin shrink-0" />
                        <div className="flex-1 bg-muted rounded-full h-1.5">
                          <div
                            className="bg-primary h-1.5 rounded-full transition-all"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{pct}%</span>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {progress.downloaded.toLocaleString()} / {progress.total.toLocaleString()} tiles
                        {progress.sizeBytes > 0 && ` · ${formatSize(progress.sizeBytes)}`}
                      </span>
                    </div>
                  )}
                  {vProgress && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        Verifying {vProgress.checked.toLocaleString()} / {vProgress.total.toLocaleString()} tiles…
                      </span>
                    </div>
                  )}
                  {vResult && (
                    <div className="mt-1.5 flex items-center justify-between gap-1.5">
                      <span className={cn(
                        "text-xs",
                        vResult.missing.length === 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-amber-600 dark:text-amber-400",
                      )}>
                        {vResult.missing.length === 0
                          ? `All ${vResult.total.toLocaleString()} tiles verified`
                          : `${vResult.missing.length.toLocaleString()} of ${vResult.total.toLocaleString()} tiles missing`}
                      </span>
                      {vResult.missing.length > 0 && (
                        <button
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
                          onClick={(e) => { e.stopPropagation(); handleRedownloadMissing(region); }}
                        >
                          <RefreshCw size={12} />
                          Re-download
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
