import { useStore } from "@/store/store";
import { mapStylesByProvider, type MapStyleId } from "@/map/mapStyles";
import { Map, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";

const iconSizePx = 14;

const variantIcon = {
  vector: Map,
  satellite: Satellite,
} as const;

export const MapStyleSwitcher = () => {
  const mapStyleId = useStore.use.mapStyleId();
  const setMapStyleId = useStore.use.setMapStyleId();

  return (
    <div className="absolute top-16 md:top-10 left-2 flex flex-col gap-1 rounded-xl bg-white drop-shadow-2xl shadow-xl border border-slate-300 px-2 pt-1.5 pb-2 text-slate-700">
      {mapStylesByProvider.map(({ provider, label, styles }) => (
        <div key={provider}>
          <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider px-1">
            {label}
          </span>
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
                      ? "bg-blue-500 text-white"
                      : "hover:bg-blue-100 active:bg-blue-500",
                  )}
                  onClick={() => setMapStyleId(style.id as MapStyleId)}
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
  );
};
