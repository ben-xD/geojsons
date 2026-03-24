import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useStore } from "@/store/store";
import type { SavedQrCode } from "@/store/qrCodesSlice";
import { ChevronLeft, ChevronRight, Copy, Check, ExternalLink, Pencil, X } from "lucide-react";
function formatRelativeTime(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function isValidUrl(str: string): boolean {
  try {
    const url = new URL(str);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function EditableName({ qrCode }: { qrCode: SavedQrCode }) {
  const updateQrCodeName = useStore.use.updateQrCodeName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(qrCode.name);
  const inputRef = useRef<HTMLInputElement>(null);

  const save = () => {
    setEditing(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== qrCode.name) {
      updateQrCodeName(qrCode.id, trimmed);
    } else {
      setDraft(qrCode.name);
    }
  };

  // Focus the input after state update renders it
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        className="text-lg font-semibold text-center bg-transparent border-b border-primary outline-none w-full"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key === "Enter") save();
          if (e.key === "Escape") {
            setDraft(qrCode.name);
            setEditing(false);
          }
        }}
      />
    );
  }

  const dataIsUrl = isValidUrl(qrCode.data);

  return (
    <div className="flex items-center justify-center gap-1.5 w-full group">
      {dataIsUrl && (
        <a
          href={qrCode.data}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-primary transition-colors shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <ExternalLink size={14} />
        </a>
      )}
      <button
        className="text-lg font-semibold text-center hover:text-primary transition-colors cursor-text truncate"
        onClick={(e) => {
          e.stopPropagation();
          setDraft(qrCode.name);
          setEditing(true);
        }}
      >
        {qrCode.name}
      </button>
      <Pencil size={14} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
    </div>
  );
}

function FullscreenQr({ qrCode, onClose }: { qrCode: SavedQrCode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center" onClick={onClose}>
      <button className="absolute top-4 right-4 p-2 rounded-full bg-muted text-foreground hover:bg-muted/80 transition-colors z-10">
        <X size={24} />
      </button>
      <div className="w-full h-full p-6 flex items-center justify-center">
        <div className="bg-white rounded-xl p-4 flex items-center justify-center" style={{ maxWidth: "100%", maxHeight: "100%" }}>
          <QRCodeSVG
            value={qrCode.data}
            size={1000}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
            style={{ width: "auto", height: "100%", maxWidth: "100%", maxHeight: "100%", aspectRatio: "1" }}
          />
        </div>
      </div>
    </div>
  );
}

function CopyableData({ data }: { data: string }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(data);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button
      onClick={copy}
      className="flex items-center gap-1.5 max-w-full px-2 py-1 rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors group"
    >
      <span className="truncate select-all">{data}</span>
      {copied ? <Check size={12} className="shrink-0 text-green-500" /> : <Copy size={12} className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />}
    </button>
  );
}

function QrSlide({ qrCode }: { qrCode: SavedQrCode }) {
  return (
    <div className="flex flex-col items-center gap-2 w-full shrink-0 px-4 h-full overflow-hidden">
      {/* QR code fills remaining space, constrained to square aspect ratio */}
      <div className="flex-1 min-h-0 flex items-center justify-center w-full p-2 overflow-hidden cursor-pointer">
        <div className="bg-white rounded-xl p-3 flex items-center justify-center h-full" style={{ aspectRatio: "1" }}>
          <QRCodeSVG
            value={qrCode.data}
            size={1000}
            level="M"
            bgColor="#ffffff"
            fgColor="#000000"
            style={{ width: "100%", height: "100%", maxWidth: "100%", maxHeight: "100%" }}
          />
        </div>
      </div>
      <div className="shrink-0 flex flex-col items-center gap-1 w-full pb-1" onPointerDown={(e) => e.stopPropagation()}>
        <EditableName key={qrCode.id} qrCode={qrCode} />
        <span className="text-xs text-muted-foreground">{formatRelativeTime(qrCode.scannedAt)}</span>
        <CopyableData data={qrCode.data} />
      </div>
    </div>
  );
}

