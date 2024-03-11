import { GeojsonsMap } from "./map/GeojsonsMap.tsx";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { RawGeojsonPanel } from "@/GeojsonPanel/RawGeojsonPanel.tsx";
import { GripHorizontal } from "lucide-react";

function App() {
  return (
    <PanelGroup direction="horizontal">
      <Panel>
        <PanelGroup direction="vertical">
          <Panel>
            <GeojsonsMap />
          </Panel>
          <PanelResizeHandle className="w-full h-px bg-slate-300 flex items-center justify-center">
            <div className="h-4 drop-shadow w-5 z-10 bg-slate-200 rounded-md px-0.5 flex items-center justify-center">
              <GripHorizontal
                className="text-slate-600"
                height={24}
                width={24}
              />
            </div>
          </PanelResizeHandle>
          <Panel style={{ overflow: "auto" }} defaultSize={40}>
            <RawGeojsonPanel />
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}

export default App;
