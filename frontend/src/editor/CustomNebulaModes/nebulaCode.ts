import {
  Pick,
  // DOens't work, but type says it exists
  // getPickedEditHandle,
} from "@nebula.gl/edit-modes";
// import { getPickedEditHandle } from "@nebula.gl/edit-modes/dist-types";
import { EditHandleFeature } from "@nebula.gl/edit-modes/dist-types/types";
// Working import, but this causes source code to be checked by typescript, and causes hundreds of TS errors:
// import { getPickedEditHandle } from "../../../node_modules/.pnpm/@nebula.gl+edit-modes@1.0.4/node_modules/@nebula.gl/edit-modes/src/utils";
// DOens't work, but type says it exists
// import {getPickedEditHandle} from "@nebula.gl/edit-modes";
// So we end up copy/pasting nebula.gl code here

// If we did use the nebula.gl import, we'd still need to fix the types using declaration merging:
// declare module "@nebula.gl/edit-modes" {
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
