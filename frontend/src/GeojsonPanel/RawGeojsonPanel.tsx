import { useBoundStore } from "@/store/store.ts";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { emptyFeatureCollection } from "@/data/featureCollection.ts";
import { useEffect, useMemo, useRef, useState } from "react";

import "@codemirror/lang-json";
import { FeatureCollection } from "@/data/validator/geojson.ts";

export const RawGeojsonPanel = () => {
  const fc = useBoundStore.use.featureCollection();
  const setFc = useBoundStore.use.updateFeatureCollection();
  const [userUpdatedFc, setUserUpdatedFc] = useState<FeatureCollection>();
  const editorContainerRef = useRef<HTMLDivElement>(null);
  const editorViewRef = useRef<EditorView>();

  const [errorMessage, setErrorMessage] = useState<string>();

  const extensions = useMemo(
    () => [
      keymap.of(defaultKeymap),
      json(),
      EditorView.lineWrapping,
      EditorView.updateListener.of(function (e) {
        if (e.docChanged) {
          try {
            const unparsedJsonString = e.state.doc.toString();
            const parsedJsonString = JSON.parse(unparsedJsonString);
            const data = FeatureCollection.parse(parsedJsonString);
            setErrorMessage(undefined);
            setUserUpdatedFc(data);
          } catch (error) {
            // TODO get the zod error or JSON parse error
            setErrorMessage("Invalid FeatureCollection");
          }
        }
      }),
    ],
    [setUserUpdatedFc],
  );

  useEffect(() => {
    // const styleExtension = EditorView.theme({
    //   "&": {maxHeight: "100%"},
    //   ".cm-scroller": {overflow: "auto"}
    // })

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
      editorViewRef.current?.destroy();
    };
  }, [extensions]);

  useEffect(() => {
    setErrorMessage(undefined);
    editorViewRef.current?.setState(
      EditorState.create({
        doc: JSON.stringify(fc, null, 2),
        extensions,
      }),
    );
  }, [extensions, fc]);

  useEffect(() => {
    if (userUpdatedFc) setFc(userUpdatedFc);
  }, [setFc, userUpdatedFc]);

  return (
    <div className="flex flex-col gap-2 w-full m-2">
      <h2 className="text-2xl text-slate-800">geojsons.com</h2>
      <p className="text-lg">Figma-level intuitiveness for maps.</p>
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
      <div className="overflow-auto max-h-full" ref={editorContainerRef}></div>
      {/*Previous display without code mirror:*/}
      {/*<pre className="overflow-auto max-h-full whitespace-pre-wrap">{JSON.stringify(fc, null, 2)}</pre>*/}
    </div>
  );
};
