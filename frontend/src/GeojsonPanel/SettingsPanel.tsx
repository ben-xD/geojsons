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

export const SettingsPanel = () => {
  const maxDownloadBytes = useStore.use.maxDownloadBytes();
  const setMaxDownloadBytes = useStore.use.setMaxDownloadBytes();

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
    </div>
  );
};
