import { useMemo, useState } from "react";
import Fuse from "fuse.js";
import { useStore } from "@/store/store";
import { QrCodeListItem } from "./QrCodeListItem";
import { Search } from "lucide-react";

export function QrCodeList() {
  const savedQrCodes = useStore.use.savedQrCodes();
  const selectedQrCodeId = useStore.use.selectedQrCodeId();
  const [query, setQuery] = useState("");

  const fuse = useMemo(() => new Fuse(savedQrCodes, { keys: ["name", "data"], threshold: 0.4 }), [savedQrCodes]);

  const filtered = query.trim() ? fuse.search(query).map((r) => r.item) : savedQrCodes;

  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b border-border">
        <div className="relative">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search QR codes..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-sm bg-muted/50 border border-border rounded-md outline-none focus:ring-1 focus:ring-ring placeholder:text-muted-foreground"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-themed">
        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">{query ? "No matches" : "No QR codes saved"}</p>
        ) : (
          filtered.map((qr) => <QrCodeListItem key={qr.id} qrCode={qr} isSelected={qr.id === selectedQrCodeId} />)
        )}
      </div>
    </div>
  );
}
