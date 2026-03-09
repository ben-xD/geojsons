import type { GeojsonsStateCreator } from "./store";

export interface AnalyticsSlice {
  analyticsEnabled: boolean;
  setAnalyticsEnabled: (enabled: boolean) => void;
}

export const createAnalyticsSlice: GeojsonsStateCreator<AnalyticsSlice> = (set) => ({
  analyticsEnabled: true,
  setAnalyticsEnabled: (enabled) =>
    set((state) => {
      state.analyticsEnabled = enabled;
    }),
});
