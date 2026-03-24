import { v4 as uuidv4 } from "uuid";
import { GeojsonsStateCreator } from "./store";

export interface SavedQrCode {
  id: string;
  name: string;
  data: string;
  scannedAt: number;
}

export interface QrCodesSlice {
  savedQrCodes: SavedQrCode[];
  selectedQrCodeId: string | null;
  addQrCode: (data: string) => void;
  removeQrCode: (id: string) => void;
  updateQrCodeName: (id: string, name: string) => void;
  selectQrCode: (id: string | null) => void;
}

export const createQrCodesSlice: GeojsonsStateCreator<QrCodesSlice> = (set, get) => ({
  savedQrCodes: [],
  selectedQrCodeId: null,
  addQrCode: (data) =>
    set((state) => {
      const id = uuidv4();
      state.savedQrCodes.unshift({
        id,
        name: `QR #${get().savedQrCodes.length + 1}`,
        data,
        scannedAt: Date.now(),
      });
      state.selectedQrCodeId = id;
    }),
  removeQrCode: (id) =>
    set((state) => {
      state.savedQrCodes = state.savedQrCodes.filter((qr) => qr.id !== id);
      if (state.selectedQrCodeId === id) {
        state.selectedQrCodeId = state.savedQrCodes[0]?.id ?? null;
      }
    }),
  updateQrCodeName: (id, name) =>
    set((state) => {
      const qr = state.savedQrCodes.find((q) => q.id === id);
      if (qr) qr.name = name;
    }),
  selectQrCode: (id) =>
    set((state) => {
      state.selectedQrCodeId = id;
    }),
});
