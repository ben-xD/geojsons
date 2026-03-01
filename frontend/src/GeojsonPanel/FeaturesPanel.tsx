import { useStore } from "@/store/store";
import { cn } from "@/lib/utils";
import { flyToFeature } from "@/map/flyTo";

const geometryLabel = (type: string) => {
  switch (type) {
    case "Point":
    case "MultiPoint":
      return "Point";
    case "LineString":
    case "MultiLineString":
      return "Line";
    case "Polygon":
    case "MultiPolygon":
      return "Polygon";
    case "GeometryCollection":
      return "Collection";
    default:
      return type;
  }
};

export const FeaturesPanel = () => {
  const featureCollection = useStore.use.featureCollection();
  const selectedFeatureIndexes = useStore.use.selectedFeatureIndexes();
  const setSelectedFeatureIndexes = useStore.use.setSelectedFeatureIndexes();
  const animateToFeature = useStore.use.animateToFeature();
  const setAnimateToFeature = useStore.use.setAnimateToFeature();
  const features = featureCollection.features;

  if (features.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground p-4">
        No features. Draw on the map to get started.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full overflow-auto scrollbar-themed p-2 gap-1">
      <label className="flex items-center gap-2 px-3 py-1 text-sm text-muted-foreground">
        <input
          type="checkbox"
          checked={animateToFeature}
          onChange={(e) => setAnimateToFeature(e.target.checked)}
        />
        Animate to feature
      </label>
      {features.map((feature, index) => {
        const isSelected = selectedFeatureIndexes.includes(index);
        const name =
          feature.properties?.name ||
          feature.properties?.title ||
          `${geometryLabel(feature.geometry.type)} #${index + 1}`;

        return (
          <button
            key={feature.id ?? index}
            className={cn(
              "flex items-center gap-2 px-3 py-2 rounded-md text-left text-sm transition-colors hover:bg-muted",
              isSelected && "bg-primary/10",
            )}
            onClick={() => {
              setSelectedFeatureIndexes([index]);
              if (animateToFeature) flyToFeature(feature);
            }}
          >
            <span className="text-xs text-muted-foreground font-mono w-16 shrink-0">
              {geometryLabel(feature.geometry.type)}
            </span>
            <span className="truncate">{name}</span>
          </button>
        );
      })}
    </div>
  );
};
