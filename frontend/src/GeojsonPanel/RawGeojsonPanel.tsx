import { useStore } from "@/store/store.ts";
import { Compartment, EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { EditorView } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import { emptyFeatureCollection } from "@/data/featureCollection.ts";
import { useEffect, useMemo, useRef, useState } from "react";

import "@codemirror/lang-json";
import * as v from "valibot";
import { FeatureCollection } from "@/data/validator/geojson.ts";
import { Trash2 } from "lucide-react";
import { ClearDataAlertDialog } from "@/GeojsonPanel/ClearDataAlertDialog";
import { starryNightTheme } from "@/editor/codemirrorTheme";

const readOnlyCompartment = new Compartment();

export const RawGeojsonPanel = () => {
  const fc = useStore.use.featureCollection();
  const setFc = useStore.use.updateFeatureCollection();
  const editLocked = useStore.use.editLocked();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView | undefined>(undefined);

  const [errorMessage, setErrorMessage] = useState<string>();

  const extensions = useMemo(
    () => [
      basicSetup,
      ...starryNightTheme,
      json(),
      EditorView.lineWrapping,
      readOnlyCompartment.of(EditorState.readOnly.of(false)),
      EditorView.updateListener.of(function (e) {
        if (e.docChanged) {
          const unparsedJsonString = e.state.doc.toString();
          const fc = useStore.getState().featureCollection;
          const stringifiedFc = JSON.stringify(fc, null, 2);
          // This is important for undo/redo. Why?: it prevents changes via the map from causing a change in the editor which will cause a change in the map.
          // It will make the undo/stack larger.
          if (stringifiedFc === unparsedJsonString) return;
          try {
            const parsedJsonString = JSON.parse(unparsedJsonString);
            const data = v.parse(FeatureCollection, parsedJsonString);
            setErrorMessage(undefined);
            setFc(data);
          } catch (_error) {
            // TODO get the zod error or JSON parse error
            setErrorMessage("Invalid FeatureCollection");
          }
        }
      }),
    ],
    [setFc],
  );

  useEffect(() => {
    const startState = EditorState.create({
      doc: JSON.stringify(emptyFeatureCollection),
      extensions,
    });

    const editorView = new EditorView({
      state: startState,
      parent: editorContainerRef.current ?? undefined,
    });
    editorViewRef.current = editorView;

    return () => {
      // This shouldn't happen until this component is unmounted / no longer needed
      // console.log("Destroying editor view");
      editorViewRef.current?.destroy();
    };
  }, [extensions]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    view.dispatch({
      effects: readOnlyCompartment.reconfigure(EditorState.readOnly.of(editLocked)),
    });
  }, [editLocked]);

  useEffect(() => {
    const view = editorViewRef.current;
    if (!view) return;
    if (view.hasFocus) return;

    setErrorMessage(undefined);
    // Check if its identical, only update if it's not. Prevents infinite render loop.
    const newContent = JSON.stringify(fc, null, 2);
    const currentContent = view.state.doc.toString();
    if (currentContent === newContent) return;

    view.dispatch({
      changes: {
        from: 0,
        to: view.state.doc.length,
        insert: newContent,
      },
    });

    // Alternative syntax:
    // const transaction = view.state.update({
    //   changes: {
    //     from: 0,
    //     to: view.state.doc.length,
    //     insert: newContent,
    //   },
    // });
    // view.dispatch(transaction);
  }, [extensions, fc]);

  return (
    <div className="flex flex-col gap-2 p-2 h-full overflow-hidden bg-background">
      <div className="flex justify-between items-center flex-wrap text-foreground">
        <p className="text-2xl">
          Draw like its{" "}
          <a
            className="underline text-muted-foreground hover:text-foreground"
            target="_blank"
            href="https://excalidraw.com"
            rel="noreferrer"
          >
            excalidraw
          </a>{" "}
          or{" "}
          <a
            className="underline text-muted-foreground hover:text-foreground"
            target="_blank"
            href="https://tldraw.com"
            rel="noreferrer"
          >
            tldraw
          </a>
          , but on a map.
        </p>
        <div className="flex items-center gap-4">
          {!editLocked && (
            <>
              <Trash2
                className="cursor-pointer hover:text-destructive transition-colors"
                onClick={() => setFc(emptyFeatureCollection)}
              />
              <ClearDataAlertDialog />
            </>
          )}
        </div>
      </div>
      <p>
        To learn more, see{" "}
        <a
          className="underline text-muted-foreground hover:text-foreground"
          target="_blank"
          href="https://macwright.com/2015/03/23/geojson-second-bite"
          rel="noreferrer"
        >
          More than you ever wanted to know about GeoJSON
        </a>{" "}
        or{" "}
        <a
          className="underline text-muted-foreground hover:text-foreground"
          target="_blank"
          rel="noreferrer"
          href="https://www.rfc-editor.org/rfc/rfc7946"
        >
          RFC7946
        </a>
        .
      </p>
      {errorMessage && (
        <p>
          <span className="font-bold">Error: </span>
          {errorMessage}
        </p>
      )}
      <div className="flex-1 min-h-0" ref={editorContainerRef}></div>
      {/*Previous display without code mirror:*/}
      {/*<pre className="overflow-auto max-h-full whitespace-pre-wrap">{JSON.stringify(fc, null, 2)}</pre>*/}
    </div>
  );
};
