import maplibregl from "maplibre-gl";
import { indexedDbBackend } from "./indexedDbBackend";
import { nodeBackend } from "./nodeBackend";
import { useStore } from "@/store/store";

// 1x1 transparent PNG as fallback for missing tiles
const TRANSPARENT_1X1_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x00, 0x00, 0x02,
  0x00, 0x01, 0xe5, 0x27, 0xde, 0xfc, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45,
  0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]).buffer;

let registered = false;

export function registerOfflineProtocol(): void {
  if (registered) return;
  registered = true;

  maplibregl.addProtocol("offline", async (params) => {
    // URL format: offline://{z}/{x}/{y}
    const match = params.url.match(/offline:\/\/(\d+)\/(\d+)\/(\d+)/);
    if (!match) {
      return { data: TRANSPARENT_1X1_PNG };
    }

    const z = parseInt(match[1], 10);
    const x = parseInt(match[2], 10);
    const y = parseInt(match[3], 10);

    const backendType = useStore.getState().offlineTileBackend;
    const backend = backendType === "node" ? nodeBackend : indexedDbBackend;

    const data = await backend.getTile(z, x, y);
    if (!data) {
      return { data: TRANSPARENT_1X1_PNG };
    }

    return { data };
  });
}
