import { useStore } from "@/store/store";
import { mapStylesByProvider, type MapStyleId } from "@/map/mapStyles";
import { Map, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

const iconSizePx = 14;

const variantIcon = {
  vector: Map,
  satellite: Satellite,
} as const;

export const MapStyleSwitcher = () => {
  const mapStyleId = useStore.use.mapStyleId();
  const setMapStyleId = useStore.use.setMapStyleId();
  const [open, setOpen] = useState(false);

  return (
    <div className="absolute top-18 md:top-11 left-2">
      {/* Mobile toggle button */}
      <button
        className="md:hidden flex items-center justify-center w-9 h-9 rounded-xl bg-card drop-shadow-2xl shadow-xl border border-border text-foreground"
        onClick={() => setOpen((v) => !v)}
      >
        <Map size={16} />
      </button>

      {/* Style picker: toggled on mobile, always visible on desktop */}
      <div
        className={cn(
          "flex-col gap-1 rounded-xl bg-card drop-shadow-2xl shadow-xl border border-border px-2 pt-1.5 pb-2 text-foreground",
          "md:flex",
          open ? "flex mt-1 md:mt-0" : "hidden",
        )}
      >
        {mapStylesByProvider.map(({ provider, label, styles, notRecommended }) => (
          <div key={provider}>
            <div className="flex items-center gap-1 px-1">
              <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
                {label}
              </span>
              {notRecommended && (
                <span
                  title={notRecommended}
                  className="text-[9px] font-medium text-red-700 bg-red-100 dark:text-red-200 dark:bg-red-900 rounded px-1 cursor-help"
                >
                  Not recommended
                </span>
              )}
            </div>
            <div className="flex gap-1">
              {styles.map((style) => {
                const Icon = variantIcon[style.variant];
                const isActive = mapStyleId === style.id;
                return (
                  <button
                    key={style.id}
                    title={`${label} ${style.label}`}
                    className={cn(
                      "flex items-center gap-1 rounded-lg px-2 py-1 text-xs transition-all ease-in-out",
                      isActive
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-primary/10 active:bg-primary",
                    )}
                    onClick={() => {
                      setMapStyleId(style.id as MapStyleId);
                      setOpen(false);
                    }}
                  >
                    <Icon size={iconSizePx} />
                    {style.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
