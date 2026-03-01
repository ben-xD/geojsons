import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useStore } from "@/store/store";
import { pollNodeRegion } from "./nodeBackend";

/**
 * Polls all active node-backend downloads every second.
 * Updates store with progress, and cleans up on completion/error.
 * Replaces the manual setInterval approach.
 */
export function useNodeRegionPoll() {
  const offlineTileBackend = useStore.use.offlineTileBackend();
  const offlineRegions = useStore.use.offlineRegions();
  const updateOfflineRegion = useStore.use.updateOfflineRegion();
  const setDownloadProgress = useStore.use.setDownloadProgress();
  const removeDownload = useStore.use.removeDownload();
  const queryClient = useQueryClient();

  const activeNodeRegionIds = offlineTileBackend === "node"
    ? offlineRegions
        .filter((r) => r.status === "downloading")
        .map((r) => r.id)
    : [];

  const hasActive = activeNodeRegionIds.length > 0;

  const { data: polledRegions } = useQuery({
    queryKey: ["node-region-poll", activeNodeRegionIds],
    queryFn: async () => {
      const results = await Promise.allSettled(
        activeNodeRegionIds.map((id) => pollNodeRegion(id)),
      );
      return results.map((r, i) => ({
        id: activeNodeRegionIds[i],
        result: r.status === "fulfilled" ? r.value : null,
        error: r.status === "rejected",
      }));
    },
    enabled: hasActive,
    refetchInterval: hasActive ? 1000 : false,
    staleTime: 0,
  });

  useEffect(() => {
    if (!polledRegions) return;

    for (const { id, result, error } of polledRegions) {
      if (error || !result) {
        updateOfflineRegion(id, { status: "error" });
        removeDownload(id);
        continue;
      }

      setDownloadProgress(id, result.downloadedCount, result.tileCount);
      updateOfflineRegion(id, {
        downloadedCount: result.downloadedCount,
        sizeBytes: result.sizeBytes,
        status: result.status,
      });

      if (result.status === "complete" || result.status === "error") {
        removeDownload(id);
        queryClient.invalidateQueries({ queryKey: ["storage-stats"] });
      }
    }
  }, [polledRegions]);
}
