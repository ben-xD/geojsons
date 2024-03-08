import { GeojsonsMap } from "./GeojsonsMap.tsx";
import { PanelGroup, Panel, PanelResizeHandle } from "react-resizable-panels";
function App() {
  return (
    <PanelGroup direction="horizontal">
      <Panel className="bg-blue-500">
        <PanelGroup direction="vertical">
          <Panel className="bg-green-500">
            <GeojsonsMap />
          </Panel>
          <PanelResizeHandle />
          <Panel>
            <PanelGroup direction="horizontal">
              <Panel>left</Panel>
            </PanelGroup>
          </Panel>
        </PanelGroup>
      </Panel>
      <PanelResizeHandle />
      <Panel className="bg-red-500" defaultSize={20}>
        geojson features
      </Panel>
    </PanelGroup>
  );
}

export default App;
