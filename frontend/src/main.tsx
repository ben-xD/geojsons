import ReactDOM from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { registerMapboxProtocol } from "./map/mapboxProtocol.ts";
import { applyHashToStore } from "./map/useHashViewState.ts";
import { ThemeProvider } from "./components/theme-provider.tsx";

registerMapboxProtocol();
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
  <ThemeProvider>
    <App />
  </ThemeProvider>,
);
