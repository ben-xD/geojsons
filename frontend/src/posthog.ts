import posthog from "posthog-js";
import { env } from "@/env";

const token = env.VITE_POSTHOG_PROJECT_TOKEN;
const host = env.VITE_PUBLIC_POSTHOG_HOST;

if (token && host) {
  posthog.init(token, {
    api_host: host,
    // "memory" breaks session recordings; "localStorage" avoids cookies while keeping recordings working
    persistence: "localStorage",
    capture_pageview: true,
    autocapture: true,
  });

  // Respect persisted analytics preference (zustand store in localStorage)
  try {
    const stored = JSON.parse(localStorage.getItem("geojsons.com") || "{}");
    if (stored?.state?.analyticsEnabled === false) {
      posthog.opt_out_capturing();
    }
  } catch {
    // ignore parse errors
  }
}

export { posthog };
