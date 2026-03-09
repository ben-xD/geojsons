import posthog from "posthog-js";
import { env } from "@/env";

const token = env.VITE_POSTHOG_PROJECT_TOKEN;

if (token) {
  posthog.init(token, {
    api_host: "https://t.geojsons.com",
    persistence: "memory",
    capture_pageview: true,
    autocapture: true,
  });
}
