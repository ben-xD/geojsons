import { useState } from "react";
import { useStore } from "@/store/store";

async function deleteAllAppData() {
  try {
    localStorage.clear();
    sessionStorage.clear();

    // Delete all IndexedDB databases
    if ("databases" in indexedDB) {
      const dbs = await indexedDB.databases();
      await Promise.allSettled(
        dbs.map((db) => {
          if (db.name) {
            return new Promise<void>((resolve) => {
              const req = indexedDB.deleteDatabase(db.name!);
              req.onsuccess = () => resolve();
              req.onerror = () => resolve(); // resolve anyway — we're nuking everything
              req.onblocked = () => resolve(); // open connections block deletion on mobile
            });
          }
        }),
      );
    }

    // Clear service worker caches
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.allSettled(keys.map((k) => caches.delete(k)));
    }
  } finally {
    window.location.reload();
  }
}

export const SettingsPanel = () => {
  const preferOffline = useStore.use.preferOffline();
  const setPreferOffline = useStore.use.setPreferOffline();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-themed p-4 gap-4 text-sm">
      <div>
        <label className="text-xs text-muted-foreground font-medium">Force offline maps</label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Force map/style tile loads to use offline caches only. This is useful for testing true
          offline behavior.
        </p>
        <label className="inline-flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={preferOffline}
            onChange={(e) => setPreferOffline(e.target.checked)}
            className="accent-primary"
          />
          Force offline maps
        </label>
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-medium">Delete all app data</label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Clears all IndexedDB databases, localStorage, and refreshes the page. This removes all
          downloaded tiles, saved settings, and cached data.
        </p>
        {!confirmDelete ? (
          <button
            className="rounded-md px-3 py-1.5 text-xs transition-colors border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30"
            onClick={() => setConfirmDelete(true)}
          >
            Delete all data
          </button>
        ) : (
          <div className="flex items-center gap-2">
            <button
              className="rounded-md px-3 py-1.5 text-xs transition-colors bg-red-600 text-white hover:bg-red-700"
              onClick={deleteAllAppData}
            >
              Confirm — delete everything
            </button>
            <button
              className="rounded-md px-3 py-1.5 text-xs transition-colors border border-border hover:bg-muted"
              onClick={() => setConfirmDelete(false)}
            >
              Cancel
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
