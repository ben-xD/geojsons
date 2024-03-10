import {FeatureCollection} from "@/data/validator/geojson";

export const emptyFeatureCollection: FeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

// const testFeatureCollection: FeatureCollection = {
//   type: "FeatureCollection",
//   features: [
//     // first feature is at the bottom of the stack
//     circleOverIreland,
//     polygonOverEngland,
//     pointInSouthUK,
//     pointInLondon,
//     // Last one goes in front
//   ],
// };