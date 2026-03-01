import { useState } from "react";
import { useStore } from "@/store/store";

const SIZE_OPTIONS = [
  { label: "100 MB", bytes: 100 * 1024 * 1024 },
  { label: "250 MB", bytes: 250 * 1024 * 1024 },
  { label: "500 MB", bytes: 500 * 1024 * 1024 },
  { label: "1 GB", bytes: 1024 * 1024 * 1024 },
  { label: "2 GB", bytes: 2 * 1024 * 1024 * 1024 },
  { label: "Unlimited", bytes: Infinity },
];

function formatLimit(bytes: number): string {
  if (!isFinite(bytes)) return "Unlimited";
  if (bytes >= 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024 * 1024)).toFixed(0)} GB`;
  return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
}

async function deleteAllAppData() {
  // Clear localStorage
  localStorage.clear();

  // Clear sessionStorage
  sessionStorage.clear();

  // Delete all IndexedDB databases
  if ("databases" in indexedDB) {
    const dbs = await indexedDB.databases();
    await Promise.all(
      dbs.map((db) => {
        if (db.name) {
          return new Promise<void>((resolve, reject) => {
            const req = indexedDB.deleteDatabase(db.name!);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
          });
        }
      }),
    );
  }

  window.location.reload();
}

export const SettingsPanel = () => {
  const maxDownloadBytes = useStore.use.maxDownloadBytes();
  const setMaxDownloadBytes = useStore.use.setMaxDownloadBytes();
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-themed p-4 gap-4 text-sm">
      <div>
        <label className="text-xs text-muted-foreground font-medium">
          Max offline download size
        </label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Polygons with an estimated tile size above this limit cannot be downloaded.
          Currently set to {formatLimit(maxDownloadBytes)}.
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SIZE_OPTIONS.map(({ label, bytes }) => (
            <button
              key={label}
              className={`rounded-md px-3 py-1.5 text-xs transition-colors ${
                maxDownloadBytes === bytes
                  ? "bg-primary text-primary-foreground"
                  : "border border-border hover:bg-muted"
              }`}
              onClick={() => setMaxDownloadBytes(bytes)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="text-xs text-muted-foreground font-medium">
          Delete all app data
        </label>
        <p className="text-xs text-muted-foreground mt-0.5 mb-2">
          Clears all IndexedDB databases, localStorage, and refreshes the page.
          This removes all downloaded tiles, saved settings, and cached data.
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
