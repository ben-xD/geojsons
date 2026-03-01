import { useQuery } from "@tanstack/react-query";
import { useStore } from "@/store/store";
import { indexedDbBackend } from "./indexedDbBackend";
import { nodeBackend } from "./nodeBackend";
import type { StorageStats } from "./tileBackend";

export function useStorageStats() {
  const offlineTileBackend = useStore.use.offlineTileBackend();

  return useQuery<StorageStats>({
    queryKey: ["storage-stats", offlineTileBackend],
    queryFn: () => {
      const backend = offlineTileBackend === "node" ? nodeBackend : indexedDbBackend;
      return backend.getStorageStats();
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
