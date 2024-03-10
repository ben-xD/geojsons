import { GeojsonsMap } from "./map/GeojsonsMap.tsx";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
import {RawGeojsonPanel} from "@/GeojsonPanel/RawGeojsonPanel.tsx";
function App() {
  return (
    <PanelGroup direction="horizontal">
      <Panel>
        <PanelGroup direction="vertical">
          <Panel>
            <GeojsonsMap />
          </Panel>
          {/*<PanelResizeHandle />*/}
          {/*<Panel>*/}
          {/*  <PanelGroup direction="horizontal">*/}
          {/*    <Panel>left</Panel>*/}
          {/*  </PanelGroup>*/}
          {/*</Panel>*/}
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <Panel defaultSize={20}>
        <RawGeojsonPanel/>
      </Panel>
    </PanelGroup>
  );
}

export default App;
