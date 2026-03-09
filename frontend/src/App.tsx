import { GeojsonsMap } from "./map/GeojsonsMap.tsx";
import { Group, Panel, Separator } from "react-resizable-panels";
import { BottomPanel } from "@/GeojsonPanel/BottomPanel";
import { GripHorizontal } from "lucide-react";

function App() {
  return (
    <Group orientation="horizontal">
      <Panel>
        <Group orientation="vertical">
          <Panel>
            <GeojsonsMap />
          </Panel>
          <Separator className="w-full h-px bg-border flex items-center justify-center">
            <div className="h-4 drop-shadow w-5 z-10 bg-muted rounded-md px-0.5 flex items-center justify-center">
              <GripHorizontal className="text-muted-foreground" height={24} width={24} />
            </div>
          </Separator>
          <Panel defaultSize="40%">
            <BottomPanel />
          </Panel>
        </Group>
      </Panel>
    </Group>
  );
}

export default App;
