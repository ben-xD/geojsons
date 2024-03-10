import { useStore } from "@/store/store.ts";
import { EditorState } from "@codemirror/state";
import { basicSetup } from "codemirror";
import { EditorView, keymap } from "@codemirror/view";
import { json } from "@codemirror/lang-json";
import { emptyFeatureCollection } from "@/data/featureCollection.ts";
import { useEffect, useMemo, useRef, useState } from "react";

import "@codemirror/lang-json";
import { FeatureCollection } from "@/data/validator/geojson.ts";
import { Trash2 } from "lucide-react";

export const RawGeojsonPanel = () => {
  const fc = useStore.use.featureCollection();
  const setFc = useStore.use.updateFeatureCollection();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView>();

  const [errorMessage, setErrorMessage] = useState<string>();

  const extensions = useMemo(
    () => [
      // EditorView.theme({
      //   // "&": { maxHeight: "100%" },
      //   ".cm-scroller": { overflow: "auto" },
      // }),
      basicSetup,
      json(),
      EditorView.lineWrapping,
      EditorView.updateListener.of(function (e) {
        if (e.docChanged) {
          const unparsedJsonString = e.state.doc.toString();
          const fc = useStore.getState().featureCollection;
          const stringifiedFc = JSON.stringify(fc, null, 2);
          // This is important for undo/redo. Why?: it prevents changes via the map/nebula from causing a change in the editor which will cause a change in the map.
          // It will make the undo/stack larger.
          if (stringifiedFc === unparsedJsonString) return;
          try {
            const parsedJsonString = JSON.parse(unparsedJsonString);
            const data = FeatureCollection.parse(parsedJsonString);
            setErrorMessage(undefined);
            setFc(data);
          } catch (error) {
            // TODO get the zod error or JSON parse error
            setErrorMessage("Invalid FeatureCollection");
          }
        }
      }),
    ],
    [setFc]
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
    <div className="flex flex-col gap-2 m-2">
      <div className="flex justify-between items-center p-2 flex-wrap text-slate-800">
        <h2 className="text-2xl">geojsons.com</h2>
        <Trash2 onClick={() => setFc(emptyFeatureCollection)} />
      </div>
      <p className="text-lg">
        Draw just like its Excalidraw or Figma, on maps.
      </p>
      <p>
        See{" "}
        <a
          className="underline text-slate-600"
          target="_blank"
          href="https://macwright.com/2015/03/23/geojson-second-bite"
          rel="noreferrer"
        >
          More than you ever wanted to know about GeoJSON
        </a>{" "}
        or{" "}
        <a
          className="underline text-slate-600"
          target="_blank"
          rel="noreferrer"
          href="https://www.rfc-editor.org/rfc/rfc7946"
        >
          RFC7946
        </a>{" "}
        to learn more.
      </p>
      {errorMessage && (
        <p>
          <span className="font-bold">Error: </span>
          {errorMessage}
        </p>
      )}
      <div className="" ref={editorContainerRef}></div>
      {/*Previous display without code mirror:*/}
      {/*<pre className="overflow-auto max-h-full whitespace-pre-wrap">{JSON.stringify(fc, null, 2)}</pre>*/}
    </div>
  );
};
