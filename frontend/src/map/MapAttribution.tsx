export const MapAttribution = () => {
  return <div className=" flex gap-2 absolute bottom-0 right-0 bg-slate-500 text-slate-900 bg-opacity-20 rounded-full px-3 py-1 m-2 text-xs">
    <a className="hover:underline" href="https://www.maptiler.com/copyright/" target="_blank"
       rel="noreferrer">&copy; MapTiler</a>
    <a className="hover:underline"
       href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">&copy; OpenStreetMap
      contributors</a>
  </div>
}