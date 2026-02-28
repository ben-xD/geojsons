import { GeojsonsMap } from "./map/GeojsonsMap.tsx";
import { Group, Panel, PanelSize, Separator } from "react-resizable-panels";
import { RawGeojsonPanel } from "@/GeojsonPanel/RawGeojsonPanel.tsx";
import { GripHorizontal } from "lucide-react";
import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const editorPanelSizeAtom = atomWithStorage("editorPanelSize", 40);

function App() {
  const [editorPanelSize, setEditorPanelSize] = useAtom(editorPanelSizeAtom);

  return (
    <Group orientation="horizontal">
      <Panel>
        <Group orientation="vertical">
          <Panel>
            <GeojsonsMap />
          </Panel>
          <Separator className="w-full h-px bg-slate-300 flex items-center justify-center">
            <div className="h-4 drop-shadow w-5 z-10 bg-slate-200 rounded-md px-0.5 flex items-center justify-center">
              <GripHorizontal className="text-slate-600" height={24} width={24} />
            </div>
          </Separator>
          <Panel
            style={{ overflow: "auto" }}
            defaultSize={`${editorPanelSize}%`}
            onResize={(size: PanelSize) => setEditorPanelSize(size.asPercentage)}
          >
            <RawGeojsonPanel />
          </Panel>
        </Group>
      </Panel>
    </Group>
  );
}

export default App;
