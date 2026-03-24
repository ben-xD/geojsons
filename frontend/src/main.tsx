import ReactDOM from "react-dom/client";
import { createRouter, RouterProvider } from "@tanstack/react-router";
import { registerSW } from "virtual:pwa-register";
import "./index.css";
import { routeTree } from "./routeTree.gen";

registerSW({
  immediate: true,
  onRegisteredSW(_swUrl, registration) {
    registration?.update();
  },
});

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const rootElement = document.getElementById("root");

if (rootElement === null) {
  throw new Error("No root element found");
}

// StrictMode disabled due to deck.gl + luma.gl bug: React 18+ StrictMode double-mounts components,
// and when DeckGL unmounts, the luma.gl WebGL device is destroyed. But the ResizeObserver callback
// fires asynchronously after destruction, accessing device.limits.maxTextureDimension2D on a
// destroyed device. This is a missing null guard in @luma.gl/core CanvasContext._handleResize.
ReactDOM.createRoot(rootElement).render(<RouterProvider router={router} />);
