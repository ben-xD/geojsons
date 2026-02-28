export const primaryTentativeLineRgba = [128, 109, 222, 255];

export const primaryTentativeFillRgba = [128, 109, 222, 50];

// Feature colors per map variant
export const featureColors = {
  vector: {
    fill: [57, 62, 65, 25] as const,
    fillSelected: [57, 62, 65, 50] as const,
    line: [57, 62, 65, 200] as const,
    highlight: [57, 62, 65, 50] as const,
    marker: "rgb(65, 90, 119)",
  },
  satellite: {
    fill: [255, 255, 80, 40] as const,
    fillSelected: [255, 255, 80, 80] as const,
    line: [255, 255, 80, 230] as const,
    highlight: [255, 255, 80, 60] as const,
    marker: "rgb(255, 255, 80)",
  },
} as const;
