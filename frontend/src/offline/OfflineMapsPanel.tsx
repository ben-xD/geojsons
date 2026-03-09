import posthog from "posthog-js";
import { useRef, useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";
import { Download, Trash2, Loader2, ShieldCheck, RefreshCw, X, AlertCircle } from "lucide-react";
import { bboxFromPolygon, estimateTileCount, getTilesForBbox, polygonAreaKm2 } from "./tileCoords";
import { flyToBbox } from "@/map/flyTo";
import {
  downloadTiles,
  verifyTiles,
  type VerifyResult,
  QuotaExceededError,
} from "./downloadManager";
import { indexedDbBackend } from "./indexedDbBackend";
import { nodeBackend, checkNodeHealth } from "./nodeBackend";
import { startNodeDownload } from "./nodeBackend";
import type { OfflineRegion } from "./tileBackend";
import { reverseGeocode } from "@/map/geocode";
import { getMapStyle } from "@/map/mapStyles";
import { useStorageStats } from "./useStorageStats";
import { useNodeRegionPoll } from "./useNodeRegionPoll";
import { env } from "@/env";
import type { OfflineTileBackendType } from "@/store/offlineTileSlice";

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
  const preferOffline = useStore.use.preferOffline();
  const setPreferOffline = useStore.use.setPreferOffline();
  const offlineRegionsByBackend = useStore.use.offlineRegionsByBackend();
  const addOfflineRegion = useStore.use.addOfflineRegion();
  const updateOfflineRegion = useStore.use.updateOfflineRegion();
  const setOfflineRegions = useStore.use.setOfflineRegions();
  const removeOfflineRegion = useStore.use.removeOfflineRegion();
  const activeDownloadsByBackend = useStore.use.activeDownloadsByBackend();
  const setDownloadProgress = useStore.use.setDownloadProgress();
  const removeDownload = useStore.use.removeDownload();
  const mapStyleId = useStore.use.mapStyleId();

  const offlineRegions = offlineRegionsByBackend[offlineTileBackend];
  const activeDownloads = activeDownloadsByBackend[offlineTileBackend];

  const queryClient = useQueryClient();
  const abortControllers = useRef<Record<string, AbortController>>({});
  const [geocodedNames, setGeocodedNames] = useState<Record<string, string>>({});
  const [verifying, setVerifying] = useState<Record<string, { checked: number; total: number }>>(
    {},
  );
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
  const [downloadingIndexes, setDownloadingIndexes] = useState<Set<number>>(new Set());
  const [nodeConnected, setNodeConnected] = useState<boolean | null>(null);
  const [quotaErrors, setQuotaErrors] = useState<Record<string, boolean>>({});

  const { data: storageStats } = useStorageStats();
  useNodeRegionPoll();

  const backendClient = (backend: OfflineTileBackendType) =>
    backend === "node" ? nodeBackend : indexedDbBackend;
  const regionStateKey = (backend: OfflineTileBackendType, id: string) => `${backend}:${id}`;
  const verifyStateKey = (backend: OfflineTileBackendType, id: string) => `verify:${backend}:${id}`;

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const backends: OfflineTileBackendType[] = ["indexeddb", "node"];
      for (const backend of backends) {
        try {
          const regions = await backendClient(backend).getRegions();
          if (!cancelled) {
            setOfflineRegions(backend, regions);
          }
        } catch {
          if (!cancelled && backend === "node") {
            setOfflineRegions("node", []);
          }
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [setOfflineRegions]);

  // Check node server health when node backend is selected
  useEffect(() => {
    if (offlineTileBackend !== "node") {
      setNodeConnected(null);
      return;
    }
    let cancelled = false;
    const check = () => {
      checkNodeHealth().then((ok) => {
        if (!cancelled) setNodeConnected(ok);
      });
    };
    check();
    const interval = setInterval(check, 10_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [offlineTileBackend]);

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
      ({ feature, index }) => !feature.properties?.name && !geocodedNames[index],
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
    posthog.capture("offline_download_started", { backend: offlineTileBackend });
    setDownloadingIndexes((prev) => new Set(prev).add(featureIndex));

    const targetBackend = offlineTileBackend;
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

    const backend = backendClient(targetBackend);

    if (targetBackend === "node") {
      try {
        const regionId = await startNodeDownload(geometry, name, ZOOM_RANGE);
        addOfflineRegion("node", { ...region, id: regionId });
        setDownloadProgress("node", regionId, 0, tiles.length);
        // Polling is handled by useNodeRegionPoll hook
      } finally {
        setDownloadingIndexes((prev) => {
          const next = new Set(prev);
          next.delete(featureIndex);
          return next;
        });
      }
      return;
    }

    const regionId = await backend.createRegion(region);
    addOfflineRegion("indexeddb", { ...region, id: regionId });
    setDownloadProgress("indexeddb", regionId, 0, tiles.length);

    const controller = new AbortController();
    const controllerKey = regionStateKey("indexeddb", regionId);
    abortControllers.current[controllerKey] = controller;

    try {
      await downloadTiles(
        backend,
        tiles,
        (progress) => {
          setDownloadProgress(
            "indexeddb",
            regionId,
            progress.downloaded,
            progress.total,
            progress.sizeBytes,
          );
          updateOfflineRegion("indexeddb", regionId, {
            downloadedCount: progress.downloaded,
            sizeBytes: progress.sizeBytes,
          });
        },
        controller.signal,
      );
      updateOfflineRegion("indexeddb", regionId, { status: "complete" });
      await backend.updateRegion(regionId, { status: "complete", downloadedCount: tiles.length });
    } catch (err) {
      const isQuotaError = err instanceof QuotaExceededError;
      if (isQuotaError) {
        setQuotaErrors((prev) => ({ ...prev, [regionId]: true }));
      }
      updateOfflineRegion("indexeddb", regionId, { status: "error" });
    } finally {
      removeDownload("indexeddb", regionId);
      delete abortControllers.current[controllerKey];
      setDownloadingIndexes((prev) => {
        const next = new Set(prev);
        next.delete(featureIndex);
        return next;
      });
      queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
    }
  };

  const handleCancel = (regionId: string) => {
    const controllerKey = regionStateKey(offlineTileBackend, regionId);
    const controller = abortControllers.current[controllerKey];
    if (controller) {
      controller.abort();
    }
    // For node downloads, mark as error — polling hook will stop automatically
    if (offlineTileBackend === "node") {
      updateOfflineRegion("node", regionId, { status: "error" });
      removeDownload("node", regionId);
    }
  };

  const handleDeleteRegion = async (regionId: string) => {
    posthog.capture("offline_region_deleted", { backend: offlineTileBackend });
    const controllerKey = regionStateKey(offlineTileBackend, regionId);
    const controller = abortControllers.current[controllerKey];
    if (controller) controller.abort();
    const backend = backendClient(offlineTileBackend);
    await backend.deleteRegion(regionId);
    removeOfflineRegion(offlineTileBackend, regionId);
    removeDownload(offlineTileBackend, regionId);
    setQuotaErrors((prev) => {
      const next = { ...prev };
      delete next[regionId];
      return next;
    });
    queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
  };

  const handleDeleteAll = async () => {
    // Abort active downloads only for current backend
    for (const key of Object.keys(abortControllers.current)) {
      if (
        key.startsWith(`${offlineTileBackend}:`) ||
        key.startsWith(`verify:${offlineTileBackend}:`)
      ) {
        abortControllers.current[key].abort();
      }
    }
    const backend = backendClient(offlineTileBackend);
    await backend.deleteAllRegions();
    for (const region of offlineRegions) {
      removeDownload(offlineTileBackend, region.id);
    }
    setOfflineRegions(offlineTileBackend, []);
    setVerifyResults({});
    setQuotaErrors({});
    queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
  };

  const handleVerify = async (region: OfflineRegion) => {
    const backend = backendClient(offlineTileBackend);
    const stateKey = regionStateKey(offlineTileBackend, region.id);
    const bbox = bboxFromPolygon(region.polygon);
    const tiles = getTilesForBbox(bbox, [region.zoomMin, region.zoomMax]);

    const controller = new AbortController();
    const verifyKey = verifyStateKey(offlineTileBackend, region.id);
    abortControllers.current[verifyKey] = controller;

    setVerifying((prev) => ({ ...prev, [stateKey]: { checked: 0, total: tiles.length } }));
    setVerifyResults((prev) => {
      const next = { ...prev };
      delete next[stateKey];
      return next;
    });

    try {
      const result = await verifyTiles(
        backend,
        tiles,
        (checked, total) => {
          setVerifying((prev) => ({ ...prev, [stateKey]: { checked, total } }));
        },
        controller.signal,
      );
      setVerifyResults((prev) => ({ ...prev, [stateKey]: result }));
    } catch {
      // abort or error
    } finally {
      setVerifying((prev) => {
        const next = { ...prev };
        delete next[stateKey];
        return next;
      });
      delete abortControllers.current[verifyKey];
    }
  };

  const handleRetry = async (region: OfflineRegion) => {
    const backend = backendClient(offlineTileBackend);
    const stateKey = regionStateKey(offlineTileBackend, region.id);
    const bbox = bboxFromPolygon(region.polygon);
    const tiles = getTilesForBbox(bbox, [region.zoomMin, region.zoomMax]);
    const controller = new AbortController();
    const controllerKey = regionStateKey(offlineTileBackend, region.id);
    abortControllers.current[controllerKey] = controller;

    updateOfflineRegion(offlineTileBackend, region.id, { status: "downloading" });
    setVerifying((prev) => ({ ...prev, [stateKey]: { checked: 0, total: tiles.length } }));
    setQuotaErrors((prev) => {
      const next = { ...prev };
      delete next[region.id];
      return next;
    });

    try {
      const result = await verifyTiles(
        backend,
        tiles,
        (checked, total) => {
          setVerifying((prev) => ({ ...prev, [stateKey]: { checked, total } }));
        },
        controller.signal,
      );
      setVerifying((prev) => {
        const next = { ...prev };
        delete next[stateKey];
        return next;
      });

      if (result.missing.length === 0) {
        updateOfflineRegion(offlineTileBackend, region.id, {
          status: "complete",
          downloadedCount: region.tileCount,
        });
        await backend.updateRegion(region.id, {
          status: "complete",
          downloadedCount: region.tileCount,
        });
        return;
      }

      const missingCount = result.missing.length;
      setDownloadProgress(offlineTileBackend, region.id, 0, missingCount);

      await downloadTiles(
        backend,
        result.missing,
        (progress) => {
          setDownloadProgress(offlineTileBackend, region.id, progress.downloaded, progress.total);
          updateOfflineRegion(offlineTileBackend, region.id, {
            downloadedCount: region.tileCount - missingCount + progress.downloaded,
            sizeBytes: region.sizeBytes + progress.sizeBytes,
          });
        },
        controller.signal,
      );
      updateOfflineRegion(offlineTileBackend, region.id, {
        status: "complete",
        downloadedCount: region.tileCount,
      });
      await backend.updateRegion(region.id, {
        status: "complete",
        downloadedCount: region.tileCount,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        const isQuotaError = err instanceof QuotaExceededError;
        if (isQuotaError) {
          setQuotaErrors((prev) => ({ ...prev, [region.id]: true }));
        }
        updateOfflineRegion(offlineTileBackend, region.id, { status: "error" });
      }
    } finally {
      setVerifying((prev) => {
        const next = { ...prev };
        delete next[stateKey];
        return next;
      });
      removeDownload(offlineTileBackend, region.id);
      delete abortControllers.current[controllerKey];
    }
  };

  const handleRedownloadMissing = async (region: OfflineRegion) => {
    const stateKey = regionStateKey(offlineTileBackend, region.id);
    const result = verifyResults[stateKey];
    if (!result || result.missing.length === 0) return;

    const backend = backendClient(offlineTileBackend);
    const controller = new AbortController();
    const controllerKey = regionStateKey(offlineTileBackend, region.id);
    abortControllers.current[controllerKey] = controller;

    const missingCount = result.missing.length;
    setDownloadProgress(offlineTileBackend, region.id, 0, missingCount);
    updateOfflineRegion(offlineTileBackend, region.id, { status: "downloading" });
    setVerifyResults((prev) => {
      const next = { ...prev };
      delete next[stateKey];
      return next;
    });

    try {
      await downloadTiles(
        backend,
        result.missing,
        (progress) => {
          setDownloadProgress(offlineTileBackend, region.id, progress.downloaded, progress.total);
          updateOfflineRegion(offlineTileBackend, region.id, {
            downloadedCount: region.tileCount - missingCount + progress.downloaded,
          });
        },
        controller.signal,
      );
      updateOfflineRegion(offlineTileBackend, region.id, {
        status: "complete",
        downloadedCount: region.tileCount,
      });
      await backend.updateRegion(region.id, {
        status: "complete",
        downloadedCount: region.tileCount,
      });
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        updateOfflineRegion(offlineTileBackend, region.id, { status: "error" });
      }
    } finally {
      removeDownload(offlineTileBackend, region.id);
      delete abortControllers.current[controllerKey];
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">
      {/* Header controls — full width */}
      <div className="shrink-0 p-2 pb-0 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-1 items-center">
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
            {offlineTileBackend === "node" && nodeConnected !== null && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs ml-1",
                  nodeConnected
                    ? "text-green-600 dark:text-green-400"
                    : "text-red-600 dark:text-red-400",
                )}
              >
                <span
                  className={cn(
                    "inline-block w-1.5 h-1.5 rounded-full",
                    nodeConnected ? "bg-green-500" : "bg-red-500",
                  )}
                />
                {nodeConnected ? "Connected" : "Disconnected"}
              </span>
            )}
          </div>
          <label className="flex items-center gap-1.5 cursor-pointer text-xs">
            <input
              type="checkbox"
              checked={preferOffline}
              onChange={(e) => setPreferOffline(e.target.checked)}
              className="accent-primary"
            />
            Force offline maps
          </label>
        </div>

        <p className="text-xs text-muted-foreground leading-relaxed">
          Draw a polygon on the map, then download its satellite tiles (z10–z16) for offline use.
          Offline maps only work with the <strong>ArcGIS Satellite</strong> map style — switch to it
          in the map style menu. Lower zooms cover large areas; higher zooms show detail at street
          level.
        </p>

        {offlineTileBackend === "node" && nodeConnected === false && (
          <p className="text-xs text-red-600 dark:text-red-400 leading-relaxed">
            Could not connect to the tile server at {env.VITE_TILE_SERVER_URL}. Run{" "}
            <code className="bg-muted px-1 rounded">cd server && npm run dev</code> to start it.
            Only IndexedDB works out of the box.
          </p>
        )}
        {offlineTileBackend === "node" && nodeConnected === true && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            The Node server backend stores tiles in a local SQLite database.
          </p>
        )}

        {storageStats && storageStats.used > 0 && (
          <div className="flex items-center justify-between text-xs text-muted-foreground bg-muted/50 rounded-md px-3 py-1.5">
            <span>
              {offlineTileBackend === "indexeddb" ? "IndexedDB" : "Node server"}:{" "}
              {formatSize(storageStats.used)} used
            </span>
            {offlineTileBackend === "indexeddb" && storageStats.quota && (
              <span>
                {formatSize(storageStats.used)} / {formatSize(storageStats.quota)} used
              </span>
            )}
          </div>
        )}
      </div>

      {/* Two-column grid */}
      <div className="flex-1 min-h-0 grid grid-cols-2 divide-x divide-border">
        {/* Left — Available polygons */}
        <div className="overflow-auto scrollbar-themed p-2 flex flex-col gap-1">
          <span className="text-xs text-muted-foreground font-medium">Available to download</span>
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
              const areaLabel =
                areaKm2 < 1
                  ? `${(areaKm2 * 1e6).toFixed(0)} m²`
                  : areaKm2 < 100
                    ? `${areaKm2.toFixed(1)} km²`
                    : `${areaKm2.toFixed(0)} km²`;
              const isDownloading = downloadingIndexes.has(index);
              const nodeDisconnected = offlineTileBackend === "node" && nodeConnected === false;
              const disableDownload = isDownloading || nodeDisconnected;
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
                  </div>
                  <button
                    className={cn(
                      "ml-2 p-1.5 rounded-md transition-colors shrink-0",
                      disableDownload ? "opacity-30 cursor-not-allowed" : "hover:bg-muted",
                    )}
                    title={
                      nodeDisconnected
                        ? "Node server disconnected"
                        : isDownloading
                          ? "Download in progress"
                          : `Download z${ZOOM_RANGE[0]}–${ZOOM_RANGE[1]}`
                    }
                    disabled={disableDownload}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownload(feature, index);
                    }}
                  >
                    {isDownloading ? (
                      <Loader2 size={14} className="animate-spin" />
                    ) : (
                      <Download size={14} />
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Right — Downloaded regions */}
        <div className="overflow-auto scrollbar-themed p-2 flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">Downloaded regions</span>
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
            <p className="text-muted-foreground mt-1 text-xs">No downloaded regions yet.</p>
          ) : (
            offlineRegions.map((region) => {
              const stateKey = regionStateKey(offlineTileBackend, region.id);
              const progress = activeDownloads[region.id];
              const isDownloading = !!progress;
              const pct = isDownloading
                ? Math.round((progress.downloaded / progress.total) * 100)
                : 0;
              const vProgress = verifying[stateKey];
              const vResult = verifyResults[stateKey];
              const isIdle = !isDownloading && !vProgress;
              const regionBbox = bboxFromPolygon(region.polygon);
              const regionAreaKm2 = polygonAreaKm2(region.polygon);
              const regionAreaLabel =
                regionAreaKm2 < 1
                  ? `${(regionAreaKm2 * 1e6).toFixed(0)} m²`
                  : regionAreaKm2 < 100
                    ? `${regionAreaKm2.toFixed(1)} km²`
                    : `${regionAreaKm2.toFixed(0)} km²`;
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
                        {regionAreaLabel} · {region.tileCount.toLocaleString()} tiles
                        {region.sizeBytes > 0 && ` · ${formatSize(region.sizeBytes)}`}
                        {region.status === "error" && !quotaErrors[region.id] && " · Failed"}
                        {region.status === "error" && quotaErrors[region.id] && (
                          <span className="text-red-500 dark:text-red-400"> · Storage full</span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-2">
                      {isDownloading && (
                        <button
                          className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400"
                          title="Cancel download"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCancel(region.id);
                          }}
                        >
                          <X size={14} />
                        </button>
                      )}
                      {isIdle && region.status === "error" && (
                        <button
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Retry download"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRetry(region);
                          }}
                        >
                          <RefreshCw size={14} />
                        </button>
                      )}
                      {isIdle && region.status === "complete" && (
                        <button
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Verify tile integrity"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleVerify(region);
                          }}
                        >
                          <ShieldCheck size={14} />
                        </button>
                      )}
                      {isIdle && (
                        <button
                          className="p-1.5 rounded-md hover:bg-red-100 dark:hover:bg-red-900/30 transition-colors text-red-600 dark:text-red-400"
                          title="Delete region"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRegion(region.id);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
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
                        {progress.downloaded.toLocaleString()} / {progress.total.toLocaleString()}{" "}
                        tiles
                        {` · ${formatSize(progress.sizeBytes)} / ~${formatSize(progress.total * AVG_TILE_SIZE_KB * 1024)}`}
                      </span>
                    </div>
                  )}
                  {vProgress && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <Loader2 size={12} className="animate-spin shrink-0" />
                      <span className="text-xs text-muted-foreground">
                        Verifying {vProgress.checked.toLocaleString()} /{" "}
                        {vProgress.total.toLocaleString()} tiles…
                      </span>
                    </div>
                  )}
                  {vResult && (
                    <div className="mt-1.5 flex items-center justify-between gap-1.5">
                      <span
                        className={cn(
                          "text-xs",
                          vResult.missing.length === 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-amber-600 dark:text-amber-400",
                        )}
                      >
                        {vResult.missing.length === 0
                          ? `All ${vResult.total.toLocaleString()} tiles verified`
                          : `${vResult.missing.length.toLocaleString()} of ${vResult.total.toLocaleString()} tiles missing`}
                      </span>
                      {vResult.missing.length > 0 && (
                        <button
                          className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-md hover:bg-muted transition-colors"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRedownloadMissing(region);
                          }}
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
