import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import { registerMapboxProtocol } from "./map/mapboxProtocol.ts";
import { applyHashToStore } from "./map/useHashViewState.ts";
import { PostHogProvider } from "@posthog/react";
import { ThemeProvider } from "./components/theme-provider.tsx";
import { initServiceWorkerPreferenceSync } from "./offline/syncServiceWorkerPreferences.ts";
import { posthog } from "./posthog.ts";

const queryClient = new QueryClient();

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    // Force an update check on every page load so users get the latest version
    // without needing a hard refresh
    registration?.update();
  },
});
registerMapboxProtocol();
initServiceWorkerPreferenceSync();
applyHashToStore();

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("No root element found");
}

// StrictMode disabled due to deck.gl + luma.gl bug: React 18+ StrictMode double-mounts components,
// and when DeckGL unmounts, the luma.gl WebGL device is destroyed. But the ResizeObserver callback
// fires asynchronously after destruction, accessing device.limits.maxTextureDimension2D on a
// destroyed device. This is a missing null guard in @luma.gl/core CanvasContext._handleResize.
//
// Uncaught TypeError: Cannot read properties of undefined (reading 'maxTextureDimension2D')
//     at WebGLCanvasContext.getMaxDrawingBufferSize
//     at WebGLCanvasContext._handleResize
//     at ResizeObserver.<anonymous>
ReactDOM.createRoot(rootElement).render(
  <PostHogProvider client={posthog}>
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </QueryClientProvider>
  </PostHogProvider>,
);
