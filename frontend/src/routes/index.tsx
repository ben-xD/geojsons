import { createFileRoute } from "@tanstack/react-router";
import App from "@/App";
import { registerMapboxProtocol } from "@/map/mapboxProtocol";
import { applyHashToStore } from "@/map/useHashViewState";
import { initServiceWorkerPreferenceSync } from "@/offline/syncServiceWorkerPreferences";

let initialized = false;
function initMapApp() {
  if (initialized) return;
  initialized = true;
  registerMapboxProtocol();
  initServiceWorkerPreferenceSync();
  applyHashToStore();
}

export const Route = createFileRoute("/")({
  beforeLoad: () => initMapApp(),
  component: App,
});