export function QrCodeDisplay() {
  const savedQrCodes = useStore.use.savedQrCodes();
  const selectedQrCodeId = useStore.use.selectedQrCodeId();
  const selectQrCode = useStore.use.selectQrCode();

  // Default to first item if no selection but codes exist
  const rawIndex = savedQrCodes.findIndex((qr) => qr.id === selectedQrCodeId);
  const currentIndex = rawIndex >= 0 ? rawIndex : 0;

  // Auto-select first item on mount if nothing is selected
  useEffect(() => {
    if (selectedQrCodeId === null && savedQrCodes.length > 0) {
      selectQrCode(savedQrCodes[0].id);
    }
  }, [selectedQrCodeId, savedQrCodes, selectQrCode]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  // Keyboard navigation — skip when user is typing in an input
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (savedQrCodes.length === 0) return;
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        if (currentIndex > 0) selectQrCode(savedQrCodes[currentIndex - 1].id);
      } else if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        if (currentIndex < savedQrCodes.length - 1) selectQrCode(savedQrCodes[currentIndex + 1].id);
      } else if (e.key === "Escape" && fullscreen) {
        setFullscreen(false);
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setFullscreen((f) => !f);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [savedQrCodes, currentIndex, selectQrCode, fullscreen]);

  // Swipe / drag state
  const [dragOffset, setDragOffset] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const pointerStart = useRef<{ x: number; y: number; id: number } | null>(null);
  const isDragging = useRef(false);
  const animationTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const goTo = useCallback(
    (index: number) => {
      const clamped = Math.max(0, Math.min(savedQrCodes.length - 1, index));
      selectQrCode(savedQrCodes[clamped].id);
    },
    [savedQrCodes, selectQrCode],
  );

  const startAnimation = () => {
    clearTimeout(animationTimer.current);
    setIsAnimating(true);
    animationTimer.current = setTimeout(() => setIsAnimating(false), 300);
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (isAnimating) return;
    pointerStart.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
    isDragging.current = false;
    if (savedQrCodes.length > 1) {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current || pointerStart.current.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;

    if (!isDragging.current) {
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy)) {
        isDragging.current = true;
      } else if (Math.abs(dy) > 10) {
        pointerStart.current = null;
        return;
      }
    }

    if (isDragging.current) {
      // Add resistance at edges
      let offset = dx;
      if ((currentIndex === 0 && dx > 0) || (currentIndex === savedQrCodes.length - 1 && dx < 0)) {
        offset = dx * 0.3;
      }
      setDragOffset(offset);
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!pointerStart.current || pointerStart.current.id !== e.pointerId) return;
    const dx = e.clientX - pointerStart.current.x;
    pointerStart.current = null;

    if (!isDragging.current) {
      setDragOffset(0);
      setFullscreen(true);
      return;
    }
    isDragging.current = false;

    const threshold = 50;
    startAnimation();
    setDragOffset(0);

    if (dx < -threshold && currentIndex < savedQrCodes.length - 1) {
      goTo(currentIndex + 1);
    } else if (dx > threshold && currentIndex > 0) {
      goTo(currentIndex - 1);
    }
  };

  const onPointerCancel = () => {
    pointerStart.current = null;
    isDragging.current = false;
    startAnimation();
    setDragOffset(0);
  };

  if (savedQrCodes.length === 0) {
    return (
      <div ref={containerRef} className="h-full flex items-center justify-center text-muted-foreground px-6 text-center">
        <p>Scan a QR code to get started</p>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="h-full flex flex-col overflow-hidden relative select-none">
      {/* Carousel track */}
      <div
        className="flex-1 min-h-0 overflow-hidden"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
        style={{ touchAction: "pan-y" }}
      >
        <div
          className="flex h-full"
          style={{
            transform: `translateX(calc(-${currentIndex * 100}% + ${dragOffset}px))`,
            transition: isAnimating || !isDragging.current ? "transform 300ms ease-out" : "none",
          }}
        >
          {savedQrCodes.map((qr) => (
            <div key={qr.id} className="flex items-center justify-center w-full shrink-0 h-full">
              <QrSlide qrCode={qr} />
            </div>
          ))}
        </div>
      </div>

      {/* Nav arrows — clamped, no wrapping */}
      {savedQrCodes.length > 1 && (
        <>
          {currentIndex > 0 && (
            <button
              className="absolute left-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted/80 text-muted-foreground hover:text-foreground transition-colors z-10"
              onClick={() => {
                startAnimation();
                goTo(currentIndex - 1);
              }}
            >
              <ChevronLeft size={20} />
            </button>
          )}
          {currentIndex < savedQrCodes.length - 1 && (
            <button
              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-full bg-muted/80 text-muted-foreground hover:text-foreground transition-colors z-10"
              onClick={() => {
                startAnimation();
                goTo(currentIndex + 1);
              }}
            >
              <ChevronRight size={20} />
            </button>
          )}
        </>
      )}

      {/* Dot indicators */}
      {savedQrCodes.length > 1 && (
        <div className="flex gap-1.5 justify-center pb-2">
          {savedQrCodes.map((qr, i) => (
            <button
              key={qr.id}
              className={`w-2 h-2 rounded-full transition-colors ${i === currentIndex ? "bg-primary" : "bg-muted-foreground/30"}`}
              onClick={() => {
                startAnimation();
                goTo(i);
              }}
            />
          ))}
        </div>
      )}

      {/* Fullscreen overlay */}
      {fullscreen && savedQrCodes[currentIndex] && (
        <FullscreenQr qrCode={savedQrCodes[currentIndex]} onClose={() => setFullscreen(false)} />
      )}
    </div>
  );
}
