import { cn } from "@/lib/utils";
import { RawGeojsonPanel } from "./RawGeojsonPanel";
import { FeaturesPanel } from "./FeaturesPanel";
import { OfflineMapsPanel } from "@/offline/OfflineMapsPanel";
import { SettingsPanel } from "./SettingsPanel";
import { useStore } from "@/store/store";
import type { BottomPanelTab } from "@/store/featureEditorSlice";

const tabs: BottomPanelTab[] = ["Features", "Offline Maps", "JSON", "Settings"];

export const BottomPanel = () => {
  const activeTab = useStore.use.activeTab();
  const setActiveTab = useStore.use.setActiveTab();

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      <div className="flex border-b border-border shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab}
            className={cn(
              "px-4 py-2 text-sm transition-colors hover:text-foreground",
              activeTab === tab
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground",
            )}
            onClick={() => setActiveTab(tab)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0">
        {activeTab === "Features" && <FeaturesPanel />}
        {activeTab === "Offline Maps" && <OfflineMapsPanel />}
        {activeTab === "JSON" && <RawGeojsonPanel />}
        {activeTab === "Settings" && <SettingsPanel />}
      </div>
    </div>
  );
};
