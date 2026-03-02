import { useStoreOriginal } from "@/store/store";

type OfflineTileBackend = "indexeddb" | "node";

interface OfflinePreferencesMessage {
  type: "OFFLINE_PREFERENCES";
  payload: {
    preferOffline: boolean;
    offlineTileBackend: OfflineTileBackend;
  };
}

let started = false;

function buildMessage(
  preferOffline: boolean,
  offlineTileBackend: OfflineTileBackend,
): OfflinePreferencesMessage {
  return {
    type: "OFFLINE_PREFERENCES",
    payload: { preferOffline, offlineTileBackend },
  };
}

function postMessageToServiceWorkers(message: OfflinePreferencesMessage): void {
  if (!("serviceWorker" in navigator)) return;

  navigator.serviceWorker.controller?.postMessage(message);

  void navigator.serviceWorker.ready.then((registration) => {
    registration.active?.postMessage(message);
    registration.waiting?.postMessage(message);
    registration.installing?.postMessage(message);
  });
}

function broadcastCurrentPreferences(): void {
  const state = useStoreOriginal.getState();
  postMessageToServiceWorkers(buildMessage(state.preferOffline, state.offlineTileBackend));
}

export function initServiceWorkerPreferenceSync(): void {
  if (started || !("serviceWorker" in navigator)) return;
  started = true;

  broadcastCurrentPreferences();
  navigator.serviceWorker.addEventListener("controllerchange", broadcastCurrentPreferences);

  useStoreOriginal.subscribe(
    (state) => state.preferOffline,
    () => {
      broadcastCurrentPreferences();
    },
  );

  useStoreOriginal.subscribe(
    (state) => state.offlineTileBackend,
    () => {
      broadcastCurrentPreferences();
    },
  );
}
