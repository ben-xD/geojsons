// Working import, but this causes source code to be checked by typescript, and causes hundreds of TS errors:
// import { getPickedEditHandle } from "../../../node_modules/.pnpm/@nebula.gl+edit-modes@1.0.4/node_modules/@nebula.gl/edit-modes/src/utils";
// DOens't work, but type says it exists
// import {getPickedEditHandle} from "@deck.gl-community/editable-layers";
// So we end up copy/pasting deck.gl code here

// If we did use the nebula.gl import, we'd still need to fix the types using declaration merging:
// declare module "@deck.gl-community/editable-layers" {
//     export function getPickedEditHandle(
//       picks: Pick[] | null | undefined
//     ): EditHandleFeature | null | undefined;
//   }

export function getPickedEditHandles(
  picks: Pick[] | null | undefined,
): EditHandleFeature[] {
  const handles =
    (picks &&
      picks
        .filter(
          (pick) =>
            pick.isGuide && pick.object.properties.guideType === "editHandle",
        )
        .map((pick) => pick.object)) ||
    [];

  return handles;
}

export function getPickedEditHandle(
  picks: Pick[] | null | undefined,
): EditHandleFeature | null | undefined {
  const handles = getPickedEditHandles(picks);
  return handles.length ? handles[0] : null;
}
