import { useStore } from "@/store/store";
import { getMapStyle } from "@/map/mapStyles";

export const MapAttribution = () => {
  const mapStyleId = useStore.use.mapStyleId();
  const { provider } = getMapStyle(mapStyleId);

  return (
    <div className="flex gap-2 absolute top-8 md:top-0 left-0 bg-white/80 text-slate-900 backdrop-blur-sm rounded-full px-3 py-1 m-2 text-xs">
      {provider === "maptiler" ? (
        <a
          className="hover:underline"
          href="https://www.maptiler.com/copyright/"
          target="_blank"
          rel="noreferrer"
        >
          &copy; MapTiler
        </a>
      ) : (
        <a
          className="hover:underline"
          href="https://www.mapbox.com/about/maps/"
          target="_blank"
          rel="noreferrer"
        >
          &copy; Mapbox
        </a>
      )}
      <a
        className="hover:underline"
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
      >
        &copy; OpenStreetMap contributors
      </a>
    </div>
  );
};
