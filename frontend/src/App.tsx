import { GeojsonsMap } from "./map/GeojsonsMap.tsx";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import { RawGeojsonPanel } from "@/GeojsonPanel/RawGeojsonPanel.tsx";

function App() {
  return (
    <PanelGroup direction="horizontal">
      <Panel>
        <PanelGroup direction="vertical">
          <Panel>
            <GeojsonsMap />
          </Panel>
          <PanelResizeHandle />
          <Panel style={{ overflow: "auto" }} defaultSize={40}>
            <RawGeojsonPanel />
          </Panel>
        </PanelGroup>
      </Panel>
    </PanelGroup>
  );
}

export default App;
