import {useBoundStore} from "@/store/store.ts";

export const RawGeojsonPanel = () => {
  const fc = useBoundStore.use.featureCollection();

  return <div className="flex flex-col gap-2 p-2 h-full">
    <h2 className="text-2xl text-slate-800">Geojsons.com</h2>
    <p>Put points, lines and polygons on the map.</p>
    <p>See <a className="underline text-slate-600" target="_blank" href="https://macwright.com/2015/03/23/geojson-second-bite" rel="noreferrer">More than you ever wanted to know about GeoJSON</a> or <a className="underline text-slate-600" target="_blank"  rel="noreferrer" href="https://www.rfc-editor.org/rfc/rfc7946">RFC7946</a> to learn more.</p>
    <pre className="overflow-auto max-h-full whitespace-pre-wrap">{JSON.stringify(fc, null, 2)}</pre>
  </div>
}
